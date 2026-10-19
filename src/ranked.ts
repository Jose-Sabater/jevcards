/**
 * Ranked games, leaderboards and share links on the page. A ranked game (Jev 1.14 and the standard settings)
 * gets its cards from a signed deal and records every answer; at the end the server checks the recording and
 * answers with its own score, the boards, and a share link. See server/scores.ts for the checks.
 */
import { formatScore, lowerIsBetter, MODES, RANKED, type Mode, type RecordedAnswer, type Recording, type SignedJevAnswer } from '../shared/game.ts';
import type { ShareResult } from '../server/scores.ts';
import { el, store } from './dom.ts';
import type { PlayerAnswer } from './view.ts';

export interface BoardEntry {
  initials: string;
  score: number;
  at: string;
}
export interface BoardsView {
  order: Mode[];
  boards: Record<Mode, BoardEntry[]>;
}
export interface CheckedResult extends BoardsView {
  mode: Mode;
  ranked: boolean;
  score: number;
  right: number;
  cards: number;
  jev: { score: number; right: number } | null;
  place: number | null;
  wouldPlace: number | null;
  share: string;
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body as T;
}

/** A signed deal and its cards, or null when the server cannot give one (the game then plays unranked). */
export async function getDeal(mode: Mode, cards: number, limitMs: number, box: boolean): Promise<{ deal: string; cards: string[]; ranked: boolean } | null> {
  try {
    return await json(await fetch(`/api/deal?mode=${mode}&cards=${cards}&limit=${limitMs}&box=${box ? 1 : 0}`, { cache: 'no-store' }));
  } catch {
    return null;
  }
}

export async function getBoards(): Promise<BoardsView> {
  return json(await fetch('/api/highscores', { cache: 'no-store' }));
}

export async function getShare(token: string): Promise<BoardsView & { result: ShareResult }> {
  return json(await fetch(`/api/share/${encodeURIComponent(token)}`, { cache: 'no-store' }));
}

async function postResult(recording: Recording, initials: string, enter: boolean): Promise<CheckedResult> {
  return json(
    await fetch('/api/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recording, initials: initials || undefined, enter }),
    }),
  );
}

/** One answer for the recording. */
export function recorded(card: string, you: PlayerAnswer): RecordedAnswer {
  return { card, option: you.option, point: you.point ? [you.point.x, you.point.y] : undefined, ms: Math.max(0, Math.round(you.ms)) };
}

/** The record of a game in progress. */
export class GameRecord {
  readonly recording: Recording;
  constructor(mode: Mode, deal: string) {
    this.recording = { version: 1, mode, deal, answers: [], jev: [] };
  }
  answer(card: string, you: PlayerAnswer): void {
    this.recording.answers.push(recorded(card, you));
  }
  jev(answers: (SignedJevAnswer | undefined)[]): void {
    // Only an unbroken run of signed answers counts; the server checks them against the deal.
    const run: SignedJevAnswer[] = [];
    for (const a of answers) {
      if (!a) break;
      run.push(a);
    }
    this.recording.jev = run;
  }
}

const lastInitials = () => store.get('jev-cards:initials', '');

/**
 * The results' leaderboard block: the server's check of the game, the board for its mode with this game's place,
 * initials to enter it when it makes the top 10, and a share button. `taunt` gives Jev's last word once known.
 */
export function rankedPanel(record: GameRecord, taunt: () => string): HTMLElement {
  const mode = record.recording.mode;
  const status = el('p', { className: 'lb-status' }, 'Checking your game...');
  const table = el('ol', { className: 'lb-table' });
  const form = el('form', { className: 'lb-form', hidden: true });
  const shareRow = el('div', { className: 'lb-share', hidden: true });
  const badge = el('span', { className: 'lb-badge' }, `${RANKED[mode].label} leaderboard`);
  const meta = el('span', { className: 'lb-meta' }, lowerIsBetter(mode) ? 'fastest first' : 'highest first');
  const panel = el(
    'section',
    { className: 'leaderboard' },
    el('div', { className: 'lb-head' }, badge, meta),
    status,
    form,
    table,
    shareRow,
  );
  let entered = '';

  const show = (r: CheckedResult, mine: { initials: string; score: number } | null) => {
    table.replaceChildren(...boardRows(mode, r.boards[mode], mine));
    if (!r.boards[mode].length) table.append(el('li', { className: 'lb-empty' }, 'No one on this board yet. Be the first.'));
  };

  postResult(record.recording, '', false).then(
    (r) => {
      if (!r.ranked) {
        // Custom settings: checked and shareable, but the boards are for the standard game only.
        panel.classList.add('unranked');
        badge.textContent = 'Your game';
        meta.textContent = 'custom settings';
        status.textContent = `Checked: ${formatScore(mode, r.score)}. Unranked (custom settings): the boards are for the standard game.`;
        table.hidden = true;
      } else {
        status.textContent = `Checked: ${formatScore(mode, r.score)}${r.wouldPlace ? `, good for #${r.wouldPlace}` : ''}.`;
        show(r, null);
      }
      if (r.wouldPlace) {
        const input = el('input', { className: 'lb-initials', id: `initials-${mode}`, maxLength: 3, autocomplete: 'off', autocapitalize: 'characters', spellcheck: false, value: lastInitials(), 'aria-label': 'Your initials' }) as HTMLInputElement;
        input.addEventListener('input', () => (input.value = input.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)));
        const go = el('button', { className: 'primary', type: 'submit' }, 'Enter');
        form.replaceChildren(el('label', { htmlFor: input.id }, `You made #${r.wouldPlace}! Your initials:`), input, go);
        form.hidden = false;
        queueMicrotask(() => input.focus({ preventScroll: true }));
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!/^[A-Z]{3}$/.test(input.value)) {
            status.textContent = 'Three letters, A to Z.';
            return;
          }
          go.setAttribute('disabled', '');
          try {
            const after = await postResult(record.recording, input.value, true);
            entered = input.value;
            store.set('jev-cards:initials', entered);
            form.hidden = true;
            status.textContent = after.place ? `You're #${after.place} on the ${RANKED[mode].label} board!` : 'Not on the board this time (your earlier score was better).';
            show(after, { initials: entered, score: after.score });
          } catch (err) {
            status.textContent = (err as Error).message;
            go.removeAttribute('disabled');
          }
        });
      }
      shareRow.hidden = false;
      shareRow.replaceChildren(shareButton(async () => (await postResult({ ...record.recording, taunt: taunt() }, entered || lastInitials(), false)).share));
    },
    (err: Error) => {
      status.textContent = `This game could not be checked: ${err.message}`;
      panel.classList.add('unranked');
    },
  );
  return panel;
}

function boardRows(mode: Mode, entries: BoardEntry[], mine: { initials: string; score: number } | null): HTMLElement[] {
  let marked = false;
  return entries.map((e, i) => {
    const me = !marked && !!mine && e.initials === mine.initials && e.score === mine.score;
    if (me) marked = true;
    return el('li', { className: me ? 'me' : '' }, el('span', { className: 'lb-place' }, `#${i + 1}`), el('span', { className: 'lb-name' }, e.initials), el('span', { className: 'lb-score' }, formatScore(mode, e.score)));
  });
}

/** Share (the phone's share sheet) or copy the link. `link` makes the link when first needed. */
export function shareButton(link: () => Promise<string>, label = 'Share your score', text = 'Can you beat Jev at Jev Cards?'): HTMLElement {
  const b = el('button', { className: 'primary share-btn', type: 'button' }, label);
  const note = el('span', { className: 'share-note', 'aria-live': 'polite' }, '');
  let url = '';
  b.addEventListener('click', async () => {
    try {
      url ||= new URL(await link(), location.origin).href;
    } catch (e) {
      note.textContent = (e as Error).message;
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Jev Cards', text, url });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      note.textContent = 'Link copied.';
    } catch {
      note.textContent = url;
    }
  });
  return el('div', { className: 'share-wrap' }, b, note);
}

/** All three boards, for the leaderboard screen and the share page. */
export function boardsBlock(view: BoardsView, only?: Mode): HTMLElement {
  return el(
    'div',
    { className: 'lb-grid' },
    ...(only ? [only] : MODES).map((m) =>
      el(
        'section',
        { className: 'leaderboard' },
        el('div', { className: 'lb-head' }, el('span', { className: 'lb-badge' }, RANKED[m].label), el('span', { className: 'lb-meta' }, lowerIsBetter(m) ? 'fastest first' : 'highest first')),
        el('ol', { className: 'lb-table' }, ...(view.boards[m].length ? boardRows(m, view.boards[m], null) : [el('li', { className: 'lb-empty' }, 'No one yet. Be the first.')])),
      ),
    ),
  );
}
