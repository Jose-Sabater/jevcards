import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { inside, type Card } from '../cards/lib.ts';
import { deal, forPage, jevAnswerMessage, standardSetup, type Mode, type RecordedAnswer, type Recording } from '../shared/game.ts';
import { Boards, checkGame, dealtCards, Games, issueDeal, readShare, shareToken, winner } from './scores.ts';
import { signer } from './sign.ts';

const cards: Card[] = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'cards', 'deck.json'), 'utf8')).cards;
const deck = new Map(cards.map((c) => [c.id, c]));
const s = signer('test-secret-test-secret-test-secret');

/** The right answer to a card, as the page would record it. */
function rightAnswer(c: Card, ms: number): RecordedAnswer {
  if (c.kind !== 'point') return { card: c.id, option: c.answer, ms };
  const t = c.target!;
  if (t.type === 'rect') return { card: c.id, point: [t.x + t.w / 2, t.y + t.h / 2], ms };
  if (t.type === 'circle') return { card: c.id, point: [t.cx, t.cy], ms };
  // A polygon: find a grid point inside it.
  for (let x = 0; x <= 1; x += 0.002) for (let y = 0; y <= 1; y += 0.002) if (inside(t, x, y)) return { card: c.id, point: [x, y], ms };
  throw new Error(`no point inside ${c.id}`);
}

function play(mode: Mode, opts: { ms?: number; wrongAt?: number; startedAgo?: number } = {}): Recording {
  const now = Date.now();
  const d = issueDeal(s, standardSetup(mode), now - (opts.startedAgo ?? 600_000));
  const ids = deal([...deck.values()], mode, d.seed);
  const n = mode === 'streak' ? (opts.wrongAt ?? 3) + 1 : ids.length;
  const answers = ids.slice(0, n).map((id, i) => {
    const a = rightAnswer(deck.get(id)!, opts.ms ?? 2000);
    return i === opts.wrongAt ? { card: id, option: 'nope', ms: a.ms } : a;
  });
  return { version: 1, mode, deal: d.deal, answers };
}

test('an honest sprint scores its time plus penalties', () => {
  const g = checkGame(s, play('sprint', { ms: 2000, wrongAt: 4 }), deck);
  assert.equal(g.right, 9);
  assert.equal(g.score, 10 * 2000 + 5000);
});

test('an honest versus scores points, and a streak counts until the first miss', () => {
  assert.equal(checkGame(s, play('versus', { ms: 5000 }), deck).score, 10 * 125);
  assert.equal(checkGame(s, play('streak', { wrongAt: 3 }), deck).score, 3);
});

test('cheats are refused', () => {
  const tooFast = play('sprint', { ms: 50 });
  assert.throws(() => checkGame(s, tooFast, deck), /out of range/);
  const longerThanGame = play('sprint', { ms: 5000, startedAgo: 10_000 });
  assert.throws(() => checkGame(s, longerThanGame, deck), /more than the game lasted/);
  const otherCards = play('sprint');
  otherCards.answers[0] = { ...otherCards.answers[0], card: otherCards.answers[1].card };
  assert.throws(() => checkGame(s, otherCards, deck), /dealt cards/);
  const forged = play('sprint');
  forged.deal = forged.deal.replace(/\.[\w-]+$/, '.AAAAAAAAAAAAAAAAAAAAAA');
  assert.throws(() => checkGame(s, forged, deck), /bad deal/);
  const streakPastMiss = play('streak', { wrongAt: 1 });
  streakPastMiss.answers.push(rightAnswer(deck.get(deal([...deck.values()], 'streak', 0)[0])!, 1000));
  assert.throws(() => checkGame(s, streakPastMiss, deck));
});

test("Jev's side counts only with signed answers", () => {
  const rec = play('sprint', { ms: 2000 });
  const jev = rec.answers.map((a) => {
    const m = { card: a.card, correct: true, latencyMs: 300, model: 'typesafe/jev-1.14.0' };
    return { ...m, sig: s.sign('answer', jevAnswerMessage(m)) };
  });
  assert.deepEqual(checkGame(s, { ...rec, jev }, deck).jev, { score: 3000, right: 10 });
  jev[0] = { ...jev[0], latencyMs: 1 };
  assert.equal(checkGame(s, { ...rec, jev }, deck).jev, null);
});

test('boards rank, keep a best per player, take a game once, and share links round-trip', () => {
  const b = new Boards(mkdtempSync(join(tmpdir(), 'jev-cards-')));
  const g = checkGame(s, play('sprint', { ms: 3000 }), deck);
  assert.equal(b.add(g, 'JOS', 'who-1'), 1);
  assert.throws(() => b.add(g, 'JOS', 'who-1'), /already/);
  const faster = checkGame(s, play('sprint', { ms: 2000 }), deck);
  assert.equal(b.add(faster, 'ANA', 'who-2'), 1);
  assert.deepEqual(b.view().boards.sprint.map((e) => e.initials), ['ANA', 'JOS']);
  const token = shareToken(s, { ...faster, limitMs: 0, initials: 'ANA', at: Date.now() });
  const back = readShare(s, token)!;
  assert.equal(back.score, faster.score);
  assert.equal(readShare(s, token.slice(0, -2) + 'xx'), null);
  assert.equal(winner({ mode: 'sprint', score: 20000, jev: { score: 3000, right: 10 } }), 'jev');
});

test('a deal takes every theme in turn: ten cards, ten themes', () => {
  const themes = new Set([...deck.values()].map((c) => c.category));
  for (const seed of [1, 2, 3, 42]) {
    const ids = deal([...deck.values()], 'versus', seed, 10);
    const dealt = ids.map((id) => deck.get(id)!.category);
    assert.equal(new Set(dealt).size, Math.min(10, themes.size), `seed ${seed}: ${dealt.join(', ')}`);
    assert.deepEqual(deal([...deck.values()], 'versus', seed, 10), ids, 'same seed, same deal');
  }
  const all = deal([...deck.values()], 'streak', 7);
  assert.equal(new Set(all).size, deck.size, 'a streak deals every card once');
});

test('the page deck has no answers, and the server marks each answer in order and gives the solution', () => {
  for (const c of deck.values()) {
    const p = forPage(c) as Partial<Card>;
    assert.ok(!p.answer && !p.target && !p.explain && !p.options?.some((o) => o.region && o.label), c.id);
  }
  const g = new Games();
  const now = Date.now();
  const d = issueDeal(s, standardSetup('sprint'), now - 600_000);
  const ids = deal([...deck.values()], 'sprint', d.seed);
  const answer = (i: number) => rightAnswer(deck.get(ids[i])!, 2000);
  assert.throws(() => g.mark(s, deck, d.deal, 1, answer(1), now), /earlier card/);
  assert.throws(() => g.mark(s, deck, d.deal, 0, answer(1), now), /not the card/);
  const first = g.mark(s, deck, d.deal, 0, answer(0), now);
  assert.equal(first.right, true);
  assert.equal(first.solution.explain, deck.get(ids[0])!.explain);
  assert.equal(g.mark(s, deck, d.deal, 0, answer(0), now).right, true, 'a retry gets the same mark');
  assert.throws(() => g.mark(s, deck, d.deal, 0, { card: ids[0], option: 'nope', ms: 2000 }, now), /already answered/);
  for (let i = 1; i < ids.length; i++) g.mark(s, deck, d.deal, i, i === 4 ? { card: ids[i], option: 'nope', ms: 2000 } : answer(i), now);
  // What counts is what the server marked: a recording that claims every answer was right changes nothing.
  const claimed = { version: 1 as const, mode: 'sprint' as const, deal: d.deal, answers: ids.map((_, i) => answer(i)) };
  const checked = checkGame(s, { ...claimed, answers: g.answers(d.deal)! }, deck, now);
  assert.equal(checked.right, 9);
  assert.equal(g.answers('not.a.deal'), null);

  const st = issueDeal(s, standardSetup('streak'), now - 600_000);
  const sids = deal([...deck.values()], 'streak', st.seed);
  assert.equal(g.mark(s, deck, st.deal, 0, { card: sids[0], ms: 10_000 }, now).right, false, 'no answer: the time ran out');
  assert.throws(() => g.mark(s, deck, st.deal, 1, rightAnswer(deck.get(sids[1])!, 2000), now), /streak is over/);
});

test('a deal names its cards, and a forged or old deal names none (Jev is only asked about dealt cards)', () => {
  const now = Date.now();
  const d = issueDeal(s, standardSetup('versus'), now - 60_000);
  assert.deepEqual(dealtCards(s, deck, d.deal, now).ids, deal([...deck.values()], 'versus', d.seed));
  assert.throws(() => dealtCards(s, deck, d.deal.slice(0, -2) + 'xx', now), /bad deal/);
  assert.throws(() => dealtCards(s, deck, issueDeal(s, standardSetup('versus'), now - 3 * 3600_000).deal, now), /too old/);
  assert.throws(() => dealtCards(s, deck, undefined, now), /bad deal/);
});
