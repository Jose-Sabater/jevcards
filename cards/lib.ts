/**
 * The card format. A card is one picture and one question that a person and Jev both answer.
 *
 * Every card is drawn as an SVG of exactly W x H (scripts/build-deck.ts renders it to a PNG), so the
 * picture and the answer come from the same source and cannot drift apart. Regions are fractions of the
 * picture (0..1 from the top left), which is also how Jev's box answers come back.
 *
 * Three kinds:
 *   pick     tap one of the things in the picture (options with regions); options without a region are
 *            buttons under it ("Same size"); Jev answers a `choice`
 *   buttons  pick one of the buttons under the picture (options without regions); Jev answers a `choice`
 *   point    tap a place (a country on a map, a square on a board); Jev answers a `box`, which counts
 *            when its center falls inside the target
 */

export const W = 960;
export const H = 720;

export type Region =
  | { type: 'rect'; x: number; y: number; w: number; h: number }
  | { type: 'circle'; cx: number; cy: number; r: number }
  /** One or more rings, even-odd (holes and islands work). */
  | { type: 'poly'; rings: [number, number][][] };

export interface Option {
  id: string;
  /** What a button says, or what a person would call the thing (shown after answering). */
  label: string;
  /** pick only: where the thing is. A pick option without one is a button under the picture. */
  region?: Region;
  /** How Jev is told about this option. pick: say where it is ("The fruit on the left."), never what it is. */
  jev: string;
}

export interface CardSpec {
  /** kebab-case, unique: the PNG is public/cards/<id>.png */
  id: string;
  title: string;
  /** The theme. Games deal the themes in turn (shared/game.ts deal), so each theme shows up about equally often. */
  category: 'objects' | 'maps' | 'chess' | 'flags' | 'illusions' | 'colors' | 'counting' | 'reading' | 'logic' | 'landmarks' | 'animals' | 'symbols' | 'charts' | 'math' | 'science' | 'nature' | 'food' | 'sports' | 'art' | 'geometry' | 'music';
  /** 1 easy, 2 medium, 3 hard (for a person). */
  difficulty: 1 | 2 | 3;
  /** What the player reads above the card. Short: "Tap the peach." */
  prompt: string;
  kind: 'pick' | 'buttons' | 'point';
  /** The full SVG document, W x H. */
  svg: string;
  options?: Option[];
  /** pick and buttons: the right option's id. */
  answer?: string;
  /** point: where a tap (or the center of Jev's box) counts. */
  target?: Region;
  /** One sentence shown after answering: why the answer is right. */
  explain: string;
  /** Jev's question. Refer to the picture as `card` (in backticks). */
  jev: {
    /** One sentence on what the picture is, without giving the answer away. */
    context: string;
    instructions: string;
  };
  /** Where the picture came from, for the credits. */
  source: 'drawn' | 'generated' | 'mixed';
}

/** What the game loads (public/cards/deck.json): the spec without its SVG. */
export type Card = Omit<CardSpec, 'svg'> & {
  image: string;
  width: number;
  height: number;
  /** The file it came from: "maps", or "season1/sports" for a card in cards/season1/. */
  group?: string;
  /** Cards from cards/season<N>/: that season's batch (season 1 started 2026-10-18). */
  season?: number;
};

export function defineCard(c: CardSpec): CardSpec {
  return c;
}

/** Is the point (fractions) inside the region? */
export function inside(r: Region, x: number, y: number, pad = 0): boolean {
  if (r.type === 'rect') return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
  if (r.type === 'circle') return Math.hypot(x - r.cx, (y - r.cy) * (H / W)) <= r.r + pad;
  let hit = false;
  for (const ring of r.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
  }
  if (hit || pad === 0) return hit;
  // A near miss on a small polygon: count it if any edge is within pad.
  for (const ring of r.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      if (segDist(x, y, ring[j], ring[i]) <= pad) return true;
    }
  }
  return false;
}

function segDist(px: number, py: number, [ax, ay]: [number, number], [bx, by]: [number, number]): number {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** The option a tap (fractions) lands on, for pick cards. */
export function optionAt(card: Pick<Card, 'options'>, x: number, y: number): Option | undefined {
  return card.options?.find((o) => o.region && inside(o.region, x, y));
}

/** Does Jev's box answer count on a point card? Its center must be inside the target. */
export function boxHits(target: Region, box: { top: number; bottom: number; left: number; right: number }): boolean {
  return inside(target, (box.left + box.right) / 2, (box.top + box.bottom) / 2, 0.01);
}

/** The usual SVG wrapper: a W x H document with a background. */
export function svgDoc(body: string, background = '#FFFFFF'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${background}"/>${body}</svg>`;
}

/** A rect region from pixel coordinates. */
export const rectPx = (x: number, y: number, w: number, h: number): Region => ({ type: 'rect', x: x / W, y: y / H, w: w / W, h: h / H });

/** XML-escape text for SVG. */
export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
