import { strict as assert } from 'node:assert';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
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
