/**
 * Jev's last word: after a match, Jev picks one line to say out loud, in one System One `choice` question with
 * no picture. Jev gets a random mood and six random lines that suit the result (from taunt-lines.ts), and picks
 * the one that fits its mood: the choice is Jev's, and the same result still gets a different line most times.
 */
import { JevError, systemOne, type Env, type Model } from './jev.ts';
import { MOODS, TAUNTS, type Mood } from './taunt-lines.ts';

export { TAUNTS };

/** How many lines Jev chooses from. */
const OFFER = 6;

export interface MatchResult {
  mode: 'sprint' | 'versus' | 'streak';
  winner: 'jev' | 'person' | 'draw';
  /** Sprint: seconds (lower is better). Versus: points. Streak: cards in a row. */
  person: number;
  jev: number;
  personRight: number;
  jevRight: number;
  cards: number;
}

const UNITS = { sprint: 'seconds, lower is better', versus: 'points, higher is better', streak: 'cards in a row, higher is better' };

/** Checks a result from the page: numbers only, in sane ranges, so the question can only ever be about a match. */
export function parseResult(b: Record<string, unknown>): MatchResult {
  const num = (k: string, max: number): number => {
    const v = b[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) throw new JevError(400, `bad ${k}`);
    return Math.round(v * 10) / 10;
  };
  if (b.mode !== 'sprint' && b.mode !== 'versus' && b.mode !== 'streak') throw new JevError(400, 'bad mode');
  if (b.winner !== 'jev' && b.winner !== 'person' && b.winner !== 'draw') throw new JevError(400, 'bad winner');
  return { mode: b.mode, winner: b.winner, person: num('person', 100_000), jev: num('jev', 100_000), personRight: num('personRight', 1000), jevRight: num('jevRight', 1000), cards: num('cards', 1000) };
}

/** A random mood and up to six random lines for the result. */
export function draw(r: MatchResult, random = Math.random): { mood: Mood; offered: string[] } {
  const pool = TAUNTS.filter((t) => t.when === r.winner).map((t) => t.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const moods = Object.keys(MOODS) as Mood[];
  return { mood: moods[Math.floor(random() * moods.length)], offered: pool.slice(0, OFFER) };
}

/** The System One body. Exported for tests. */
export function tauntBody(r: MatchResult, mood: Mood, offered: string[], modelId: string): unknown {
  const who = r.winner === 'jev' ? 'Jev won' : r.winner === 'person' ? 'The person won' : 'It was a draw';
  return {
    model: modelId,
    state: {
      context: 'Jev is a decision model with an attitude. It just played a picture quiz match against a person, and gets the last word: one line of trash talk, said out loud.',
      match: { mode: r.mode, result: who, score_unit: UNITS[r.mode], person_score: r.person, jev_score: r.jev, cards: r.cards, person_right: r.personRight, jev_right: r.jevRight },
      jev_mood: MOODS[mood],
    },
    questions: {
      line: {
        type: 'choice',
        instructions: 'Jev is in the mood described by `jev_mood`. Which line does Jev say out loud after `match`? Pick the one that best fits its mood. The meaner and funnier, the better.',
        criteria: Object.fromEntries(offered.map((id) => [id, `"${TAUNTS.find((t) => t.id === id)!.text}"`])),
      },
    },
  };
}

export interface TauntAnswer {
  choice: string;
  probabilities: Record<string, number>;
  latencyMs: number;
  mood: Mood;
  offered: string[];
}

/** Asks Jev for its last word, on the same route and keys as the cards. */
export async function taunt(r: MatchResult, model: Model, env: Env, fetchImpl: typeof fetch = fetch): Promise<TauntAnswer> {
  const { mood, offered } = draw(r);
  const { data, latencyMs } = await systemOne<{ answers?: { line?: { choice?: string; probabilities?: Record<string, number> } } }>(model, env, (id) => tauntBody(r, mood, offered, id), fetchImpl);
  const a = data.answers?.line;
  if (!a?.choice || !offered.includes(a.choice)) throw new JevError(502, 'Jev picked no line');
  return { choice: a.choice, probabilities: a.probabilities ?? {}, latencyMs, mood, offered };
}
