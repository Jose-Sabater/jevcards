/**
 * Asks a decision model one card: the card's picture and its question, in the System One wire format with
 * TypeSafe's `assets` map. Scores the answer against the card.
 *
 * Routes: through the Opper gateway when OPPER_API_KEY is set, else straight to TypeSafe with TYPESAFE_API_KEY.
 * JEV_ROUTE=typesafe picks TypeSafe when both keys are set. The request is the same either way.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { boxHits, type Card } from '../cards/lib.ts';

export interface Model {
  id: string;
  name: string;
  /** Answers box questions (point cards). */
  box: boolean;
  /** TypeSafe's own id, to call it there directly. */
  typesafeId?: string;
  usdPerMillionInput: number;
}

export const MODELS: readonly Model[] = [
  { id: 'typesafe/jev-1.14.0', name: 'Jev 1.14', box: true, typesafeId: 'jev-1.14.0', usdPerMillionInput: 0.042 },
  { id: 'typesafe/jev-1.13.0', name: 'Jev 1.13', box: false, typesafeId: 'jev-1.13.0', usdPerMillionInput: 0.042 },
];
export const DEFAULT_MODEL = MODELS[0].id;
export const findModel = (id: unknown): Model | undefined => MODELS.find((m) => m.id === id);

export interface Env {
  OPPER_API_KEY?: string;
  OPPER_BASE_URL?: string;
  TYPESAFE_API_KEY?: string;
  TYPESAFE_BASE_URL?: string;
  JEV_ROUTE?: string;
}

export interface JevAnswer {
  model: string;
  /** pick and buttons: the option Jev chose. */
  choice?: string;
  probabilities?: Record<string, number>;
  /** point: Jev's box, as fractions of the picture. */
  box?: { top: number; bottom: number; left: number; right: number };
  confidence?: number;
  correct: boolean;
  latencyMs: number;
  inputTokens: number;
  costUsd: number;
  route: 'typesafe' | 'opper';
}

export class JevError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const TIMEOUT_MS = 10_000;
let counter = 0;

function route(m: Model, env: Env): { route: 'typesafe' | 'opper'; url: string; key: string; modelId: string } {
  if (m.typesafeId && env.TYPESAFE_API_KEY && (!env.OPPER_API_KEY || env.JEV_ROUTE === 'typesafe')) {
    const base = (env.TYPESAFE_BASE_URL || 'https://api.typesafe.ai').replace(/\/+$/, '');
    return { route: 'typesafe', url: `${base}/v1/systemone`, key: env.TYPESAFE_API_KEY, modelId: m.typesafeId };
  }
  if (!env.OPPER_API_KEY) throw new JevError(503, 'no key: set OPPER_API_KEY (or TYPESAFE_API_KEY)');
  const base = (env.OPPER_BASE_URL || 'https://api.opper.ai').replace(/\/+$/, '');
  return { route: 'opper', url: `${base}/v3/compat/v1/systemone`, key: env.OPPER_API_KEY, modelId: m.id };
}

/**
 * The order Jev gets a card's options in: shuffled, under the neutral names option-1, option-2, ... The option ids
 * name the things ("peach"), so sending them would hand Jev the answer; neither the names nor the order may say
 * which option is right.
 */
export function optionOrder(card: Card, random = Math.random): string[] {
  const ids = (card.options ?? []).map((o) => o.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

const neutral = (i: number) => `option-${i + 1}`;

/** The System One body for a card, with the options in `order` under neutral names. Exported for tests. */
export function wireBody(card: Card, png: string, modelId: string, order = optionOrder(card)): unknown {
  // Placeholders are matched as plain text anywhere in the request, so make them impossible to hit by accident.
  const ph = `img-${Date.now().toString(36)}-${(counter++).toString(36)}-card`;
  const question =
    card.kind === 'point'
      ? { type: 'box', instructions: card.jev.instructions }
      : { type: 'choice', instructions: card.jev.instructions, criteria: Object.fromEntries(order.map((id, i) => [neutral(i), card.options!.find((o) => o.id === id)!.jev])) };
  return {
    model: modelId,
    state: { context: card.jev.context, card: ph },
    assets: { [ph]: { type: 'image', format: 'png', data_base64: png } },
    questions: { answer: question },
  };
}

const pngCache = new Map<string, Promise<string>>();
/** A card's picture as base64, read once per process. `dir` holds `cards/` (public/ in dev, dist/ when built). */
export const cardPng = (dir: string, card: Card): Promise<string> => {
  const file = join(dir, card.image);
  let p = pngCache.get(file);
  if (!p) {
    p = readFile(file).then((b) => b.toString('base64'));
    p.catch(() => pngCache.delete(file));
    pngCache.set(file, p);
  }
  return p;
};

/** Statuses that mean "busy, try again": rate limits and an overloaded model (TypeSafe answers 529). */
const BUSY = new Set([429, 503, 529]);
/** Waits before each retry of a busy answer: short, because a player is waiting. */
const RETRY_MS = [250, 700];

/**
 * One System One call on the model's route: the body is built for the route's own model id. A busy answer is
 * tried again a couple of times. Errors carry a short message for players; the provider's own text is logged.
 * The latency is the answering attempt's own, so a retry does not count against the model's speed.
 */
export async function systemOne<T>(model: Model, env: Env, body: (modelId: string) => unknown, fetchImpl: typeof fetch = fetch): Promise<{ data: T; latencyMs: number; route: 'typesafe' | 'opper'; modelId: string }> {
  const r = route(model, env);
  for (let attempt = 0; ; attempt++) {
    const started = performance.now();
    let res: Response;
    let text: string;
    try {
      res = await fetchImpl(r.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${r.key}`, 'Content-Type': 'application/json', 'TypeSafe-Danger-Zone-Images': 'true' },
        body: JSON.stringify(body(r.modelId)),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      text = await res.text();
    } catch (e) {
      console.warn(`${r.route}: no answer (${(e as Error).name})`);
      throw new JevError(504, `${model.name} took too long to answer`);
    }
    const latencyMs = Math.round(performance.now() - started);
    if (res.ok) return { data: JSON.parse(text) as T, latencyMs, route: r.route, modelId: r.modelId };
    if (BUSY.has(res.status) && attempt < RETRY_MS.length) {
      await new Promise((ok) => setTimeout(ok, RETRY_MS[attempt]));
      continue;
    }
    console.warn(`${r.route} answered ${res.status}: ${text.slice(0, 300)}`);
    if (BUSY.has(res.status)) throw new JevError(503, `${model.name} is overloaded right now`);
    throw new JevError(502, `${model.name} could not answer (error ${res.status})`);
  }
}

export async function ask(card: Card, png: string, model: Model, env: Env, fetchImpl: typeof fetch = fetch): Promise<JevAnswer> {
  if (card.kind === 'point' && !model.box) throw new JevError(400, `${model.name} answers no point cards`);
  const order = optionOrder(card);
  const { data, latencyMs, route: via, modelId } = await systemOne<{
    model?: string;
    answers?: { answer?: { choice?: string; probabilities?: Record<string, number>; box?: JevAnswer['box']; confidence?: number } };
    usage?: { input_tokens?: number };
  }>(model, env, (id) => wireBody(card, png, id, order), fetchImpl);
  const a = data.answers?.answer ?? {};
  // Back from the neutral names to the card's own option ids.
  const idOf = (key: string | undefined) => (key ? order[Number(key.replace('option-', '')) - 1] : undefined);
  const choice = idOf(a.choice);
  const probabilities = a.probabilities && Object.fromEntries(Object.entries(a.probabilities).map(([k, p]) => [idOf(k) ?? k, p]));
  const inputTokens = data.usage?.input_tokens ?? 0;
  const correct = card.kind === 'point' ? !!a.box && boxHits(card.target!, a.box) : choice === card.answer;
  return {
    model: data.model ?? modelId,
    choice,
    probabilities,
    box: a.box,
    confidence: a.confidence,
    correct,
    latencyMs,
    inputTokens,
    costUsd: (inputTokens * model.usdPerMillionInput) / 1_000_000,
    route: via,
  };
}
