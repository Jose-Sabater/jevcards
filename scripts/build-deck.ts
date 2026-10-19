/**
 * Builds the deck: every card module under cards/ and cards/season<N>/ (any .ts file but lib.ts and *.test.ts)
 * default-exports a CardSpec or an array of them. Each SVG is rendered to public/cards/<id>.png and the specs,
 * without their SVG, go to cards/deck.json, which only the server and the scripts read. The page loads
 * public/cards/deck.json: the same cards without their answers (forPage in shared/game.ts). Cards from
 * cards/season<N>/ carry `season: N`.
 *
 *   npm run deck                 every card
 *   npm run deck -- maps chess   only the cards in cards/maps.ts and cards/chess.ts (the deck keeps the others)
 *   npm run deck -- season1/sports   only cards/season1/sports.ts
 *   npm run deck -- maps --out cards/deck-maps.json   only those, into their own deck file (for npm run bench -- --deck)
 */
import { Resvg } from '@resvg/resvg-js';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { H, W, type Card, type CardSpec, type Region } from '../cards/lib.ts';
import { forPage } from '../shared/game.ts';

const root = join(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const outAt = argv.indexOf('--out');
const out = outAt >= 0 ? argv.splice(outAt, 2)[1] : undefined;
const only = argv;
const cardFiles = (dir: string) => readdirSync(join(root, dir)).filter((f) => f.endsWith('.ts') && f !== 'lib.ts' && !f.endsWith('.test.ts') && !f.startsWith('_'));
const seasons = readdirSync(join(root, 'cards'), { withFileTypes: true }).filter((d) => d.isDirectory() && /^season\d+$/.test(d.name)).map((d) => d.name);
const files = [...cardFiles('cards'), ...seasons.flatMap((s) => cardFiles(`cards/${s}`).map((f) => `${s}/${f}`))];
const deckPath = join(root, out ?? 'cards/deck.json');
const previous: Card[] = !out && existsSync(deckPath) ? JSON.parse(readFileSync(deckPath, 'utf8')).cards : [];

const built: Card[] = [];
const problems: string[] = [];
for (const f of files.sort()) {
  const group = f.replace(/\.ts$/, '');
  const season = /^season(\d+)\//.exec(f)?.[1];
  if (only.length && !only.includes(group)) {
    built.push(...previous.filter((c) => (c as Card & { group?: string }).group === group));
    continue;
  }
  const mod = await import(join(root, 'cards', f));
  const specs: CardSpec[] = [mod.default].flat();
  for (const spec of specs) {
    problems.push(...check(spec).map((p) => `${spec.id}: ${p}`));
    const png = new Resvg(spec.svg, {
      fitTo: { mode: 'original' },
      font: { loadSystemFonts: true, defaultFontFamily: 'Arial' },
    }).render().asPng();
    writeFileSync(join(root, 'public/cards', `${spec.id}.png`), png);
    const { svg: _svg, ...rest } = spec;
    built.push({ ...slim(rest), group, ...(season ? { season: Number(season) } : {}), image: `cards/${spec.id}.png`, width: W, height: H } as Card);
    console.log(`${spec.id.padEnd(28)} ${(png.length / 1024).toFixed(0).padStart(4)} KB  ${spec.kind}`);
  }
}

const ids = new Set<string>();
for (const c of built) {
  if (ids.has(c.id)) problems.push(`${c.id}: duplicate id`);
  ids.add(c.id);
}
if (problems.length) {
  console.error('\n' + problems.join('\n'));
  process.exit(1);
}
// One card per line: readable in a diff, without the indentation that doubled the download.
const deckJson = (cards: object[]) => `{"version":1,"cards":[\n${cards.map((c) => JSON.stringify(c)).join(',\n')}\n]}\n`;
writeFileSync(deckPath, deckJson(built));
if (!out) writeFileSync(join(root, 'public/cards/deck.json'), deckJson(built.map(forPage)));
console.log(`\n${built.length} cards in ${out ?? 'cards/deck.json (and public/cards/deck.json, without the answers)'}`);

/**
 * Smaller tap regions for the download: polygon points rounded to 1/10000 of the picture and thinned where they sit
 * closer than 1/1000 to the last kept one (about 1 px on the card). A country's outline keeps its shape; a tap on the
 * border was never exact anyway.
 */
function slim<T extends { options?: { region?: Region }[]; target?: Region }>(c: T): T {
  const thin = (r?: Region): Region | undefined => {
    if (!r || r.type !== 'poly') return r;
    const rings = r.rings.map((ring) => {
      const kept: [number, number][] = [];
      for (const [x, y] of ring) {
        const last = kept[kept.length - 1];
        if (!last || Math.hypot(x - last[0], y - last[1]) >= 0.001) kept.push([Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);
      }
      return kept;
    }).filter((ring) => ring.length >= 3);
    // Never thin a region away: tiny islands keep their points.
    return rings.length ? { type: 'poly', rings } : r;
  };
  return { ...c, ...(c.target ? { target: thin(c.target) } : {}), ...(c.options ? { options: c.options.map((o) => (o.region ? { ...o, region: thin(o.region) } : o)) } : {}) };
}

function check(c: CardSpec): string[] {
  const p: string[] = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id)) p.push('id must be kebab-case');
  if (!c.svg.includes(`width="${W}"`) || !c.svg.includes(`height="${H}"`)) p.push(`svg must be ${W}x${H}`);
  if (!c.jev.instructions.includes('`card`')) p.push('jev.instructions must refer to the picture as `card`');
  if (/—/.test(JSON.stringify({ ...c, svg: '' }))) p.push('no em dashes in text');
  if (c.kind === 'point') {
    if (!c.target) p.push('point cards need a target');
  } else {
    const o = c.options ?? [];
    if (o.length < 2 || o.length > 8) p.push('2 to 8 options');
    if (!o.some((x) => x.id === c.answer)) p.push('answer must be an option id');
    if (c.kind === 'pick' && o.filter((x) => x.region).length < 2) p.push('pick cards need two or more options with regions');
    if (c.kind === 'buttons' && o.some((x) => x.region)) p.push('buttons options have no regions');
    if (new Set(o.map((x) => x.id)).size !== o.length) p.push('option ids must be unique');
  }
  return p;
}
