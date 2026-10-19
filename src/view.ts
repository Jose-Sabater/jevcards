/**
 * One card on screen: the prompt, the picture, and buttons for buttons cards. The player answers by tapping
 * the picture (pick and point cards) or a button; `reveal` then marks the right answer, the player's and Jev's.
 */
import { optionAt, type Region } from '../cards/lib.ts';
import type { Card, JevAnswer } from './api.ts';
import { el } from './dom.ts';

export interface PlayerAnswer {
  /** pick and buttons: the option chosen. point: the tap. Null when the time ran out. */
  option?: string;
  point?: { x: number; y: number };
  /** Filled in by the server's mark: the page does not know the answers until then. */
  correct: boolean;
  ms: number;
}

/** Another player's answer in a live match, shown at the reveal under their name. */
export interface OtherAnswer {
  name: string;
  option?: string;
  point?: { x: number; y: number };
}

const ASPECT = 720 / 960;

export class CardView {
  readonly root: HTMLElement;
  private img: HTMLImageElement;
  private overlay: SVGSVGElement;
  private buttons = new Map<string, HTMLButtonElement>();
  private started = 0;
  private done = false;
  private resolveAnswer!: (a: PlayerAnswer) => void;
  readonly answer: Promise<PlayerAnswer>;
  readonly card: Card;

  constructor(card: Card, plate?: number) {
    this.card = card;
    this.answer = new Promise((r) => (this.resolveAnswer = r));
    this.img = el('img', { className: 'card-img', alt: card.prompt, draggable: false }) as HTMLImageElement;
    this.img.src = '/' + card.image;
    this.overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.overlay.setAttribute('class', 'card-overlay');
    this.overlay.setAttribute('viewBox', `0 0 1 ${ASPECT}`);
    this.overlay.setAttribute('preserveAspectRatio', 'none');
    const frame = el('div', { className: `card-frame kind-${card.kind}` }, this.img, this.overlay);
    if (card.kind !== 'buttons') {
      // A tap answers when the finger lifts close to where it landed: a swipe to scroll the page is not an answer.
      let down: { id: number; x: number; y: number } | undefined;
      frame.addEventListener('pointerdown', (e) => (down = { id: e.pointerId, x: e.clientX, y: e.clientY }));
      frame.addEventListener('pointercancel', () => (down = undefined));
      frame.addEventListener('pointerup', (e) => {
        if (down && down.id === e.pointerId && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12) this.tap(e, frame);
        down = undefined;
      });
    }
    const row = el('div', { className: 'answer-row' });
    if (card.kind !== 'point') {
      // buttons cards: every option. pick cards: the options that are not in the picture ("Same size").
      for (const o of card.options!.filter((x) => !x.region)) {
        const b = el('button', { className: 'answer-btn', type: 'button' }, o.label) as HTMLButtonElement;
        b.addEventListener('click', () => this.choose(o.id));
        this.buttons.set(o.id, b);
        row.append(b);
      }
    }
    this.root = el(
      'section',
      { className: 'card' },
      el(
        'div',
        { className: 'card-head' },
        el('span', { className: 'plate-no' }, plate ? `Card ${plate}` : 'Card', el('span', { className: 'chip' }, card.category)),
        el('h2', { className: 'prompt' }, card.prompt),
      ),
      frame,
      row,
    );
  }

  /** Waits until the picture is decoded, so the clock starts when the player can see it. */
  async ready(): Promise<void> {
    try {
      await this.img.decode();
    } catch {
      // shown anyway
    }
  }

  start(): void {
    this.started = performance.now();
  }

  private elapsed(): number {
    return Math.round(performance.now() - this.started);
  }

  private tap(e: PointerEvent, frame: HTMLElement): void {
    if (this.done || !this.started) return;
    const r = frame.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    if (this.card.kind === 'pick') {
      const o = optionAt(this.card, x, y);
      if (!o) return pulse(frame);
      this.finish({ option: o.id, correct: false, ms: this.elapsed() });
    } else {
      this.finish({ point: { x, y }, correct: false, ms: this.elapsed() });
    }
  }

  private choose(id: string): void {
    if (this.done || !this.started) return;
    this.finish({ option: id, correct: false, ms: this.elapsed() });
  }

  /** Time is up: answers nothing. */
  timeout(): void {
    if (!this.done) this.finish({ correct: false, ms: this.elapsed() });
  }

  private finish(a: PlayerAnswer): void {
    this.done = true;
    this.root.classList.add('answered');
    this.resolveAnswer(a);
  }

  /**
   * Marks the right answer, the player's answer, Jev's (if given) and, in a live match, everyone else's. Call it
   * once the card's solution is known (learn in api.ts).
   */
  reveal(you: PlayerAnswer | null, jev: JevAnswer | null, others: OtherAnswer[] = []): void {
    const c = this.card;
    const svg = this.overlay;
    svg.replaceChildren();
    for (const [id, b] of this.buttons) {
      b.disabled = true;
      b.classList.toggle('right', id === c.answer);
      b.classList.toggle('wrong', id !== c.answer && (you?.option === id || jev?.choice === id));
      const tags: string[] = [];
      if (you?.option === id) tags.push('you');
      if (jev?.choice === id) tags.push('jev');
      b.querySelector('.tags')?.remove();
      const names = others.filter((o) => o.option === id).map((o) => o.name);
      if (tags.length || names.length) {
        b.append(
          el(
            'span',
            { className: 'tags' },
            ...tags.map((t) => el('i', { className: `tag tag-${t}` }, t === 'you' ? 'You' : 'Jev')),
            ...(names.length ? [el('i', { className: 'tag tag-other' }, namesText(names))] : []),
          ),
        );
      }
    }
    if (c.kind === 'buttons') return;
    // The right answer, when it is in the picture.
    const right = c.kind === 'pick' ? c.options!.find((o) => o.id === c.answer)?.region : c.target;
    if (right) svg.append(regionShape(right, 'mark-right'));
    if (c.kind === 'pick') {
      if (jev?.choice && jev.choice !== c.answer) {
        const o = c.options!.find((x) => x.id === jev.choice);
        if (o?.region) svg.append(regionShape(o.region, 'mark-jev-wrong'));
      }
      if (you?.option && you.option !== c.answer) {
        const o = c.options!.find((x) => x.id === you.option);
        if (o?.region) svg.append(regionShape(o.region, 'mark-you-wrong'));
      }
      if (jev?.choice) svg.append(label(c.options!.find((x) => x.id === jev.choice)?.region, 'Jev', 'jev'));
      if (you?.option) svg.append(label(c.options!.find((x) => x.id === you.option)?.region, 'You', 'you'));
      for (const o of c.options!) {
        const names = others.filter((a) => a.option === o.id).map((a) => a.name);
        if (o.region && names.length) svg.append(othersLabel(o.region, namesText(names)));
      }
    } else {
      if (jev?.box) {
        const b = jev.box;
        svg.append(svgEl('rect', { x: b.left, y: b.top * ASPECT, width: b.right - b.left, height: (b.bottom - b.top) * ASPECT, class: 'mark-jev-box' }));
        svg.append(svgEl('circle', { cx: (b.left + b.right) / 2, cy: ((b.top + b.bottom) / 2) * ASPECT, r: 0.012, class: 'dot-jev' }));
      }
      for (const o of others) {
        if (!o.point) continue;
        svg.append(svgEl('circle', { cx: o.point.x, cy: o.point.y * ASPECT, r: 0.01, class: 'dot-other' }));
        const t = svgEl('text', { x: o.point.x, y: o.point.y * ASPECT - 0.018, class: 'dot-name' });
        t.textContent = short(o.name);
        svg.append(t);
      }
      if (you?.point) svg.append(svgEl('circle', { cx: you.point.x, cy: you.point.y * ASPECT, r: 0.014, class: 'dot-you' }));
    }
  }
}

const short = (name: string) => ([...name].length > 8 ? [...name].slice(0, 7).join('') + '…' : name);

/** Up to two names, then how many more: "Ana, Ben +3". */
function namesText(names: string[]): string {
  const shown = names.slice(0, 2).map(short).join(', ');
  return names.length > 2 ? `${shown} +${names.length - 2}` : shown;
}

/** Other players' names along the bottom of a region, on a pill sized to the text. */
function othersLabel(r: Region, text: string): SVGElement {
  const g = svgEl('g', { class: 'label label-other' });
  const xs: number[] = [];
  const ys: number[] = [];
  if (r.type === 'rect') xs.push(r.x, r.x + r.w), ys.push(r.y, r.y + r.h);
  else if (r.type === 'circle') xs.push(r.cx - r.r, r.cx + r.r), ys.push(r.cy - r.r / ASPECT, r.cy + r.r / ASPECT);
  else for (const ring of r.rings) for (const [x, y] of ring) xs.push(x), ys.push(y);
  const w = Math.min(0.4, 0.014 * [...text].length + 0.03);
  const cx = Math.min(1 - w / 2, Math.max(w / 2, (Math.min(...xs) + Math.max(...xs)) / 2));
  const y = Math.min(ASPECT - 0.05, Math.max(...ys) * ASPECT - 0.05);
  g.append(svgEl('rect', { x: cx - w / 2, y, width: w, height: 0.04, rx: 0.02 }));
  const t = svgEl('text', { x: cx, y: y + 0.028 });
  t.textContent = text;
  g.append(t);
  return g;
}

function regionShape(r: Region, cls: string): SVGElement {
  if (r.type === 'rect') return svgEl('rect', { x: r.x, y: r.y * ASPECT, width: r.w, height: r.h * ASPECT, rx: 0.01, class: cls });
  if (r.type === 'circle') return svgEl('circle', { cx: r.cx, cy: r.cy * ASPECT, r: r.r, class: cls });
  const d = r.rings.map((ring) => 'M' + ring.map(([x, y]) => `${x.toFixed(4)},${(y * ASPECT).toFixed(4)}`).join('L') + 'Z').join('');
  return svgEl('path', { d, 'fill-rule': 'evenodd', class: cls });
}

/** A small name tag at the top of a region. */
function label(r: Region | undefined, text: string, who: 'you' | 'jev'): SVGElement {
  const g = svgEl('g', { class: `label label-${who}` });
  if (!r || r.type !== 'rect') return g;
  const x = r.x + (who === 'you' ? 0.01 : r.w - 0.075);
  const y = r.y * ASPECT + 0.01;
  g.append(svgEl('rect', { x, y, width: 0.065, height: 0.04, rx: 0.02 }));
  const t = svgEl('text', { x: x + 0.0325, y: y + 0.028 });
  t.textContent = text;
  g.append(t);
  return g;
}

function svgEl(tag: string, attrs: Record<string, string | number>): SVGElement {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

function pulse(e: HTMLElement): void {
  e.classList.remove('miss');
  void e.offsetWidth;
  e.classList.add('miss');
}
