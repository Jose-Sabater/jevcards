/**
 * Runs cards through a model and prints what it answered, right or wrong, and how fast.
 *
 *   npm run bench                         every card, Jev 1.14
 *   npm run bench -- --model typesafe/jev-1.13.0
 *   npm run bench -- --cards fruit-peach,map-egypt --runs 3
 *   npm run bench -- --deck cards/deck-maps.json
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Card } from '../cards/lib.ts';
import { ask, cardPng, DEFAULT_MODEL, findModel } from '../server/jev.ts';

try {
  process.loadEnvFile();
} catch {
  // the environment alone
}
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const root = join(import.meta.dirname, '..');
const model = findModel(arg('model') ?? DEFAULT_MODEL);
if (!model) throw new Error('unknown model');
const runs = Number(arg('runs') ?? 1);
const pick = arg('cards')?.split(',');
const deck: Card[] = JSON.parse(readFileSync(join(root, arg('deck') ?? 'cards/deck.json'), 'utf8')).cards;
const cards = deck.filter((c) => !pick || pick.includes(c.id)).filter((c) => c.kind !== 'point' || model.box);

let right = 0, total = 0;
const lat: number[] = [];
for (const c of cards) {
  const marks: string[] = [];
  for (let i = 0; i < runs; i++) {
    try {
      const a = await ask(c, await cardPng(join(root, 'public'), c), model, process.env);
      total++;
      if (a.correct) right++;
      lat.push(a.latencyMs);
      const what = a.box ? `box c=(${((a.box.left + a.box.right) / 2).toFixed(2)},${((a.box.top + a.box.bottom) / 2).toFixed(2)}) conf ${a.confidence?.toFixed(2)}` : `${a.choice} ${Math.round((a.probabilities?.[a.choice!] ?? 0) * 100)}%`;
      marks.push(`${a.correct ? 'ok ' : 'NO '} ${what} ${a.latencyMs}ms`);
    } catch (e) {
      marks.push(`ERR ${(e as Error).message.slice(0, 120)}`);
    }
  }
  const want = c.kind === 'point' ? 'target' : c.answer;
  console.log(`${c.id.padEnd(28)} want ${String(want).padEnd(10)} ${marks.join(' | ')}`);
}
lat.sort((a, b) => a - b);
console.log(`\n${model.name}: ${right}/${total} right, median ${lat[Math.floor((lat.length - 1) / 2)] ?? '-'} ms`);
