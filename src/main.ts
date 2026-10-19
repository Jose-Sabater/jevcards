/**
 * Jev Cards: a visual quiz that people and Jev answer from the same picture cards.
 *
 *   Sprint     N cards against the clock. Your time is the time you spent answering plus 5 s per miss. Jev
 *              answers the same cards; its time is its answer times plus the same penalty.
 *   Versus     10 rounds, live: Jev is asked the moment the card appears, you get the seconds you picked.
 *              A right answer scores 100 plus up to 50 for speed; nothing for a wrong or late one.
 *   Streak     Cards until the first miss (10 s each). Jev's streak on the same cards, in the same order.
 */
import './style.css';
import '@fontsource/bungee/latin-400.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/fraunces/latin-600.css';
import { askTaunt, JevQueue, loadDeck, loadModels, markAnswer, type Card, type JevAnswer, type MatchResult, type ModelInfo } from './api.ts';
import { TAUNTS } from '../server/taunt-lines.ts';
import { el, secs, shuffle, sleep, store } from './dom.ts';
import { CardView, type PlayerAnswer } from './view.ts';
import { beep, effect, hush, jevSays, prefs, say, setPref, unlock } from './sound.ts';
import { boardsBlock, GameRecord, getBoards, getDeal, getShare, rankedPanel } from './ranked.ts';
import { matchMenu, openMatchLink, type MatchContext } from './match.ts';
import { howItWorks } from './how.ts';
import { formatScore, RANKED, SPRINT_CARDS, VERSUS_LIMITS, type Mode } from '../shared/game.ts';
import type { ShareResult } from '../server/scores.ts';

const PENALTY_MS = 5_000;
const STREAK_LIMIT_MS = 10_000;
const VERSUS_ROUNDS = 10;

const app = document.getElementById('app')!;
let deck: Card[] = [];
let models: ModelInfo[] = [];
const DEFAULT_SETTINGS = { model: '', sprintCards: 10, versusSeconds: 10 };
/** Saved settings over the defaults, so a setting added later (or a value no longer offered) never comes back undefined. */
const settings = { ...DEFAULT_SETTINGS, ...store.get<Partial<typeof DEFAULT_SETTINGS>>('jev-cards:settings', {}) };
if (!SPRINT_CARDS.includes(settings.sprintCards)) settings.sprintCards = DEFAULT_SETTINGS.sprintCards;
if (!VERSUS_LIMITS.includes(settings.versusSeconds * 1000)) settings.versusSeconds = DEFAULT_SETTINGS.versusSeconds;
const saveSettings = () => store.set('jev-cards:settings', settings);
/** Set by a running game; called when leaving it. */
let leave: (() => void) | undefined;

const modelName = () => models.find((m) => m.id === settings.model)?.name ?? 'Jev';
/**
 * The cards for a game: a signed deal from the server for this setup. The server marks every answer against it
 * (the page has no answers), checks the game at the end, and ranks it when the setup is the standard one. Null
 * when the server cannot deal: the game cannot be played then, and says so.
 */
async function dealFor(mode: Mode): Promise<{ cards: Card[]; record: GameRecord } | null> {
  const box = !!models.find((m) => m.id === settings.model)?.box;
  const dealt = await getDeal(mode, mode === 'sprint' ? settings.sprintCards : VERSUS_ROUNDS, mode === 'versus' ? settings.versusSeconds * 1000 : STREAK_LIMIT_MS, box);
  const byId = new Map(deck.map((c) => [c.id, c]));
  if (dealt && dealt.cards.every((id) => byId.has(id))) return { cards: dealt.cards.map((id) => byId.get(id)!), record: new GameRecord(mode, dealt.deal) };
  screen(topbar(RANKED[mode].label), el('main', { className: 'play' }, el('div', { className: 'results' }, el('p', { className: 'loading' }, 'Could not reach the game server. Try again in a moment.'), again(PLAY[mode], 'Try again'))));
  return null;
}

const playable = (): Card[] => {
  const m = models.find((x) => x.id === settings.model);
  return deck.filter((c) => c.kind !== 'point' || m?.box);
};

async function boot() {
  app.replaceChildren(el('p', { className: 'loading' }, 'Shuffling the cards...'));
  try {
    // The page always plays the server's default model (Jev 1.14); other models stay supported behind the scenes.
    [deck, { models }] = await Promise.all([loadDeck(), loadModels().then((r) => ((settings.model = r.default), r))]);
  } catch (e) {
    app.replaceChildren(el('p', { className: 'loading' }, `Could not load the game: ${(e as Error).message}`));
    return;
  }
  const shared = location.pathname.match(/^\/r\/([A-Za-z0-9_.-]+)$/);
  const match = location.pathname.match(/^\/m\/([A-Za-z0-9]{4})$/);
  if (shared) void sharePage(shared[1]);
  else if (match) void openMatchLink(matchCtx, match[1].toUpperCase());
  else if (location.pathname === '/how') showHow();
  else home();
}

/** Shows a new screen and ends the running game, if any. */
function screen(...children: (Node | string | null | false)[]) {
  leave?.();
  leave = undefined;
  swap(...children);
}

/** Shows a new screen within the running game (its results), which keeps going. */
function swap(...children: (Node | string | null | false)[]) {
  app.replaceChildren(...children.filter((c): c is Node | string => !!c));
  window.scrollTo(0, 0);
}

function topbar(title: string, ...right: Node[]) {
  const back = el('button', { className: 'link', type: 'button', 'aria-label': 'Menu' }, '← ', el('span', { className: 'link-label' }, 'Menu'));
  back.addEventListener('click', home);
  return el('header', { className: 'topbar' }, back, el('span', { className: 'topbar-title' }, title), el('div', { className: 'topbar-right' }, ...right, soundSwitch('music', 'Music')));
}

// ---------------------------------------------------------------------------------------------------- home

function home() {
  hush();
  // Leaving a share link's page: the address goes back to the game's own.
  if (location.pathname !== '/') history.replaceState(null, '', '/');
  const best = store.get('jev-cards:best', { sprint: 0, versus: 0, streak: 0 });
  const mode = (id: string, name: string, blurb: string, record: string, start: () => void) => {
    const b = el(
      'button',
      { className: `mode mode-${id}`, type: 'button' },
      el('span', { className: 'mode-name' }, name),
      el('span', { className: 'mode-blurb' }, blurb),
      el('span', { className: 'mode-best' }, record),
    );
    b.addEventListener('click', start);
    return b;
  };
  const matchBanner = () => {
    const b = el(
      'button',
      { className: 'mode mode-match', type: 'button' },
      el('span', { className: 'mode-name' }, 'Live match'),
      el('span', { className: 'mode-blurb' }, 'Play with friends: everyone gets the same 10 cards at the same moment, and Jev plays too.'),
      el('span', { className: 'mode-cta' }, 'Host or join'),
    );
    b.addEventListener('click', () => matchMenu(matchCtx));
    return b;
  };
  const select = <T extends string | number>(label: string, value: T, options: [T, string][], set: (v: T) => void) => {
    const s = el('select', {}, ...options.map(([v, t]) => el('option', { value: String(v), selected: v === value }, t)));
    s.addEventListener('change', () => {
      const raw = s.value;
      set((typeof value === 'number' ? Number(raw) : raw) as T);
      saveSettings();
    });
    return el('label', { className: 'setting' }, el('span', {}, label), s);
  };
  const n = playable().length;
  // Three cards from different categories, fanned out on stage.
  const fan = shuffle([...new Map(shuffle(deck).map((c) => [c.category, c])).values()]).slice(0, 3);
  screen(
    el(
      'main',
      { className: 'home' },
      el(
        'div',
        { className: 'hero' },
        el('p', { className: 'eyebrow' }, 'Live tonight: people against a model'),
        el('h1', { className: 'marquee' }, 'Jev Cards'),
        el('div', { className: 'fan', 'aria-hidden': 'true' }, ...fan.map((c) => el('img', { src: '/' + c.image, alt: '', draggable: false }))),
        el('p', { className: 'lede' }, `${deck.length} picture cards: fruit, flags, maps, chess, illusions. Jev sees the same picture you do and answers in about a quarter of a second. Can you keep up?`),
        linkButton('How does Jev see the cards?', showHow),
      ),
      el('div', { className: 'contestants' }, el('span', { className: 'podium-mini you' }, 'You'), el('span', { className: 'vs' }, 'vs'), el('span', { className: 'podium-mini jev' }, modelName())),
      el(
        'div',
        { className: 'modes' },
        mode('sprint', 'Sprint', `${Math.min(settings.sprintCards, n)} cards against the clock, with Jev's ghost racing the same cards. Every miss costs 5 seconds.`, best.sprint ? `Your best: ${secs(best.sprint)}` : 'No time yet', sprint),
        mode('versus', 'Versus', `${VERSUS_ROUNDS} rounds at the buzzer, live. ${settings.versusSeconds} seconds a card. Right and fast scores most.`, best.versus ? `Your best: ${best.versus} points` : 'No score yet', versus),
        mode('streak', 'Streak', 'How many in a row before your first miss? Jev plays the same cards.', best.streak ? `Your best: ${best.streak} in a row` : 'No streak yet', streak),
      ),
      // Live match is the odd one out (it is played with friends), so it gets its own banner under the solo games.
      matchBanner(),
      el(
        'div',
        { className: 'settings' },
        select('Sprint cards', settings.sprintCards, [[5, '5'], [10, '10'], [20, '20'], [999, 'All']], (v) => ((settings.sprintCards = v), home())),
        select('Versus seconds', settings.versusSeconds, [[3, '3 s'], [5, '5 s'], [10, '10 s'], [15, '15 s']], (v) => ((settings.versusSeconds = v), home())),
      ),
      el('div', { className: 'home-links' }, linkButton('Leaderboards', leaderboards)),
      el('div', { className: 'settings sound' }, soundSwitch('music', 'Music'), soundSwitch('effects', 'Effects'), soundSwitch('host', 'Voices')),
      el('p', { className: 'footnote' }, `${modelName()} is a decision model: it reads the picture and the question and returns a probability for every option (or a box, for "tap the place" cards) in one call. It never writes text.`),
      signature(),
    ),
  );
}

/** The maker's mark at the foot of a page: "Built by JMS" (JMS as on jose.sabater.io), linking to the source. */
function signature() {
  return el(
    'footer',
    { className: 'signature' },
    el('a', { href: 'https://github.com/Jose-Sabater/jevcards', target: '_blank', rel: 'noopener' }, el('span', { className: 'sig-text' }, 'Built by'), el('span', { className: 'sig-mark' }, 'JMS')),
  );
}

/** The countdown ring: empties as the time runs out, with the whole seconds left in the middle. */
function countdown() {
  const num = el('span', {}, '');
  const root = el('div', { className: 'ring' }, num);
  let shown = -1;
  return {
    root,
    set(msLeft: number, total: number) {
      root.style.setProperty('--left', String(Math.max(0, msLeft / total)));
      const whole = Math.max(0, Math.ceil(msLeft / 1000));
      // Tick the last three seconds, but not on the first frame of a card.
      if (whole !== shown && shown !== -1 && whole > 0 && whole <= 3) effect('tick', 0.7);
      shown = whole;
      num.textContent = String(whole);
      root.classList.toggle('hurry', msLeft < 3000);
    },
  };
}

function linkButton(label: string, go: () => void) {
  const b = el('button', { className: 'secondary', type: 'button' }, label);
  b.addEventListener('click', go);
  return b;
}

// ---------------------------------------------------------------------------------------------------- boards and share links

/** Every leaderboard. */
async function leaderboards() {
  const body = el('div', { className: 'results' }, el('p', { className: 'loading' }, 'Loading the boards...'));
  screen(topbar('Leaderboards'), el('main', { className: 'play' }, body));
  try {
    const view = await getBoards();
    body.replaceChildren(
      el('h1', { className: 'result-title' }, 'Leaderboards'),
      el('p', { className: 'footnote' }, `Ranked games: Sprint with ${RANKED.sprint.cards} cards, Versus at ${RANKED.versus.limitMs / 1000} s, against Jev 1.14. Every score is checked by the server.`),
      boardsBlock(view),
      again(home, 'Play'),
      signature(),
    );
  } catch (e) {
    body.replaceChildren(el('p', { className: 'loading' }, `Could not load the boards: ${(e as Error).message}`));
  }
}

const PLAY: Record<Mode, () => void> = { sprint: () => sprint(), versus: () => versus(), streak: () => streak() };

/** The page a share link opens: the shared game, Jev's last word, and a big button to play the same mode. */
async function sharePage(token: string) {
  const body = el('div', { className: 'results share-page' }, el('p', { className: 'loading' }, 'Loading the result...'));
  screen(el('main', { className: 'play' }, body));
  const toHome = () => {
    history.replaceState(null, '', '/');
    home();
  };
  let shared: Awaited<ReturnType<typeof getShare>>;
  try {
    shared = await getShare(token);
  } catch (e) {
    body.replaceChildren(el('p', { className: 'loading' }, (e as Error).message), again(toHome, 'Play Jev Cards'));
    return;
  }
  const r: ShareResult = shared.result;
  const who = r.initials || 'A player';
  const jevName = 'Jev 1.14';
  const lower = r.mode === 'sprint';
  const won = !r.jev ? null : r.score === r.jev.score ? 'draw' : (lower ? r.score < r.jev.score : r.score > r.jev.score) ? 'person' : 'jev';
  const headline = won === 'person' ? `${who} beat Jev!` : won === 'jev' ? `${jevName} beat ${who}` : won === 'draw' ? 'A draw!' : `${who} played Jev`;
  const taunt = TAUNTS.find((t) => t.id === r.taunt);
  const play = el('button', { className: 'primary play-yourself', type: 'button' }, `Play ${RANKED[r.mode].label} yourself`);
  play.addEventListener('click', () => {
    history.replaceState(null, '', '/');
    PLAY[r.mode]();
  });
  body.replaceChildren(
    el('p', { className: 'eyebrow' }, `Jev Cards · ${RANKED[r.mode].label}`),
    el('h1', { className: 'result-title' }, headline),
    el(
      'div',
      { className: 'scores' },
      scoreBox(who, formatScore(r.mode, r.score), r.mode === 'streak' ? 'until the first miss' : `${r.right}/${r.cards} right`, won === 'person' || won === 'draw', 'you'),
      scoreBox(jevName, r.jev ? formatScore(r.mode, r.jev.score) : '?', r.jev ? (r.mode === 'streak' ? 'until its first miss' : `${r.jev.right}/${r.cards} right`) : 'no score', won === 'jev' || won === 'draw'),
    ),
    ...(taunt ? [el('section', { className: 'last-word done' }, el('div', { className: 'lw-head' }, el('span', { className: 'lw-badge' }, `${jevName} said`)), el('p', { className: 'lw-quote' }, `"${taunt.text}"`))] : []),
    el('div', { className: 'actions play-row' }, play),
    el('p', { className: 'footnote' }, 'A visual quiz: tap the right thing in each picture, faster than Jev, a decision model that answers in about 0.3 s.'),
    boardsBlock(shared, r.mode),
    again(toHome, 'All games'),
    signature(),
  );
}

// ---------------------------------------------------------------------------------------------------- shared

/**
 * Shows card `index` of the game, waits for the answer (or the limit), has the server mark it, and returns it.
 * `hud` gets the elapsed ms each frame. Null when the server could not be reached: the stage then says so.
 */
async function playCard(stage: HTMLElement, view: CardView, rec: GameRecord, index: number, limitMs: number | null, hud?: (ms: number) => void): Promise<{ view: CardView; you: PlayerAnswer } | null> {
  await view.ready();
  stage.replaceChildren(view.root);
  effect('deal', 0.6);
  view.start();
  const t0 = performance.now();
  let raf = 0;
  const tick = () => {
    const ms = performance.now() - t0;
    hud?.(ms);
    if (limitMs !== null && ms >= limitMs) view.timeout();
    else raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  // A background tab pauses requestAnimationFrame: a timer still ends the card.
  const timer = limitMs !== null ? setTimeout(() => view.timeout(), limitMs + 50) : 0;
  const you = await view.answer;
  cancelAnimationFrame(raf);
  clearTimeout(timer);
  try {
    you.correct = await markAnswer(rec.recording.deal, index, view.card, you);
  } catch (e) {
    const menu = el('button', { className: 'primary', type: 'button' }, 'Menu');
    menu.addEventListener('click', home);
    stage.replaceChildren(el('div', { className: 'results' }, el('p', { className: 'loading' }, `${(e as Error).message}. This game cannot go on.`), el('div', { className: 'actions' }, menu)));
    return null;
  }
  effect(you.correct ? 'ding' : you.option || you.point ? 'buzzer' : 'timeup');
  return { view, you };
}

const verdict = (ok: boolean | undefined, text?: string) => el('span', { className: `verdict ${ok ? 'ok' : ok === false ? 'no' : 'none'}` }, text ?? (ok ? 'Right' : 'Wrong'));

function explainPanel(card: Card, you: PlayerAnswer, jev: JevAnswer | null | 'pending' | Error, onNext: () => void, nextLabel = 'Next card') {
  const jevLine =
    jev === 'pending'
      ? el('span', { className: 'who' }, el('b', {}, modelName()), ' is still thinking...')
      : jev instanceof Error
        ? el('span', { className: 'who' }, el('b', {}, modelName()), jev.message.startsWith(modelName()) ? jev.message.slice(modelName().length) : ' could not answer')
        : jev
          ? el('span', { className: 'who' }, el('b', {}, modelName()), verdict(jev.correct), ` in ${secs(jev.latencyMs)}`)
          : null;
  const next = el('button', { className: 'primary', type: 'button' }, nextLabel);
  next.addEventListener('click', onNext);
  queueMicrotask(() => {
    next.focus({ preventScroll: true });
    next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  return el(
    'div',
    { className: 'explain' },
    el('div', { className: 'explain-row' }, el('span', { className: 'who' }, el('b', {}, 'You'), verdict(you.correct, you.option || you.point ? undefined : 'Too slow'), you.option || you.point ? ` in ${secs(you.ms)}` : ''), jevLine),
    el('p', {}, card.explain),
    next,
  );
}

const waitClick = (fn: (go: () => void) => HTMLElement, host: HTMLElement) =>
  new Promise<void>((resolve) => {
    host.append(fn(resolve));
  });

function saveBest(key: 'sprint' | 'versus' | 'streak', value: number, lowerIsBetter = false): boolean {
  const best = store.get('jev-cards:best', { sprint: 0, versus: 0, streak: 0 });
  // A zero (0 in a row, 0 points) is never a best.
  const better = lowerIsBetter ? !best[key] || value < best[key] : value > (best[key] || 0);
  if (better) store.set('jev-cards:best', { ...best, [key]: value });
  return better;
}

/**
 * The opening: the host asks if the contestants are ready, then 3, 2, 1, GO on the stage. Returns false when
 * the player left meanwhile. The host's line never holds the game up for long: say() has its own time limit.
 */
async function getReady(stage: HTMLElement, alive: () => boolean): Promise<boolean> {
  const big = el('span', { className: 'ready-big' }, 'Ready?');
  stage.replaceChildren(el('div', { className: 'get-ready' }, el('p', { className: 'ready-line' }, 'Contestants...'), big));
  await say('ready');
  for (const step of ['3', '2', '1', 'GO!']) {
    if (!alive()) return false;
    big.textContent = step;
    big.classList.toggle('go', step === 'GO!');
    // Restart the pop animation for every step.
    big.style.animation = 'none';
    void big.offsetWidth;
    big.style.animation = '';
    beep(step === 'GO!');
    await sleep(step === 'GO!' ? 550 : 750);
  }
  return alive();
}

/** The end of a game: the crowd, then the host, then a word on a new best. */
function finale(outcome: 'win' | 'lose' | 'draw' | 'perfect', record: boolean) {
  effect(outcome === 'lose' ? 'aww' : outcome === 'draw' ? 'ding' : 'applause', outcome === 'lose' ? 0.8 : 1);
  void say(outcome === 'perfect' ? 'perfect' : outcome);
  if (record) void say('best');
}

/** An on/off switch for one part of the sound. */
function soundSwitch(key: 'music' | 'effects' | 'host', label: string) {
  const b = el('button', { className: 'switch', type: 'button', 'aria-pressed': String(prefs[key]), 'aria-label': label }, el('span', { className: 'switch-label' }, label));
  b.addEventListener('click', () => {
    setPref(key, !prefs[key]);
    b.setAttribute('aria-pressed', String(prefs[key]));
  });
  return b;
}

// ---------------------------------------------------------------------------------------------------- sprint

async function sprint() {
  hush();
  const dealt = await dealFor('sprint');
  if (!dealt) return;
  const { cards, record: rec } = dealt;
  const jev = new JevQueue(settings.model, rec.recording.deal);
  // Jev's answers, in card order, as they arrive (the queue asks one at a time, in this order).
  const jevAnswers: (JevAnswer | Error)[] = [];
  cards.forEach((c, i) => void jev.get(c.id).then((a) => (jevAnswers[i] = a), (e: Error) => (jevAnswers[i] = e)));
  let alive = true;
  const clock = el('span', { className: 'clock' }, '0.0 s');
  const count = el('span', { className: 'count' }, `1/${cards.length}`);
  const track = new GhostTrack(cards.length, modelName());
  const stage = el('div', { className: 'stage' });
  screen(topbar('Sprint', count, clock), el('main', { className: 'play' }, track.root, stage));
  leave = () => ((alive = false), jev.stop());

  if (!(await getReady(stage, () => alive))) return;
  let spent = 0;
  let misses = 0;
  const results: { card: Card; you: PlayerAnswer }[] = [];
  const tick = (ms: number) => {
    const t = spent + misses * PENALTY_MS + ms;
    clock.textContent = secs(t);
    track.update(t, jevAnswers);
  };
  for (const [i, card] of cards.entries()) {
    count.textContent = `${i + 1}/${cards.length}`;
    track.you(i, undefined);
    const played = await playCard(stage, cardView(card), rec, i, null, tick);
    if (!alive || !played) return;
    const { view, you } = played;
    spent += you.ms;
    if (!you.correct) misses++;
    tick(0);
    track.you(i, you.correct);
    results.push({ card, you });
    rec.answer(card.id, you);
    view.reveal(you, null);
    view.root.append(el('div', { className: `flash ${you.correct ? 'ok' : 'no'}` }, you.correct ? 'Right' : '+5 s'));
    // A miss shows why, and waits: the clock is stopped between cards.
    if (you.correct) await sleep(450);
    else await waitClick((go) => explainPanel(card, you, null, go, i + 1 < cards.length ? 'Next card' : 'See the result'), view.root);
    if (!alive) return;
  }

  const yourTime = spent + misses * PENALTY_MS;
  const record = saveBest('sprint', yourTime, true);
  const board = el('div', { className: 'results' }, el('p', { className: 'loading' }, `Waiting for ${modelName()}'s answers...`));
  swap(topbar('Sprint'), el('main', { className: 'play' }, board));
  const answers = await Promise.all(cards.map((c) => jev.get(c.id).catch((e: Error) => e)));
  const jevMs = answers.reduce((s, a) => s + (a instanceof Error ? PENALTY_MS : a.latencyMs + (a.correct ? 0 : PENALTY_MS)), 0);
  const jevRight = answers.filter((a) => !(a instanceof Error) && a.correct).length;
  const youRight = results.filter((r) => r.you.correct).length;
  const win = yourTime < jevMs;
  rec.jev(answers.map((a) => (a instanceof Error ? undefined : a.signed)));
  let taunt = '';
  finale(win ? 'win' : 'lose', record);
  board.replaceChildren(
    el('h1', { className: 'result-title' }, win ? 'You beat Jev!' : `${modelName()} wins this one`),
    el('div', { className: 'scores' }, scoreBox('You', secs(yourTime), `${youRight}/${cards.length} right${record ? ', new best' : ''}`, win), scoreBox(modelName(), secs(jevMs), `${jevRight}/${cards.length} right`, !win)),
    rankedPanel(rec, () => taunt),
    lastWord({ mode: 'sprint', winner: win ? 'person' : 'jev', person: yourTime / 1000, jev: jevMs / 1000, personRight: youRight, jevRight, cards: cards.length }, (id) => (taunt = id)),
    el('p', { className: 'footnote' }, 'Time spent answering, plus 5 seconds for every miss.'),
    cardTable(results.map((r, i) => ({ card: r.card, you: r.you, jev: answers[i] }))),
    again(sprint),
  );
}

/**
 * Sprint's race strip: a row of pips for you and one for Jev's ghost. Jev's ghost runs on the same clock as
 * yours (time on cards plus penalties), so at your 6.2 s it shows the card Jev had reached at its 6.2 s.
 */
class GhostTrack {
  readonly root: HTMLElement;
  private mine: HTMLElement[];
  private ghost: HTMLElement[];
  private status: HTMLElement;
  private name: string;
  constructor(n: number, name: string) {
    this.name = name;
    const pips = () => Array.from({ length: n }, () => el('i', { className: 'pip' }));
    this.mine = pips();
    this.ghost = pips();
    this.status = el('span', { className: 'lane-status' }, `${name} is reading the first card`);
    this.root = el(
      'div',
      { className: 'race' },
      el('div', { className: 'lane lane-you' }, el('span', { className: 'lane-name' }, 'You'), el('span', { className: 'pips' }, ...this.mine)),
      el('div', { className: 'lane lane-jev' }, el('span', { className: 'lane-name' }, name), el('span', { className: 'pips' }, ...this.ghost), this.status),
    );
  }

  /** Marks your card i: undefined while you are on it. */
  you(i: number, ok: boolean | undefined): void {
    const p = this.mine[i];
    p.className = `pip ${ok === undefined ? 'now' : ok ? 'ok' : 'no'}`;
  }

  /** Moves Jev's ghost to where Jev was at game time t. */
  update(t: number, answers: (JevAnswer | Error)[]): void {
    let at = 0;
    let done = 0;
    for (let i = 0; i < this.ghost.length; i++) {
      const a = answers[i];
      if (!a) break;
      const ms = a instanceof Error ? PENALTY_MS : a.latencyMs + (a.correct ? 0 : PENALTY_MS);
      if (at + ms > t) break;
      at += ms;
      done++;
    }
    this.ghost.forEach((p, i) => {
      const a = answers[i];
      p.className = i < done ? `pip ${a && !(a instanceof Error) && a.correct ? 'ok' : 'no'}` : i === done ? 'pip now' : 'pip';
    });
    const right = answers.slice(0, done).filter((a) => !(a instanceof Error) && a.correct).length;
    this.status.textContent = done === this.ghost.length ? `finished in ${secs(at)}, ${right} right` : `on card ${done + 1}, ${right} right`;
    this.root.classList.toggle('ghost-done', done === this.ghost.length);
  }
}

/** A card view numbered by its place in the deck. */
const cardView = (card: Card) => new CardView(card, deck.indexOf(card) + 1);

/** The how-it-works page, at /how. */
function showHow() {
  if (location.pathname !== '/how') history.pushState(null, '', '/how');
  howItWorks({ screen, topbar, home, deck: () => deck, cardView, model: () => settings.model });
}

/** What the live match module uses from the game. */
const matchCtx: MatchContext = {
  screen,
  topbar,
  home,
  card: (id) => deck.find((c) => c.id === id),
  cardView,
  countdown,
  setLeave: (fn) => (leave = fn),
};

/**
 * Jev's last word: Jev gets a random mood and six lines that suit the result, picks one in a single decision call
 * (server/taunts.ts), and says it out loud. The panel shows Jev's mood and its top three, runs a highlight
 * between them that slows down and lands on the one Jev chose, then speaks. The landing is decided before the
 * spin starts: the spin is only for show. A late answer speaks only while the results are still on screen.
 */
function lastWord(result: MatchResult, chose?: (taunt: string) => void): HTMLElement {
  const quote = el('p', { className: 'lw-quote thinking' }, `${modelName()} is choosing its last word...`);
  const meta = el('span', { className: 'lw-meta' }, '');
  const list = el('ol', { className: 'lw-options' });
  const again = el('button', { className: 'secondary lw-again', type: 'button', hidden: true }, 'Say it again');
  const badge = el('span', { className: 'lw-badge' }, `${modelName()} is choosing`);
  const panel = el('section', { className: 'last-word', 'aria-live': 'polite' }, el('div', { className: 'lw-head' }, badge, meta), quote, list, again);
  askTaunt(result, settings.model).then(
    async (a) => {
      const chosen = TAUNTS.find((t) => t.id === a.choice)!;
      chose?.(chosen.id);
      const pct = (id: string) => a.probabilities[id] ?? 0;
      // Jev's choice and its two runners-up, in a random order so the landing spot is not always the top row.
      const runnersUp = a.offered.filter((id) => id !== a.choice).sort((x, y) => pct(y) - pct(x));
      const top = shuffle([a.choice, ...runnersUp.slice(0, 2)]);
      const rows = top.map((id) => {
        const bar = el('i', { className: 'lw-bar' });
        bar.style.setProperty('--p', String(pct(id)));
        return el(
          'li',
          {},
          el('span', { className: 'lw-text' }, TAUNTS.find((t) => t.id === id)!.text),
          el('span', { className: 'lw-track' }, bar),
          el('span', { className: 'lw-pct' }, `${Math.round(pct(id) * 100)}%`),
        );
      });
      quote.textContent = `Mood: ${a.mood}`;
      meta.textContent = `top 3 of ${a.offered.length} lines`;
      list.replaceChildren(...rows);
      // The host hands over to Jev while the spin runs; Jev's line follows once the host is done.
      void say('intro');
      // The spin: about two laps that slow down, ending on Jev's choice.
      const target = top.indexOf(a.choice);
      const steps = 2 * rows.length + target + 1;
      for (let i = 0; i < steps; i++) {
        rows.forEach((r, k) => r.classList.toggle('lit', k === i % rows.length));
        effect('tick', 0.5);
        await sleep(70 + 260 * (i / steps) ** 2);
        if (!panel.isConnected) return;
      }
      rows.forEach((r, k) => r.classList.toggle('chosen', k === target));
      rows.forEach((r) => r.classList.remove('lit'));
      badge.textContent = `${modelName()} chose`;
      meta.textContent = `mood: ${a.mood} · top 3 of ${a.offered.length} lines · ${secs(a.latencyMs)}`;
      quote.classList.remove('thinking');
      quote.textContent = `"${chosen.text}"`;
      panel.classList.add('done');
      effect('ding');
      again.hidden = false;
      again.addEventListener('click', () => void jevSays(chosen.id));
      void jevSays(chosen.id);
    },
    (e: Error) => {
      quote.classList.remove('thinking');
      badge.textContent = `${modelName()} is speechless`;
      quote.classList.add('quiet');
      quote.textContent = /overloaded/.test(e.message) ? 'Its servers are busy right now, so no last word this time.' : 'No last word this time.';
    },
  );
  return panel;
}

function scoreBox(who: string, big: string, small: string, winner: boolean, side: 'you' | 'jev' = who === 'You' ? 'you' : 'jev') {
  return el('div', { className: `score-box ${winner ? 'winner' : ''} ${side}` }, el('span', { className: 'score-who' }, who), el('span', { className: 'score-big' }, big), el('span', { className: 'score-small' }, small));
}

function cardTable(rows: { card: Card; you: PlayerAnswer; jev: JevAnswer | Error | undefined }[]) {
  const mark = (ok: boolean | undefined, ms?: number) => el('td', { className: ok ? 'ok' : 'no' }, ok ? '✓' : '✗', ms !== undefined ? el('small', {}, ` ${secs(ms)}`) : '');
  return el(
    'div',
    { className: 'table-wrap' },
    el(
      'table',
      { className: 'card-table' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Card'), el('th', {}, 'You'), el('th', {}, modelName()))),
      el('tbody', {}, ...rows.map((r) => el('tr', {}, el('td', {}, r.card.title), mark(r.you.correct, r.you.ms), r.jev instanceof Error || !r.jev ? el('td', { className: 'no' }, 'error') : mark(r.jev.correct, r.jev.latencyMs)))),
    ),
  );
}

function again(fn: () => void, label = 'Play again') {
  const a = el('button', { className: 'primary', type: 'button' }, label);
  a.addEventListener('click', fn);
  const m = el('button', { className: 'secondary', type: 'button' }, 'Menu');
  m.addEventListener('click', home);
  return el('div', { className: 'actions' }, a, m);
}

// ---------------------------------------------------------------------------------------------------- versus

async function versus() {
  hush();
  const limit = settings.versusSeconds * 1000;
  const dealt = await dealFor('versus');
  if (!dealt) return;
  const { cards, record: rec } = dealt;
  const jev = new JevQueue(settings.model, rec.recording.deal);
  let alive = true;
  const youScore = el('b', { className: 'led' }, '0');
  const jevScore = el('b', { className: 'led' }, '0');
  const round = el('span', { className: 'count' }, `1/${cards.length}`);
  const ring = countdown();
  ring.set(limit, limit);
  const jevChip = el('p', { className: 'jev-chip' }, '');
  const stage = el('div', { className: 'stage' });
  screen(
    topbar('Versus', round),
    el(
      'main',
      { className: 'play' },
      el('div', { className: 'podiums' }, el('div', { className: 'podium you' }, el('span', { className: 'podium-who' }, 'You'), youScore), ring.root, el('div', { className: 'podium jev' }, el('span', { className: 'podium-who' }, modelName()), jevScore)),
      jevChip,
      stage,
    ),
  );
  leave = () => ((alive = false), jev.stop());

  const points = (ok: boolean, ms: number) => (ok && ms <= limit ? 100 + Math.round(50 * Math.max(0, 1 - ms / limit)) : 0);
  if (!(await getReady(stage, () => alive))) return;
  let you = 0, them = 0;
  const rows: { card: Card; you: PlayerAnswer; jev: JevAnswer | Error | undefined }[] = [];
  for (const [i, card] of cards.entries()) {
    round.textContent = `${i + 1}/${cards.length}`;
    jevChip.textContent = `${modelName()} is looking...`;
    jevChip.className = 'jev-chip thinking';
    let jevAnswer: JevAnswer | Error | undefined;
    const view = cardView(card);
    await view.ready();
    // Jev is asked the moment the card is shown; its answer stays hidden until you answer.
    const asked = jev.get(card.id).then(
      (a) => {
        jevAnswer = a;
        jevChip.textContent = a.latencyMs <= limit ? `${modelName()} answered in ${secs(a.latencyMs)}` : `${modelName()} was too slow`;
        jevChip.className = 'jev-chip done';
      },
      (e: Error) => {
        jevAnswer = e;
        jevChip.textContent = `${modelName()} could not answer`;
        jevChip.className = 'jev-chip error';
      },
    );
    const played = await playCard(stage, view, rec, i, limit, (ms) => ring.set(limit - ms, limit));
    if (!alive || !played) return;
    const ya = played.you;
    // Jev had the same time limit; wait for it only as long as the limit allows.
    await Promise.race([asked, sleep(Math.max(0, limit - ya.ms) + 200)]);
    const ja = jevAnswer instanceof Error || !jevAnswer ? null : jevAnswer;
    const jaOk = !!ja && ja.correct && ja.latencyMs <= limit;
    you += points(ya.correct, ya.ms);
    them += ja ? points(jaOk, ja.latencyMs) : 0;
    youScore.textContent = String(you);
    jevScore.textContent = String(them);
    rows.push({ card, you: ya, jev: jevAnswer });
    rec.answer(card.id, ya);
    view.reveal(ya, ja);
    await waitClick((go) => explainPanel(card, ya, jevAnswer instanceof Error ? jevAnswer : (ja ?? 'pending'), go, i + 1 < cards.length ? 'Next card' : 'See the result'), view.root);
    if (!alive) return;
  }
  const record = saveBest('versus', you);
  rec.jev(rows.map((r) => (r.jev instanceof Error ? undefined : r.jev?.signed)));
  let taunt = '';
  finale(you > them ? 'win' : you === them ? 'draw' : 'lose', record);
  const verdictText = you > them ? 'You beat Jev!' : you === them ? 'A draw!' : `${modelName()} wins this one`;
  screen(
    topbar('Versus'),
    el(
      'main',
      { className: 'play results' },
      el('h1', { className: 'result-title' }, verdictText),
      el('div', { className: 'scores' }, scoreBox('You', String(you), `${rows.filter((r) => r.you.correct).length}/${rows.length} right${record ? ', new best' : ''}`, you >= them), scoreBox(modelName(), String(them), `${rows.filter((r) => !(r.jev instanceof Error) && r.jev?.correct).length}/${rows.length} right`, them >= you)),
      rankedPanel(rec, () => taunt),
      lastWord(
        { mode: 'versus', winner: you > them ? 'person' : you === them ? 'draw' : 'jev', person: you, jev: them, personRight: rows.filter((r) => r.you.correct).length, jevRight: rows.filter((r) => !(r.jev instanceof Error) && r.jev?.correct).length, cards: rows.length },
        (id) => (taunt = id),
      ),
      el('p', { className: 'footnote' }, `100 points for a right answer within ${settings.versusSeconds} s, plus up to 50 for speed.`),
      cardTable(rows),
      again(versus),
    ),
  );
}

// ---------------------------------------------------------------------------------------------------- streak

async function streak() {
  hush();
  const dealt = await dealFor('streak');
  if (!dealt) return;
  const { cards, record: rec } = dealt;
  const jev = new JevQueue(settings.model, rec.recording.deal);
  // Ask a few ahead, so Jev's streak is known soon after yours ends.
  const ahead = (i: number) => cards.slice(i, i + 3).forEach((c) => void jev.get(c.id).catch(() => undefined));
  let alive = true;
  const run = el('span', { className: 'count' }, '0 in a row');
  const ring = countdown();
  ring.set(STREAK_LIMIT_MS, STREAK_LIMIT_MS);
  const stage = el('div', { className: 'stage' });
  screen(topbar('Streak', run), el('main', { className: 'play' }, el('div', { className: 'podiums solo' }, ring.root), stage));
  leave = () => ((alive = false), jev.stop());

  if (!(await getReady(stage, () => alive))) return;
  let n = 0;
  let last: { card: Card; you: PlayerAnswer; view: CardView } | undefined;
  for (const [i, card] of cards.entries()) {
    ahead(i);
    const played = await playCard(stage, cardView(card), rec, i, STREAK_LIMIT_MS, (ms) => ring.set(STREAK_LIMIT_MS - ms, STREAK_LIMIT_MS));
    if (!alive || !played) return;
    const { view, you } = played;
    last = { card, you, view };
    rec.answer(card.id, you);
    if (!you.correct) break;
    n++;
    run.textContent = `${n} in a row`;
    view.reveal(you, null);
    view.root.append(el('div', { className: 'flash ok' }, String(n)));
    await sleep(450);
    if (!alive) return;
  }
  const perfect = n === cards.length;
  if (last && !perfect) {
    last.view.reveal(last.you, null);
    await waitClick((go) => explainPanel(last!.card, last!.you, null, go, 'See the result'), last.view.root);
    if (!alive) return;
  }
  const record = saveBest('streak', n);
  const board = el('div', { className: 'results' }, el('p', { className: 'loading' }, `${modelName()} is playing the same cards...`));
  swap(topbar('Streak'), el('main', { className: 'play' }, board));
  // Jev's streak: the same cards in the same order, until its first miss.
  let j = 0;
  const jevRun: (JevAnswer['signed'] | undefined)[] = [];
  for (const c of cards) {
    ahead(j + 1);
    const a = await jev.get(c.id).catch(() => null);
    if (!alive) return;
    jevRun.push(a?.signed);
    if (!a?.correct) break;
    j++;
    (board.firstElementChild as HTMLElement).textContent = `${modelName()} is playing the same cards... ${j} in a row`;
  }
  rec.jev(jevRun);
  let taunt = '';
  finale(perfect ? 'perfect' : n > j ? 'win' : n === j ? 'draw' : 'lose', record);
  board.replaceChildren(
    el('h1', { className: 'result-title' }, perfect ? 'A perfect run!' : n > j ? 'You beat Jev!' : n === j ? 'A draw!' : `${modelName()} wins this one`),
    el('div', { className: 'scores' }, scoreBox('You', String(n), `in a row${record ? ', new best' : ''}`, n >= j), scoreBox(modelName(), String(j), j === cards.length ? 'every card' : 'in a row', j >= n)),
    rankedPanel(rec, () => taunt),
    lastWord({ mode: 'streak', winner: perfect || n > j ? 'person' : n === j ? 'draw' : 'jev', person: n, jev: j, personRight: n, jevRight: j, cards: cards.length }, (id) => (taunt = id)),
    again(streak),
  );
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') home();
});

// Back from /how lands on the home screen (and forward goes back to /how).
window.addEventListener('popstate', () => (location.pathname === '/how' ? showHow() : location.pathname === '/' ? home() : undefined));

for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(type, unlock, { passive: true });

void boot();
