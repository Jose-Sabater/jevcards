/**
 * Quick visual math: fractions, sums, coins, tallies, angles, symmetry, a number line, areas, patterns and
 * clock arithmetic. Everything is drawn from fixed coordinates and every answer is computed from the same data
 * that draws the picture, so the answer cannot drift from what is shown.
 */
import { defineCard, rectPx, svgDoc, W, type CardSpec, type Option } from './lib.ts';

const FONT = `font-family="Arial, Helvetica, sans-serif"`;
const INK = '#2B2D42';
const rad = (deg: number) => (deg * Math.PI) / 180;
const f1 = (n: number) => n.toFixed(1);
const pts = (p: [number, number][]) => p.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');
const text = (x: number, y: number, s: string | number, size = 44, fill = INK, extra = '') =>
  `<text x="${f1(x)}" y="${f1(y)}" text-anchor="middle" ${FONT} font-weight="bold" font-size="${size}" fill="${fill}" ${extra}>${s}</text>`;
const ROW3 = ['left', 'middle', 'right'];
const ROW4 = ['far left', 'second from the left', 'second from the right', 'far right'];
const GRID4 = ['top left', 'top right', 'bottom left', 'bottom right'];

/** The only option index whose score is the maximum, or throw. */
function uniqueMax(scores: number[]): number {
  const best = Math.max(...scores);
  if (scores.filter((s) => Math.abs(s - best) < 1e-9).length !== 1) throw new Error('the maximum must be unique');
  return scores.indexOf(best);
}

/** Buttons from numbers; the answer must be among them exactly once. */
function numButtons(prefix: string, values: (number | string)[], answer: number | string, fmt = (v: number | string) => String(v)): { options: Option[]; answer: string } {
  if (values.filter((v) => v === answer).length !== 1) throw new Error(`${prefix}: answer must be one option`);
  const id = (v: number | string) => `${prefix}${String(v).replace(/[^a-z0-9]/gi, '')}`;
  return { options: values.map((v) => ({ id: id(v), label: fmt(v), jev: `${fmt(v)}.` })), answer: id(answer) };
}

/** Lines of mirror symmetry of a polygon (its vertex set), tested every quarter degree through its centroid. */
function symmetryLines(poly: [number, number][]): number {
  const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
  let n = 0;
  for (let q = 0; q < 720; q++) {
    const t = rad(q / 4), ux = Math.cos(t), uy = Math.sin(t);
    const ok = poly.every(([x, y]) => {
      const dx = x - cx, dy = y - cy, d = dx * ux + dy * uy;
      const rx = cx + 2 * d * ux - dx, ry = cy + 2 * d * uy - dy;
      return poly.some(([px, py]) => Math.hypot(px - rx, py - ry) < 0.5);
    });
    if (ok) n++;
  }
  return n;
}

// 1. Which fraction is biggest: three labeled pies.
const fractionPies = (() => {
  const fr: [number, number][] = [[5, 8], [2, 3], [3, 5]];
  const r = 130, cy = 300;
  let body = '';
  const options: Option[] = fr.map(([a, b], i) => {
    const cx = 170 + i * 310;
    body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF"/>`;
    const end = rad((360 * a) / b);
    const large = a / b > 0.5 ? 1 : 0;
    body += `<path d="M${cx},${cy} L${cx},${cy - r} A${r},${r} 0 ${large} 1 ${f1(cx + r * Math.sin(end))},${f1(cy - r * Math.cos(end))} Z" fill="#E76F51"/>`;
    for (let k = 0; k < b; k++) {
      const t = rad((360 * k) / b);
      body += `<line x1="${cx}" y1="${cy}" x2="${f1(cx + r * Math.sin(t))}" y2="${f1(cy - r * Math.cos(t))}" stroke="${INK}" stroke-width="4"/>`;
    }
    body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INK}" stroke-width="6"/>`;
    body += text(cx - 2, 540, a, 60) + `<line x1="${cx - 34}" y1="560" x2="${cx + 34}" y2="560" stroke="${INK}" stroke-width="6"/>` + text(cx - 2, 622, b, 60);
    return { id: `f${a}${b}`, label: `${a}/${b}`, region: rectPx(cx - 150, 150, 300, 500), jev: `The pie on the ${ROW3[i]}.` };
  });
  const vals = fr.map(([a, b]) => a / b);
  const best = uniqueMax(vals);
  return defineCard({
    id: 'math-fraction-pies',
    title: 'Biggest slice',
    category: 'math',
    difficulty: 2,
    prompt: 'Tap the biggest fraction.',
    kind: 'pick',
    svg: svgDoc(body, '#F4F1EA'),
    options,
    answer: options[best].id,
    explain: `As decimals: ${fr.map(([a, b]) => `${a}/${b} = ${(a / b).toFixed(3)}`).join(', ')}, so ${fr[best].join('/')} is the biggest.`,
    jev: {
      context: 'Three pie charts, each shaded to show the fraction written under it.',
      instructions: 'In `card`, which of the three fractions is the largest?',
    },
    source: 'drawn',
  });
})();

// 2. Tap the wrong product: 7 x 6 = 48 hides among true facts that also land on 48 and 54.
const wrongProduct = (() => {
  const eqs: [number, number, number][] = [[8, 7, 56], [6, 9, 54], [7, 6, 48], [4, 12, 48]];
  let body = '';
  const options: Option[] = eqs.map(([a, b, c], i) => {
    const x = 50 + (i % 2) * 450, y = 70 + Math.floor(i / 2) * 310;
    body += `<rect x="${x}" y="${y}" width="410" height="270" rx="22" fill="#FFFFFF" stroke="${INK}" stroke-width="4"/>`;
    body += text(x + 205, y + 160, `${a} × ${b} = ${c}`, 72);
    return { id: `e${a}x${b}`, label: `${a} × ${b} = ${c}`, region: rectPx(x, y, 410, 270), jev: `The equation in the ${GRID4[i]}.` };
  });
  const wrong = eqs.map(([a, b, c]) => a * b !== c);
  if (wrong.filter(Boolean).length !== 1) throw new Error('exactly one wrong equation');
  const w = wrong.indexOf(true);
  const [a, b, c] = eqs[w];
  return defineCard({
    id: 'math-wrong-product',
    title: 'Times tables',
    category: 'math',
    difficulty: 2,
    prompt: 'One of these is wrong. Tap it.',
    kind: 'pick',
    svg: svgDoc(body, '#DDE7EE'),
    options,
    answer: options[w].id,
    explain: `${a} × ${b} is ${a * b}, not ${c}. The other three are right.`,
    jev: {
      context: 'Four cards, each showing a multiplication with its result.',
      instructions: 'In `card`, which of the four multiplications has a wrong result?',
    },
    source: 'drawn',
  });
})();

// 3. How much money: euro coins with their values written on them.
const coinsTotal = (() => {
  type Coin = { cents: number; x: number; y: number };
  const coins: Coin[] = [
    { cents: 200, x: 170, y: 220 }, { cents: 100, x: 400, y: 170 }, { cents: 50, x: 640, y: 230 },
    { cents: 20, x: 850, y: 170 }, { cents: 20, x: 240, y: 480 }, { cents: 10, x: 490, y: 430 },
    { cents: 5, x: 670, y: 540 }, { cents: 50, x: 860, y: 450 },
  ];
  const size: Record<number, number> = { 200: 96, 100: 88, 50: 90, 20: 82, 10: 74, 5: 78 };
  const gold = '#D9B44A', silver = '#C9CDD2', copper = '#B8733A';
  let body = '';
  for (const c of coins) {
    const r = size[c.cents];
    const label = c.cents >= 100 ? `€${c.cents / 100}` : `${c.cents}c`;
    if (c.cents >= 100) {
      const [outer, inner] = c.cents === 200 ? [silver, gold] : [gold, silver];
      body += `<circle cx="${c.x}" cy="${c.y}" r="${r}" fill="${outer}" stroke="#6B5B3A" stroke-width="4"/><circle cx="${c.x}" cy="${c.y}" r="${r * 0.68}" fill="${inner}" stroke="#6B5B3A" stroke-width="3"/>`;
    } else {
      body += `<circle cx="${c.x}" cy="${c.y}" r="${r}" fill="${c.cents >= 10 ? gold : copper}" stroke="#6B5B3A" stroke-width="4"/><circle cx="${c.x}" cy="${c.y}" r="${r - 10}" fill="none" stroke="#00000033" stroke-width="3"/>`;
    }
    body += text(c.x, c.y + 18, label, 52, INK);
  }
  for (let i = 0; i < coins.length; i++)
    for (let j = i + 1; j < coins.length; j++)
      if (Math.hypot(coins[i].x - coins[j].x, coins[i].y - coins[j].y) < size[coins[i].cents] + size[coins[j].cents] + 8) throw new Error('coins overlap');
  const total = coins.reduce((a, c) => a + c.cents, 0);
  const eur = (c: number | string) => `€${(Number(c) / 100).toFixed(2)}`;
  const { options, answer } = numButtons('c', [total - 20, total, total + 50, total + 100], total, eur);
  return defineCard({
    id: 'math-coins-total',
    title: 'Pocket change',
    category: 'math',
    difficulty: 2,
    prompt: 'How much money is here?',
    kind: 'buttons',
    svg: svgDoc(body, '#3E6B5A'),
    options,
    answer,
    explain: `${coins.map((c) => (c.cents >= 100 ? `€${c.cents / 100}` : `${c.cents}c`)).join(' + ')} = ${eur(total)}.`,
    jev: {
      context: 'Euro coins scattered on a green table, each with its value written on it.',
      instructions: 'What is the total value of the coins in `card`?',
    },
    source: 'drawn',
  });
})();

// 4. Tally marks: groups of five (four strokes and a slash) plus a few loose strokes.
const tallyCount = (() => {
  const groups = 5, loose = 2;
  let body = '';
  const stroke = `stroke="${INK}" stroke-width="12" stroke-linecap="round"`;
  const place = (k: number): [number, number] => [130 + (k % 3) * 290, 110 + Math.floor(k / 3) * 280];
  for (let g = 0; g < groups; g++) {
    const [x, y] = place(g);
    for (let s = 0; s < 4; s++) body += `<line x1="${x + s * 46}" y1="${y}" x2="${x + s * 46 + 4}" y2="${y + 190}" ${stroke}/>`;
    body += `<line x1="${x - 30}" y1="${y + 160}" x2="${x + 3 * 46 + 34}" y2="${y + 30}" ${stroke}/>`;
  }
  const [lx, ly] = place(groups);
  for (let s = 0; s < loose; s++) body += `<line x1="${lx + s * 46}" y1="${ly}" x2="${lx + s * 46 + 4}" y2="${ly + 190}" ${stroke}/>`;
  const n = groups * 5 + loose;
  const { options, answer } = numButtons('n', [n - 5, n - 3, n, n + 2], n);
  return defineCard({
    id: 'math-tally-marks',
    title: 'Tally',
    category: 'counting',
    difficulty: 1,
    prompt: 'What number do these tally marks show?',
    kind: 'buttons',
    svg: svgDoc(body, '#FBF8F1'),
    options,
    answer,
    explain: `Each crossed bundle is 5, so ${groups} bundles make ${groups * 5}, plus ${loose} single strokes is ${n}.`,
    jev: {
      context: 'Tally marks drawn in two rows, some bundled with a diagonal slash.',
      instructions: 'What number do the tally marks in `card` show?',
    },
    source: 'drawn',
  });
})();

/** An angle (two rays from a vertex with an arc), centered in a cell. rot is the first ray's direction, counterclockwise from east. */
function angleSvg(cx: number, cy: number, deg: number, rot: number, len: number, color: string): string {
  const dir = (a: number): [number, number] => [Math.cos(rad(a)), -Math.sin(rad(a))];
  const [ax, ay] = dir(rot), [bx, by] = dir(rot + deg);
  const P: [number, number][] = [[0, 0], [ax * len, ay * len], [bx * len, by * len]];
  const minX = Math.min(...P.map((p) => p[0])), maxX = Math.max(...P.map((p) => p[0]));
  const minY = Math.min(...P.map((p) => p[1])), maxY = Math.max(...P.map((p) => p[1]));
  if (maxX - minX > 400 || maxY - minY > 280) throw new Error(`angle ${deg} does not fit its box`);
  const ox = cx - (minX + maxX) / 2, oy = cy - (minY + maxY) / 2;
  const ar = 46;
  let s = `<path d="M${f1(ox + ax * ar)},${f1(oy + ay * ar)} A${ar},${ar} 0 ${deg > 180 ? 1 : 0} 0 ${f1(ox + bx * ar)},${f1(oy + by * ar)}" fill="none" stroke="${color}" stroke-width="5"/>`;
  s += `<polyline points="${pts([[ox + ax * len, oy + ay * len], [ox, oy], [ox + bx * len, oy + by * len]])}" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<circle cx="${f1(ox)}" cy="${f1(oy)}" r="9" fill="${color}"/>`;
  return s;
}

/** Four angles in a 2x2 grid of cells. */
function angleGrid(angles: { deg: number; rot: number; len: number }[], color: string) {
  let body = '';
  const options: Option[] = angles.map((a, i) => {
    const x = 20 + (i % 2) * 470, y = 20 + Math.floor(i / 2) * 350;
    body += `<rect x="${x}" y="${y}" width="450" height="330" rx="18" fill="#FFFFFF" stroke="#B9BEC7" stroke-width="3"/>`;
    body += angleSvg(x + 225, y + 165, a.deg, a.rot, a.len, color);
    return { id: `a${i}`, label: `${a.deg}°`, region: rectPx(x, y, 450, 330), jev: `The angle in the ${GRID4[i]} box.` };
  });
  return { body, options };
}

// 5. Biggest angle: the widest one has the shortest arms.
const biggestAngle = (() => {
  const angles = [
    { deg: 95, rot: 20, len: 200 },
    { deg: 112, rot: 200, len: 200 },
    { deg: 124, rot: 130, len: 110 },
    { deg: 104, rot: 300, len: 165 },
  ];
  const { body, options } = angleGrid(angles, '#E76F51');
  const best = uniqueMax(angles.map((a) => a.deg));
  return defineCard({
    id: 'math-biggest-angle',
    title: 'Widest angle',
    category: 'math',
    difficulty: 3,
    prompt: 'Tap the biggest angle.',
    kind: 'pick',
    svg: svgDoc(body, '#E9EEF3'),
    options,
    answer: options[best].id,
    explain: `The angles are ${angles.map((a) => `${a.deg}°`).join(', ')} (reading across, then down). The ${angles[best].deg}° one is widest even though its arms are the shortest: arm length does not change an angle.`,
    jev: {
      context: 'Four angles, each drawn as two arms meeting at a dot, in four boxes; the arms are different lengths.',
      instructions: 'In `card`, which box holds the largest angle (the widest opening between the two arms)?',
    },
    source: 'drawn',
  });
})();

// 6. Which is a right angle: the 90 degree one is turned, the near-misses sit square to the page.
const rightAngle = (() => {
  const angles = [
    { deg: 80, rot: 0, len: 210 },
    { deg: 102, rot: 270, len: 210 },
    { deg: 90, rot: 32, len: 210 },
    { deg: 68, rot: 180, len: 210 },
  ];
  const { body, options } = angleGrid(angles, '#2A9D8F');
  const rights = angles.map((a) => a.deg === 90);
  if (rights.filter(Boolean).length !== 1) throw new Error('one right angle');
  return defineCard({
    id: 'math-right-angle',
    title: 'Square corner',
    category: 'math',
    difficulty: 3,
    prompt: 'Tap the right angle.',
    kind: 'pick',
    svg: svgDoc(body, '#E9EEF3'),
    options,
    answer: options[rights.indexOf(true)].id,
    explain: `Only the tilted one is exactly 90°. The others are ${angles.filter((a) => a.deg !== 90).map((a) => `${a.deg}°`).join(', ')}, even the ones with an arm lying flat or upright.`,
    jev: {
      context: 'Four angles, each drawn as two arms meeting at a dot, in four boxes, turned different ways.',
      instructions: 'In `card`, which box holds the angle that is exactly 90 degrees?',
    },
    source: 'drawn',
  });
})();

// 7. Lines of symmetry of a regular five-pointed star (counted in code).
const starSymmetry = (() => {
  const cx = 480, cy = 380, R = 300, r = R * 0.382;
  const star: [number, number][] = [];
  for (let k = 0; k < 10; k++) {
    const a = rad(k * 36), rr = k % 2 ? r : R;
    star.push([cx + rr * Math.sin(a), cy - rr * Math.cos(a)]);
  }
  const n = symmetryLines(star);
  const body = `<polygon points="${pts(star)}" fill="#E9C46A" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>`;
  const { options, answer } = numButtons('l', [1, 2, 5, 10], n);
  return defineCard({
    id: 'math-star-symmetry',
    title: 'Fold the star',
    category: 'math',
    difficulty: 2,
    prompt: 'How many lines of symmetry does this star have?',
    kind: 'buttons',
    svg: svgDoc(body, '#264653'),
    options,
    answer,
    explain: `A regular five-pointed star has ${n} lines of symmetry, one through each point and the dip opposite it.`,
    jev: {
      context: 'A regular five-pointed star.',
      instructions: 'How many lines of mirror symmetry does the star in `card` have?',
    },
    source: 'drawn',
  });
})();

// 8. Tap the shape with no line of symmetry: the parallelogram looks balanced but no fold matches it.
const noSymmetry = (() => {
  const shapes: { name: string; p: [number, number][]; color: string }[] = [
    { name: 'kite', p: [[0, -150], [80, -60], [0, 150], [-80, -60]], color: '#2A9D8F' },
    { name: 'parallelogram', p: [[-130, -80], [50, -80], [130, 80], [-50, 80]], color: '#E76F51' },
    { name: 'isosceles trapezoid', p: [[-60, -80], [60, -80], [110, 80], [-110, 80]], color: '#8AB17D' },
    { name: 'isosceles triangle', p: [[0, -120], [90, 100], [-90, 100]], color: '#E9C46A' },
  ];
  let body = '';
  const options: Option[] = shapes.map((s, i) => {
    const x = 20 + (i % 2) * 470, y = 20 + Math.floor(i / 2) * 350, cx = x + 225, cy = y + 165;
    body += `<rect x="${x}" y="${y}" width="450" height="330" rx="18" fill="#FFFFFF" stroke="#B9BEC7" stroke-width="3"/>`;
    body += `<polygon points="${pts(s.p.map(([a, b]) => [cx + a, cy + b]))}" fill="${s.color}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`;
    return { id: s.name.split(' ').pop()!, label: s.name[0].toUpperCase() + s.name.slice(1), region: rectPx(x, y, 450, 330), jev: `The shape in the ${GRID4[i]} box.` };
  });
  const lines = shapes.map((s) => symmetryLines(s.p));
  if (lines.filter((n) => n === 0).length !== 1) throw new Error('exactly one shape without symmetry');
  const none = lines.indexOf(0);
  return defineCard({
    id: 'math-no-symmetry',
    title: 'No mirror line',
    category: 'math',
    difficulty: 3,
    prompt: 'Tap the shape with no line of symmetry.',
    kind: 'pick',
    svg: svgDoc(body, '#E9EEF3'),
    options,
    answer: options[none].id,
    explain: `The ${shapes[none].name} has no line of symmetry: it looks the same turned halfway round, but no fold lays one half on the other. The kite, trapezoid and triangle each fold in half down the middle.`,
    jev: {
      context: 'Four flat shapes, one in each of four boxes.',
      instructions: 'In `card`, which shape has no line of mirror symmetry?',
    },
    source: 'drawn',
  });
})();

// 9. A number line from 100 to 200 with four unlabeled ticks between: each step is 20.
const numberLine = (() => {
  const lo = 100, hi = 200, steps = 5, at = 3;
  const x0 = 110, x1 = 850, y = 380;
  let body = `<line x1="${x0 - 50}" y1="${y}" x2="${x1 + 50}" y2="${y}" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>`;
  for (let k = 0; k <= steps; k++) {
    const x = x0 + ((x1 - x0) * k) / steps, end = k === 0 || k === steps;
    body += `<line x1="${x}" y1="${y - (end ? 44 : 30)}" x2="${x}" y2="${y + (end ? 44 : 30)}" stroke="${INK}" stroke-width="${end ? 8 : 6}"/>`;
  }
  body += text(x0, y + 110, lo, 56) + text(x1, y + 110, hi, 56);
  const dx = x0 + ((x1 - x0) * at) / steps;
  body += `<circle cx="${dx}" cy="${y}" r="24" fill="#D62828" stroke="${INK}" stroke-width="4"/>`;
  const v = lo + ((hi - lo) * at) / steps;
  const { options, answer } = numButtons('v', [130, 150, v, 175], v);
  return defineCard({
    id: 'math-number-line',
    title: 'On the line',
    category: 'math',
    difficulty: 2,
    prompt: 'What number is at the red dot?',
    kind: 'buttons',
    svg: svgDoc(body, '#FBF8F1'),
    options,
    answer,
    explain: `From ${lo} to ${hi} is split into ${steps} equal steps of ${(hi - lo) / steps}, and the dot is on the ${at}rd tick: ${lo} + ${at} × ${(hi - lo) / steps} = ${v}.`,
    jev: {
      context: 'A number line labeled only at its two ends, with evenly spaced tick marks and a red dot on one tick.',
      instructions: 'What number is at the red dot on the number line in `card`?',
    },
    source: 'drawn',
  });
})();

// 10. Most area on a grid: shoelace areas in grid squares.
const mostArea = (() => {
  const u = 40;
  const shapes: { p: [number, number][]; at: [number, number]; color: string }[] = [
    { p: [[0, 0], [5, 0], [5, 5], [0, 5]], at: [3, 2], color: '#2A9D8F' }, // square 25
    { p: [[0, 0], [0, 7], [8, 7]], at: [14, 1], color: '#E76F51' }, // right triangle 28
    { p: [[0, 0], [3, 0], [3, 9], [0, 9]], at: [4, 8], color: '#E9C46A' }, // 3 x 9 = 27
    { p: [[0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6]], at: [14, 10], color: '#8AB17D' }, // L 20
  ];
  const area = (p: [number, number][]) => Math.abs(p.reduce((a, [x, y], i) => a + x * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * y, 0)) / 2;
  let body = '';
  for (let x = 0; x <= W; x += u) body += `<line x1="${x}" y1="0" x2="${x}" y2="720" stroke="#C7D3DD" stroke-width="2"/>`;
  for (let y = 0; y <= 720; y += u) body += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#C7D3DD" stroke-width="2"/>`;
  const where = ['top left', 'top right', 'bottom left', 'bottom right'];
  const options: Option[] = shapes.map((s, i) => {
    const P = s.p.map(([x, y]) => [(s.at[0] + x) * u, (s.at[1] + y) * u] as [number, number]);
    body += `<polygon points="${pts(P)}" fill="${s.color}" fill-opacity="0.85" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
    const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
    const [x, y, w, h] = [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
    if (x < 0 || y < 0 || x + w > W || y + h > 720) throw new Error('shape off the card');
    return { id: `s${i}`, label: `${area(s.p)} squares`, region: rectPx(x - 10, y - 10, w + 20, h + 20), jev: `The shape in the ${where[i]}.` };
  });
  const areas = shapes.map((s) => area(s.p));
  const best = uniqueMax(areas);
  return defineCard({
    id: 'math-most-area',
    title: 'Most ground',
    category: 'math',
    difficulty: 3,
    prompt: 'Tap the shape with the most area.',
    kind: 'pick',
    svg: svgDoc(body, '#F2F6F9'),
    options,
    answer: options[best].id,
    explain: `Counting grid squares: the square is 25, the triangle is half of 8 × 7 = 28, the tall bar is 3 × 9 = 27 and the L is 20, so the triangle wins.`,
    jev: {
      context: 'Four colored shapes drawn on square grid paper.',
      instructions: 'In `card`, which shape covers the largest area?',
    },
    source: 'drawn',
  });
})();

// 11. What comes next: n(n + 1) = 2, 6, 12, 20, 30.
const patternNext = (() => {
  const f = (n: number) => n * (n + 1);
  const seq = [1, 2, 3, 4].map(f), next = f(5);
  let body = '';
  [...seq, '?'].forEach((v, i) => {
    const x = 30 + i * 184;
    body += `<rect x="${x}" y="230" width="164" height="190" rx="20" fill="${v === '?' ? '#FFE8A3' : '#FFFFFF'}" stroke="${INK}" stroke-width="5"/>`;
    body += text(x + 82, 350, v, 80);
  });
  const diffs = seq.slice(1).map((v, i) => v - seq[i]);
  const { options, answer } = numButtons('p', [28, next, 32, 36], next);
  return defineCard({
    id: 'math-pattern-next',
    title: 'Growing gaps',
    category: 'math',
    difficulty: 2,
    prompt: 'What comes next?',
    kind: 'buttons',
    svg: svgDoc(body, '#DDE7EE'),
    options,
    answer,
    explain: `The gaps grow by 2 each time (+${diffs.join(', +')}), so the next gap is +${next - seq[3]} and ${seq[3]} + ${next - seq[3]} = ${next}.`,
    jev: {
      context: 'A row of number tiles with the last one a question mark.',
      instructions: 'Which number replaces the question mark in the sequence in `card`?',
    },
    source: 'drawn',
  });
})();

// 12. Clock arithmetic: 10:25 plus 45 minutes.
const clockPlus = (() => {
  const cx = 350, cy = 360, R = 300;
  const h = 10, m = 25, add = 45;
  let body = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#FFFFFF" stroke="${INK}" stroke-width="14"/>`;
  for (let i = 0; i < 60; i++) {
    const a = rad(i * 6), big = i % 5 === 0;
    const r1 = R - 18, r2 = R - (big ? 48 : 30);
    body += `<line x1="${f1(cx + r1 * Math.sin(a))}" y1="${f1(cy - r1 * Math.cos(a))}" x2="${f1(cx + r2 * Math.sin(a))}" y2="${f1(cy - r2 * Math.cos(a))}" stroke="${INK}" stroke-width="${big ? 7 : 3}"/>`;
  }
  for (let k = 1; k <= 12; k++) {
    const a = rad(k * 30), r = R - 92;
    body += text(cx + r * Math.sin(a), cy - r * Math.cos(a) + 18, k, 50);
  }
  const hand = (deg: number, len: number, width: number) =>
    `<line x1="${f1(cx - 26 * Math.sin(rad(deg)))}" y1="${f1(cy + 26 * Math.cos(rad(deg)))}" x2="${f1(cx + len * Math.sin(rad(deg)))}" y2="${f1(cy - len * Math.cos(rad(deg)))}" stroke="${INK}" stroke-width="${width}" stroke-linecap="round"/>`;
  body += hand((h + m / 60) * 30, 140, 18) + hand(m * 6, 245, 8) + `<circle cx="${cx}" cy="${cy}" r="16" fill="#D62828"/>`;
  body += `<rect x="690" y="290" width="240" height="140" rx="20" fill="#D62828"/>` + text(810, 380, `+${add} min`, 50, '#FFFFFF');
  const total = h * 60 + m + add;
  const fmt = (mins: number) => `${((Math.floor(mins / 60) + 11) % 12) + 1}:${String(mins % 60).padStart(2, '0')}`;
  const ans = fmt(total);
  const { options, answer } = numButtons('t', [fmt(total - 10), ans, fmt(total + 10), fmt(total + 60)], ans);
  return defineCard({
    id: 'math-clock-plus',
    title: 'Later on',
    category: 'math',
    difficulty: 2,
    prompt: `What time will it be in ${add} minutes?`,
    kind: 'buttons',
    svg: svgDoc(body, '#E9EEF3'),
    options,
    answer,
    explain: `The clock shows ${h}:${String(m).padStart(2, '0')}. ${60 - m} minutes takes it to ${h + 1}:00 and the other ${add - (60 - m)} make ${ans}.`,
    jev: {
      context: `An analog clock with hour and minute hands, next to a tag reading +${add} min.`,
      instructions: `What time will it be ${add} minutes after the time shown on the clock in \`card\`?`,
    },
    source: 'drawn',
  });
})();

// 13. Exactly half shaded: four 3 x 4 grids with 5, 6, 7 and 8 of 12 cells shaded, scattered.
const halfShaded = (() => {
  const grids: number[][] = [
    // shaded cell indexes (row-major, 4 columns x 3 rows)
    [0, 2, 5, 7, 9, 10, 11],
    [1, 3, 4, 6, 9, 11],
    [0, 1, 4, 7, 10],
    [0, 2, 3, 5, 6, 8, 9, 11],
  ];
  const c = 64, cols = 4, rows = 3;
  let body = '';
  const options: Option[] = grids.map((g, i) => {
    const x = 20 + (i % 2) * 470, y = 20 + Math.floor(i / 2) * 350;
    body += `<rect x="${x}" y="${y}" width="450" height="330" rx="18" fill="#FFFFFF" stroke="#B9BEC7" stroke-width="3"/>`;
    const gx = x + 225 - (cols * c) / 2, gy = y + 165 - (rows * c) / 2;
    for (let k = 0; k < cols * rows; k++)
      body += `<rect x="${gx + (k % cols) * c}" y="${gy + Math.floor(k / cols) * c}" width="${c}" height="${c}" fill="${g.includes(k) ? '#7B2CBF' : '#FFFFFF'}" stroke="${INK}" stroke-width="4"/>`;
    return { id: `g${i}`, label: `${g.length} of 12`, region: rectPx(x, y, 450, 330), jev: `The grid in the ${GRID4[i]} box.` };
  });
  const halves = grids.map((g) => g.length * 2 === cols * rows);
  if (halves.filter(Boolean).length !== 1) throw new Error('one half-shaded grid');
  const half = halves.indexOf(true);
  return defineCard({
    id: 'math-half-shaded',
    title: 'Half and half',
    category: 'math',
    difficulty: 2,
    prompt: 'Tap the grid that is exactly half shaded.',
    kind: 'pick',
    svg: svgDoc(body, '#E9EEF3'),
    options,
    answer: options[half].id,
    explain: `Each grid has 12 squares, so half is 6. The grids shade ${grids.map((g) => g.length).join(', ')} squares (reading across, then down).`,
    jev: {
      context: 'Four grids of 12 squares each, with some squares shaded purple.',
      instructions: 'In `card`, which grid has exactly half of its squares shaded?',
    },
    source: 'drawn',
  });
})();

// 14. Percent of a hundred-square shaded: three full rows and seven more.
const percentGrid = (() => {
  const shaded = 37, c = 60, x0 = (W - 10 * c) / 2, y0 = 60;
  let body = '';
  for (let k = 0; k < 100; k++)
    body += `<rect x="${x0 + (k % 10) * c}" y="${y0 + Math.floor(k / 10) * c}" width="${c}" height="${c}" fill="${k < shaded ? '#1F5FD6' : '#FFFFFF'}" stroke="${INK}" stroke-width="3"/>`;
  body += `<rect x="${x0}" y="${y0}" width="${10 * c}" height="${10 * c}" fill="none" stroke="${INK}" stroke-width="6"/>`;
  const { options, answer } = numButtons('p', [30, shaded, 100 - shaded, 73], shaded, (v) => `${v}%`);
  return defineCard({
    id: 'math-percent-shaded',
    title: 'Out of a hundred',
    category: 'math',
    difficulty: 1,
    prompt: 'What percent is shaded blue?',
    kind: 'buttons',
    svg: svgDoc(body, '#FBF8F1'),
    options,
    answer,
    explain: `The grid has 100 squares and ${shaded} are blue (${Math.floor(shaded / 10)} full rows of 10 and ${shaded % 10} more), so ${shaded}% is shaded.`,
    jev: {
      context: 'A 10 by 10 grid of squares, some shaded blue.',
      instructions: 'What percentage of the grid in `card` is shaded blue?',
    },
    source: 'drawn',
  });
})();

const cards: CardSpec[] = [
  fractionPies, wrongProduct, coinsTotal, tallyCount, biggestAngle, rightAngle, starSymmetry,
  noSymmetry, numberLine, mostArea, patternNext, clockPlus, halfShaded, percentGrid,
];
export default cards;
