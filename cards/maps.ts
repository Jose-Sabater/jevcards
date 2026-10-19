/**
 * Map cards: continents drawn with d3-geo from Natural Earth (world-atlas, 1:50m), no labels.
 * The target of a point card is the country's own projected outline, so picture and answer share one source.
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
const BORDER = '#8C8C8C';
const HIGHLIGHT = '#E8743B';
const MARGIN = 24;

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
      return `<path d="${d}" fill="${fill}" stroke="${BORDER}" stroke-width="0.7" stroke-linejoin="round"/>`;
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

/** Throws when the country's own centroid misses the target or a neighbor's centroid hits it. */
function check(p: GeoProjection, id: string, target: Region, neighbors: (string | [number, number])[]): void {
  const at = (cid: string | [number, number]) => {
    // A neighbor is checked at its centroid, or at a given point when its centroid falls outside it (Vietnam).
    const xy = p(typeof cid === 'string' ? geoCentroid(country(cid)) : cid)!;
    return [xy[0] / W, xy[1] / H] as const;
  };
  const [x, y] = at(id);
  if (!inside(target, x, y)) throw new Error(`maps: centroid of ${id} is not inside its target`);
  for (const n of neighbors) {
    const [nx, ny] = at(n);
    if (inside(target, nx, ny, 0.01)) throw new Error(`maps: centroid of neighbor ${n} is inside the target of ${id}`);
  }
  // The mainland must be tappable: at least about 25 px across.
  const r = (target as Extract<Region, { type: 'poly' }>).rings.reduce((a, b) => (b.length > a.length ? b : a));
  const xs = r.map((q) => q[0] * W), ys = r.map((q) => q[1] * H);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  if (Math.min(w, h) < 25) throw new Error(`maps: ${id} is only ${w.toFixed(0)}x${h.toFixed(0)} px`);
}

function pointCard(o: {
  id: string;
  name: string;
  iso: string;
  neighbors: (string | [number, number])[];
  region: string;
  lon: [number, number];
  lat: [number, number];
  difficulty: 1 | 2 | 3;
  explain: string;
}): CardSpec {
  const p = projectionFor(o.lon, o.lat);
  const target = targetOf(p, o.iso);
  check(p, o.iso, target, o.neighbors);
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

const asia = projectionFor([25, 150], [-10, 60]);

export default [
  pointCard({
    id: 'map-egypt',
    name: 'Egypt',
    iso: '818',
    neighbors: ['434', '729'],
    region: 'Africa',
    lon: [-20, 52],
    lat: [-36, 38],
    difficulty: 1,
    explain: 'Egypt sits in the northeast corner of Africa, where the Nile meets the Mediterranean; its Sinai peninsula reaches into Asia.',
  }),
  pointCard({
    id: 'map-paraguay',
    name: 'Paraguay',
    iso: '600',
    neighbors: ['068', '032', '076'],
    region: 'South America',
    lon: [-82, -34],
    lat: [-56, 13],
    difficulty: 2,
    explain: 'Paraguay is landlocked between Bolivia, Brazil and Argentina, yet it has one of the largest navies of any landlocked country.',
  }),
  pointCard({
    id: 'map-switzerland',
    name: 'Switzerland',
    iso: '756',
    neighbors: ['276', '250', '380', '040'],
    region: 'Europe',
    lon: [-11, 35],
    lat: [35, 66],
    difficulty: 2,
    explain: 'Switzerland is wedged between France, Germany, Austria and Italy, in the middle of the Alps.',
  }),
  pointCard({
    id: 'map-laos',
    name: 'Laos',
    iso: '418',
    neighbors: ['764', [105.85, 21.03], [106.7, 10.8], '116', '104', '156'], // Vietnam's centroid lies in Laos: Hanoi and Ho Chi Minh City
    region: 'Asia',
    lon: [25, 150],
    lat: [-10, 60],
    difficulty: 3,
    explain: 'Laos is the only landlocked country in Southeast Asia, squeezed between Thailand and Vietnam along the Mekong.',
  }),
  defineCard({
    id: 'map-which-mongolia',
    title: 'Which country?',
    category: 'maps',
    difficulty: 2,
    prompt: 'Which country is highlighted?',
    kind: 'buttons',
    svg: drawMap(asia, '496'),
    options: [
      { id: 'kazakhstan', label: 'Kazakhstan', jev: 'Kazakhstan' },
      { id: 'mongolia', label: 'Mongolia', jev: 'Mongolia' },
      { id: 'kyrgyzstan', label: 'Kyrgyzstan', jev: 'Kyrgyzstan' },
      { id: 'uzbekistan', label: 'Uzbekistan', jev: 'Uzbekistan' },
    ],
    answer: 'mongolia',
    explain: 'Mongolia sits between Russia and China and is the most sparsely populated sovereign country on Earth.',
    jev: {
      context: 'A map of Asia with country borders and no labels, with one country filled in orange.',
      instructions: 'Which country is filled in orange in `card`?',
    },
    source: 'drawn',
  }),
];
