import type { Card } from '../cards/lib.ts';
import type { MatchResult } from '../server/taunts.ts';
import type { SignedJevAnswer, Solution } from '../shared/game.ts';

export type { Card, MatchResult };

export interface JevAnswer {
  model: string;
  choice?: string;
  probabilities?: Record<string, number>;
  box?: { top: number; bottom: number; left: number; right: number };
  confidence?: number;
  correct: boolean;
  latencyMs: number;
  costUsd: number;
  /** The server's signature over this answer, for share links. */
  signed?: SignedJevAnswer;
}

export interface ModelInfo {
  id: string;
  name: string;
  box: boolean;
  available: boolean;
}

/**
 * The deck, without answers: a card's answer, target, explanation and the names of the things in its picture
 * arrive once it is answered (learn), from the server's mark or a live match's reveal.
 */
export async function loadDeck(): Promise<Card[]> {
  const res = await fetch('/cards/deck.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`no deck (HTTP ${res.status}): run npm run deck`);
  return (await res.json()).cards;
}

/** Fills in what a card's answer is, once the server has said (the same card object the game holds). */
export function learn(card: Card, s: Solution): void {
  card.answer = s.answer;
  card.target = s.target;
  card.explain = s.explain;
  for (const o of card.options ?? []) if (s.labels[o.id]) o.label = s.labels[o.id];
}

/**
 * Has the server mark one answer of a dealt game (in order: card `index` of the deal) and learns the card's
 * solution. Tries again when the connection drops: the server gives a repeated answer the same mark.
 */
export async function markAnswer(deal: string, index: number, card: Card, a: { option?: string; point?: { x: number; y: number }; ms: number }): Promise<boolean> {
  const body = JSON.stringify({ deal, index, card: card.id, option: a.option, point: a.point ? [a.point.x, a.point.y] : undefined, ms: Math.round(a.ms) });
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch('/api/mark', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    } catch (e) {
      if (attempt >= 3) throw new Error('Lost the connection to the game');
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    learn(card, data.solution);
    return data.right;
  }
}

export async function loadModels(): Promise<{ models: ModelInfo[]; default: string }> {
  const res = await fetch('/api/models');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Asks Jev one card. Rejects with the server's message. */
export async function askJev(card: string, model: string, deal?: string, signal?: AbortSignal): Promise<JevAnswer> {
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card, model, deal }),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as JevAnswer;
}

/**
 * Jev's answers for one game, asked one at a time in the order given, so a game can ask ahead (a sprint asks
 * every card at the start) without flooding the server. `get` starts a card's question if it is not queued yet.
 */
export class JevQueue {
  private answers = new Map<string, Promise<JevAnswer>>();
  private chain: Promise<unknown> = Promise.resolve();
  private ctrl = new AbortController();
  private model: string;
  /** The game's deal: the server only asks Jev about the cards dealt in it. */
  private deal: string;
  constructor(model: string, deal: string) {
    this.model = model;
    this.deal = deal;
  }

  get(card: string): Promise<JevAnswer> {
    let p = this.answers.get(card);
    if (!p) {
      p = this.chain.then(() => askJev(card, this.model, this.deal, this.ctrl.signal));
      // A failed question must not stop the ones after it.
      this.chain = p.catch(() => undefined);
      this.answers.set(card, p);
    }
    return p;
  }

  stop(): void {
    this.ctrl.abort();
  }
}

export interface TauntAnswer {
  choice: string;
  probabilities: Record<string, number>;
  latencyMs: number;
  /** The mood Jev was given, and the lines it chose from. */
  mood: string;
  offered: string[];
}

/** Asks Jev which line it says after the match. */
export async function askTaunt(result: MatchResult, model: string): Promise<TauntAnswer> {
  const res = await fetch('/api/taunt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...result, model }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as TauntAnswer;
}
