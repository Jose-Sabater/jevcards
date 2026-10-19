/**
 * Names other players will see (live match names, leaderboard initials) get one quick decision from Jev: fine or
 * offensive. A name is refused only when Jev is sure (OFFENSIVE_AT), so ordinary names and playful nicknames pass;
 * and when Jev cannot answer, the name passes too: a busy model must not stop anyone from playing.
 */
import { systemOne, type Env, type Model } from './jev.ts';

/** How sure Jev must be that a name is offensive before it is refused. */
export const OFFENSIVE_AT = 0.9;

/** The System One body. Exported for tests. */
export function nameBody(name: string, modelId: string): unknown {
  return {
    model: modelId,
    state: {
      context: 'A player typed this name for a public game screen that other players will see: a live match or a leaderboard. Names can be short, nicknames, initials, or in any language.',
      name,
    },
    questions: {
      verdict: {
        type: 'choice',
        instructions: 'Is `name` offensive to show to other players?',
        criteria: {
          fine: 'Fine to show: a real name, a nickname, initials, a playful or silly word, or anything that is not clearly offensive.',
          offensive: 'Offensive: a slur, a sexual term, a violent or hateful insult, or harassment of a group, even if spelled with tricks.',
        },
      },
    },
  };
}

/** True when Jev is sure the name is offensive. */
export async function isOffensive(name: string, model: Model, env: Env, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const { data } = await systemOne<{ answers?: { verdict?: { probabilities?: Record<string, number> } } }>(model, env, (id) => nameBody(name, id), fetchImpl);
    return (data.answers?.verdict?.probabilities?.offensive ?? 0) >= OFFENSIVE_AT;
  } catch {
    return false;
  }
}
