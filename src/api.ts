import type { Card } from '../cards/lib.ts';
import type { MatchResult } from '../server/taunts.ts';
import type { SignedJevAnswer } from '../shared/game.ts';

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

export async function loadDeck(): Promise<Card[]> {
  const res = await fetch('/cards/deck.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`no deck (HTTP ${res.status}): run npm run deck`);
  return (await res.json()).cards;
}

export async function loadModels(): Promise<{ models: ModelInfo[]; default: string }> {
  const res = await fetch('/api/models');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Asks Jev one card. Rejects with the server's message. */
export async function askJev(card: string, model: string, signal?: AbortSignal): Promise<JevAnswer> {
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card, model }),
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
  constructor(model: string) {
    this.model = model;
  }

  get(card: string): Promise<JevAnswer> {
    let p = this.answers.get(card);
    if (!p) {
      p = this.chain.then(() => askJev(card, this.model, this.ctrl.signal));
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
