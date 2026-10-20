import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Stats } from './stats.ts';
import { Tally } from './tally.ts';

test('the tally counts a game once per id, and survives a restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jev-cards-'));
  const t = new Tally(dir);
  assert.deepEqual(t.view(), { jev: 0, person: 0, draw: 0 });
  t.count('jev', 'deal-1');
  t.count('jev', 'deal-1');
  t.count('person', 'deal-2');
  t.count('draw');
  t.count('draw');
  assert.deepEqual(t.view(), { jev: 1, person: 1, draw: 2 }, 'the same deal sent twice counts once; matches have no id');
  assert.deepEqual(new Tally(dir).view(), { jev: 1, person: 1, draw: 2 });
});

test('the play log appends one JSON line per write', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'jev-cards-'));
  const s = new Stats(dir);
  s.write({ type: 'answer', who: 'person', right: true, ms: 900 });
  s.write({ type: 'game', winner: 'jev' });
  await s.flush();
  const lines = readFileSync(join(dir, 'stats.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.type), ['answer', 'game']);
  assert.ok(Date.parse(lines[0].t), 'every line has its time');
});
