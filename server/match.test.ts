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
