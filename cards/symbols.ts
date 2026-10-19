/**
 * Symbol and script cards: writing systems, road signs (Vienna Convention shapes), GHS hazard pictograms,
 * laundry care symbols (ISO 3758), weather fronts, currency signs, staff notation and Morse code. Everything is
 * drawn in SVG. Scripts and currency signs are text, and only scripts that resvg renders correctly with the macOS
 * system fonts are used (Amharic and the ruble sign, for example, do not render). The clefs come from Apple
 * Symbols, the only system font here that has them.
 */
import { defineCard, rectPx, svgDoc, type Option } from './lib.ts';

const FONT = `font-family="Arial, Helvetica, sans-serif"`;
const BG = '#F7F5EF';

interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  /** Where it is, for Jev: "top left", "middle", ... */
  where: string;
}

/** A grid of cols x rows cells over the picture, with a margin and a gap. */
function grid(cols: number, rows: number, margin = 30, gap = 24): Cell[] {
  const w = (960 - 2 * margin - (cols - 1) * gap) / cols;
  const h = (720 - 2 * margin - (rows - 1) * gap) / rows;
  const colName = cols === 1 ? [''] : cols === 2 ? ['left', 'right'] : cols === 3 ? ['left', 'middle', 'right'] : ['far left', 'second from the left', 'second from the right', 'far right'];
  const rowName = rows === 1 ? [''] : rows === 2 ? ['top', 'bottom'] : rows === 3 ? ['top', 'middle', 'bottom'] : ['top', 'second', 'third', 'bottom'];
  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = margin + c * (w + gap);
      const y = margin + r * (h + gap);
      const where = [rowName[r], colName[c]].filter(Boolean).join(' ');
      cells.push({ x, y, w, h, cx: x + w / 2, cy: y + h / 2, where });
    }
  return cells;
}

interface Item {
  id: string;
  label: string;
  draw: (c: Cell) => string;
}

/** Lays items into cells, each on a white card, and returns the picture and the pick options. */
function board(items: Item[], cells: Cell[], noun: string, panel = '#FFFFFF'): { svg: string; options: Option[] } {
  let body = '';
  const options: Option[] = [];
  items.forEach((it, i) => {
    const c = cells[i];
    body += `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="18" fill="${panel}" stroke="#D9D4C7" stroke-width="2"/>`;
    body += it.draw(c);
    options.push({ id: it.id, label: it.label, region: rectPx(c.x, c.y, c.w, c.h), jev: `The ${noun} in the ${c.where}.` });
  });
  return { svg: svgDoc(body, BG), options };
}

const pickJev = (context: string, question: string) => ({ context, instructions: `${question} Answer with the option for its position in \`card\`.` });

// ---------------------------------------------------------------------------------------------------------------
// Scripts.

const text = (s: string, size = 64, family = 'Arial, Helvetica, sans-serif') => (c: Cell) =>
  `<text x="${c.cx}" y="${c.cy + size * 0.35}" text-anchor="middle" font-family="${family}" font-size="${size}" fill="#1B1B1B">${s}</text>`;

const greekBoard = board(
  [
    { id: 'cyrillic', label: 'Russian (Cyrillic): Привет', draw: text('Привет', 76) },
    { id: 'armenian', label: 'Armenian: Բարեւ', draw: text('Բարեւ', 76) },
    { id: 'greek', label: 'Greek: Γειά σας', draw: text('Γειά σας', 76) },
    { id: 'georgian', label: 'Georgian: გამარჯობა', draw: text('გამარჯობა', 64) },
  ],
  grid(2, 2),
  'word',
);

const georgianBoard = board(
  [
    { id: 'thai', label: 'Thai: สวัสดี', draw: text('สวัสดี', 76) },
    { id: 'georgian', label: 'Georgian: გამარჯობა', draw: text('გამარჯობა', 64) },
    { id: 'tamil', label: 'Tamil: வணக்கம்', draw: text('வணக்கம்', 64) },
    { id: 'armenian', label: 'Armenian: Բարեւ ձեզ', draw: text('Բարեւ ձեզ', 72) },
  ],
  grid(2, 2),
  'word',
);

const koreanBoard = board(
  [
    { id: 'japanese', label: 'Japanese: こんにちは', draw: text('こんにちは', 80) },
    { id: 'chinese', label: 'Chinese: 你好', draw: text('你好', 96) },
    { id: 'korean', label: 'Korean: 안녕하세요', draw: text('안녕하세요', 80) },
  ],
  grid(1, 3),
  'word',
);

// ---------------------------------------------------------------------------------------------------------------
// Road signs, Vienna Convention shapes and colors.

const RED = '#C8102E';
const SIGN_BLUE = '#0050A0';
const SIGN_YELLOW = '#FFC72C';

/** Red disc with a white horizontal bar (C,1 no entry). */
const noEntry = (R: number) => (c: Cell) =>
  `<circle cx="${c.cx}" cy="${c.cy}" r="${R}" fill="#FFFFFF" stroke="#BBBBBB" stroke-width="2"/><circle cx="${c.cx}" cy="${c.cy}" r="${R * 0.96}" fill="${RED}"/>` +
  `<rect x="${c.cx - R * 0.76}" y="${c.cy - R * 0.19}" width="${R * 1.52}" height="${R * 0.38}" fill="#FFFFFF"/>`;
/** White disc with a red rim (C,2 closed to all vehicles). */
const noVehicles = (R: number) => (c: Cell) =>
  `<circle cx="${c.cx}" cy="${c.cy}" r="${R}" fill="${RED}"/><circle cx="${c.cx}" cy="${c.cy}" r="${R * 0.78}" fill="#FFFFFF"/>`;
/** Blue disc, red rim, red bars: one (\) for no parking, two (X) for no stopping. */
const blueRestriction = (R: number, cross: boolean) => (c: Cell) => {
  const d = R * 0.78 * Math.SQRT1_2;
  const clip = `nb-${Math.round(c.cx)}-${Math.round(c.cy)}`;
  const bar = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${RED}" stroke-width="${R * 0.17}"/>`;
  return (
    `<defs><clipPath id="${clip}"><circle cx="${c.cx}" cy="${c.cy}" r="${R * 0.8}"/></clipPath></defs>` +
    `<circle cx="${c.cx}" cy="${c.cy}" r="${R}" fill="${RED}"/><circle cx="${c.cx}" cy="${c.cy}" r="${R * 0.78}" fill="${SIGN_BLUE}"/>` +
    `<g clip-path="url(#${clip})">${bar(c.cx - d * 1.2, c.cy - d * 1.2, c.cx + d * 1.2, c.cy + d * 1.2)}${cross ? bar(c.cx + d * 1.2, c.cy - d * 1.2, c.cx - d * 1.2, c.cy + d * 1.2) : ''}</g>`
  );
};
/** Equilateral triangle with a red border, point down (give way) or up (danger warning). */
const triangle = (R: number, down: boolean, inner = '') => (c: Cell) => {
  const pts = (r: number) =>
    [0, 120, 240]
      .map((a) => {
        const t = ((a + (down ? 180 : 0)) * Math.PI) / 180;
        return `${(c.cx + r * Math.sin(t)).toFixed(1)},${(c.cy + (down ? -0.15 : 0.15) * R - r * Math.cos(t)).toFixed(1)}`;
      })
      .join(' ');
  return `<polygon points="${pts(R)}" fill="${RED}" stroke="${RED}" stroke-width="14" stroke-linejoin="round"/><polygon points="${pts(R * 0.62)}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="8" stroke-linejoin="round"/>${inner}`;
};
const exclaim = (c: Cell, R: number) =>
  `<rect x="${c.cx - 9}" y="${c.cy - R * 0.22}" width="18" height="${R * 0.42}" rx="6" fill="#111"/><circle cx="${c.cx}" cy="${c.cy + R * 0.35}" r="10" fill="#111"/>`;
/** Red octagon with STOP. */
const stop = (R: number) => (c: Cell) => {
  const pts = (r: number) =>
    Array.from({ length: 8 }, (_, i) => {
      const t = ((22.5 + i * 45) * Math.PI) / 180;
      return `${(c.cx + r * Math.cos(t)).toFixed(1)},${(c.cy + r * Math.sin(t)).toFixed(1)}`;
    }).join(' ');
  return `<polygon points="${pts(R)}" fill="#FFFFFF" stroke="#BBBBBB" stroke-width="2"/><polygon points="${pts(R * 0.94)}" fill="${RED}"/><text x="${c.cx}" y="${c.cy + R * 0.2}" text-anchor="middle" ${FONT} font-weight="bold" font-size="${R * 0.55}" fill="#FFFFFF">STOP</text>`;
};
/** Yellow square on its corner with a white border (priority road); optional black stripes for its end. */
const priority = (R: number, ended: boolean) => (c: Cell) => {
  const dia = (r: number) => `${c.cx},${c.cy - r} ${c.cx + r},${c.cy} ${c.cx},${c.cy + r} ${c.cx - r},${c.cy}`;
  const clip = `pr-${Math.round(c.cx)}-${Math.round(c.cy)}`;
  return (
    `<polygon points="${dia(R)}" fill="#FFFFFF" stroke="#888" stroke-width="3" stroke-linejoin="round"/><polygon points="${dia(R * 0.7)}" fill="${SIGN_YELLOW}" stroke="#333" stroke-width="2"/>` +
    (ended ? `<defs><clipPath id="${clip}"><polygon points="${dia(R * 0.7)}"/></clipPath></defs><g clip-path="url(#${clip})">${endStripes(c.cx, c.cy, R)}</g>` : '')
  );
};
/** The "end of" band: five thin black lines from the upper right to the lower left. */
const endStripes = (cx: number, cy: number, R: number) =>
  [-2, -1, 0, 1, 2]
    .map((k) => {
      const o = k * R * 0.075; // offset perpendicular to the band
      const ox = o * Math.SQRT1_2, oy = o * Math.SQRT1_2;
      return `<line x1="${cx + R + ox}" y1="${cy - R + oy}" x2="${cx - R + ox}" y2="${cy + R + oy}" stroke="#222" stroke-width="${R * 0.035}"/>`;
    })
    .join('');
/** White disc with a thin dark rim and the end band; optionally the grey speed number that has ended. */
const endOf = (R: number, number?: string) => (c: Cell) => {
  const clip = `eo-${Math.round(c.cx)}-${Math.round(c.cy)}`;
  return (
    `<defs><clipPath id="${clip}"><circle cx="${c.cx}" cy="${c.cy}" r="${R * 0.95}"/></clipPath></defs>` +
    `<circle cx="${c.cx}" cy="${c.cy}" r="${R}" fill="#FFFFFF" stroke="#222" stroke-width="3"/>` +
    (number ? `<text x="${c.cx}" y="${c.cy + R * 0.3}" text-anchor="middle" ${FONT} font-weight="bold" font-size="${R * 0.9}" fill="#8A8A8A">${number}</text>` : '') +
    `<g clip-path="url(#${clip})">${endStripes(c.cx, c.cy, R)}</g>`
  );
};

const noEntryBoard = board(
  [
    { id: 'no-vehicles', label: 'No vehicles', draw: noVehicles(115) },
    { id: 'no-entry', label: 'No entry', draw: noEntry(115) },
    { id: 'no-parking', label: 'No parking', draw: blueRestriction(115, false) },
    { id: 'no-stopping', label: 'No stopping', draw: blueRestriction(115, true) },
  ],
  grid(2, 2),
  'sign',
);

const giveWayBoard = board(
  [
    { id: 'warning', label: 'Other danger (warning)', draw: (c) => triangle(120, false)(c) + exclaim(c, 120) },
    { id: 'priority', label: 'Priority road', draw: priority(125, false) },
    { id: 'stop', label: 'Stop', draw: stop(115) },
    { id: 'give-way', label: 'Give way', draw: triangle(120, true) },
  ],
  grid(2, 2),
  'sign',
);

const endBoard = board(
  [
    { id: 'end-speed', label: 'End of the 50 speed limit', draw: endOf(115, '50') },
    { id: 'no-parking', label: 'No parking', draw: blueRestriction(115, false) },
    { id: 'end-priority', label: 'End of priority road', draw: priority(125, true) },
    { id: 'end-all', label: 'End of all restrictions', draw: endOf(115) },
  ],
  grid(2, 2),
  'sign',
);

// ---------------------------------------------------------------------------------------------------------------
// GHS hazard pictograms: a red-bordered square on its corner, black symbol on white.

const ghsFrame = (c: Cell, R: number, inner: string) => {
  const dia = (r: number) => `${c.cx},${c.cy - r} ${c.cx + r},${c.cy} ${c.cx},${c.cy + r} ${c.cx - r},${c.cy}`;
  return `<polygon points="${dia(R)}" fill="#FFFFFF" stroke="${RED}" stroke-width="${R * 0.1}" stroke-linejoin="miter"/>${inner}`;
};
/** A flame about 1 unit tall, base at (0,0), drawn in a box scaled by s. */
const flamePath = (x: number, y: number, s: number) =>
  `<path transform="translate(${x},${y}) scale(${s})" fill="#111" d="M0,0 C-0.42,0 -0.5,-0.32 -0.36,-0.55 C-0.3,-0.4 -0.22,-0.36 -0.2,-0.42 C-0.26,-0.65 -0.08,-0.85 0.02,-1 C0.02,-0.82 0.14,-0.7 0.22,-0.62 C0.24,-0.7 0.24,-0.76 0.2,-0.82 C0.44,-0.66 0.5,-0.3 0.36,-0.12 C0.28,-0.02 0.16,0 0,0 Z M-0.02,-0.06 C0.16,-0.06 0.22,-0.2 0.14,-0.34 C0.1,-0.26 0.04,-0.24 0.02,-0.3 C0.02,-0.4 -0.08,-0.46 -0.08,-0.52 C-0.2,-0.4 -0.2,-0.08 -0.02,-0.06 Z" fill-rule="evenodd"/>`;
const ghsFlame = (c: Cell) => ghsFrame(c, 135, flamePath(c.cx, c.cy + 50, 110) + `<rect x="${c.cx - 55}" y="${c.cy + 58}" width="110" height="10" fill="#111"/>`);
const ghsFlameOverCircle = (c: Cell) =>
  ghsFrame(
    c,
    135,
    flamePath(c.cx, c.cy + 12, 85) +
      `<circle cx="${c.cx}" cy="${c.cy + 32}" r="26" fill="none" stroke="#111" stroke-width="12"/>` +
      `<rect x="${c.cx - 55}" y="${c.cy + 66}" width="110" height="10" fill="#111"/>`,
  );
const ghsExclaim = (c: Cell) =>
  ghsFrame(c, 135, `<path d="M${c.cx - 15},${c.cy - 70} h30 l-6,95 h-18 z" fill="#111"/><circle cx="${c.cx}" cy="${c.cy + 50}" r="15" fill="#111"/>`);
const ghsSkull = (c: Cell) => {
  const { cx, cy } = c;
  const bone = (a: number) =>
    `<g transform="rotate(${a} ${cx} ${cy + 30})"><rect x="${cx - 62}" y="${cy + 25}" width="124" height="11" rx="5" fill="#111"/>` +
    `<circle cx="${cx - 64}" cy="${cy + 24}" r="9" fill="#111"/><circle cx="${cx - 64}" cy="${cy + 38}" r="9" fill="#111"/>` +
    `<circle cx="${cx + 64}" cy="${cy + 24}" r="9" fill="#111"/><circle cx="${cx + 64}" cy="${cy + 38}" r="9" fill="#111"/></g>`;
  return ghsFrame(
    c,
    135,
    bone(28) +
      bone(-28) +
      `<path d="M${cx - 38},${cy - 30} C${cx - 40},${cy - 80} ${cx + 40},${cy - 80} ${cx + 38},${cy - 30} C${cx + 38},${cy - 10} ${cx + 28},${cy - 6} ${cx + 26},${cy + 4} L${cx + 26},${cy + 16} L${cx - 26},${cy + 16} L${cx - 26},${cy + 4} C${cx - 28},${cy - 6} ${cx - 38},${cy - 10} ${cx - 38},${cy - 30} Z" fill="#111"/>` +
      `<ellipse cx="${cx - 16}" cy="${cy - 32}" rx="11" ry="12" fill="#FFFFFF"/><ellipse cx="${cx + 16}" cy="${cy - 32}" rx="11" ry="12" fill="#FFFFFF"/>` +
      `<path d="M${cx},${cy - 18} l-6,12 h12 z" fill="#FFFFFF"/>` +
      `<path d="M${cx - 14},${cy + 4} v12 M${cx - 5},${cy + 4} v12 M${cx + 5},${cy + 4} v12 M${cx + 14},${cy + 4} v12" stroke="#FFFFFF" stroke-width="3"/>`,
  );
};

const ghsBoard = board(
  [
    { id: 'oxidizer', label: 'Flame over circle (oxidizer)', draw: ghsFlameOverCircle },
    { id: 'toxic', label: 'Skull and crossbones (acute toxicity)', draw: ghsSkull },
    { id: 'irritant', label: 'Exclamation mark (irritant, harmful)', draw: ghsExclaim },
    { id: 'flammable', label: 'Flame (flammable)', draw: ghsFlame },
  ],
  grid(2, 2),
  'symbol',
);

// ---------------------------------------------------------------------------------------------------------------
// Laundry care symbols (ISO 3758), black lines.

const ls = (w = 9) => `fill="none" stroke="#111" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const LS = ls();
const cross = (c: Cell, r: number) => `<path d="M${c.cx - r},${c.cy - r} L${c.cx + r},${c.cy + r} M${c.cx + r},${c.cy - r} L${c.cx - r},${c.cy + r}" ${LS}/>`;
const tumble = (crossed: boolean) => (c: Cell) =>
  `<rect x="${c.cx - 85}" y="${c.cy - 85}" width="170" height="170" ${LS}/><circle cx="${c.cx}" cy="${c.cy}" r="68" ${LS}/>` + (crossed ? cross(c, 105) : '');
const dryClean = (crossed: boolean) => (c: Cell) => `<circle cx="${c.cx}" cy="${c.cy}" r="80" ${LS}/>` + (crossed ? cross(c, 95) : '');
const tub = (crossed: boolean) => (c: Cell) => {
  const { cx, cy } = c;
  return (
    `<path d="M${cx - 100},${cy - 50} L${cx - 78},${cy + 65} L${cx + 78},${cy + 65} L${cx + 100},${cy - 50}" ${LS}/>` +
    `<path d="M${cx - 84},${cy - 18} q12,-18 24,0 t24,0 t24,0 t24,0 t24,0 t24,0 t24,0" ${ls(7)}/>` +
    (crossed ? cross(c, 105) : '')
  );
};
/** The iron: flat soleplate, square back, curved front to a point on the left, a handle on top. */
const iron = (dots: number) => (c: Cell) => {
  const { cx, cy } = c;
  const body = `<path d="M${cx + 120},${cy + 70} L${cx - 140},${cy + 70} C${cx - 110},${cy - 10} ${cx - 60},${cy - 30} ${cx + 10},${cy - 30} L${cx + 120},${cy - 30} Z" ${ls(12)}/>`;
  const handle = `<path d="M${cx - 40},${cy - 30} C${cx - 40},${cy - 90} ${cx - 10},${cy - 100} ${cx + 30},${cy - 100} L${cx + 120},${cy - 100} L${cx + 120},${cy - 30}" ${ls(12)}/>`;
  const xs = dots === 1 ? [10] : dots === 2 ? [-20, 40] : [-40, 15, 70];
  return body + handle + xs.map((x) => `<circle cx="${cx + x}" cy="${cy + 25}" r="12" fill="#111"/>`).join('');
};

const laundryBoard = board(
  [
    { id: 'tumble-ok', label: 'Tumble dry allowed', draw: tumble(false) },
    { id: 'no-dry-clean', label: 'Do not dry clean', draw: dryClean(true) },
    { id: 'no-wash', label: 'Do not wash', draw: tub(true) },
    { id: 'no-tumble', label: 'Do not tumble dry', draw: tumble(true) },
  ],
  grid(2, 2),
  'symbol',
);

const ironSvg = svgDoc(
  `<rect x="230" y="110" width="500" height="500" rx="24" fill="#FFFFFF" stroke="#D9D4C7" stroke-width="2"/>` +
    iron(3)({ x: 230, y: 110, w: 500, h: 500, cx: 480, cy: 380, where: '' }),
  BG,
);

// ---------------------------------------------------------------------------------------------------------------
// Weather fronts, drawn in black as on a printed chart: barbs on the side the front is moving toward.

const front = (y: number, kinds: ('tri' | 'semi')[]) => {
  const x0 = 110, x1 = 850, n = kinds.length;
  const step = (x1 - x0) / n;
  let s = `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#111" stroke-width="7"/>`;
  kinds.forEach((k, i) => {
    const mx = x0 + step * (i + 0.5);
    s +=
      k === 'tri'
        ? `<polygon points="${mx - 24},${y} ${mx + 24},${y} ${mx},${y - 40}" fill="#111"/>`
        : `<path d="M${mx - 24},${y} A24,24 0 0 1 ${mx + 24},${y} Z" fill="#111"/>`;
  });
  return s;
};
const frontsSvg = (() => {
  const rows: [string, string, ('tri' | 'semi')[]][] = [
    ['occluded', 'Occluded front', ['tri', 'semi', 'tri', 'semi', 'tri', 'semi']],
    ['cold', 'Cold front', ['tri', 'tri', 'tri', 'tri', 'tri', 'tri']],
    ['warm', 'Warm front', ['semi', 'semi', 'semi', 'semi', 'semi', 'semi']],
  ];
  let body = '';
  const options: Option[] = [];
  const where = ['top', 'middle', 'bottom'];
  rows.forEach(([id, label, kinds], i) => {
    const y = 150 + i * 220;
    body += `<rect x="40" y="${y - 110}" width="880" height="190" rx="18" fill="#FFFFFF" stroke="#D9D4C7" stroke-width="2"/>` + front(y + 20, kinds);
    options.push({ id, label, region: rectPx(40, y - 110, 880, 190), jev: `The line in the ${where[i]} panel.` });
  });
  return { svg: svgDoc(body, BG), options };
})();

// ---------------------------------------------------------------------------------------------------------------
// Currency signs.

const currencyBoard = board(
  [
    { id: 'lira', label: 'Turkish lira ₺', draw: text('₺', 170) },
    { id: 'hryvnia', label: 'Ukrainian hryvnia ₴', draw: text('₴', 170) },
    { id: 'rupee', label: 'Indian rupee ₹', draw: text('₹', 170) },
    { id: 'peso', label: 'Philippine peso ₱', draw: text('₱', 170) },
    { id: 'naira', label: 'Nigerian naira ₦', draw: text('₦', 170) },
    { id: 'won', label: 'Korean won ₩', draw: text('₩', 170) },
  ],
  grid(3, 2),
  'sign',
);

// ---------------------------------------------------------------------------------------------------------------
// Staff notation. Staff lines 28 px apart; step = half a space. Position 0 is the bottom line.

const GAP = 28;
const staff = (x0: number, x1: number, bottom: number) =>
  [0, 1, 2, 3, 4].map((i) => `<line x1="${x0}" y1="${bottom - i * GAP}" x2="${x1}" y2="${bottom - i * GAP}" stroke="#111" stroke-width="3"/>`).join('');
/** Treble clef glyph from Apple Symbols, sized so its curl wraps the G line (second line up). */
const trebleClef = (x: number, bottom: number) => `<text x="${x}" y="${bottom + 44}" font-family="Apple Symbols" font-size="250" fill="#111">𝄞</text>`;
/** Bass clef glyph, with its dots around the F line (fourth line up). */
const bassClef = (x: number, bottom: number) => `<text x="${x}" y="${bottom - 22}" font-family="Apple Symbols" font-size="130" fill="#111">𝄢</text>`;
/** A quarter note at staff position pos (0 = bottom line, 1 = first space, ...). Stem up below the middle line. */
const note = (x: number, bottom: number, pos: number) => {
  const y = bottom - (pos * GAP) / 2;
  const up = pos < 4;
  const stem = up ? `<line x1="${x + 16}" y1="${y - 4}" x2="${x + 16}" y2="${y - 98}" stroke="#111" stroke-width="4"/>` : `<line x1="${x - 16}" y1="${y + 4}" x2="${x - 16}" y2="${y + 98}" stroke="#111" stroke-width="4"/>`;
  return `<ellipse cx="${x}" cy="${y}" rx="18" ry="13" transform="rotate(-22 ${x} ${y})" fill="#111"/>${stem}`;
};

const noteCSvg = (() => {
  const bottom = 440;
  // G4 (second line), C5 (third space), A4 (second space), E5 (fourth space).
  const notes: [string, string, number, number][] = [
    ['g', 'G', 2, 330],
    ['c', 'C', 5, 490],
    ['a', 'A', 3, 650],
    ['e', 'E', 7, 810],
  ];
  let body = `<rect x="30" y="150" width="900" height="420" rx="18" fill="#FFFFFF" stroke="#D9D4C7" stroke-width="2"/>` + staff(60, 900, bottom) + trebleClef(70, bottom);
  const options: Option[] = [];
  const where = ['first', 'second', 'third', 'fourth'];
  notes.forEach(([id, label, pos, x], i) => {
    body += note(x, bottom, pos);
    options.push({ id, label, region: rectPx(x - 70, 170, 140, 380), jev: `The ${where[i]} note from the left.` });
  });
  return { svg: svgDoc(body, BG), options };
})();

const pitchSvg = (() => {
  const bottomL = 470, bottomR = 470;
  let body =
    `<rect x="30" y="150" width="438" height="440" rx="18" fill="#FFFFFF" stroke="#D9D4C7" stroke-width="2"/>` +
    `<rect x="492" y="150" width="438" height="440" rx="18" fill="#FFFFFF" stroke="#D9D4C7" stroke-width="2"/>` +
    staff(55, 445, bottomL) +
    trebleClef(62, bottomL) +
    note(320, bottomL, 0) + // E4 on the bottom line of the treble staff
    staff(517, 905, bottomR) +
    bassClef(525, bottomR) +
    note(790, bottomR, 8); // A3 on the top line of the bass staff
  return {
    svg: svgDoc(body, BG),
    options: [
      { id: 'left', label: 'Left: E above middle C', region: rectPx(30, 150, 438, 440), jev: 'The note on the left staff.' },
      { id: 'right', label: 'Right: A below middle C', region: rectPx(492, 150, 438, 440), jev: 'The note on the right staff.' },
      { id: 'same', label: 'Same pitch', jev: 'They are the same pitch.' },
    ] as Option[],
  };
})();

// ---------------------------------------------------------------------------------------------------------------
// Morse code: dot = 1 unit, dash = 3, gap inside a letter = 1, gap between letters = 3 (drawn wider to read).

const morseRow = (y: number, letters: string[]) => {
  const U = 22;
  const width = letters.reduce((s, l) => s + [...l].reduce((a, ch) => a + (ch === '.' ? 1 : 3) + 1, -1), 0) * U + (letters.length - 1) * 4 * U;
  let x = 480 - width / 2;
  let s = '';
  letters.forEach((l, li) => {
    [...l].forEach((ch, i) => {
      if (i) x += U;
      if (ch === '.') s += `<circle cx="${x + U / 2}" cy="${y}" r="${U / 2}" fill="#111"/>`;
      else s += `<rect x="${x}" y="${y - U / 2}" width="${3 * U}" height="${U}" rx="${U / 2}" fill="#111"/>`;
      x += ch === '.' ? U : 3 * U;
    });
    if (li < letters.length - 1) x += 4 * U;
  });
  return s;
};
const morseSvg = (() => {
  const rows: [string, string, string[]][] = [
    ['oso', 'O S O', ['---', '...', '---']],
    ['sms', 'S M S', ['...', '--', '...']],
    ['sos', 'S O S', ['...', '---', '...']],
    ['sts', 'S T S', ['...', '-', '...']],
  ];
  let body = '';
  const options: Option[] = [];
  const where = ['top', 'second', 'third', 'bottom'];
  rows.forEach(([id, label, letters], i) => {
    const y = 105 + i * 170;
    body += `<rect x="40" y="${y - 70}" width="880" height="140" rx="18" fill="#FFFFFF" stroke="#D9D4C7" stroke-width="2"/>` + morseRow(y, letters);
    options.push({ id, label, region: rectPx(40, y - 70, 880, 140), jev: `The ${where[i]} row.` });
  });
  return { svg: svgDoc(body, BG), options };
})();

// ---------------------------------------------------------------------------------------------------------------

export default [
  defineCard({
    id: 'script-greek',
    title: 'Greek letters',
    category: 'symbols',
    difficulty: 2,
    prompt: 'Tap the Greek text.',
    kind: 'pick',
    svg: greekBoard.svg,
    options: greekBoard.options,
    answer: 'greek',
    explain: 'Γειά σας is Greek (hello); letters like γ, ά and the final ς are Greek only. Привет is Russian in Cyrillic, which borrowed many shapes from Greek.',
    jev: pickJev('Four greetings, each in a different writing system, in two rows.', 'Which word is written in the Greek alphabet?'),
    source: 'drawn',
  }),
  defineCard({
    id: 'script-georgian',
    title: 'Curly scripts',
    category: 'symbols',
    difficulty: 3,
    prompt: 'Tap the Georgian text.',
    kind: 'pick',
    svg: georgianBoard.svg,
    options: georgianBoard.options,
    answer: 'georgian',
    explain: 'გამარჯობა (gamarjoba, hello) is in the Georgian Mkhedruli script. Its neighbor Armenian looks similar but is a separate alphabet (Բարեւ ձեզ); the other two are Thai and Tamil.',
    jev: pickJev('Four greetings, each in a different writing system, in two rows.', 'Which word is written in the Georgian script?'),
    source: 'drawn',
  }),
  defineCard({
    id: 'script-korean',
    title: 'East Asian scripts',
    category: 'symbols',
    difficulty: 2,
    prompt: 'Tap the Korean text.',
    kind: 'pick',
    svg: koreanBoard.svg,
    options: koreanBoard.options,
    answer: 'korean',
    explain: '안녕하세요 is Korean Hangul: letters built from circles and straight strokes, grouped into square syllable blocks. こんにちは is Japanese hiragana and 你好 is Chinese.',
    jev: pickJev('Three greetings in East Asian writing systems, one above the other.', 'Which word is written in Korean?'),
    source: 'drawn',
  }),
  defineCard({
    id: 'sign-no-entry',
    title: 'No entry',
    category: 'symbols',
    difficulty: 2,
    prompt: 'Tap the no entry sign.',
    kind: 'pick',
    svg: noEntryBoard.svg,
    options: noEntryBoard.options,
    answer: 'no-entry',
    explain: 'No entry is a red disc with a white horizontal bar. The white disc with a red rim closes the road to all vehicles; the blue ones ban parking (one bar) and stopping (a cross).',
    jev: pickJev('Four round European road signs in two rows.', 'Which sign means no entry?'),
    source: 'drawn',
  }),
  defineCard({
    id: 'sign-give-way',
    title: 'Give way',
    category: 'symbols',
    difficulty: 1,
    prompt: 'Tap the give way sign.',
    kind: 'pick',
    svg: giveWayBoard.svg,
    options: giveWayBoard.options,
    answer: 'give-way',
    explain: 'Give way (yield) is the triangle standing on its point. A triangle pointing up warns of a danger, the octagon is stop and the yellow diamond marks a priority road.',
    jev: pickJev('Four European road signs in two rows.', 'Which sign means give way?'),
    source: 'drawn',
  }),
  defineCard({
    id: 'sign-end-restrictions',
    title: 'The end of it',
    category: 'symbols',
    difficulty: 3,
    prompt: 'Which sign means end of all restrictions?',
    kind: 'pick',
    svg: endBoard.svg,
    options: endBoard.options,
    answer: 'end-all',
    explain: 'A plain white disc crossed by a band of thin black lines ends every restriction. With a grey number it ends only that speed limit; the striped diamond ends a priority road.',
    jev: pickJev('Four European road signs in two rows.', 'Which sign means end of all restrictions?'),
    source: 'drawn',
  }),
  defineCard({
    id: 'ghs-flammable',
    title: 'Hazard diamonds',
    category: 'symbols',
    difficulty: 2,
    prompt: 'Tap the flammable symbol.',
    kind: 'pick',
    svg: ghsBoard.svg,
    options: ghsBoard.options,
    answer: 'flammable',
    explain: 'The plain flame means flammable. The flame over a circle looks alike but means oxidizer, a substance that makes other things burn more fiercely.',
    jev: pickJev('Four chemical hazard pictograms (red-bordered diamonds) in two rows.', 'Which pictogram means flammable?'),
    source: 'drawn',
  }),
  defineCard({
    id: 'laundry-no-tumble-dry',
    title: 'Care label',
    category: 'symbols',
    difficulty: 2,
    prompt: 'Tap the do not tumble dry symbol.',
    kind: 'pick',
    svg: laundryBoard.svg,
    options: laundryBoard.options,
    answer: 'no-tumble',
    explain: 'A circle inside a square is the tumble dryer; crossed out, it means do not tumble dry. A crossed circle alone means do not dry clean, and the crossed tub means do not wash.',
    jev: pickJev('Four laundry care symbols in two rows.', 'Which symbol means do not tumble dry?'),
    source: 'drawn',
  }),
  defineCard({
    id: 'laundry-iron-dots',
    title: 'Three dots',
    category: 'symbols',
    difficulty: 2,
    prompt: 'What does this care symbol mean?',
    kind: 'buttons',
    svg: ironSvg,
    options: [
      { id: 'low', label: 'Iron on low heat', jev: 'Iron on low heat.' },
      { id: 'medium', label: 'Iron on medium heat', jev: 'Iron on medium heat.' },
      { id: 'high', label: 'Iron on high heat', jev: 'Iron on high heat.' },
      { id: 'steam', label: 'Do not use steam', jev: 'Do not use steam.' },
    ],
    answer: 'high',
    explain: 'The dots in the iron give the heat: one dot is low (about 110 °C), two medium (150 °C) and three high (200 °C, for cotton and linen).',
    jev: { context: 'A single laundry care symbol.', instructions: 'What does the care symbol in `card` mean?' },
    source: 'drawn',
  }),
  defineCard({
    id: 'weather-warm-front',
    title: 'Fronts',
    category: 'symbols',
    difficulty: 2,
    prompt: 'Tap the warm front.',
    kind: 'pick',
    svg: frontsSvg.svg,
    options: frontsSvg.options,
    answer: 'warm',
    explain: 'On a weather chart a warm front carries semicircles and a cold front carries triangles; an occluded front alternates the two on the same side.',
    jev: pickJev('Three weather-map front lines drawn in black, one per panel.', 'Which line is the warm front?'),
    source: 'drawn',
  }),
  defineCard({
    id: 'currency-rupee',
    title: 'Money signs',
    category: 'symbols',
    difficulty: 2,
    prompt: 'Tap the Indian rupee sign.',
    kind: 'pick',
    svg: currencyBoard.svg,
    options: currencyBoard.options,
    answer: 'rupee',
    explain: 'The rupee sign ₹ (adopted in 2010) joins the Devanagari ra and a Latin R with two lines across. ₺ is the Turkish lira, ₴ the hryvnia, ₱ the peso, ₦ the naira and ₩ the won.',
    jev: pickJev('Six currency signs in two rows of three.', 'Which is the Indian rupee sign?'),
    source: 'drawn',
  }),
  defineCard({
    id: 'music-find-c',
    title: 'Read the staff',
    category: 'symbols',
    difficulty: 3,
    prompt: 'Tap the C.',
    kind: 'pick',
    svg: noteCSvg.svg,
    options: noteCSvg.options,
    answer: 'c',
    explain: 'In the treble clef the spaces from the bottom spell F A C E, so the third space is C. The others are G (second line), A (second space) and E (top space).',
    jev: pickJev('A treble clef staff with four notes.', 'Which note is a C?'),
    source: 'drawn',
  }),
  defineCard({
    id: 'music-higher-note',
    title: 'Mind the clef',
    category: 'symbols',
    difficulty: 3,
    prompt: 'Which note sounds higher?',
    kind: 'pick',
    svg: pitchSvg.svg,
    options: pitchSvg.options,
    answer: 'left',
    explain: 'The left note is on the bottom line of a treble staff, the E above middle C. The right note sits higher on the page but on the top line of a bass staff: the A below middle C.',
    jev: pickJev('Two short staves side by side, each with one note.', 'Which note sounds higher in pitch, or are they the same?'),
    source: 'drawn',
  }),
  defineCard({
    id: 'morse-sos',
    title: 'Dots and dashes',
    category: 'symbols',
    difficulty: 2,
    prompt: 'Tap SOS in Morse code.',
    kind: 'pick',
    svg: morseSvg.svg,
    options: morseSvg.options,
    answer: 'sos',
    explain: 'S is three dots and O is three dashes, so SOS is dot dot dot, dash dash dash, dot dot dot.',
    jev: pickJev('Four rows of Morse code dots and dashes.', 'Which row spells SOS in Morse code?'),
    source: 'drawn',
  }),
];
