/**
 * The rules both sides agree on: which cards a game deals, how a game is recorded, and how it scores. The page
 * plays by them and the server replays a recording by them, so a score on a leaderboard or in a share link is
 * the server's own count, never what the page claims (the same idea as the decision-benchmarks kit).
 */
import { inside, type Card, type Region } from '../cards/lib.ts';

export type Mode = 'sprint' | 'versus' | 'streak';

/** The ranked setup of each mode. Games with other settings play the same but do not rank. */
export const RANKED = {
  sprint: { cards: 10, penaltyMs: 5_000, label: 'Sprint', unit: 'time' as const },
  versus: { cards: 10, limitMs: 10_000, label: 'Versus', unit: 'points' as const },
  streak: { limitMs: 10_000, label: 'Streak', unit: 'in a row' as const },
};
export const MODES: Mode[] = ['sprint', 'versus', 'streak'];

/** Lower is better for Sprint (a time), higher for the others. */
export const lowerIsBetter = (mode: Mode): boolean => mode === 'sprint';

/** A small seeded random generator (mulberry32), so the page and the server deal the same cards. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A game's setup: how many cards (Sprint) or rounds (Versus), the time per card (Versus), and whether the deck
 * includes "tap the place" cards (only models that answer boxes play those). Only the standard setup ranks.
 */
export interface Setup {
  mode: Mode;
  /** Sprint and Versus: cards dealt. Streak: the whole deck (0 here). */
  cards: number;
  /** Versus and Streak: ms per card. Sprint: 0 (no limit). */
  limitMs: number;
  /** Point cards included. */
  box: boolean;
}

export const SPRINT_CARDS = [5, 10, 20, 999];
export const VERSUS_LIMITS = [3_000, 5_000, 10_000, 15_000];

export const standardSetup = (mode: Mode): Setup =>
  mode === 'sprint' ? { mode, cards: RANKED.sprint.cards, limitMs: 0, box: true } : mode === 'versus' ? { mode, cards: RANKED.versus.cards, limitMs: RANKED.versus.limitMs, box: true } : { mode, cards: 0, limitMs: RANKED.streak.limitMs, box: true };

export const isRanked = (s: Setup): boolean => {
  const std = standardSetup(s.mode);
  return s.cards === std.cards && s.limitMs === std.limitMs && s.box === std.box;
};

/** A setup from untrusted input, or null when it is not one the game offers. */
export function cleanSetup(mode: unknown, cards: unknown, limitMs: unknown, box: unknown): Setup | null {
  if (!MODES.includes(mode as Mode)) return null;
  const b = box === true || box === '1' || box === 1;
  if (mode === 'sprint') return SPRINT_CARDS.includes(Number(cards)) ? { mode, cards: Number(cards), limitMs: 0, box: b } : null;
  if (mode === 'versus') return VERSUS_LIMITS.includes(Number(limitMs)) ? { mode, cards: RANKED.versus.cards, limitMs: Number(limitMs), box: b } : null;
  return { mode: 'streak', cards: 0, limitMs: RANKED.streak.limitMs, box: b };
}

/** The card ids a game deals, in order: the playable cards sorted by id, shuffled by the seed. */
export function deal(playable: readonly { id: string; category: string }[], mode: Mode, seed: number, cards: number = mode === 'sprint' ? RANKED.sprint.cards : RANKED.versus.cards): string[] {
  // Themes take turns, so a game is not all maps because maps are the biggest theme: each round deals one card
  // from every theme, the themes in a fresh order each round, until the cards run out. Same seed, same deal.
  const r = rng(seed);
  const shuffle = <T>(xs: T[]): T[] => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    return xs;
  };
  const byTheme = new Map<string, string[]>();
  for (const c of [...playable].sort((a, b) => (a.id < b.id ? -1 : 1))) byTheme.set(c.category, [...(byTheme.get(c.category) ?? []), c.id]);
  const piles = [...byTheme.keys()].sort().map((t) => shuffle(byTheme.get(t)!));
  const ids: string[] = [];
  while (piles.some((p) => p.length)) for (const p of shuffle(piles.filter((x) => x.length))) ids.push(p.pop()!);
  return mode === 'streak' ? ids : ids.slice(0, cards);
}

/** One answer as the page records it. No option and no point means the time ran out. */
export interface RecordedAnswer {
  card: string;
  option?: string;
  point?: [number, number];
  ms: number;
}

/** One of Jev's answers, as the server signed it in /api/ask. */
export interface SignedJevAnswer {
  card: string;
  correct: boolean;
  latencyMs: number;
  model: string;
  sig: string;
}

export interface Recording {
  version: 1;
  mode: Mode;
  /** The signed deal from /api/deal. */
  deal: string;
  answers: RecordedAnswer[];
  /** Jev's answers on the same cards, for the Jev side of a share link. */
  jev?: SignedJevAnswer[];
  /** Jev's last word, if it had one (a line id from server/taunt-lines.ts). */
  taunt?: string;
}

/** Was this answer right? */
export function isRight(card: Card, a: RecordedAnswer): boolean {
  if (card.kind === 'point') return !!a.point && inside(card.target!, a.point[0], a.point[1], 0.01);
  return a.option === card.answer;
}

export const versusPoints = (right: boolean, ms: number, limitMs = RANKED.versus.limitMs): number =>
  right && ms <= limitMs ? 100 + Math.round(50 * Math.max(0, 1 - ms / limitMs)) : 0;

/** A game's score: Sprint in ms (time plus penalties), Versus in points, Streak in cards in a row. */
export function score(mode: Mode, results: { right: boolean; ms: number }[], limitMs: number = RANKED.versus.limitMs): number {
  if (mode === 'sprint') return results.reduce((s, r) => s + r.ms + (r.right ? 0 : RANKED.sprint.penaltyMs), 0);
  if (mode === 'versus') return results.reduce((s, r) => s + versusPoints(r.right, r.ms, limitMs), 0);
  const miss = results.findIndex((r) => !r.right);
  return miss < 0 ? results.length : miss;
}

/** Jev's score on the same cards, from its signed answers. */
export function jevScore(mode: Mode, answers: { correct: boolean; latencyMs: number }[], limitMs?: number): number {
  return score(mode, answers.map((a) => ({ right: a.correct, ms: a.latencyMs })), limitMs);
}

/** A score as people read it: 18.4 s, 1,240 points, 7 in a row. */
export function formatScore(mode: Mode, value: number): string {
  if (mode === 'sprint') return `${(value / 1000).toFixed(1)} s`;
  if (mode === 'versus') return `${value.toLocaleString('en-US')} pts`;
  return `${value} in a row`;
}

/** The message Jev's answers are signed over. */
export const jevAnswerMessage = (a: Omit<SignedJevAnswer, 'sig'>): string => `jev-cards:answer:${a.card}:${a.correct ? 1 : 0}:${a.latencyMs}:${a.model}`;

/** The cards the how-it-works page shows (src/how.ts): their solutions come with the request (GET /api/explain). */
export const HOW_EXAMPLES = ['fruit-peach', 'stroop-ink', 'map-egypt', 'big-cat-cheetah', 'flag-sweden', 'chess-mate-piece'];

/**
 * What the page learns about a card once it is answered: the right option or place, why, and what the things in
 * the picture are. The deck the page loads leaves all of this out (forPage), so the answers are not in the
 * download; the server sends a card's solution with its mark (POST /api/mark), or at a live match's reveal.
 */
export interface Solution {
  answer?: string;
  target?: Region;
  explain: string;
  /** pick cards: what each thing in the picture is, by option id. */
  labels: Record<string, string>;
}

export const solutionOf = (c: Card): Solution => ({
  answer: c.answer,
  target: c.target,
  explain: c.explain,
  labels: Object.fromEntries((c.options ?? []).filter((o) => o.region).map((o) => [o.id, o.label])),
});

/** A card as the page loads it: no answer, no target, no explanation, and the things in the picture unnamed. */
export function forPage(c: Card): Omit<Card, 'answer' | 'target' | 'explain'> {
  const { answer: _a, target: _t, explain: _e, ...rest } = c;
  return { ...rest, ...(c.options ? { options: c.options.map(({ label, ...o }) => (o.region ? { ...o, label: '' } : { ...o, label })) } : {}) };
}
