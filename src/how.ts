/**
 * How Jev plays: what Jev is given for a card (the picture, a sentence of context, the question, and the options
 * described by where they are), what it is not given (the answer), and what it sends back (one probability per
 * option, or a box). The example is live: the request is the server's own for that card (GET /api/explain), and
 * "Ask Jev now" makes a real call.
 */
import type { Card } from '../cards/lib.ts';
import { askJev, type JevAnswer } from './api.ts';
import { el } from './dom.ts';
import type { CardView } from './view.ts';

export interface HowContext {
  screen: (...children: (Node | string | null | false)[]) => void;
  topbar: (title: string, ...right: Node[]) => HTMLElement;
  home: () => void;
  deck: () => Card[];
  cardView: (card: Card) => CardView;
  model: () => string;
}

/** Cards that show the idea well: a photo pick, a drawn trap, a map tap. */
const EXAMPLES = ['fruit-peach', 'stroop-ink', 'map-egypt', 'big-cat-cheetah', 'flag-sweden', 'chess-mate-piece'];

export function howItWorks(ctx: HowContext, start = EXAMPLES[0]): void {
  const deck = ctx.deck();
  let card = deck.find((c) => c.id === start) ?? deck[0];
  const pictureBox = el('div', { className: 'how-card' });
  const request = el('pre', { className: 'how-json', 'aria-label': 'The request Jev gets' }, 'Loading...');
  const answer = el('div', { className: 'how-answer' }, el('p', { className: 'how-note' }, 'Press the button to send this exact request to Jev.'));
  const ask = el('button', { className: 'primary', type: 'button' }, 'Ask Jev now');
  const another = el('button', { className: 'secondary', type: 'button' }, 'Another card');
  let view: CardView | null = null;

  const load = async () => {
    view = ctx.cardView(card);
    pictureBox.replaceChildren(view.root);
    answer.replaceChildren(el('p', { className: 'how-note' }, 'Press the button to send this exact request to Jev.'));
    request.textContent = 'Loading...';
    try {
      const res = await fetch(`/api/explain?card=${encodeURIComponent(card.id)}`, { cache: 'no-store' });
      const body = await res.json();
      request.textContent = JSON.stringify(body.request, null, 2);
    } catch {
      request.textContent = 'Could not load the request.';
    }
  };

  ask.addEventListener('click', async () => {
    ask.setAttribute('disabled', '');
    answer.replaceChildren(el('p', { className: 'how-note thinking' }, 'Jev is looking...'));
    try {
      const a = await askJev(card.id, ctx.model());
      view?.reveal(null, a);
      answer.replaceChildren(...answerView(card, a));
    } catch (e) {
      answer.replaceChildren(el('p', { className: 'how-note' }, (e as Error).message));
    }
    ask.removeAttribute('disabled');
  });
  another.addEventListener('click', () => {
    const pool = EXAMPLES.filter((id) => id !== card.id);
    card = deck.find((c) => c.id === pool[Math.floor(Math.random() * pool.length)]) ?? card;
    void load();
  });

  const play = el('button', { className: 'primary', type: 'button' }, 'Play now');
  play.addEventListener('click', ctx.home);

  ctx.screen(
    ctx.topbar('How Jev plays'),
    el(
      'main',
      { className: 'play how' },
      el('h1', { className: 'result-title' }, 'How Jev plays'),
      el(
        'section',
        { className: 'how-facts' },
        fact('Jev has never seen these cards', 'Every card was made for this game in October 2026, after Jev 1.14 came out: drawn in code (maps, flags, chess, charts) or generated as new pictures. None of them is in what Jev learned from.'),
        fact('Jev never gets the answer', 'Jev gets the picture and the question, nothing else. The right answer stays on the server, which marks Jev the same way it marks you.'),
        fact('Every card is a fresh look', 'Each question is its own call with no history: Jev does not remember the last card, or the last game.'),
      ),
      el('h2', { className: 'how-step' }, el('span', {}, '1'), 'What Jev is given'),
      el(
        'p',
        { className: 'how-text' },
        'The same picture you see, one sentence about it, the question, and the options. The options say ',
        el('em', {}, 'where'),
        ' each thing is ("the fruit on the left"), never ',
        el('em', {}, 'what'),
        ' it is, so the words cannot give the answer away. For "tap the place" cards there are no options: Jev draws a box.',
      ),
      el('div', { className: 'how-example' }, pictureBox, el('div', { className: 'how-request' }, el('p', { className: 'lb-badge' }, 'The request, exactly as sent'), request)),
      el('h2', { className: 'how-step' }, el('span', {}, '2'), 'What Jev sends back'),
      el('p', { className: 'how-text' }, 'No words: one probability for each option (or a box for a place), in a single step. That is why it takes about a quarter of a second, where a chatbot would first write out its thinking.'),
      el('div', { className: 'actions how-actions' }, ask, another),
      answer,
      el('h2', { className: 'how-step' }, el('span', {}, '3'), 'How it is scored'),
      el('p', { className: 'how-text' }, "The server marks Jev's answer like yours: the option it picked, or whether the middle of its box is inside the right place. Jev's time is the time the call took."),
      el('div', { className: 'actions' }, play),
    ),
  );
  void load();
}

function fact(title: string, text: string): HTMLElement {
  return el('div', { className: 'how-fact' }, el('h3', {}, title), el('p', {}, text));
}

/** Jev's answer: the probabilities as bars (or the box), right or wrong, and the time. */
function answerView(card: Card, a: JevAnswer): HTMLElement[] {
  const head = el('p', { className: `how-verdict ${a.correct ? 'ok' : 'no'}` }, `${a.correct ? 'Right' : 'Wrong'}, in ${(a.latencyMs / 1000).toFixed(2)} s`);
  if (card.kind === 'point' || !a.probabilities) {
    const b = a.box;
    return [head, el('p', { className: 'how-note' }, b ? `Jev's box: from ${Math.round(b.left * 100)}% to ${Math.round(b.right * 100)}% across, ${Math.round(b.top * 100)}% to ${Math.round(b.bottom * 100)}% down (drawn on the card).` : 'No box.')];
  }
  const label = (id: string) => card.options!.find((o) => o.id === id)?.label ?? id;
  const rows = Object.entries(a.probabilities)
    .sort((x, y) => y[1] - x[1])
    .map(([id, p]) => {
      const bar = el('i', { className: 'lw-bar' });
      bar.style.setProperty('--p', String(p));
      return el('li', { className: id === a.choice ? 'chosen' : '' }, el('span', { className: 'lw-text' }, label(id)), el('span', { className: 'lw-track' }, bar), el('span', { className: 'lw-pct' }, `${Math.round(p * 100)}%`));
    });
  return [head, el('ol', { className: 'lw-options how-probs' }, ...rows), el('p', { className: 'how-note' }, 'The names are added here for you; Jev only saw the positions.')];
}
