/**
 * Live matches on the page (the server side is server/match.ts): host or join a room, wait in the lobby, then play
 * the same cards as everyone at the same moment. The server runs the clock and the scores; this page follows the
 * room by long polling (see server/match.ts) and draws what it is told: the lobby, each card, the reveal with the round's
 * podium, and the final standings with Jev's last word.
 */
import type { Card } from '../cards/lib.ts';
import { learn, type JevAnswer } from './api.ts';
import type { Solution } from '../shared/game.ts';
import { el, sleep, store } from './dom.ts';
import { shareButton } from './ranked.ts';
import { beep, effect, hush, jevSays, say } from './sound.ts';
import { TAUNTS } from '../server/taunt-lines.ts';
import type { CardView, OtherAnswer, PlayerAnswer } from './view.ts';

/** What the game hands this module: its screens, cards and countdown ring. */
export interface MatchContext {
  screen: (...children: (Node | string | null | false)[]) => void;
  topbar: (title: string, ...right: Node[]) => HTMLElement;
  home: () => void;
  card: (id: string) => Card | undefined;
  cardView: (card: Card) => CardView;
  countdown: () => { root: HTMLElement; set: (msLeft: number, total: number) => void };
  setLeave: (fn: () => void) => void;
}

interface RoomPlayer {
  id: string;
  name: string;
  score: number;
  ready: boolean;
  online: boolean;
  answered: boolean;
}
interface RoundAnswer {
  option?: string;
  point?: [number, number];
  right: boolean;
  ms: number;
  points: number;
}
interface RoomView {
  code: string;
  phase: 'lobby' | 'playing' | 'final';
  me: string;
  host: string;
  players: RoomPlayer[];
  jev: { score: number; right: number };
  rounds: number;
  round: {
    index: number;
    of: number;
    card: string;
    startsAt: number;
    limitMs: number;
    revealed: boolean;
    jevAnswered: boolean;
    mine: RoundAnswer | null;
    answers: Record<string, RoundAnswer> | null;
    jevAnswer: { right: boolean; ms: number; points: number; choice?: string; box?: JevAnswer['box'] } | null;
    /** At the reveal: the card's answer and why (the page's deck has none). */
    solution: Solution | null;
  } | null;
  taunt: string | null;
  serverNow: number;
}

const SESSION = 'jev-cards:match';
const lastName = () => store.get('jev-cards:name', '');

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

const NAME_MAX = 12;

/**
 * A name field: up to 12 characters, keeping only what a name may hold (letters in any alphabet, digits, spaces
 * and . _ ' -, as the server checks), with a counter beside it.
 */
function nameInput(id: string): { field: HTMLElement; input: HTMLInputElement } {
  const input = el('input', { className: 'name-input', id, maxLength: NAME_MAX, autocomplete: 'nickname', spellcheck: false, value: lastName().slice(0, NAME_MAX), placeholder: 'Your name', 'aria-label': 'Your name' }) as HTMLInputElement;
  const count = el('span', { className: 'name-count', 'aria-hidden': 'true' }, '');
  const update = () => {
    const clean = [...input.value.replace(/[^\p{L}\p{N} ._'-]/gu, '').replace(/\s{2,}/g, ' ').replace(/^\s+/, '')].slice(0, NAME_MAX).join('');
    if (clean !== input.value) input.value = clean;
    count.textContent = `${[...clean].length}/${NAME_MAX}`;
  };
  input.addEventListener('input', update);
  update();
  return { field: el('span', { className: 'name-field' }, input, count), input };
}

/** The match menu: host a new match, or join one by its code (prefilled from a /m/<code> link). */
export function matchMenu(ctx: MatchContext, code = ''): void {
  hush();
  const { field: hostField, input: hostName } = nameInput('host-name');
  const { field: joinField, input: joinName } = nameInput('join-name');
  const codeInput = el('input', { className: 'lb-initials code-input', id: 'join-code', maxLength: 4, autocomplete: 'off', autocapitalize: 'characters', spellcheck: false, value: code, placeholder: 'CODE', 'aria-label': 'Match code' }) as HTMLInputElement;
  codeInput.addEventListener('input', () => (codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)));
  const note = el('p', { className: 'lb-status', 'aria-live': 'polite' }, '');
  const go = async (fn: () => Promise<{ code: string; token: string; name: string }>) => {
    note.textContent = '';
    try {
      const joined = await fn();
      store.set('jev-cards:name', joined.name);
      sessionStorage.setItem(SESSION, JSON.stringify(joined));
      history.replaceState(null, '', `/m/${joined.code}`);
      follow(ctx, joined.code, joined.token);
    } catch (e) {
      note.textContent = (e as Error).message;
    }
  };
  const valid = (i: HTMLInputElement) => (i.value = i.value.trim().replace(/\s+/g, ' ')).length > 0 || ((note.textContent = 'Type your name first.'), false);
  const hostForm = el('form', { className: 'lb-form match-form' }, el('label', { htmlFor: 'host-name' }, 'Host a match: your name'), hostField, el('button', { className: 'primary', type: 'submit' }, 'Create'));
  hostForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (valid(hostName)) void go(async () => ({ ...(await post<{ code: string; token: string }>('/api/match', { name: hostName.value })), name: hostName.value }));
  });
  const joinForm = el('form', { className: 'lb-form match-form' }, el('label', { htmlFor: 'join-code' }, 'Join a match: code and your name'), codeInput, joinField, el('button', { className: 'primary', type: 'submit' }, 'Join'));
  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!/^[A-Z0-9]{4}$/.test(codeInput.value)) return void (note.textContent = 'The code has four letters or digits.');
    if (valid(joinName)) void go(async () => ({ code: codeInput.value, ...(await post<{ token: string }>(`/api/match/${codeInput.value}/join`, { name: joinName.value })), name: joinName.value }));
  });
  // From an invite link, joining is the point: hosting a new match (easy to tap by mistake) hides behind a link.
  let second: HTMLElement = joinForm;
  if (code) {
    hostForm.hidden = true;
    const own = el('button', { className: 'link own-match', type: 'button' }, 'Or host your own match');
    own.addEventListener('click', () => {
      own.remove();
      hostForm.hidden = false;
      hostName.focus({ preventScroll: true });
    });
    second = el('div', { className: 'own-wrap' }, own, hostForm);
  }
  ctx.screen(
    ctx.topbar('Live match'),
    el(
      'main',
      { className: 'play results match' },
      el('h1', { className: 'result-title' }, code ? `Join match ${code}` : 'Live match'),
      el('p', { className: 'footnote' }, 'Everyone plays the same cards at the same moment, 10 seconds each. Jev plays too. Right and fast scores most. The host picks how many.'),
      code ? joinForm : hostForm,
      second,
      note,
    ),
  );
  (code ? joinName : hostName).focus({ preventScroll: true });
}

/** A /m/<code> link: rejoin if this tab was in the match, show the join form if it is waiting, say so if it is gone. */
export async function openMatchLink(ctx: MatchContext, code: string): Promise<void> {
  if (resumeMatch(ctx, code)) return;
  const res = await fetch(`/api/match/${code}/info`, { cache: 'no-store' }).catch(() => null);
  if (res && res.status === 404) return matchGone(ctx, code);
  matchMenu(ctx, code);
}

/** The ended screen: the match is no longer running (it finished, or the server restarted). */
function matchGone(ctx: MatchContext, code: string): void {
  sessionStorage.removeItem(SESSION);
  const again = el('button', { className: 'primary', type: 'button' }, 'Start a new match');
  again.addEventListener('click', () => {
    history.replaceState(null, '', '/');
    matchMenu(ctx);
  });
  const menu = el('button', { className: 'secondary', type: 'button' }, 'Menu');
  menu.addEventListener('click', ctx.home);
  ctx.screen(
    ctx.topbar(`Match ${code}`),
    el(
      'main',
      { className: 'play results' },
      el('h1', { className: 'result-title' }, 'This match has ended'),
      el('p', { className: 'footnote' }, `Match ${code} is no longer running: it finished, or the server restarted. Start a new one and share the new link.`),
      el('div', { className: 'actions' }, again, menu),
    ),
  );
}

/** Rejoin a match after a reload, if this tab was in one. */
export function resumeMatch(ctx: MatchContext, code: string): boolean {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION) ?? 'null') as { code: string; token: string } | null;
    if (s && s.code === code) {
      follow(ctx, s.code, s.token);
      return true;
    }
  } catch {
    // no session storage
  }
  return false;
}

/** Follows a room until the player leaves. */
function follow(ctx: MatchContext, code: string, token: string): void {
  const status = el('div', { className: 'match-strip' });
  const stage = el('div', { className: 'stage' });
  const ring = ctx.countdown();
  const roundLabel = el('span', { className: 'count' }, '');
  // The host can end a match early (everyone goes back to the lobby): two taps, so a stray one does not.
  const endBtn = el('button', { className: 'link end-match', type: 'button', hidden: true }, 'End match');
  let endArmed = 0;
  endBtn.addEventListener('click', () => {
    if (Date.now() - endArmed > 3000) {
      endArmed = Date.now();
      endBtn.textContent = 'Tap again to end';
      setTimeout(() => Date.now() - endArmed >= 3000 && (endBtn.textContent = 'End match'), 3100);
      return;
    }
    endArmed = 0;
    endBtn.textContent = 'End match';
    void post(`/api/match/${code}/rematch`, { token }).catch(() => undefined);
  });
  ctx.screen(ctx.topbar(`Match ${code}`, endBtn, roundLabel), el('main', { className: 'play' }, el('div', { className: 'podiums solo match-ring', hidden: true }, ring.root), status, stage));
  const ringBox = ring.root.parentElement!;
  const stop = new AbortController();
  let alive = true;
  let offset = 0;
  let shownRound = -1;
  let view: CardView | null = null;
  let mine: PlayerAnswer | null = null;
  let revealedRound = -1;
  let raf = 0;
  let finalShown = false;
  let tauntSaid = '';
  /** Who was in the lobby last time, to chime when someone new comes in. */
  let seen = new Set<string>();
  ctx.setLeave(() => {
    // Leaving through the menu: out of the room for good, so nobody waits for this player. (Not when the match
    // is already gone, and not on a reload, which comes back to the room.)
    if (alive) void fetch(`/api/match/${code}/leave`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), keepalive: true }).catch(() => undefined);
    alive = false;
    stop.abort();
    cancelAnimationFrame(raf);
    sessionStorage.removeItem(SESSION);
  });

  const serverNow = () => Date.now() + offset;

  /** The match is gone (it ended, or the server restarted and lost it): stop everything and say so plainly. */
  function gone() {
    if (!alive) return;
    alive = false;
    stop.abort();
    cancelAnimationFrame(raf);
    matchGone(ctx, code);
  }


  const onRoom = (s: RoomView) => {
    if (!alive) return;
    offset = s.serverNow - Date.now();
    endBtn.hidden = !(s.phase === 'playing' && s.me === s.host);
    if (s.phase === 'lobby') {
      shownRound = -1;
      revealedRound = -1;
      finalShown = false;
      tauntSaid = '';
      ringBox.hidden = true;
      roundLabel.textContent = '';
      lobby(s);
    } else if (s.phase === 'playing' && s.round) playing(s);
    else if (s.phase === 'final') final(s);
  };
  // Ask for the room again and again; each answer comes when the room has changed.
  void (async () => {
    let since = -1;
    let failures = 0;
    while (alive) {
      try {
        const res = await fetch(`/api/match/${code}/state?token=${encodeURIComponent(token)}&since=${since}`, { cache: 'no-store', signal: stop.signal });
        if (res.status === 404 || res.status === 403) {
          gone();
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const s = (await res.json()) as RoomView & { version: number };
        failures = 0;
        since = s.version;
        onRoom(s);
      } catch {
        if (!alive) return;
        if (++failures === 3) status.replaceChildren(el('p', { className: 'lb-status' }, 'Reconnecting...'));
        await sleep(Math.min(3000, 400 * failures));
      }
    }
  })();

  const chips = (s: RoomView, round = false) =>
    el(
      'div',
      { className: 'chips' },
      ...s.players.map((p) =>
        el(
          'span',
          { className: `chip-player ${p.id === s.me ? 'me' : ''} ${p.online ? '' : 'away'} ${round && p.answered ? 'done' : ''} ${!round && p.ready ? 'ready' : ''}` },
          p.name,
          p.id === s.host ? el('i', { className: 'host-tag' }, 'host') : !round && p.ready ? el('i', { className: 'ready-tag' }, '✓ ready') : null,
        ),
      ),
      el('span', { className: `chip-player jev ${round && s.round?.jevAnswered ? 'done' : ''}` }, 'JEV'),
    );

  /** A guest says they are ready (tap again to take it back); the host starts when they like. */
  function readyButton(s: RoomView) {
    const me = s.players.find((p) => p.id === s.me);
    const ready = !!me?.ready;
    const b = el('button', { className: `primary ready-btn ${ready ? 'is-ready' : 'play-yourself'}`, type: 'button', 'aria-pressed': String(ready) }, ready ? "✓ I'm ready" : "I'm ready");
    b.addEventListener('click', () => {
      effect('ready-click', 0.8);
      void post(`/api/match/${code}/ready`, { token, ready: !ready }).catch(() => undefined);
    });
    return el('div', { className: 'ready-box' }, b, el('p', { className: 'jev-chip' }, ready ? 'Waiting for the host to start' : 'Tap when you are ready to play'));
  }

  /** The host picks the match length; everyone sees it in their lobby. */
  function roundsPicker(current: number) {
    return el(
      'div',
      { className: 'rounds-picker', role: 'group', 'aria-label': 'Rounds' },
      el('span', { className: 'lb-meta' }, 'Rounds'),
      ...[5, 10, 15, 20].map((n) => {
        const b = el('button', { className: 'switch', type: 'button', 'aria-pressed': String(n === current) }, String(n));
        b.addEventListener('click', () => void post(`/api/match/${code}/rounds`, { token, rounds: n }).catch(() => undefined));
        return b;
      }),
    );
  }

  function lobby(s: RoomView) {
    const isHost = s.me === s.host;
    // A chime when someone new joins (not for the first look at the room).
    const ids = new Set(s.players.map((p) => p.id));
    if (seen.size && [...ids].some((id) => !seen.has(id))) effect('join');
    seen = ids;
    const guests = s.players.filter((p) => p.id !== s.host);
    const readyCount = guests.filter((p) => p.ready).length;
    const allReady = guests.length > 0 && readyCount === guests.length;
    const start = el(
      'button',
      { className: `primary play-yourself ${allReady ? '' : 'waiting'}`, type: 'button' },
      guests.length ? (allReady ? 'All ready: start!' : `Start (${readyCount}/${guests.length} ready)`) : 'Start the match',
    );
    start.addEventListener('click', async () => {
      start.setAttribute('disabled', '');
      try {
        await post(`/api/match/${code}/start`, { token });
      } catch (err) {
        start.removeAttribute('disabled');
        status.append(el('p', { className: 'lb-status' }, (err as Error).message));
      }
    });
    status.replaceChildren();
    stage.replaceChildren(
      el(
        'div',
        { className: 'lobby' },
        el('p', { className: 'eyebrow' }, 'Match code'),
        el('h1', { className: 'marquee code' }, code),
        shareButton(async () => `/m/${code}`, 'Invite people', `Join my Jev Cards match: code ${code}`),
        el('p', { className: 'lb-status' }, `${s.players.length} ${s.players.length === 1 ? 'player' : 'players'} and Jev`),
        chips(s),
        isHost ? roundsPicker(s.rounds) : el('p', { className: 'lb-status' }, `${s.rounds} cards, 10 seconds each`),
        isHost ? start : readyButton(s),
      ),
    );
  }

  function playing(s: RoomView) {
    const r = s.round!;
    roundLabel.textContent = `${r.index + 1}/${r.of}`;
    status.replaceChildren(chips(s, true));
    if (r.index !== shownRound) {
      shownRound = r.index;
      mine = null;
      void showCard(s);
      return;
    }
    if (r.revealed && revealedRound !== r.index && view) {
      revealedRound = r.index;
      reveal(s);
    }
  }

  async function showCard(s: RoomView) {
    const r = s.round!;
    const card = ctx.card(r.card);
    if (!card) return;
    const index = r.index;
    const v = ctx.cardView(card);
    view = v;
    ringBox.hidden = false;
    // Before the first card: 3, 2, 1 on every screen at once.
    if (index === 0 && r.startsAt - serverNow() > 1500) {
      const big = el('span', { className: 'ready-big' }, 'Ready?');
      stage.replaceChildren(el('div', { className: 'get-ready' }, el('p', { className: 'ready-line' }, 'Contestants...'), big));
      void say('ready');
      let shown = '';
      while (alive && shownRound === index && r.startsAt - serverNow() > 0) {
        const left = r.startsAt - serverNow();
        const step = left > 3000 ? 'Ready?' : left > 2000 ? '3' : left > 1000 ? '2' : '1';
        if (step !== shown) {
          shown = step;
          big.textContent = step;
          big.style.animation = 'none';
          void big.offsetWidth;
          big.style.animation = '';
          if (step !== 'Ready?') beep(false);
        }
        await sleep(50);
      }
      beep(true);
    }
    await v.ready();
    while (alive && shownRound === index && r.startsAt - serverNow() > 0) await sleep(20);
    if (!alive || shownRound !== index) return;
    stage.replaceChildren(v.root);
    effect('deal', 0.6);
    v.start();
    const tick = () => {
      if (!alive || view !== v) return;
      const left = r.startsAt + r.limitMs - serverNow();
      ring.set(left, r.limitMs);
      if (left <= 0) v.timeout();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const you = await v.answer;
    cancelAnimationFrame(raf);
    if (!alive || view !== v) return;
    mine = you;
    if (you.option || you.point) {
      v.root.append(el('div', { className: 'flash wait' }, 'Locked in'));
      try {
        await post(`/api/match/${code}/answer`, { token, index, option: you.option, point: you.point ? [you.point.x, you.point.y] : undefined });
      } catch (e) {
        if (/no match/i.test((e as Error).message)) gone();
        else v.root.querySelector('.flash')?.replaceChildren((e as Error).message);
      }
    } else effect('timeup');
  }

  function reveal(s: RoomView) {
    const r = s.round!;
    const v = view!;
    v.timeout();
    v.root.querySelector('.flash')?.remove();
    if (r.solution) learn(v.card, r.solution);
    // Right or wrong is the server's word: the page cannot mark an answer itself.
    const me = r.mine;
    const you: PlayerAnswer | null = mine ? { ...mine, correct: !!me?.right } : me ? { option: me.option, point: me.point ? { x: me.point[0], y: me.point[1] } : undefined, correct: me.right, ms: me.ms } : null;
    const jev = r.jevAnswer ? ({ choice: r.jevAnswer.choice, box: r.jevAnswer.box, correct: r.jevAnswer.right, latencyMs: r.jevAnswer.ms } as JevAnswer) : null;
    const others: OtherAnswer[] = s.players
      .filter((p) => p.id !== s.me && r.answers?.[p.id])
      .map((p) => {
        const a = r.answers![p.id];
        return { name: p.name, option: a.option, point: a.point ? { x: a.point[0], y: a.point[1] } : undefined };
      });
    v.reveal(you, jev, others);
    effect(me?.right ? 'ding' : 'buzzer');
    const rows = [
      ...s.players.map((p) => ({ name: p.name, me: p.id === s.me, jev: false, a: r.answers?.[p.id] ?? null, total: p.score })),
      { name: 'JEV', me: false, jev: true, a: r.jevAnswer, total: s.jev.score },
    ].sort((x, y) => (y.a?.points ?? 0) - (x.a?.points ?? 0) || (x.a?.ms ?? 1e9) - (y.a?.ms ?? 1e9));
    v.root.append(
      el(
        'div',
        { className: 'round-podium' },
        el('p', { className: 'lb-badge' }, 'This card'),
        el(
          'ol',
          { className: 'lb-table' },
          ...rows.map((row) =>
            el(
              'li',
              { className: `${row.me ? 'me' : ''} ${row.jev ? 'jev-row' : ''}` },
              el('span', { className: 'lb-place' }, row.a ? (row.a.right ? '✓' : '✗') : '·'),
              el('span', { className: 'lb-name' }, row.name),
              el('span', { className: 'lb-score' }, row.a ? `+${row.a.points}${row.a.right ? ` · ${(row.a.ms / 1000).toFixed(1)} s` : ''}` : 'no answer'),
            ),
          ),
        ),
      ),
    );
  }

  function final(s: RoomView) {
    ringBox.hidden = true;
    roundLabel.textContent = '';
    status.replaceChildren();
    const rows = [...s.players.map((p) => ({ name: p.name, score: p.score, me: p.id === s.me, jev: false })), { name: 'JEV', score: s.jev.score, me: false, jev: true }].sort((a, b) => b.score - a.score);
    const top = rows[0];
    const myPlace = rows.findIndex((r) => r.me) + 1;
    if (!finalShown) {
      finalShown = true;
      const beatJev = rows.find((r) => r.me)!.score > s.jev.score;
      effect(beatJev ? 'applause' : 'aww', beatJev ? 1 : 0.8);
      // The host only calls it when it is about this player: they won, or Jev did.
      if (top.me) void say('win');
      else if (top.jev) void say('lose');
    }
    const quote = el('p', { className: 'lw-quote thinking' }, 'Jev is choosing its last word...');
    if (s.taunt) {
      const t = TAUNTS.find((x) => x.id === s.taunt);
      if (t) {
        quote.classList.remove('thinking');
        quote.textContent = `"${t.text}"`;
        if (tauntSaid !== t.id) {
          tauntSaid = t.id;
          void say('intro');
          void jevSays(t.id);
        }
      }
    }
    const isHost = s.me === s.host;
    const rematch = el('button', { className: 'primary', type: 'button' }, 'Rematch');
    rematch.addEventListener('click', () => void post(`/api/match/${code}/rematch`, { token }).catch(() => undefined));
    const leave = el('button', { className: 'secondary', type: 'button' }, 'Leave');
    leave.addEventListener('click', ctx.home);
    stage.replaceChildren(
      el(
        'div',
        { className: 'results' },
        el('h1', { className: 'result-title' }, top.jev ? 'Jev wins the match' : `${top.name} wins the match!`),
        el('p', { className: 'lb-status' }, `You came #${myPlace} of ${rows.length}.`),
        el(
          'section',
          { className: 'leaderboard' },
          el('div', { className: 'lb-head' }, el('span', { className: 'lb-badge' }, `Match ${code}`), el('span', { className: 'lb-meta' }, 'final standings')),
          el(
            'ol',
            { className: 'lb-table' },
            ...rows.map((r, i) => el('li', { className: `${r.me ? 'me' : ''} ${r.jev ? 'jev-row' : ''}` }, el('span', { className: 'lb-place' }, `#${i + 1}`), el('span', { className: 'lb-name' }, r.name), el('span', { className: 'lb-score' }, `${r.score} pts`))),
          ),
        ),
        el('section', { className: 'last-word done' }, el('div', { className: 'lw-head' }, el('span', { className: 'lw-badge' }, 'Jev to the room')), quote),
        el('div', { className: 'actions' }, isHost ? rematch : el('p', { className: 'jev-chip' }, 'The host can start a rematch'), leave),
      ),
    );
  }
}
