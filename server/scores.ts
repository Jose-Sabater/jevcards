/**
 * Ranked games: signed deals, the server-side check of a recorded game, the leaderboards and share links.
 *
 *   deal       `<mode>.<cards>.<limitMs>.<box>.<seed>.<issuedAt>.<sig>`: fixes a game's setup and which cards it
 *              gets, in which order (shared/game.ts). Any setup the game offers can be dealt and shared; only the
 *              standard one ranks.
 *   mark       the page sends each answer as it is given (POST /api/mark) and gets back right or wrong and the
 *              card's solution: the deck the page loads has no answers. The server keeps the answers it marked,
 *              in order, one per card; what counts at the end is that list, not the page's recording.
 *   check      replays a game's answers against the deck: every answer is re-marked here, the score is the
 *              server's own count, and a game that is faster than possible, longer than the time since its deal,
 *              or on other cards is refused.
 *   boards     the top 10 per mode, three-letter initials, one line per player (the decision-benchmarks kit's
 *              shape: { initials, score, at, who }), kept in a JSON file in the data directory.
 *   share      `/r/<payload>.<sig>`: a finished game anyone can open, with the server-checked numbers.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Card } from '../cards/lib.ts';
import { cleanSetup, deal, isRanked, isRight, jevAnswerMessage, jevScore, lowerIsBetter, MODES, score, solutionOf, type Mode, type RecordedAnswer, type Recording, type Setup, type Solution } from '../shared/game.ts';
import { TAUNTS } from './taunt-lines.ts';
import type { Signer } from './sign.ts';

/** A deal is good for two hours: a game, then entering initials, with room to spare. */
export const DEAL_TTL_MS = 2 * 60 * 60 * 1000;
/** Nobody reads a card and taps the answer in under 150 ms. */
const MIN_MS = 150;
const MAX_SPRINT_CARD_MS = 120_000;
export const BOARD_SIZE = 10;

export class GameError extends Error {}

// ---------------------------------------------------------------------------------------------------- deals

export function issueDeal(s: Signer, setup: Setup, now = Date.now()): { deal: string; seed: number } {
  const seed = Math.floor(Math.random() * 2 ** 31);
  const body = `${setup.mode}.${setup.cards}.${setup.limitMs}.${setup.box ? 1 : 0}.${seed}.${now}`;
  return { deal: `${body}.${s.sign('deal', body)}`, seed };
}

export function readDeal(s: Signer, token: unknown, now = Date.now()): { setup: Setup; seed: number; issuedAt: number; id: string } {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 7) throw new GameError('bad deal');
  const [mode, cards, limit, box, seed, at, sig] = parts;
  if (!s.verify('deal', parts.slice(0, 6).join('.'), sig)) throw new GameError('bad deal');
  const setup = cleanSetup(mode, cards, limit, box);
  if (!setup) throw new GameError('bad deal');
  const issuedAt = Number(at);
  if (!(now - issuedAt < DEAL_TTL_MS) || issuedAt > now + 60_000) throw new GameError('this game is too old to count');
  return { setup, seed: Number(seed), issuedAt, id: sig };
}

/** The card ids a deal gets, in order; throws when the deal is not good (forged, or too old). */
export function dealtCards(s: Signer, deck: Map<string, Card>, token: unknown, now = Date.now()): { d: ReturnType<typeof readDeal>; ids: string[] } {
  const d = readDeal(s, token, now);
  return { d, ids: deal(playable(deck, d.setup.box), d.setup.mode, d.seed, d.setup.cards) };
}

/** The cards a setup deals from: all of them, or all but the "tap the place" ones. */
export const playable = (deck: Map<string, Card>, box: boolean): Card[] => [...deck.values()].filter((c) => box || c.kind !== 'point');

// ---------------------------------------------------------------------------------------------------- mark

/** Games being played: more than this and the oldest are dropped (their players can still finish, unranked). */
const MAX_GAMES = 50_000;

/**
 * The answers of the games in progress, by deal, as the server marked them. In memory: a restart loses them, and
 * a game that was going on then cannot be checked (it is dealt again with the next game).
 */
export class Games {
  private games = new Map<string, { answers: RecordedAnswer[]; at: number }>();
  private swept = 0;

  /**
   * Marks answer `index` of a deal: it must be the next one, for the card dealt there. The same answer sent again
   * (a retry after a dropped connection) gets the same mark. A time under the minimum counts as the minimum, and
   * one over the limit as the limit, so a stray double tap or a slow timer does not spoil the game.
   */
  mark(s: Signer, deck: Map<string, Card>, token: unknown, index: number, a: { card?: unknown; option?: unknown; point?: unknown; ms?: unknown }, now = Date.now()): { right: boolean; solution: Solution } {
    const { d, ids } = dealtCards(s, deck, token, now);
    if (!Number.isInteger(index) || index < 0 || index >= ids.length || a.card !== ids[index]) throw new GameError('that is not the card dealt here');
    const point = Array.isArray(a.point) && a.point.length === 2 && a.point.every((v) => typeof v === 'number' && v >= 0 && v <= 1) ? (a.point as [number, number]) : undefined;
    const option = typeof a.option === 'string' ? a.option.slice(0, 40) : undefined;
    const limit = d.setup.mode === 'sprint' ? MAX_SPRINT_CARD_MS : d.setup.limitMs;
    const ms = Math.min(limit, Math.max(MIN_MS, Math.round(Number(a.ms) || 0)));
    const answer: RecordedAnswer = { card: ids[index], ...(option !== undefined ? { option } : {}), ...(point ? { point } : {}), ms };
    const card = deck.get(ids[index])!;

    const game = this.games.get(d.id) ?? { answers: [], at: now };
    const before = game.answers[index];
    if (before) {
      if (before.option !== answer.option || String(before.point) !== String(answer.point)) throw new GameError('that card is already answered');
      return { right: isRight(card, before), solution: solutionOf(card) };
    }
    if (index !== game.answers.length) throw new GameError(index > game.answers.length ? 'an earlier card has no answer (the server may have restarted)' : 'that card is already answered');
    if (d.setup.mode === 'streak' && game.answers.some((x) => !isRight(deck.get(x.card)!, x))) throw new GameError('the streak is over');
    if (game.answers.reduce((t, x) => t + x.ms, ms) > now - d.issuedAt + 2_000) throw new GameError('the answer times add up to more than the game has lasted');
    game.answers.push(answer);
    game.at = now;
    if (!this.games.has(d.id)) {
      this.sweep(now);
      this.games.set(d.id, game);
    }
    return { right: isRight(card, answer), solution: solutionOf(card) };
  }

  /** The answers marked for a deal so far, or null when the server has none (an unknown or lost game). */
  answers(token: unknown): RecordedAnswer[] | null {
    const sig = String(token ?? '').split('.')[6];
    return (sig && this.games.get(sig)?.answers) || null;
  }

  private sweep(now: number): void {
    if (now - this.swept > 60_000) {
      this.swept = now;
      for (const [id, g] of this.games) if (now - g.at > DEAL_TTL_MS) this.games.delete(id);
    }
    while (this.games.size >= MAX_GAMES) this.games.delete(this.games.keys().next().value!);
  }
}

// ---------------------------------------------------------------------------------------------------- check

export interface CheckedGame {
  mode: Mode;
  setup: Setup;
  /** The standard setup: the only games that go on the boards. */
  ranked: boolean;
  dealId: string;
  score: number;
  right: number;
  cards: number;
  jev: { score: number; right: number } | null;
  taunt: string;
}

/**
 * Replays a recording. `deck` is every card by id; ranked games deal from the whole deck (Jev 1.14 answers
 * every kind of card).
 */
export function checkGame(s: Signer, raw: unknown, deck: Map<string, Card>, now = Date.now()): CheckedGame {
  const rec = raw as Recording;
  if (!rec || typeof rec !== 'object' || rec.version !== 1 || !Array.isArray(rec.answers)) throw new GameError('not a game recording');
  const d = readDeal(s, rec.deal, now);
  const mode = d.setup.mode;
  if (rec.mode !== mode) throw new GameError('wrong mode for this deal');
  const ids = deal(playable(deck, d.setup.box), mode, d.seed, d.setup.cards);
  const answers = rec.answers;
  if (mode !== 'streak' ? answers.length !== ids.length : answers.length < 1 || answers.length > ids.length) throw new GameError('wrong number of answers');

  const limit = mode === 'sprint' ? MAX_SPRINT_CARD_MS : d.setup.limitMs;
  const results = answers.map((a, i) => {
    if (!a || a.card !== ids[i]) throw new GameError('answers are not for the dealt cards');
    const ms = Number(a.ms);
    if (!Number.isInteger(ms) || ms < MIN_MS || ms > limit + 250) throw new GameError('an answer time is out of range');
    if (a.point && !(Array.isArray(a.point) && a.point.length === 2 && a.point.every((v) => typeof v === 'number' && v >= 0 && v <= 1))) throw new GameError('bad tap');
    const right = isRight(deck.get(a.card)!, a);
    return { right, ms: Math.min(ms, limit) };
  });
  if (mode === 'streak') {
    // A streak ends at the first miss: every answer before the last is right, and the last is wrong unless the deck ran out.
    if (results.slice(0, -1).some((r) => !r.right)) throw new GameError('a streak goes on after a miss');
    if (results.at(-1)!.right && results.length !== ids.length) throw new GameError('a streak ended without a miss');
  }
  // Answering cannot take longer than the time since the deal (with a little slack for clocks).
  const spent = results.reduce((t, r) => t + r.ms, 0);
  if (spent > now - d.issuedAt + 2_000) throw new GameError('the answer times add up to more than the game lasted');

  return {
    mode,
    setup: d.setup,
    ranked: isRanked(d.setup),
    dealId: d.id,
    score: score(mode, results, d.setup.limitMs),
    right: results.filter((r) => r.right).length,
    cards: results.length,
    jev: checkJev(s, rec, ids, answers.length, d.setup.limitMs),
    taunt: TAUNTS.some((t) => t.id === rec.taunt) ? String(rec.taunt) : '',
  };
}

/** Jev's side, only from answers the server signed, on the same cards. Null when it is incomplete. */
function checkJev(s: Signer, rec: Recording, ids: string[], played: number, limitMs: number): CheckedGame['jev'] {
  const jev = Array.isArray(rec.jev) ? rec.jev : [];
  const ok = (a: (typeof jev)[number], i: number) =>
    !!a && a.card === ids[i] && s.verify('answer', jevAnswerMessage({ card: a.card, correct: !!a.correct, latencyMs: Number(a.latencyMs), model: String(a.model) }), a.sig);
  if (rec.mode === 'streak') {
    // Jev's streak: the same cards in the same order, until its first miss (or the end of the deck).
    let n = 0;
    for (; n < jev.length && ok(jev[n], n); n++) if (!jev[n].correct) return { score: n, right: n };
    return n === ids.length ? { score: n, right: n } : null;
  }
  if (jev.length !== played || !jev.every(ok)) return null;
  return { score: jevScore(rec.mode, jev, limitMs), right: jev.filter((a) => a.correct).length };
}

// ---------------------------------------------------------------------------------------------------- boards

export interface ScoreEntry {
  initials: string;
  score: number;
  at: string;
  /** A one-way hash of the player (address and initials): one line each, never shown. */
  who: string;
}
export type PublicEntry = Omit<ScoreEntry, 'who'>;
export interface BoardsView {
  order: Mode[];
  boards: Record<Mode, PublicEntry[]>;
}

export const cleanInitials = (v: unknown): string | null => (typeof v === 'string' && /^[A-Z]{3}$/.test(v) ? v : null);

const better = (mode: Mode, a: number, b: number) => (lowerIsBetter(mode) ? a < b : a > b);

export class Boards {
  private boards: Record<Mode, ScoreEntry[]>;
  private file: string;
  /** Deals already on a board: a game enters once. Kept for as long as a deal is valid. */
  private used = new Map<string, number>();

  constructor(dir: string) {
    this.file = join(dir, 'highscores.json');
    mkdirSync(dir, { recursive: true });
    let stored: Partial<Record<Mode, ScoreEntry[]>> = {};
    try {
      stored = JSON.parse(readFileSync(this.file, 'utf8'));
    } catch {
      // a new file
    }
    this.boards = Object.fromEntries(MODES.map((m) => [m, (stored[m] ?? []).filter((e) => cleanInitials(e.initials) && Number.isFinite(e.score))])) as Record<Mode, ScoreEntry[]>;
  }

  view(): BoardsView {
    return { order: MODES, boards: Object.fromEntries(MODES.map((m) => [m, this.boards[m].map(({ who: _, ...e }) => e)])) as BoardsView['boards'] };
  }

  /** The place a score would take (1 is the top), or null when it would not make the board. Ties go below. */
  placeFor(mode: Mode, value: number): number | null {
    const place = this.boards[mode].filter((e) => !better(mode, value, e.score)).length + 1;
    return place <= BOARD_SIZE ? place : null;
  }

  /** Enters a checked game. Keeps a player's best only. Returns the place, or null when it did not make it. */
  add(game: CheckedGame, initials: string, who: string, now = Date.now()): number | null {
    for (const [id, at] of this.used) if (now - at > DEAL_TTL_MS) this.used.delete(id);
    if (!game.ranked) throw new GameError('only games with the standard settings go on the board');
    if (this.used.has(game.dealId)) throw new GameError('this game is already on the board');
    const board = this.boards[game.mode];
    const mine = board.find((e) => e.who === who);
    if (mine && !better(game.mode, game.score, mine.score)) return null;
    const place = this.placeFor(game.mode, game.score);
    if (place === null) return null;
    this.used.set(game.dealId, now);
    const next = board.filter((e) => e.who !== who);
    next.push({ initials, score: game.score, at: new Date(now).toISOString(), who });
    next.sort((a, b) => (lowerIsBetter(game.mode) ? a.score - b.score : b.score - a.score));
    this.boards[game.mode] = next.slice(0, BOARD_SIZE);
    this.save();
    return this.boards[game.mode].findIndex((e) => e.who === who) + 1 || null;
  }

  private save(): void {
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.boards, null, 1));
    renameSync(tmp, this.file);
  }
}

// ---------------------------------------------------------------------------------------------------- share

/** What a share link carries: the checked numbers, never the page's own claims. */
export interface ShareResult {
  mode: Mode;
  /** Versus: seconds per card (0 otherwise). */
  limitMs: number;
  score: number;
  right: number;
  cards: number;
  initials: string;
  jev: { score: number; right: number } | null;
  taunt: string;
  /** When the game was played (ms). */
  at: number;
}

export function shareToken(s: Signer, r: ShareResult): string {
  const body = Buffer.from(JSON.stringify([r.mode, r.score, r.right, r.cards, r.initials, r.jev?.score ?? null, r.jev?.right ?? null, r.taunt, Math.round(r.at / 1000), r.limitMs])).toString('base64url');
  return `${body}.${s.sign('share', body)}`;
}

export function readShare(s: Signer, token: string): ShareResult | null {
  const [body, sig] = token.split('.');
  if (!body || !sig || token.length > 600 || !s.verify('share', body, sig)) return null;
  try {
    const [mode, score, right, cards, initials, js, jr, taunt, at, limitMs] = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!MODES.includes(mode)) return null;
    return { mode, limitMs: Number(limitMs) || 0, score, right, cards, initials: cleanInitials(initials) ?? '', jev: js === null ? null : { score: js, right: jr }, taunt: TAUNTS.some((t) => t.id === taunt) ? taunt : '', at: at * 1000 };
  } catch {
    return null;
  }
}

/** Who won a shared game: 'person', 'jev', or 'draw'; null without Jev's side. */
export function winner(r: Pick<ShareResult, 'mode' | 'score' | 'jev'>): 'person' | 'jev' | 'draw' | null {
  if (!r.jev) return null;
  if (r.score === r.jev.score) return 'draw';
  return better(r.mode, r.score, r.jev.score) ? 'person' : 'jev';
}
