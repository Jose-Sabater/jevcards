/**
 * Geography cards beyond "tap country X": silhouettes, true-size comparisons, the Mercator size trap,
 * borders and coastlines. Everything is drawn with d3-geo from Natural Earth (world-atlas, 1:50m), and every
 * answer is computed from the same data the picture is drawn from:
 *   sizes       d3.geoArea on the country's polygons (km2 on a 6371 km sphere)
 *   borders     topojson neighbors (countries that share an arc)
 *   coastlines  a country has a coast when one of its arcs belongs to no other country. The 1:50m countries
 *               tile the land with no gaps, so an unshared arc is a shore (or the Caspian, which no card here
 *               touches). The resulting landlocked list matches the usual one.
 */
import { geoAzimuthalEqualArea, geoArea, geoCentroid, geoDistance, geoEqualEarth, geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature, neighbors } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { H, W, defineCard, esc, inside, svgDoc, type CardSpec, type Option, type Region } from './lib.ts';

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8')) as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const geoms = topo.objects.countries.geometries;
const world = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;
const countries = world.features.filter((f) => f.id !== '010'); // no Antarctica

const OCEAN = '#CFE6F5';
const LAND = '#F1ECE1';
const BORDER = '#6E6E6E';
const HIGHLIGHT = '#E8743B';
const INK = '#26313D';
const PAPER = '#F7F4EE';
const R_KM = 6371.0088;

type Country = Feature<Geometry, { name: string }>;

/** The country with this ISO numeric id (the largest one when ids repeat, as Australia's does). */
function country(id: string): Country {
  const all = countries.filter((c) => c.id === id);
  if (!all.length) throw new Error(`geo: no country ${id}`);
  return all.reduce((a, b) => (geoArea(b) > geoArea(a) ? b : a));
}

const areaKm2 = (f: Feature | Geometry) => geoArea(f as Feature) * R_KM * R_KM;

/** Index into the topology's geometries, matched by id and name so repeated ids stay apart. */
function geomIndex(id: string): number {
  const name = country(id).properties.name;
  const i = geoms.findIndex((g) => g.id === id && (g.properties as { name?: string } | undefined)?.name === name);
  if (i < 0) throw new Error(`geo: no geometry ${id}`);
  return i;
}

const nb = neighbors(geoms as never[]);
const bordersOf = (id: string) => new Set(nb[geomIndex(id)].map((j) => geoms[j].id as string));

const arcUse = new Map<number, number>();
const arcsOf = (g: { arcs?: unknown }): number[] => {
  const out: number[] = [];
  const walk = (a: unknown) => (typeof a === 'number' ? out.push(a < 0 ? ~a : a) : Array.isArray(a) && a.forEach(walk));
  walk(g.arcs);
  return [...new Set(out)];
};
for (const g of geoms) for (const a of arcsOf(g as { arcs?: unknown })) arcUse.set(a, (arcUse.get(a) ?? 0) + 1);
/** Has a coast: some arc of its outline is shared with no other country. */
const hasCoast = (id: string) => arcsOf(geoms[geomIndex(id)] as { arcs?: unknown }).some((a) => arcUse.get(a) === 1);

/** Only the parts of a country near its biggest polygon (drops Easter Island from Chile, and so on). */
function mainParts(f: Country, maxDeg: number): Country {
  if (f.geometry.type !== 'MultiPolygon') return f;
  const polys = (f.geometry as MultiPolygon).coordinates.map((c): Polygon => ({ type: 'Polygon', coordinates: c }));
  const big = polys.reduce((a, b) => (geoArea(b) > geoArea(a) ? b : a));
  const c = geoCentroid(big);
  const keep = polys.filter((q) => geoDistance(geoCentroid(q), c) <= (maxDeg * Math.PI) / 180);
  return { ...f, geometry: { type: 'MultiPolygon', coordinates: keep.map((q) => q.coordinates) } };
}

/** A projection's outline of a feature as fraction rings. */
function ringsOf(p: GeoProjection, f: Feature): Region {
  const rings: [number, number][][] = [];
  let ring: [number, number][] = [];
  const ctx = {
    moveTo(x: number, y: number) {
      if (ring.length > 2) rings.push(ring);
      ring = [[x / W, y / H]];
    },
    lineTo(x: number, y: number) {
      ring.push([x / W, y / H]);
    },
    closePath() {
      if (ring.length > 2) rings.push(ring);
      ring = [];
    },
    arc() {},
  };
  geoPath(p, ctx as unknown as CanvasRenderingContext2D)(f);
  if (ring.length > 2) rings.push(ring);
  return { type: 'poly', rings };
}

function boxPoints(lon: [number, number], lat: [number, number]) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const a = lon[0] + ((lon[1] - lon[0]) * i) / 20;
    const b = lat[0] + ((lat[1] - lat[0]) * i) / 20;
    pts.push([a, lat[0]], [a, lat[1]], [lon[0], b], [lon[1], b]);
  }
  return { type: 'MultiPoint' as const, coordinates: pts };
}

function equalArea(lon: [number, number], lat: [number, number]): GeoProjection {
  return geoAzimuthalEqualArea()
    .rotate([-(lon[0] + lon[1]) / 2, -(lat[0] + lat[1]) / 2])
    .clipAngle(90)
    .fitExtent([[24, 24], [W - 24, H - 24]], boxPoints(lon, lat))
    .clipExtent([[0, 0], [W, H]]);
}

function mercator(lon: [number, number], lat: [number, number]): GeoProjection {
  return geoMercator()
    .rotate([-(lon[0] + lon[1]) / 2, 0])
    .fitExtent([[24, 24], [W - 24, H - 24]], boxPoints(lon, lat))
    .clipExtent([[0, 0], [W, H]]);
}

/** Fills for lettered countries, one each so shared borders stay visible. */
const MARKS = ['#E8743B', '#4FA36B', '#8E6BBF', '#D9A82E'];

function mapLayer(p: GeoProjection, highlight: string[] = [], fills: string[] = []): string {
  const path = geoPath(p);
  return countries
    .map((f) => {
      const d = path(f);
      if (!d) return '';
      const k = highlight.indexOf(f.id as string);
      const fill = k < 0 ? LAND : (fills[k] ?? HIGHLIGHT);
      return `<path d="${d}" fill="${fill}" stroke="${BORDER}" stroke-width="1" stroke-linejoin="round"/>`;
    })
    .join('');
}

function badge(x: number, y: number, letter: string): string {
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="25" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/><text x="${x.toFixed(1)}" y="${(y + 11).toFixed(1)}" font-family="Arial, Helvetica" font-size="31" font-weight="bold" text-anchor="middle" fill="${INK}">${letter}</text>`;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

interface Marked {
  iso: string;
  label: string;
  /** Where the letter goes, [lon, lat], inside the country. Defaults to its centroid. */
  at?: [number, number];
  /** Where the letter badge goes when the country is too small to hold it, [lon, lat]; a line joins it to `at`. */
  badgeAt?: [number, number];
}

/** Several countries filled in different colours and lettered A, B, C... Each option's region is its country's outline. */
function markedMap(p: GeoProjection, items: Marked[], cardId: string): { svg: string; options: Option[] } {
  const letters = 'ABCDEFGH';
  const regions = items.map((it) => ringsOf(p, country(it.iso)));
  const spots = items.map((it) => p(it.at ?? geoCentroid(country(it.iso)))!);
  items.forEach((it, i) => {
    const [x, y] = [spots[i][0] / W, spots[i][1] / H];
    if (!inside(regions[i], x, y)) throw new Error(`geo: ${cardId}: letter of ${it.label} is not inside it`);
    regions.forEach((r, j) => {
      if (j !== i && inside(r, x, y, 0.01)) throw new Error(`geo: ${cardId}: letter of ${it.label} is inside ${items[j].label}`);
    });
  });
  const marks = items.map((it, i) => {
    if (!it.badgeAt) return badge(spots[i][0], spots[i][1], letters[i]);
    const [bx, by] = p(it.badgeAt)!;
    const [sx, sy] = spots[i];
    return `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${INK}" stroke-width="3"/><circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="5" fill="${INK}"/>${badge(bx, by, letters[i])}`;
  });
  const svg = svgDoc(mapLayer(p, items.map((i) => i.iso), MARKS) + marks.join(''), OCEAN);
  const options = items.map((it, i) => ({ id: slug(it.label), label: it.label, region: regions[i], jev: `The coloured country marked ${letters[i]}.` }));
  return { svg, options };
}

// ---------------------------------------------------------------------------------------------- silhouettes

function shapeCard(o: { id: string; iso: string; options: string[]; answer: string; difficulty: 1 | 2 | 3; explain: string; maxDeg?: number }): CardSpec {
  if (!o.options.includes(o.answer)) throw new Error(`geo: ${o.id} answer not in options`);
  const f = mainParts(country(o.iso), o.maxDeg ?? 25);
  const c = geoCentroid(f);
  const p = geoAzimuthalEqualArea().rotate([-c[0], -c[1]]).fitExtent([[90, 50], [W - 90, H - 50]], f);
  const d = geoPath(p)(f)!;
  return defineCard({
    id: o.id,
    title: 'Name the shape',
    category: 'maps',
    difficulty: o.difficulty,
    prompt: 'Which country is this?',
    kind: 'buttons',
    svg: svgDoc(`<path d="${d}" fill="${INK}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`, PAPER),
    options: o.options.map((n) => ({ id: slug(n), label: n, jev: n })),
    answer: slug(o.answer),
    explain: o.explain,
    jev: {
      context: 'The outline of one country on its own, filled dark, north up, with no map, borders or labels around it.',
      instructions: 'Which country has the outline shown in `card`?',
    },
    source: 'drawn',
  });
}

// --------------------------------------------------------------------------------------------- true sizes

/** Two countries side by side, each in its own equal-area projection at one shared scale, so areas compare. */
function sameScaleCard(o: { id: string; a: string; b: string; names: [string, string]; difficulty: 1 | 2 | 3; explain: string }): CardSpec {
  const fs = [mainParts(country(o.a), 25), mainParts(country(o.b), 25)];
  const boxW = W / 2 - 50, boxH = H - 170;
  const projs = fs.map((f) => {
    const c = geoCentroid(f);
    return geoAzimuthalEqualArea().rotate([-c[0], -c[1]]).fitExtent([[0, 0], [boxW, boxH]], f);
  });
  const scale = Math.min(...projs.map((p) => p.scale()));
  const body: string[] = [];
  const regions: Region[] = [];
  projs.forEach((p, i) => {
    p.scale(scale).translate([0, 0]);
    const [[x0, y0], [x1, y1]] = geoPath(p).bounds(fs[i]);
    const cx = i === 0 ? W / 4 : (3 * W) / 4, cy = 40 + boxH / 2;
    p.translate([cx - (x0 + x1) / 2, cy - (y0 + y1) / 2]);
    body.push(`<path d="${geoPath(p)(fs[i])}" fill="${HIGHLIGHT}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`);
    body.push(`<text x="${cx}" y="${H - 50}" font-family="Arial, Helvetica" font-size="40" font-weight="bold" text-anchor="middle" fill="${INK}">${esc(o.names[i])}</text>`);
    regions.push(ringsOf(p, fs[i]));
  });
  body.push(`<line x1="${W / 2}" y1="40" x2="${W / 2}" y2="${H - 110}" stroke="#C9C2B4" stroke-width="2" stroke-dasharray="8 8"/>`);
  const [areaA, areaB] = fs.map(areaKm2);
  if (Math.abs(areaA - areaB) / Math.max(areaA, areaB) < 0.05) throw new Error(`geo: ${o.id} is too close to call`);
  const answer = areaA > areaB ? 0 : 1;
  return defineCard({
    id: o.id,
    title: 'Same scale',
    category: 'maps',
    difficulty: o.difficulty,
    prompt: 'Tap the bigger country.',
    kind: 'pick',
    svg: svgDoc(body.join(''), PAPER),
    options: [0, 1].map((i) => ({ id: slug(o.names[i]), label: o.names[i], region: regions[i], jev: i === 0 ? 'The country on the left.' : 'The country on the right.' })),
    answer: slug(o.names[answer]),
    explain: o.explain,
    jev: {
      context: 'Two countries drawn side by side at the same scale with an equal-area projection, each named underneath.',
      instructions: 'Which of the two countries in `card` has the larger area?',
    },
    source: 'drawn',
  });
}

/** Two countries marked on a Mercator map; the question is which is larger on the ground. */
function mercatorCard(o: { id: string; lon: [number, number]; lat: [number, number]; items: Marked[]; region: string; difficulty: 1 | 2 | 3; explain: string }): CardSpec {
  const p = mercator(o.lon, o.lat);
  const { svg, options } = markedMap(p, o.items, o.id);
  const areas = o.items.map((it) => areaKm2(country(it.iso)));
  const best = areas.indexOf(Math.max(...areas));
  // The trap only works when the map shows the smaller one bigger.
  const drawn = o.items.map((it) => geoPath(p).area(country(it.iso)));
  if (drawn.indexOf(Math.max(...drawn)) === best) throw new Error(`geo: ${o.id}: the Mercator map already shows the bigger one bigger`);
  return defineCard({
    id: o.id,
    title: 'Mercator trap',
    category: 'maps',
    difficulty: o.difficulty,
    prompt: 'Which is bigger in real life?',
    kind: 'pick',
    svg,
    options,
    answer: options[best].id,
    explain: o.explain,
    jev: {
      context: `A Mercator map of ${o.region} with no labels; two countries are filled in colour and marked with letters.`,
      instructions: 'Which of the lettered countries in `card` has the larger real area on the ground?',
    },
    source: 'drawn',
  });
}

// ------------------------------------------------------------------------------------ borders and coasts

function notBorderCard(o: { id: string; iso: string; name: string; p: GeoProjection; region: string; options: [string, string][]; answer: string; difficulty: 1 | 2 | 3; explain: string }): CardSpec {
  const near = bordersOf(o.iso);
  for (const [n, iso] of o.options) {
    if ((n === o.answer) === near.has(iso)) throw new Error(`geo: ${o.id}: ${n} ${near.has(iso) ? 'borders' : 'does not border'} ${o.name}`);
  }
  return defineCard({
    id: o.id,
    title: 'Next door',
    category: 'maps',
    difficulty: o.difficulty,
    prompt: `Which country does NOT border ${o.name}?`,
    kind: 'buttons',
    svg: svgDoc(mapLayer(o.p, [o.iso]), OCEAN),
    options: o.options.map(([n]) => ({ id: slug(n), label: n, jev: n })),
    answer: slug(o.answer),
    explain: o.explain,
    jev: {
      context: `A map of ${o.region} with country borders and no labels, with ${o.name} filled in orange.`,
      instructions: `Which of these countries does not share a land border with ${o.name} in \`card\`?`,
    },
    source: 'drawn',
  });
}

function coastCard(o: {
  id: string;
  p: GeoProjection;
  region: string;
  items: Marked[];
  want: 'landlocked' | 'no-land-border';
  difficulty: 1 | 2 | 3;
  explain: string;
}): CardSpec {
  const { svg, options } = markedMap(o.p, o.items, o.id);
  const fits = o.items.map((it) => (o.want === 'landlocked' ? !hasCoast(it.iso) : bordersOf(it.iso).size === 0));
  if (fits.filter(Boolean).length !== 1) throw new Error(`geo: ${o.id}: ${fits.filter(Boolean).length} countries fit`);
  const prompt = o.want === 'landlocked' ? 'Tap the landlocked country.' : 'Tap the country with no land border.';
  return defineCard({
    id: o.id,
    title: o.want === 'landlocked' ? 'No coast' : 'No neighbours',
    category: 'maps',
    difficulty: o.difficulty,
    prompt,
    kind: 'pick',
    svg,
    options,
    answer: options[fits.indexOf(true)].id,
    explain: o.explain,
    jev: {
      context: `A map of ${o.region} with country borders and no labels; four countries are filled in different colours and marked with letters.`,
      instructions:
        o.want === 'landlocked'
          ? 'Which lettered country in `card` has no coastline at all?'
          : 'Which lettered country in `card` shares no land border with any other country?',
    },
    source: 'drawn',
  });
}

/** A world map (Equal Earth) with one country filled orange, all its parts included. */
function worldWith(iso: string, lon: [number, number], lat: [number, number]): string {
  const p = geoEqualEarth()
    .rotate([-(lon[0] + lon[1]) / 2, 0])
    .fitExtent([[24, 24], [W - 24, H - 24]], boxPoints(lon, lat))
    .clipExtent([[0, 0], [W, H]]);
  return svgDoc(mapLayer(p, [iso]), OCEAN);
}

function franceBorderCard(): CardSpec {
  const near = bordersOf('250');
  const opts: [string, string][] = [['Portugal', '620'], ['Brazil', '076'], ['Austria', '040'], ['Denmark', '208']];
  for (const [n, iso] of opts) if ((n === 'Brazil') !== near.has(iso)) throw new Error(`geo: france border check failed on ${n}`);
  return defineCard({
    id: 'geo-france-borders-brazil',
    title: 'Next door',
    category: 'maps',
    difficulty: 2,
    prompt: 'Which country shares a land border with France?',
    kind: 'buttons',
    svg: worldWith('250', [-95, 45], [-25, 62]),
    options: opts.map(([n]) => ({ id: slug(n), label: n, jev: n })),
    answer: 'brazil',
    explain: 'French Guiana in South America is part of France, and its 730 km border with Brazil is the longest land border France has; Portugal, Austria and Denmark never touch France.',
    jev: {
      context: 'A map of Europe, Africa and the Americas with country borders and no labels, with every part of France filled in orange.',
      instructions: 'Which of these countries shares a land border with France, as shown in `card`?',
    },
    source: 'drawn',
  });
}

// ------------------------------------------------------------------------------------------------- deck

const brazil = areaKm2(mainParts(country('076'), 25)), australia = areaKm2(mainParts(country('036'), 25));
if (!(brazil > australia)) throw new Error('geo: Brazil should be bigger than Australia');

export default [
  shapeCard({
    id: 'geo-shape-italy',
    iso: '380',
    options: ['Greece', 'Italy', 'Croatia', 'Spain'],
    answer: 'Italy',
    difficulty: 1,
    explain: 'The boot kicking the island of Sicily, with Sardinia to the west, is Italy.',
  }),
  shapeCard({
    id: 'geo-shape-chile',
    iso: '152',
    options: ['Norway', 'Argentina', 'Peru', 'Chile'],
    answer: 'Chile',
    difficulty: 2,
    explain: 'Chile runs about 4,300 km north to south but is rarely more than 350 km wide, breaking into islands at its southern tip.',
  }),
  shapeCard({
    id: 'geo-shape-japan',
    iso: '392',
    options: ['Philippines', 'Japan', 'New Zealand', 'Indonesia'],
    answer: 'Japan',
    difficulty: 2,
    explain: 'Four main islands in a curving arc, Hokkaido at the top, then Honshu, Shikoku and Kyushu, make Japan.',
  }),
  shapeCard({
    id: 'geo-shape-india',
    iso: '356',
    options: ['Pakistan', 'Saudi Arabia', 'India', 'Mexico'],
    answer: 'India',
    difficulty: 1,
    explain: 'The big triangle pointing south into the Indian Ocean, with the northeast states reaching out to the right, is India.',
  }),
  shapeCard({
    id: 'geo-shape-uk',
    iso: '826',
    options: ['Ireland', 'Iceland', 'United Kingdom', 'New Zealand'],
    answer: 'United Kingdom',
    difficulty: 2,
    explain: 'Great Britain with Northern Ireland, the piece on the left, is the United Kingdom; the rest of the island of Ireland is a separate country.',
  }),
  mercatorCard({
    id: 'geo-mercator-greenland-congo',
    lon: [-75, 45],
    lat: [-22, 83],
    region: 'the Atlantic and Africa',
    items: [
      { iso: '304', label: 'Greenland', at: [-41, 72] },
      { iso: '180', label: 'DR Congo', at: [23.5, -2.5], badgeAt: [0, -10] },
    ],
    difficulty: 3,
    explain: `DR Congo is about ${Math.round(areaKm2(country('180')) / 1e4) / 100} million km2 and Greenland about ${Math.round(areaKm2(country('304')) / 1e4) / 100} million; Mercator stretches land more the further it is from the equator, so Greenland looks several times bigger than it is.`,
  }),
  mercatorCard({
    id: 'geo-mercator-spain-finland',
    lon: [-12, 32],
    lat: [35, 70],
    region: 'Europe',
    items: [
      { iso: '246', label: 'Finland', at: [26, 63] },
      { iso: '724', label: 'Spain', at: [-3.7, 40.2] },
    ],
    difficulty: 3,
    explain: 'Spain is about 506,000 km2 and Finland about 338,000, yet Mercator stretches Finland, far to the north, to look about twice the size of Spain.',
  }),
  sameScaleCard({
    id: 'geo-same-scale-brazil-australia',
    a: '036',
    b: '076',
    names: ['Australia', 'Brazil'],
    difficulty: 2,
    explain: `Brazil is about ${(brazil / 1e6).toFixed(1)} million km2 and mainland Australia with Tasmania about ${(australia / 1e6).toFixed(1)} million, so Brazil is roughly a tenth bigger.`,
  }),
  notBorderCard({
    id: 'geo-not-bordering-germany',
    iso: '276',
    name: 'Germany',
    p: equalArea([0, 26], [44, 57]),
    region: 'central Europe',
    options: [['Austria', '040'], ['Slovakia', '703'], ['Denmark', '208'], ['Czechia', '203'], ['Poland', '616']],
    answer: 'Slovakia',
    difficulty: 2,
    explain: 'Slovakia lies east of Czechia and north of Hungary; Czechia and Austria sit between it and Germany.',
  }),
  notBorderCard({
    id: 'geo-not-bordering-brazil',
    iso: '076',
    name: 'Brazil',
    p: equalArea([-82, -34], [-56, 13]),
    region: 'South America',
    options: [['Peru', '604'], ['Venezuela', '862'], ['Ecuador', '218'], ['Uruguay', '858'], ['Colombia', '170']],
    answer: 'Ecuador',
    difficulty: 2,
    explain: 'Brazil borders every South American country except Chile and Ecuador; Peru and Colombia keep Ecuador away from it.',
  }),
  franceBorderCard(),
  coastCard({
    id: 'geo-no-land-border-philippines',
    p: equalArea([94, 156], [-12, 22]),
    region: 'Southeast Asia',
    want: 'no-land-border',
    items: [
      { iso: '360', label: 'Indonesia', at: [113.5, -1.5] },
      { iso: '458', label: 'Malaysia', at: [102.3, 4.3] },
      { iso: '608', label: 'Philippines', at: [121.2, 16.2] },
      { iso: '598', label: 'Papua New Guinea', at: [144, -6] },
    ],
    difficulty: 3,
    explain: 'The Philippines is all islands with no land border; Indonesia is islands too, but shares Borneo with Malaysia, New Guinea with Papua New Guinea, and Timor with Timor-Leste.',
  }),
  coastCard({
    id: 'geo-landlocked-hungary',
    p: equalArea([2, 24], [41, 52]),
    region: 'central Europe and the Balkans',
    want: 'landlocked',
    items: [
      { iso: '056', label: 'Belgium', at: [4.6, 50.6] },
      { iso: '705', label: 'Slovenia', at: [14.8, 46.1] },
      { iso: '348', label: 'Hungary', at: [19.4, 47.1] },
      { iso: '070', label: 'Bosnia and Herzegovina', at: [17.8, 44.2] },
    ],
    difficulty: 3,
    explain: 'Hungary has no coast; Belgium has about 66 km on the North Sea, Slovenia about 47 km and Bosnia and Herzegovina about 20 km at Neum, both on the Adriatic.',
  }),
  coastCard({
    id: 'geo-landlocked-ethiopia',
    p: equalArea([22, 52], [-6, 24]),
    region: 'northeast Africa',
    want: 'landlocked',
    items: [
      { iso: '729', label: 'Sudan', at: [30, 16] },
      { iso: '232', label: 'Eritrea', at: [38.6, 15.6] },
      { iso: '231', label: 'Ethiopia', at: [39.5, 8.5] },
      { iso: '404', label: 'Kenya', at: [37.9, 0.5] },
    ],
    difficulty: 2,
    explain: 'Ethiopia lost its coast when Eritrea became independent in 1993; Sudan and Eritrea face the Red Sea and Kenya the Indian Ocean.',
  }),
];
