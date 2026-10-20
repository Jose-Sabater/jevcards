import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Card } from '../cards/lib.ts';
import { Matches } from './match.ts';

const cards: Card[] = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'cards', 'deck.json'), 'utf8')).cards;
const deck = new Map(cards.map((c) => [c.id, c]));

/** A response that records what the server sends. */
function response(): ServerResponse & { body: Promise<any> } {
  let done!: (v: unknown) => void;
  const body = new Promise((r) => (done = r));
  const res = {
    headersSent: false,
    writableEnded: false,
    writeHead() {
      this.headersSent = true;
      return this;
    },
    end(text: string) {
      this.writableEnded = true;
      done(JSON.parse(text));
    },
    on() {},
    body,
  };
  return res as never;
}

test('a room: create, join, and a held poll answers when someone joins', async () => {
  const m = new Matches(async () => deck, async () => ({ correct: true, latencyMs: 300 }), async () => null);
  const host = m.create('AAA');
  const first = response();
  m.poll(host.code, host.token, -1, first);
  const v = (await first.body).version;
  const held = response();
  m.poll(host.code, host.token, v, held);
  let answered = false;
  void held.body.then(() => (answered = true));
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(answered, false, 'a poll with nothing new waits');
  m.join(host.code, 'BBB');
  const room = await held.body;
  assert.deepEqual(room.players.map((p: { name: string }) => p.name), ['AAA', 'BBB']);
  assert.throws(() => m.join(host.code, 'BBB'), /taken/);
  assert.throws(() => m.join(host.code, 'JEV'), /taken/);
});

test('the host stays host while away for a bit, and a leaving host hands over', async () => {
  const m = new Matches(async () => deck, async () => ({ correct: true, latencyMs: 300 }), async () => null);
  const host = m.create('AAA');
  const guest = m.join(host.code, 'BBB');
  // The host's phone stops asking (sharing the invite in another app) for longer than GONE_MS.
  const realNow = Date.now;
  Date.now = () => realNow() + 60_000;
  try {
    const seen = response();
    m.poll(host.code, guest.token, -1, seen);
    const room = await seen.body;
    assert.equal(room.players.find((p: { id: string }) => p.id === room.host).name, 'AAA', 'still the host after a minute away');
    await assert.rejects(m.start(host.code, guest.token), /only the host/);
  } finally {
    Date.now = realNow;
  }
  m.leave(host.code, host.token);
  const after = response();
  m.poll(host.code, guest.token, -1, after);
  const room = await after.body;
  assert.deepEqual(room.players.map((p: { name: string }) => p.name), ['BBB']);
  assert.equal(room.host, room.me, 'the guest hosts once the host leaves');
  m.leave(host.code, guest.token);
  assert.equal(m.summary(host.code), null, 'an empty room ends');
});

test('one visitor may keep 5 rooms open, and a lobby nobody watches closes after 5 minutes', () => {
  const m = new Matches(async () => deck, async () => ({ correct: true, latencyMs: 300 }), async () => null);
  const codes = Array.from({ length: 5 }, () => m.create('AAA', '1.2.3.4').code);
  assert.throws(() => m.create('AAA', '1.2.3.4'), /5 matches open/);
  assert.ok(m.create('BBB', '5.6.7.8'), 'someone else still can');
  const realNow = Date.now;
  Date.now = () => realNow() + 6 * 60_000;
  try {
    assert.ok(m.create('AAA', '1.2.3.4'), 'the abandoned lobbies were closed');
    assert.equal(m.summary(codes[0]), null);
  } finally {
    Date.now = realNow;
  }
});

test('a finished match is counted toward Jev\'s tally, and every card is logged', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() });
  const results: string[] = [];
  const rounds: { players: unknown[]; jev: unknown }[] = [];
  const m = new Matches(async () => deck, async () => ({ correct: true, latencyMs: 300 }), async () => null, { result: (e) => results.push(e.winner), round: (e) => rounds.push(e) });
  const host = m.create('AAA');
  m.setRounds(host.code, host.token, 5);
  await m.start(host.code, host.token);
  for (let i = 0; i < 200 && !results.length; i++) {
    t.mock.timers.tick(1_000);
    await new Promise((r) => setImmediate(r));
  }
  assert.deepEqual(results, ['jev'], 'Jev answered every card right; the host none');
  assert.equal(rounds.length, 5, 'every card is logged');
  assert.deepEqual([rounds[0].players, rounds[0].jev], [[null], { right: true, ms: 300 }], 'the host gave no answer; Jev was right');
});
