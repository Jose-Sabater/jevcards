/**
 * Jev's record: how many games against Jev it won, lost and drew, over every finished game with both sides (a solo
 * game with Jev's full side, or a live match). Kept in a JSON file in the data directory, next to the leaderboards.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEAL_TTL_MS } from './scores.ts';

export type Outcome = 'jev' | 'person' | 'draw';
export type TallyView = Record<Outcome, number>;

const OUTCOMES: Outcome[] = ['jev', 'person', 'draw'];

export class Tally {
  private counts: TallyView;
  private file: string;
  /** Games already counted, by id: a solo game's result can be sent more than once. Kept while its deal is valid. */
  private seen = new Map<string, number>();
  private swept = 0;

  constructor(dir: string) {
    this.file = join(dir, 'tally.json');
    mkdirSync(dir, { recursive: true });
    let stored: Partial<TallyView> = {};
    try {
      stored = JSON.parse(readFileSync(this.file, 'utf8'));
    } catch {
      // a new file
    }
    this.counts = Object.fromEntries(OUTCOMES.map((o) => [o, Number.isSafeInteger(stored[o]) && stored[o]! > 0 ? stored[o] : 0])) as TallyView;
  }

  view(): TallyView {
    return { ...this.counts };
  }

  /** Counts a finished game, once per `id` when it has one. */
  count(outcome: Outcome, id?: string, now = Date.now()): void {
    if (id) {
      if (now - this.swept > 60_000) {
        this.swept = now;
        for (const [k, at] of this.seen) if (now - at > DEAL_TTL_MS) this.seen.delete(k);
      }
      if (this.seen.has(id)) return;
      this.seen.set(id, now);
    }
    this.counts[outcome]++;
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.counts));
    renameSync(tmp, this.file);
  }
}
