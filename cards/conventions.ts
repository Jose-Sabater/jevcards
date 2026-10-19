/**
 * "Know the convention" cards: pictures that mislead unless you know how they are drawn. Music staves (clefs,
 * key signatures, ledger lines), map projections (Mercator sizes, conic parallels, a same-scale overlay) and
 * charts (log scale, reversed axis, dual axis, a pie that does not add up, a broken axis).
 *
 * Every answer is computed from the same data the picture is drawn from:
 *   music   a staff position plus a clef gives a diatonic step, then a MIDI number (middle C = 60)
 *   maps    d3-geo on Natural Earth (world-atlas, 1:50m): geoArea for sizes, the projection for page positions
 *   charts  the values in this file, and the axis functions that place them
 * Clefs and accidentals come from Apple Symbols, the only system font here that has them.
 */
import { geoAzimuthalEqualArea, geoArea, geoCentroid, geoConicConformal, geoDistance, geoGraticule, geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { H, W, defineCard, esc, inside, rectPx, svgDoc, type CardSpec, type Option, type Region } from './lib.ts';

const FONT = `font-family="Arial, Helvetica, sans-serif"`;
const INK = '#26313D';
const PAPER = '#F7F5EF';
const f1 = (n: number) => n.toFixed(1);
const pickJev = (context: string, question: string) => ({ context, instructions: `${question} Answer with the option for its position in \`card\`.` });
const text = (x: number, y: number, s: string, size = 32, opts = '') =>
  `<text x="${f1(x)}" y="${f1(y)}" text-anchor="middle" ${FONT} font-size="${size}" ${opts.includes('fill=') ? '' : `fill="${INK}"`} ${opts}>${s}</text>`;
const panel = (x: number, y: number, w: number, h: number) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#FFFFFF" stroke="#D9D4C7" stroke-width="2"/>`;

// =============================================================================================================
// Music. Staff lines GAP px apart; a staff position counts half spaces from the bottom line (0 = bottom line,
// 1 = first space, 8 = top line, -2 = first ledger line below, 10 = first ledger line above).

const GAP = 28;
type Clef = 'treble' | 'bass' | 'alto';
/** The diatonic step (octave * 7 + letter, C = 0) of each clef's bottom line: E4, G2, F3. */
const BOTTOM_LINE: Record<Clef, number> = { treble: 4 * 7 + 2, bass: 2 * 7 + 4, alto: 3 * 7 + 3 };
const LETTERS = 'CDEFGAB';
const SEMIS = [0, 2, 4, 5, 7, 9, 11];
const step = (clef: Clef, pos: number) => BOTTOM_LINE[clef] + pos;
/** MIDI number of a staff position (middle C = 60), with an accidental in semitones. */
const midi = (clef: Clef, pos: number, acc = 0) => {
  const d = step(clef, pos);
  return 12 * (Math.floor(d / 7) + 1) + SEMIS[((d % 7) + 7) % 7] + acc;
};
const letter = (clef: Clef, pos: number) => LETTERS[((step(clef, pos) % 7) + 7) % 7];
const pitchName = (clef: Clef, pos: number) => `${letter(clef, pos)}${Math.floor(step(clef, pos) / 7)}`;
if (midi('treble', -2) !== 60 || midi('bass', 10) !== 60 || midi('alto', 4) !== 60 || midi('treble', 0) !== 64) throw new Error('conventions: pitch math is off');

const staff = (x0: number, x1: number, bottom: number) =>
  [0, 1, 2, 3, 4].map((i) => `<line x1="${x0}" y1="${bottom - i * GAP}" x2="${x1}" y2="${bottom - i * GAP}" stroke="#111" stroke-width="3"/>`).join('');
/** Clef glyphs from Apple Symbols, placed for this staff (calibrated by eye on rendered PNGs). */
const clefGlyph = (clef: Clef, x: number, bottom: number) =>
  clef === 'treble'
    ? `<text x="${x}" y="${bottom + 44}" font-family="Apple Symbols" font-size="250" fill="#111">𝄞</text>`
    : clef === 'bass'
      ? `<text x="${x}" y="${bottom - 22}" font-family="Apple Symbols" font-size="130" fill="#111">𝄢</text>`
      : `<text x="${x}" y="${bottom + 1}" font-family="Apple Symbols" font-size="162" fill="#111">𝄡</text>`;
const posY = (bottom: number, pos: number) => bottom - (pos * GAP) / 2;
/** A sharp centered on a staff position. */
const sharp = (x: number, bottom: number, pos: number) => `<text x="${x}" y="${f1(posY(bottom, pos) + 29)}" font-family="Apple Symbols" font-size="110" fill="#111">♯</text>`;
/** A quarter note with any ledger lines it needs. Stem up below the middle line. */
const note = (x: number, bottom: number, pos: number) => {
  const y = posY(bottom, pos);
  let s = '';
  for (let p = -2; p >= pos; p -= 2) s += `<line x1="${x - 32}" y1="${posY(bottom, p)}" x2="${x + 32}" y2="${posY(bottom, p)}" stroke="#111" stroke-width="3"/>`;
  for (let p = 10; p <= pos; p += 2) s += `<line x1="${x - 32}" y1="${posY(bottom, p)}" x2="${x + 32}" y2="${posY(bottom, p)}" stroke="#111" stroke-width="3"/>`;
  const up = pos < 4;
  const stem = up
    ? `<line x1="${x + 16}" y1="${y - 4}" x2="${x + 16}" y2="${y - 98}" stroke="#111" stroke-width="4"/>`
    : `<line x1="${x - 16}" y1="${y + 4}" x2="${x - 16}" y2="${y + 98}" stroke="#111" stroke-width="4"/>`;
  return s + `<ellipse cx="${x}" cy="${f1(y)}" rx="18" ry="13" transform="rotate(-22 ${x} ${f1(y)})" fill="#111"/>${stem}`;
};

// 1. Alto clef: middle C is the middle line. The treble clef's middle C spot (first ledger line below) is a D here.
const altoMiddleC = (() => {
  const bottom = 430;
  const notes: number[] = [-2, 5, 4, 1];
  const xs = [330, 490, 650, 810];
  const where = ['first', 'second', 'third', 'fourth'];
  let body = panel(30, 120, 900, 480) + staff(60, 900, bottom) + clefGlyph('alto', 70, bottom);
  const options: Option[] = notes.map((pos, i) => {
    body += note(xs[i], bottom, pos);
    return { id: `n${i + 1}`, label: `${where[i][0].toUpperCase() + where[i].slice(1)} note: ${pitchName('alto', pos)}`, region: rectPx(xs[i] - 70, 130, 140, 460), jev: `The ${where[i]} note from the left.` };
  });
  const hits = notes.map((p) => midi('alto', p) === 60);
  if (hits.filter(Boolean).length !== 1) throw new Error('conventions: one middle C');
  return defineCard({
    id: 'conv-alto-clef-middle-c',
    title: 'The alto clef',
    category: 'symbols',
    difficulty: 3,
    prompt: 'Which note is middle C?',
    kind: 'pick',
    svg: svgDoc(body, PAPER),
    options,
    answer: options[hits.indexOf(true)].id,
    explain: 'The alto clef (the C clef used by violas) points at middle C, here the middle line. The note on the ledger line below would be middle C in the treble clef, but in the alto clef it is the D an octave lower.',
    jev: pickJev('A staff with an alto (C) clef and four notes.', 'Which note is middle C?'),
    source: 'drawn',
  });
})();

// 2. Key signature: two sharps (F and C) on the top line and third space. The F at the bottom of the staff is sharp too.
const keySignature = (() => {
  const bottom = 440;
  const sig = [{ pos: 8, x: 210 }, { pos: 5, x: 262 }]; // F5 and C5: D major
  const sharpened = new Set(sig.map((s) => letter('treble', s.pos)));
  const target = 1; // F4, first space
  if (letter('treble', target) !== 'F') throw new Error('conventions: target must be an F');
  let body = panel(30, 150, 900, 420) + staff(60, 900, bottom) + clefGlyph('treble', 70, bottom);
  for (const s of sig) body += sharp(s.x, bottom, s.pos);
  body += note(700, bottom, target);
  const played = sharpened.has('F') ? 'F sharp' : 'F';
  return defineCard({
    id: 'conv-key-signature-f-sharp',
    title: 'Key signature',
    category: 'symbols',
    difficulty: 2,
    prompt: 'This F is played as...',
    kind: 'buttons',
    svg: svgDoc(body, PAPER),
    options: ['F', 'F sharp', 'F flat'].map((l) => ({ id: l.toLowerCase().replace(' ', '-'), label: l, jev: `${l}.` })),
    answer: played.toLowerCase().replace(' ', '-'),
    explain: 'The sharps after the clef are a key signature: the one on the top line sharpens every F in every octave until the key changes, including this F in the bottom space.',
    jev: {
      context: 'A treble staff with two sharps after the clef and one note, an F in the bottom space.',
      instructions: 'How is the note F in `card` played?',
    },
    source: 'drawn',
  });
})();

// 3. Three clefs: the note drawn lowest on the page sounds highest.
const threeClefs = (() => {
  const bottom = 430;
  const parts: { clef: Clef; pos: number; name: string }[] = [
    { clef: 'bass', pos: 9, name: 'bass' },
    { clef: 'alto', pos: 6, name: 'alto' },
    { clef: 'treble', pos: 1, name: 'treble' },
  ];
  const where = ['left', 'middle', 'right'];
  let body = '';
  const options: Option[] = parts.map((p, i) => {
    const x0 = 30 + i * 306;
    body += panel(x0, 120, 288, 480) + staff(x0 + 16, x0 + 272, bottom) + clefGlyph(p.clef, x0 + (p.clef === 'treble' ? 22 : 26), bottom) + note(x0 + 200, bottom, p.pos);
    return { id: where[i], label: `${where[i][0].toUpperCase() + where[i].slice(1)}: ${pitchName(p.clef, p.pos)} (${p.name} clef)`, region: rectPx(x0, 120, 288, 480), jev: `The note on the ${where[i]} staff.` };
  });
  const pitches = parts.map((p) => midi(p.clef, p.pos));
  const best = pitches.indexOf(Math.max(...pitches));
  if (pitches.filter((m) => m === pitches[best]).length !== 1) throw new Error('conventions: one highest note');
  const lowestDrawn = parts.map((p) => p.pos).indexOf(Math.min(...parts.map((p) => p.pos)));
  if (best !== lowestDrawn) throw new Error('conventions: the trap needs the highest note drawn lowest');
  return defineCard({
    id: 'conv-three-clefs-highest',
    title: 'Three clefs',
    category: 'symbols',
    difficulty: 3,
    prompt: 'Which note sounds highest?',
    kind: 'pick',
    svg: svgDoc(body, PAPER),
    options,
    answer: options[best].id,
    explain: `Read each note in its own clef: bass clef B3 above the staff, alto clef E4 on the fourth line, treble clef F4 in the bottom space. The treble F4 is the highest, though it sits lowest on the page.`,
    jev: pickJev('Three short staves side by side, each with a different clef and one note.', 'Which note sounds highest in pitch?'),
    source: 'drawn',
  });
})();

// 4. Ledger lines: a note on the second ledger line above the treble staff is C6.
const ledgerLine = (() => {
  const bottom = 500;
  const pos = 12;
  let body = panel(30, 90, 900, 520) + staff(60, 900, bottom) + clefGlyph('treble', 70, bottom) + note(560, bottom, pos);
  const answer = letter('treble', pos);
  if (pitchName('treble', pos) !== 'C6') throw new Error('conventions: ledger note should be C6');
  return defineCard({
    id: 'conv-ledger-line-note',
    title: 'Ledger lines',
    category: 'symbols',
    difficulty: 3,
    prompt: 'Which note is this?',
    kind: 'buttons',
    svg: svgDoc(body, PAPER),
    options: ['A', 'B', 'C', 'D'].map((l) => ({ id: l.toLowerCase(), label: l, jev: `${l}.` })),
    answer: answer.toLowerCase(),
    explain: 'Ledger lines continue the staff. Above the top line F come G (space), A (first ledger line), B (space) and C on the second ledger line.',
    jev: {
      context: 'A treble staff with one note above it, on short extra lines.',
      instructions: 'What is the letter name of the note in `card`?',
    },
    source: 'drawn',
  });
})();

// =============================================================================================================
// Maps.

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8')) as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const world = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;
const countries = world.features.filter((f) => f.id !== '010'); // no Antarctica
const OCEAN = '#CFE6F5';
const LAND = '#F1ECE1';
const BORDER = '#6E6E6E';
const MARKS = ['#E8743B', '#4FA36B', '#8E6BBF', '#D9A82E'];
const R_KM = 6371.0088;
type Country = Feature<Geometry, { name: string }>;

function country(id: string): Country {
  const all = countries.filter((c) => c.id === id);
  if (!all.length) throw new Error(`conventions: no country ${id}`);
  return all.reduce((a, b) => (geoArea(b) > geoArea(a) ? b : a));
}
const areaKm2 = (f: Feature | Geometry) => geoArea(f as Feature) * R_KM * R_KM;
const polysOf = (f: Country): Polygon[] =>
  f.geometry.type === 'MultiPolygon' ? (f.geometry as MultiPolygon).coordinates.map((c): Polygon => ({ type: 'Polygon', coordinates: c })) : [f.geometry as Polygon];
const fromPolys = (f: Country, polys: Polygon[]): Country => ({ ...f, geometry: { type: 'MultiPolygon', coordinates: polys.map((q) => q.coordinates) } });

/** Only the parts of a country near its biggest polygon. */
function mainParts(f: Country, maxDeg: number): Country {
  const polys = polysOf(f);
  const big = polys.reduce((a, b) => (geoArea(b) > geoArea(a) ? b : a));
  const c = geoCentroid(big);
  return fromPolys(f, polys.filter((q) => geoDistance(geoCentroid(q), c) <= (maxDeg * Math.PI) / 180));
}

/** Alaska: the US polygons north of 50 N and west of 129 W (the Aleutians reach past 180). */
const alaska: Country = (() => {
  const us = country('840');
  const polys = polysOf(us).filter((q) => {
    const [lon, lat] = geoCentroid(q);
    return lat > 50 && (lon < -129 || lon > 170);
  });
  return fromPolys(us, polys);
})();

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

function mercator(lon: [number, number], lat: [number, number]): GeoProjection {
  return geoMercator()
    .rotate([-(lon[0] + lon[1]) / 2, 0])
    .fitExtent([[24, 24], [W - 24, H - 24]], boxPoints(lon, lat))
    .clipExtent([[0, 0], [W, H]]);
}

const landLayer = (p: GeoProjection) => {
  const path = geoPath(p);
  return countries.map((f) => (path(f) ? `<path d="${path(f)}" fill="${LAND}" stroke="${BORDER}" stroke-width="1" stroke-linejoin="round"/>` : '')).join('');
};

function badge(x: number, y: number, letter: string): string {
  return `<circle cx="${f1(x)}" cy="${f1(y)}" r="25" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/><text x="${f1(x)}" y="${f1(y + 11)}" font-family="Arial, Helvetica" font-size="31" font-weight="bold" text-anchor="middle" fill="${INK}">${letter}</text>`;
}

interface Marked {
  f: Country;
  label: string;
  /** Where the letter goes, [lon, lat], inside the shape. */
  at: [number, number];
  /** A badge placed away from the shape, joined by a line, [lon, lat]. */
  badgeAt?: [number, number];
}

/** Shapes filled in colour over a plain map and lettered A, B, ...; each option's region is its outline. */
function markedMap(p: GeoProjection, items: Marked[], cardId: string): { svg: string; options: Option[] } {
  const letters = 'ABCD';
  const path = geoPath(p);
  const regions = items.map((it) => ringsOf(p, it.f));
  const spots = items.map((it) => p(it.at)!);
  items.forEach((it, i) => {
    const [x, y] = [spots[i][0] / W, spots[i][1] / H];
    if (!inside(regions[i], x, y)) throw new Error(`conventions: ${cardId}: letter of ${it.label} is not inside it`);
  });
  let body = landLayer(p);
  items.forEach((it, i) => (body += `<path d="${path(it.f)}" fill="${MARKS[i]}" stroke="${BORDER}" stroke-width="1" stroke-linejoin="round"/>`));
  items.forEach((it, i) => {
    if (!it.badgeAt) return (body += badge(spots[i][0], spots[i][1], letters[i]));
    const [bx, by] = p(it.badgeAt)!;
    const [sx, sy] = spots[i];
    body += `<line x1="${f1(sx)}" y1="${f1(sy)}" x2="${f1(bx)}" y2="${f1(by)}" stroke="${INK}" stroke-width="3"/><circle cx="${f1(sx)}" cy="${f1(sy)}" r="5" fill="${INK}"/>${badge(bx, by, letters[i])}`;
  });
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  const options = items.map((it, i) => ({ id: slug(it.label), label: it.label, region: regions[i], jev: `The coloured shape marked ${letters[i]}.` }));
  return { svg: svgDoc(body, OCEAN), options };
}

const mkm2 = (f: Country) => (areaKm2(f) / 1e6).toFixed(2);
const kkm2 = (f: Country) => `${Math.round(areaKm2(f) / 1e3)},000`;

function mercatorCard(o: { id: string; lon: [number, number]; lat: [number, number]; items: Marked[]; region: string; what: string; difficulty: 1 | 2 | 3; explain: (a: Country, b: Country, drawnRatio: string) => string }): CardSpec {
  const p = mercator(o.lon, o.lat);
  const { svg, options } = markedMap(p, o.items, o.id);
  const areas = o.items.map((it) => areaKm2(it.f));
  const best = areas.indexOf(Math.max(...areas));
  const drawn = o.items.map((it) => geoPath(p).area(it.f));
  if (drawn.indexOf(Math.max(...drawn)) === best) throw new Error(`conventions: ${o.id}: Mercator already shows the bigger one bigger`);
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
    explain: o.explain(o.items[0].f, o.items[1].f, (drawn[0] / drawn[1]).toFixed(1)),
    jev: {
      context: `A Mercator map of ${o.region} with no labels; two ${o.what} are filled in colour and marked with letters.`,
      instructions: 'Which of the lettered shapes in `card` has the larger real area on the ground?',
    },
    source: 'drawn',
  });
}

// 5. Mercator: Alaska vs Mexico.
const mexico = country('484');
const alaskaMexico = mercatorCard({
  id: 'conv-mercator-alaska-mexico',
  lon: [-172, -84],
  lat: [13, 72],
  region: 'North America',
  what: 'areas',
  items: [
    { f: alaska, label: 'Alaska', at: [-152, 64] },
    { f: mexico, label: 'Mexico', at: [-102, 23.5] },
  ],
  difficulty: 3,
  explain: (a, b, r) => `Mexico is about ${mkm2(b)} million km2 and Alaska about ${mkm2(a)} million km2 of land; Mercator stretches Alaska, far to the north, so this map draws it ${r} times the size of Mexico.`,
});

// 6. Mercator: Sweden vs Madagascar.
const sweden = country('752'), madagascar = country('450');
const swedenMadagascar = mercatorCard({
  id: 'conv-mercator-sweden-madagascar',
  lon: [-12, 58],
  lat: [-27, 70],
  region: 'Europe and Africa',
  what: 'countries',
  items: [
    { f: sweden, label: 'Sweden', at: [15, 62.5] },
    { f: madagascar, label: 'Madagascar', at: [46.8, -19.5], badgeAt: [36, -26] },
  ],
  difficulty: 3,
  explain: (a, b, r) => `Madagascar is about ${kkm2(b)} km2 and Sweden about ${kkm2(a)}; Mercator barely stretches Madagascar, near the equator, but blows up Sweden so this map draws it ${r} times the size of Madagascar.`,
});

// 7. Conic map: parallels are arcs, so a city at the edge is drawn higher than one further north in the middle.
const conicPole = (() => {
  const p = geoConicConformal()
    .parallels([35, 65])
    .rotate([96, 0])
    .fitExtent([[24, 24], [W - 24, H - 24]], boxPoints([-135, -55], [24, 62]))
    .clipExtent([[0, 0], [W, H]]);
  const cities: { name: string; at: [number, number] }[] = [
    { name: 'Seattle', at: [-122.33, 47.61] },
    { name: 'Winnipeg', at: [-97.14, 49.9] },
    { name: "St. John's", at: [-52.71, 47.56] },
  ];
  const path = geoPath(p);
  let body = landLayer(p);
  const grat = geoGraticule().extent([[-180, 20], [180, 80]]).step([10, 10]);
  body += `<path d="${path(grat())}" fill="none" stroke="#5B7FA0" stroke-width="1.6" stroke-dasharray="6 5"/>`;
  for (const lat of [30, 40, 50, 60]) {
    const [x, y] = p([-84, lat])!;
    if (y > 40 && y < H - 30) body += `<rect x="${f1(x - 44)}" y="${f1(y - 22)}" width="88" height="34" rx="6" fill="#FFFFFF" opacity="0.85"/>` + text(x, y + 6, `${lat}°N`, 28, 'font-weight="bold"');
  }
  const letters = 'ABC';
  const pts = cities.map((c) => p(c.at)!);
  const options: Option[] = cities.map((c, i) => {
    const [x, y] = pts[i];
    body += `<circle cx="${f1(x)}" cy="${f1(y)}" r="9" fill="#D62828" stroke="#FFFFFF" stroke-width="3"/>` + badge(x, y - 46, letters[i]);
    return { id: c.name.toLowerCase().replace(/[^a-z]+/g, '-'), label: c.name, region: { type: 'circle', cx: x / W, cy: (y - 20) / H, r: 70 / W }, jev: `The red dot marked ${letters[i]}.` };
  });
  const lats = cities.map((c) => c.at[1]);
  const best = lats.indexOf(Math.max(...lats));
  const ys = pts.map((q) => q[1]);
  if (ys.indexOf(Math.max(...ys)) !== best) throw new Error('conventions: the northernmost city must be drawn lowest');
  return defineCard({
    id: 'conv-conic-closest-north-pole',
    title: 'Curved parallels',
    category: 'maps',
    difficulty: 3,
    prompt: 'Which dot is closest to the North Pole?',
    kind: 'pick',
    svg: svgDoc(body, OCEAN),
    options,
    answer: options[best].id,
    explain: `On this conic map the lines of latitude curve up toward the edges. ${cities[best].name} (${lats[best].toFixed(1)}°N) is the furthest north and so the closest to the pole, though it is drawn lowest; Seattle is at ${lats[0].toFixed(1)}°N and St. John's at ${lats[2].toFixed(1)}°N.`,
    jev: {
      context: 'A conic map of North America with dashed lines of latitude every 10 degrees and three red dots marked with letters.',
      instructions: 'Which lettered dot in `card` is closest to the North Pole?',
    },
    source: 'drawn',
  });
})();

// 8. Same-scale overlay: long thin Chile laid over compact Ukraine, both equal-area at one scale.
const overlay = (() => {
  const a = mainParts(country('152'), 25), b = mainParts(country('804'), 25);
  const projs = [a, b].map((f) => {
    const c = geoCentroid(f);
    return geoAzimuthalEqualArea().rotate([-c[0], -c[1]]).fitExtent([[0, 0], [W - 300, H - 60]], f);
  });
  const scale = Math.min(...projs.map((p) => p.scale()));
  const body: string[] = [];
  const colors = ['#E8743B', '#3A7CA5'];
  const names = ['Chile', 'Ukraine'];
  [a, b].forEach((f, i) => {
    const p = projs[i].scale(scale).translate([0, 0]);
    const [cx, cy] = p(geoCentroid(f))!;
    p.translate([W / 2 - 60 - cx, H / 2 - cy]);
    body.push(`<path d="${geoPath(p)(f)}" fill="${colors[i]}" fill-opacity="0.6" stroke="${colors[i]}" stroke-width="3" stroke-linejoin="round"/>`);
  });
  names.forEach((n, i) => {
    const y = 300 + i * 90;
    body.push(`<rect x="${W - 250}" y="${y - 34}" width="44" height="44" rx="6" fill="${colors[i]}" fill-opacity="0.6" stroke="${colors[i]}" stroke-width="3"/>`);
    body.push(`<text x="${W - 192}" y="${y}" ${FONT} font-size="40" font-weight="bold" fill="${INK}">${esc(n)}</text>`);
  });
  const [areaA, areaB] = [a, b].map(areaKm2);
  if (Math.abs(areaA - areaB) / Math.max(areaA, areaB) < 0.15) throw new Error('conventions: overlay too close to call');
  const answer = areaA > areaB ? 'chile' : 'ukraine';
  return defineCard({
    id: 'conv-overlay-chile-ukraine',
    title: 'Laid on top',
    category: 'maps',
    difficulty: 3,
    prompt: 'Which country is bigger?',
    kind: 'buttons',
    svg: svgDoc(body.join(''), '#F7F4EE'),
    options: [
      { id: 'chile', label: 'Chile', jev: 'Chile.' },
      { id: 'ukraine', label: 'Ukraine', jev: 'Ukraine.' },
      { id: 'same', label: 'About the same', jev: 'About the same.' },
    ],
    answer,
    explain: `Chile is about ${Math.round(areaA / 1e3)},000 km2 and Ukraine about ${Math.round(areaB / 1e3)},000 in this data. Chile is so thin that it looks small, but it is over 4,000 km long.`,
    jev: {
      context: 'Two country outlines, Chile and Ukraine, laid on top of each other at the same scale on an equal-area projection, with a colour key.',
      instructions: 'Which country in `card` has the larger area, or are they about the same?',
    },
    source: 'drawn',
  });
})();

// =============================================================================================================
// Charts.

// 9. Log scale: B's bar is twice as tall as A's but its value is 100 times bigger.
const logScale = (() => {
  const a = 100, b = 10000;
  const x0 = 200, base = 620, top = 70, decades = 5;
  const py = (v: number) => base - ((base - top) * Math.log10(v)) / decades;
  let body = '';
  for (let k = 0; k <= decades; k++) {
    const v = 10 ** k;
    body += `<line x1="${x0}" y1="${f1(py(v))}" x2="880" y2="${f1(py(v))}" stroke="#D5D0C4" stroke-width="2"/>`;
    body += `<text x="${x0 - 16}" y="${f1(py(v) + 11)}" text-anchor="end" ${FONT} font-size="32" fill="${INK}">${v.toLocaleString('en-US')}</text>`;
  }
  body += `<line x1="${x0}" y1="${top}" x2="${x0}" y2="${base}" stroke="${INK}" stroke-width="4"/><line x1="${x0}" y1="${base}" x2="880" y2="${base}" stroke="${INK}" stroke-width="4"/>`;
  for (const [name, v, x, c] of [['A', a, 330, '#9AA5B1'], ['B', b, 610, '#E07A5F']] as const) {
    body += `<rect x="${x}" y="${f1(py(v))}" width="160" height="${f1(base - py(v))}" fill="${c}"/>`;
    body += text(x + 80, base + 56, name, 44, 'font-weight="bold"');
  }
  const ratio = b / a, looks = (base - py(b)) / (base - py(a));
  const choices = [2, 10, 100, 1000];
  if (!choices.includes(ratio)) throw new Error('conventions: log answer must be an option');
  return defineCard({
    id: 'conv-log-scale-times',
    title: 'Log scale',
    category: 'charts',
    difficulty: 2,
    prompt: 'How many times bigger is B than A?',
    kind: 'buttons',
    svg: svgDoc(body, '#FBF8F1'),
    options: choices.map((c) => ({ id: `x${c}`, label: `${c.toLocaleString('en-US')} times`, jev: `${c.toLocaleString('en-US')} times.` })),
    answer: `x${ratio}`,
    explain: `Each gridline is 10 times the one below it, a logarithmic scale. A is ${a} and B is ${b.toLocaleString('en-US')}, so B is ${ratio} times A, though its bar is only ${looks.toFixed(0)} times as tall.`,
    jev: {
      context: 'A bar chart with two bars, A and B, and a numbered vertical axis.',
      instructions: 'In `card`, how many times bigger is the value of B than the value of A?',
    },
    source: 'drawn',
  });
})();

// 10. Reversed axis: league positions, 1 at the top, bars hanging down. The shortest bar is the best season.
const reversedRanks = (() => {
  const seasons = ['2020', '2021', '2022', '2023', '2024'];
  const ranks = [9, 14, 2, 17, 6];
  const x0 = 170, top = 110, k = 24, bw = 104, gap = 34;
  const py = (r: number) => top + r * k;
  let body = text(480, 60, 'League position at the end of each season', 30, 'font-weight="bold"');
  for (const r of [1, 5, 10, 15, 20]) {
    body += `<line x1="${x0}" y1="${py(r)}" x2="900" y2="${py(r)}" stroke="#D5D0C4" stroke-width="2"/>`;
    body += `<text x="${x0 - 16}" y="${py(r) + 11}" text-anchor="end" ${FONT} font-size="32" fill="${INK}">${r}</text>`;
  }
  body += `<line x1="${x0}" y1="${top}" x2="${x0}" y2="${py(20)}" stroke="${INK}" stroke-width="4"/><line x1="${x0}" y1="${top}" x2="900" y2="${top}" stroke="${INK}" stroke-width="4"/>`;
  const options: Option[] = ranks.map((r, i) => {
    const x = x0 + 40 + i * (bw + gap);
    body += `<rect x="${x}" y="${top}" width="${bw}" height="${py(r) - top}" fill="#3A7CA5"/>`;
    body += text(x + bw / 2, py(20) + 52, seasons[i], 32, 'font-weight="bold"');
    return { id: `s${seasons[i]}`, label: `${seasons[i]}: position ${r}`, region: rectPx(x - gap / 2, top, bw + gap, py(20) + 70 - top), jev: `The bar labeled ${seasons[i]}.` };
  });
  const best = ranks.indexOf(Math.min(...ranks));
  return defineCard({
    id: 'conv-reversed-axis-best-season',
    title: 'Upside down',
    category: 'charts',
    difficulty: 2,
    prompt: "Tap the team's best season.",
    kind: 'pick',
    svg: svgDoc(body, '#FBF8F1'),
    options,
    answer: options[best].id,
    explain: `The axis runs from 1 at the top to 20 at the bottom, so a longer bar is a worse position. The shortest bar, ${seasons[best]}, is position ${ranks[best]}, the best finish.`,
    jev: {
      context: 'A bar chart of a team\'s league position in five seasons; the bars hang down from the top axis.',
      instructions: 'In `card`, which season was the team\'s best finish?',
    },
    source: 'drawn',
  });
})();

// 11. Dual axis: the revenue line sits above the costs line, but costs are read on a scale ten times bigger.
const dualAxis = (() => {
  const years = ['2020', '2021', '2022', '2023', '2024'];
  const revenue = [18, 24, 30, 37, 44]; // left axis, 0 to 50
  const costs = [260, 270, 285, 290, 300]; // right axis, 0 to 500
  const L = 50, R = 500;
  const x0 = 170, x1 = 790, base = 590, top = 110;
  const px = (i: number) => x0 + 50 + (i * (x1 - x0 - 100)) / (years.length - 1);
  const pyL = (v: number) => base - ((base - top) * v) / L, pyR = (v: number) => base - ((base - top) * v) / R;
  const BLUE = '#2E6DA4', ORANGE = '#D9622B';
  let body = '';
  for (let k = 0; k <= 5; k++) {
    const y = pyL((L * k) / 5);
    body += `<line x1="${x0}" y1="${f1(y)}" x2="${x1}" y2="${f1(y)}" stroke="#D5D0C4" stroke-width="2"/>`;
    body += `<text x="${x0 - 14}" y="${f1(y + 11)}" text-anchor="end" ${FONT} font-size="30" font-weight="bold" fill="${BLUE}">${(L * k) / 5}</text>`;
    body += `<text x="${x1 + 14}" y="${f1(y + 11)}" ${FONT} font-size="30" font-weight="bold" fill="${ORANGE}">${(R * k) / 5}</text>`;
  }
  body += `<line x1="${x0}" y1="${top}" x2="${x0}" y2="${base}" stroke="${BLUE}" stroke-width="5"/><line x1="${x1}" y1="${top}" x2="${x1}" y2="${base}" stroke="${ORANGE}" stroke-width="5"/>`;
  body += `<line x1="${x0}" y1="${base}" x2="${x1}" y2="${base}" stroke="${INK}" stroke-width="4"/>`;
  body += `<polyline points="${revenue.map((v, i) => `${f1(px(i))},${f1(pyL(v))}`).join(' ')}" fill="none" stroke="${BLUE}" stroke-width="7" stroke-linejoin="round"/>`;
  body += `<polyline points="${costs.map((v, i) => `${f1(px(i))},${f1(pyR(v))}`).join(' ')}" fill="none" stroke="${ORANGE}" stroke-width="7" stroke-linejoin="round" stroke-dasharray="18 10"/>`;
  years.forEach((y, i) => (body += text(px(i), base + 44, y, 28, 'font-weight="bold"')));
  body += `<text x="40" y="70" ${FONT} font-size="30" font-weight="bold" fill="${BLUE}">Revenue (€ thousands)</text>`;
  body += `<text x="920" y="70" text-anchor="end" ${FONT} font-size="30" font-weight="bold" fill="${ORANGE}">Costs (€ thousands)</text>`;
  body += text(480, 690, 'Solid line: revenue, left axis. Dashed line: costs, right axis.', 28);
  const last = years.length - 1;
  if (!(pyL(revenue[last]) < pyR(costs[last]))) throw new Error('conventions: the revenue line must be drawn above costs');
  const answer = revenue[last] > costs[last] ? 'revenue' : costs[last] > revenue[last] ? 'costs' : 'same';
  return defineCard({
    id: 'conv-dual-axis-costs',
    title: 'Two axes',
    category: 'charts',
    difficulty: 3,
    prompt: 'In 2024, which was bigger?',
    kind: 'buttons',
    svg: svgDoc(body, '#FBF8F1'),
    options: [
      { id: 'revenue', label: 'Revenue', jev: 'Revenue.' },
      { id: 'costs', label: 'Costs', jev: 'Costs.' },
      { id: 'same', label: 'About the same', jev: 'About the same.' },
    ],
    answer,
    explain: `Each line has its own axis. In 2024 revenue is ${revenue[last]} thousand euros on the left axis and costs are ${costs[last]} thousand on the right axis, so costs are far bigger even though their line is lower.`,
    jev: {
      context: 'A line chart with two lines, revenue and costs, each read on its own vertical axis (left and right).',
      instructions: 'In `card`, which was bigger in 2024: revenue or costs?',
    },
    source: 'drawn',
  });
})();

// 12. A pie whose shares add up to 120% (a "pick all that apply" survey drawn as a pie).
const badPie = (() => {
  const slices = [
    { name: 'Dog', pct: 45, color: '#E07A5F' },
    { name: 'Cat', pct: 35, color: '#3D85C6' },
    { name: 'Fish', pct: 25, color: '#81B29A' },
    { name: 'Bird', pct: 15, color: '#F2CC8F' },
  ];
  const total = slices.reduce((s, x) => s + x.pct, 0);
  if (total === 100) throw new Error('conventions: the pie must not add to 100');
  if (new Set(slices.map((s) => s.pct)).size !== slices.length) throw new Error('conventions: no two equal slices');
  const cx = 360, cy = 380, R = 270;
  let body = text(480, 66, 'Pets our readers own', 36, 'font-weight="bold"');
  let a0 = 0;
  const pol = (r: number, deg: number): [number, number] => [cx + r * Math.sin((deg * Math.PI) / 180), cy - r * Math.cos((deg * Math.PI) / 180)];
  for (const s of slices) {
    const a1 = a0 + (s.pct / total) * 360;
    const [sx, sy] = pol(R, a0), [ex, ey] = pol(R, a1);
    body += `<path d="M ${cx} ${cy} L ${f1(sx)} ${f1(sy)} A ${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f1(ex)} ${f1(ey)} Z" fill="${s.color}" stroke="#FFFFFF" stroke-width="4"/>`;
    const [lx, ly] = pol(R * 0.62, (a0 + a1) / 2);
    body += text(lx, ly + 14, `${s.pct}%`, 40, 'font-weight="bold"');
    a0 = a1;
  }
  slices.forEach((s, i) => {
    const y = 250 + i * 80;
    body += `<rect x="690" y="${y - 32}" width="40" height="40" rx="6" fill="${s.color}"/><text x="746" y="${y}" ${FONT} font-size="36" fill="${INK}">${s.name}</text>`;
  });
  return defineCard({
    id: 'conv-pie-over-100',
    title: 'Does it add up?',
    category: 'charts',
    difficulty: 2,
    prompt: 'What is wrong with this chart?',
    kind: 'buttons',
    svg: svgDoc(body, '#FBF8F1'),
    options: [
      { id: 'nothing', label: 'Nothing is wrong', jev: 'Nothing is wrong.' },
      { id: 'over', label: `The shares add up to ${total}%`, jev: `The shares add up to ${total}%.` },
      { id: 'legend', label: 'The legend is missing a pet', jev: 'The legend is missing a pet.' },
      { id: 'order', label: 'The slices are in the wrong order', jev: 'The slices are in the wrong order.' },
    ],
    answer: 'over',
    explain: `A pie shows parts of one whole, so its shares must add up to 100%. These add up to ${slices.map((s) => s.pct).join(' + ')} = ${total}%, likely because readers could pick more than one pet; a bar chart would suit the data.`,
    jev: {
      context: 'A pie chart titled "Pets our readers own" with four slices labelled with percentages and a legend.',
      instructions: 'What is wrong with the chart in `card`?',
    },
    source: 'drawn',
  });
})();

// 13. Broken axis: the axis jumps from 30 to 380, so a bar 20 times taller in value is drawn only twice as tall.
const brokenAxis = (() => {
  const vals = [20, 25, 400];
  const names = ['A', 'B', 'C'];
  const x0 = 190, base = 620, lowTop = 30, hiLo = 380, hiHi = 420;
  const kLow = 9, kHi = 4, breakAt = base - lowTop * kLow, gapPx = 64, hiBase = breakAt - gapPx;
  const py = (v: number) => (v <= lowTop ? base - v * kLow : hiBase - (v - hiLo) * kHi);
  if (vals.some((v) => v > lowTop && v < hiLo) || vals.some((v) => v > hiHi)) throw new Error('conventions: values must fit the axis');
  let body = '';
  const ticks = [0, 10, 20, 30, 380, 400, 420];
  for (const v of ticks) {
    body += `<line x1="${x0}" y1="${py(v)}" x2="860" y2="${py(v)}" stroke="#D5D0C4" stroke-width="2"/>`;
    body += `<text x="${x0 - 16}" y="${py(v) + 11}" text-anchor="end" ${FONT} font-size="32" fill="${INK}">${v}</text>`;
  }
  body += `<line x1="${x0}" y1="${py(hiHi)}" x2="${x0}" y2="${hiBase}" stroke="${INK}" stroke-width="4"/><line x1="${x0}" y1="${breakAt}" x2="${x0}" y2="${base}" stroke="${INK}" stroke-width="4"/>`;
  body += `<line x1="${x0}" y1="${base}" x2="860" y2="${base}" stroke="${INK}" stroke-width="4"/>`;
  vals.forEach((v, i) => {
    const x = 270 + i * 210;
    body += `<rect x="${x}" y="${f1(py(v))}" width="140" height="${f1(base - py(v))}" fill="${i === 2 ? '#E07A5F' : '#9AA5B1'}"/>`;
    body += text(x + 70, base + 56, names[i], 44, 'font-weight="bold"');
  });
  // The break: a zigzag band across the axis and the tall bar.
  const zig = (xa: number, xb: number, y: number) => {
    let d = `M ${xa} ${y}`;
    for (let x = xa, up = true; x < xb; x += 14, up = !up) d += ` L ${Math.min(x + 14, xb)} ${y + (up ? -7 : 7)}`;
    return d;
  };
  const yMid = (breakAt + hiBase) / 2;
  body += `<rect x="${x0 - 4}" y="${hiBase + 2}" width="674" height="${gapPx - 4}" fill="#FBF8F1"/>`;
  body += `<path d="${zig(x0 - 14, 730, yMid - 10)}" fill="none" stroke="${INK}" stroke-width="3"/><path d="${zig(x0 - 14, 730, yMid + 10)}" fill="none" stroke="${INK}" stroke-width="3"/>`;
  const ratio = vals[2] / vals[0];
  const looks = (base - py(vals[2])) / (base - py(vals[0]));
  const choices = [2, 5, 20, 200];
  if (!choices.includes(ratio)) throw new Error('conventions: broken-axis answer must be an option');
  return defineCard({
    id: 'conv-broken-axis-times',
    title: 'Broken axis',
    category: 'charts',
    difficulty: 3,
    prompt: 'About how many times bigger is C than A?',
    kind: 'buttons',
    svg: svgDoc(body, '#FBF8F1'),
    options: choices.map((c) => ({ id: `x${c}`, label: `About ${c} times`, jev: `About ${c} times.` })),
    answer: `x${ratio}`,
    explain: `The zigzag marks a break: the axis jumps from 30 to 380. A is ${vals[0]} and C is ${vals[2]}, so C is ${ratio} times A, though its bar is drawn only about ${looks.toFixed(1)} times as tall.`,
    jev: {
      context: 'A bar chart with three bars, A, B and C, and a numbered vertical axis with a zigzag break in it.',
      instructions: 'In `card`, about how many times bigger is the value of C than the value of A?',
    },
    source: 'drawn',
  });
})();

export default [altoMiddleC, keySignature, threeClefs, ledgerLine, alaskaMexico, swedenMadagascar, conicPole, overlay, logScale, reversedRanks, dualAxis, badPie, brokenAxis];
