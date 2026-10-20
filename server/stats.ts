/**
 * The play log, for stats later: one JSON line per answer (a person's or Jev's) and one per finished game, appended
 * to stats.jsonl in the data directory. No addresses or names: a game is a short one-way id, so its lines can be
 * grouped and nothing more.
 *
 *   answer  { t, type: 'answer', game, mode, card, category, who: 'person' | 'jev', right, ms, match? }
 *           ms is null for a live match player who gave no answer. A person's ms in a solo game is the page's own.
 *   game    { t, type: 'game', game, mode, cards, score, right, jev, winner, ... }
 *           solo games add limitMs, box and ranked; live matches add match: true, players and best.
 */
import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';

export class Stats {
  private out: WriteStream;

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.out = createWriteStream(join(dir, 'stats.jsonl'), { flags: 'a' });
    // A full disk must not stop the game.
    this.out.on('error', (e) => console.warn(`stats: ${e.message}`));
  }

  write(line: Record<string, unknown>): void {
    this.out.write(`${JSON.stringify({ t: new Date().toISOString(), ...line })}\n`);
  }

  /** Waits for what was written to reach the file (for tests). */
  flush(): Promise<void> {
    return new Promise((ok) => this.out.write('', () => ok()));
  }
}
