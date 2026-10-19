/**
 * More map cards, same idiom as maps.ts: regions drawn with d3-geo from Natural Earth (world-atlas, 1:50m), no labels.
 * A point card's target is the country's own projected outline; buttons cards highlight one country in orange.
 */
import { geoAzimuthalEqualArea, geoCentroid, geoPath, type GeoProjection } from 'd3-geo';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { H, W, defineCard, inside, svgDoc, type CardSpec, type Region } from './lib.ts';

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8')) as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const world = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;
const countries = world.features.filter((f) => f.id !== '010'); // no Antarctica

const OCEAN = '#CFE6F5';
const LAND = '#F1ECE1';
const BORDER = '#6E6E6E';
const HIGHLIGHT = '#E8743B';
const MARGIN = 24;

type Probe = string | [number, number];

function country(id: string): Feature<Geometry, { name: string }> {
  const f = countries.find((c) => c.id === id);
  if (!f) throw new Error(`no country ${id}`);
  return f;
}

/** An azimuthal equal-area projection centered on the region, fitted so the lon/lat box fills the canvas. */
function projectionFor(lon: [number, number], lat: [number, number]): GeoProjection {
  const center: [number, number] = [(lon[0] + lon[1]) / 2, (lat[0] + lat[1]) / 2];
  const pts: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const a = lon[0] + ((lon[1] - lon[0]) * i) / 20;
    const b = lat[0] + ((lat[1] - lat[0]) * i) / 20;
    pts.push([a, lat[0]], [a, lat[1]], [lon[0], b], [lon[1], b]);
  }
  return geoAzimuthalEqualArea()
    .rotate([-center[0], -center[1]])
    .clipAngle(90)
    .fitExtent([[MARGIN, MARGIN], [W - MARGIN, H - MARGIN]], { type: 'MultiPoint', coordinates: pts })
    .clipExtent([[0, 0], [W, H]]);
}

function drawMap(p: GeoProjection, highlight?: string): string {
  const path = geoPath(p);
  const shapes = countries
    .map((f) => {
      const d = path(f);
      if (!d) return '';
      const fill = highlight && f.id === highlight ? HIGHLIGHT : LAND;
      return `<path d="${d}" fill="${fill}" stroke="${BORDER}" stroke-width="1" stroke-linejoin="round"/>`;
    })
    .join('');
  return svgDoc(shapes, OCEAN);
}

/** The country's projected outline as fraction rings (all parts, islands included). */
function targetOf(p: GeoProjection, id: string): Region {
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
  geoPath(p, ctx as unknown as CanvasRenderingContext2D)(country(id));
  if (ring.length > 2) rings.push(ring);
  return { type: 'poly', rings };
}

/**
 * Throws when the country's own probe point misses the target, a neighbor's probe point hits it, or the
 * mainland is too small to tap. A probe is a country id (its centroid) or a [lon, lat] inside the country,
 * for countries whose centroid falls outside them (Vietnam).
 */
function check(p: GeoProjection, id: string, self: Probe, target: Region, neighbors: Probe[]): void {
  const at = (cid: Probe) => {
    const xy = p(typeof cid === 'string' ? geoCentroid(country(cid)) : cid)!;
    return [xy[0] / W, xy[1] / H] as const;
  };
  const [x, y] = at(self);
  if (!inside(target, x, y)) throw new Error(`maps2: probe of ${id} is not inside its target`);
  for (const n of neighbors) {
    const [nx, ny] = at(n);
    if (inside(target, nx, ny, 0.01)) throw new Error(`maps2: neighbor ${JSON.stringify(n)} is inside the target of ${id}`);
  }
  const r = (target as Extract<Region, { type: 'poly' }>).rings.reduce((a, b) => (b.length > a.length ? b : a));
  const xs = r.map((q) => q[0] * W), ys = r.map((q) => q[1] * H);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  if (Math.min(w, h) < 60) throw new Error(`maps2: ${id} is only ${w.toFixed(0)}x${h.toFixed(0)} px`);
}

function pointCard(o: {
  id: string;
  name: string;
  iso: string;
  probe?: [number, number];
  neighbors: Probe[];
  region: string;
  lon: [number, number];
  lat: [number, number];
  difficulty: 1 | 2 | 3;
  explain: string;
}): CardSpec {
  const p = projectionFor(o.lon, o.lat);
  const target = targetOf(p, o.iso);
  check(p, o.iso, o.probe ?? o.iso, target, o.neighbors);
  return defineCard({
    id: o.id,
    title: `Find ${o.name}`,
    category: 'maps',
    difficulty: o.difficulty,
    prompt: `Tap ${o.name}.`,
    kind: 'point',
    svg: drawMap(p),
    target,
    explain: o.explain,
    jev: {
      context: `A map of ${o.region} with country borders and no labels.`,
      instructions: `Where is ${o.name} in \`card\`?`,
    },
    source: 'drawn',
  });
}

function whichCard(o: {
  id: string;
  iso: string;
  region: string;
  lon: [number, number];
  lat: [number, number];
  options: string[];
  answer: string;
  difficulty: 1 | 2 | 3;
  explain: string;
}): CardSpec {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  if (!o.options.includes(o.answer)) throw new Error(`maps2: ${o.id} answer not in options`);
  return defineCard({
    id: o.id,
    title: 'Which country?',
    category: 'maps',
    difficulty: o.difficulty,
    prompt: 'Which country is highlighted?',
    kind: 'buttons',
    svg: drawMap(projectionFor(o.lon, o.lat), o.iso),
    options: o.options.map((n) => ({ id: slug(n), label: n, jev: n })),
    answer: slug(o.answer),
    explain: o.explain,
    jev: {
      context: `A map of ${o.region} with country borders and no labels, with one country filled in orange.`,
      instructions: 'Which country is filled in orange in `card`?',
    },
    source: 'drawn',
  });
}

export default [
  pointCard({
    id: 'map-niger',
    name: 'Niger',
    iso: '562',
    neighbors: ['566', '466', '148', '012', '434', '204', '854'],
    region: 'West and North Africa',
    lon: [-18, 30],
    lat: [0, 30],
    difficulty: 2,
    explain: 'Niger is the big landlocked country north of Nigeria; both are named after the Niger River, but Nigeria is the coastal one on the Gulf of Guinea.',
  }),
  pointCard({
    id: 'map-slovenia',
    name: 'Slovenia',
    iso: '705',
    neighbors: ['703', '040', '191', '348', '380', '203', '070'],
    region: 'Central Europe',
    lon: [6, 26],
    lat: [42, 52],
    difficulty: 3,
    explain: 'Slovenia is the small country between Italy, Austria, Hungary and Croatia, with a short Adriatic coast; Slovakia lies further northeast, next to Poland.',
  }),
  pointCard({
    id: 'map-iraq',
    name: 'Iraq',
    iso: '368',
    neighbors: ['364', '760', '682', '400', '792', '414'],
    region: 'the Middle East',
    lon: [26, 64],
    lat: [12, 42],
    difficulty: 2,
    explain: 'Iraq lies between Syria and Iran around the Tigris and Euphrates, with only a tiny coastline at the top of the Gulf; Iran is the much larger country to its east.',
  }),
  pointCard({
    id: 'map-colombia',
    name: 'Colombia',
    iso: '170',
    neighbors: ['862', '218', '604', '076', '591'],
    region: 'South America',
    lon: [-82, -34],
    lat: [-56, 13],
    difficulty: 1,
    explain: 'Colombia is in the northwest corner of South America, the only country on the continent with coasts on both the Pacific and the Caribbean.',
  }),
  pointCard({
    id: 'map-madagascar',
    name: 'Madagascar',
    iso: '450',
    neighbors: ['508', '834'],
    region: 'Africa',
    lon: [-20, 52],
    lat: [-36, 38],
    difficulty: 1,
    explain: 'Madagascar is the large island off the southeast coast of Africa, across the Mozambique Channel.',
  }),
  pointCard({
    id: 'map-finland',
    name: 'Finland',
    iso: '246',
    neighbors: ['752', '578', '233', [33, 64], [30, 60]],
    region: 'northern Europe',
    lon: [-5, 45],
    lat: [50, 71],
    difficulty: 1,
    explain: 'Finland lies between Sweden and Russia, east of the Gulf of Bothnia and north of the Gulf of Finland.',
  }),
  pointCard({
    id: 'map-vietnam',
    name: 'Vietnam',
    iso: '704',
    probe: [105.85, 21.03], // Hanoi: Vietnam's own centroid falls in Laos
    neighbors: ['418', '116', '764', '104', [102.6, 17.97], [104.9, 11.55], [113, 27]],
    region: 'Southeast Asia',
    lon: [90, 122],
    lat: [0, 28],
    difficulty: 2,
    explain: 'Vietnam is the long S-shaped country along the eastern coast of the Indochinese peninsula, east of Laos and Cambodia.',
  }),
  pointCard({
    id: 'map-kenya',
    name: 'Kenya',
    iso: '404',
    neighbors: ['231', '706', '834', '800', '728'],
    region: 'East Africa',
    lon: [22, 52],
    lat: [-14, 14],
    difficulty: 2,
    explain: 'Kenya sits on the equator on the Indian Ocean coast, between Tanzania to the south and Ethiopia and Somalia to the north.',
  }),
  pointCard({
    id: 'map-portugal',
    name: 'Portugal',
    iso: '620',
    neighbors: ['724', '250', '504'],
    region: 'western Europe',
    lon: [-12, 10],
    lat: [35, 50],
    difficulty: 1,
    explain: 'Portugal is the narrow country on the Atlantic side of the Iberian Peninsula, west of Spain.',
  }),
  whichCard({
    id: 'map-which-bolivia',
    iso: '068',
    region: 'South America',
    lon: [-82, -34],
    lat: [-56, 13],
    options: ['Peru', 'Paraguay', 'Bolivia', 'Ecuador'],
    answer: 'Bolivia',
    difficulty: 2,
    explain: 'Bolivia is the landlocked country west of Brazil, between Peru and Chile on one side and Paraguay on the other.',
  }),
  whichCard({
    id: 'map-which-nicaragua',
    iso: '558',
    region: 'Central America',
    lon: [-93, -77],
    lat: [7, 19],
    options: ['Honduras', 'Nicaragua', 'Costa Rica', 'El Salvador'],
    answer: 'Nicaragua',
    difficulty: 3,
    explain: 'Nicaragua is the largest country in Central America, between Honduras to the north and Costa Rica to the south, with coasts on both oceans.',
  }),
  whichCard({
    id: 'map-which-papua-new-guinea',
    iso: '598',
    region: 'Southeast Asia and Oceania',
    lon: [110, 165],
    lat: [-28, 8],
    options: ['Indonesia', 'Papua New Guinea', 'Solomon Islands', 'Fiji'],
    answer: 'Papua New Guinea',
    difficulty: 2,
    explain: 'Papua New Guinea is the eastern half of the island of New Guinea, north of Australia; the western half belongs to Indonesia.',
  }),
  whichCard({
    id: 'map-which-myanmar',
    iso: '104',
    region: 'South and Southeast Asia',
    lon: [80, 115],
    lat: [2, 30],
    options: ['Thailand', 'Myanmar', 'Bangladesh', 'Cambodia'],
    answer: 'Myanmar',
    difficulty: 2,
    explain: 'Myanmar lies between Bangladesh and India to the west and Thailand to the east, with a long tail running down the Andaman Sea.',
  }),
  whichCard({
    id: 'map-which-romania',
    iso: '642',
    region: 'eastern Europe',
    lon: [8, 36],
    lat: [38, 52],
    options: ['Bulgaria', 'Hungary', 'Romania', 'Moldova'],
    answer: 'Romania',
    difficulty: 2,
    explain: 'Romania sits on the Black Sea north of Bulgaria, with Hungary to its west and Moldova and Ukraine to its east; the Carpathians curve through it.',
  }),
];
