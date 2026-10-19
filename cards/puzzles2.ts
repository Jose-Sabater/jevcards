/**
 * More puzzle cards: two illusions, two color cards, two counts, two readings and six logic puzzles.
 * Everything is drawn from fixed coordinates (or a seeded PRNG), and every answer is computed from the same
 * data that draws the picture, so rebuilding gives the same pictures and the answers cannot drift.
 */
import { defineCard, H, rectPx, svgDoc, W, type CardSpec, type Option, type Region } from './lib.ts';

const FONT = `font-family="Arial, Helvetica, sans-serif"`;
const rad = (deg: number) => (deg * Math.PI) / 180;
const f1 = (n: number) => n.toFixed(1);
const INK = '#2B2D42';

/** Deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A region made of several pixel rects (even-odd rings, so disjoint rects act as a union). */
const rectsPx = (rs: [number, number, number, number][]): Region => ({
  type: 'poly',
  rings: rs.map(([x, y, w, h]) => [[x / W, y / H], [(x + w) / W, y / H], [(x + w) / W, (y + h) / H], [x / W, (y + h) / H]]),
});

// 1. Ponzo: two equal red bars across converging rails.
const ponzoRails = (() => {
  const yTop = 40, yBot = 720;
  const railX = (side: -1 | 1, y: number) => 480 + side * (60 + (220 * (y - yTop)) / (yBot - yTop));
  let body = '';
  for (let k = 0; k <= 16; k++) {
    const y = yTop + 20 + (yBot - yTop) * Math.pow(k / 16, 1.5);
    const w = 3 + (9 * (y - yTop)) / (yBot - yTop);
    body += `<line x1="${f1(railX(-1, y) - 24)}" y1="${f1(y)}" x2="${f1(railX(1, y) + 24)}" y2="${f1(y)}" stroke="#8B6A4A" stroke-width="${f1(w)}"/>`;
  }
  for (const s of [-1, 1] as const)
    body += `<line x1="${railX(s, yTop)}" y1="${yTop}" x2="${railX(s, yBot)}" y2="${yBot}" stroke="#4A4E57" stroke-width="7"/>`;
  const len = 160, bars = [170, 580];
  for (const y of bars) body += `<rect x="${480 - len / 2}" y="${y - 10}" width="${len}" height="20" fill="#D62828"/>`;
  return defineCard({
    id: 'ponzo-rails',
    title: 'On the rails',
    category: 'illusions',
    difficulty: 2,
    prompt: 'Tap the longer red bar, or say they are the same.',
    kind: 'pick',
    svg: svgDoc(body, '#E8E2D4'),
    options: [
      { id: 'top', label: 'Top', region: rectPx(360, bars[0] - 60, 240, 120), jev: 'The upper red bar.' },
      { id: 'bottom', label: 'Bottom', region: rectPx(360, bars[1] - 60, 240, 120), jev: 'The lower red bar.' },
      { id: 'same', label: 'Same length', jev: 'Same length.' },
    ],
    answer: 'same',
    explain: `Both red bars are exactly ${len} pixels long: the rails converging toward the top make the upper bar look longer (the Ponzo illusion).`,
    jev: {
      context: 'A railway track running into the distance with two red bars lying across it, one high and one low.',
      instructions: 'In `card`, which red bar is longer, or are they the same length?',
    },
    source: 'drawn',
  });
})();

// 2. Checker shadow: a dark square in the light and a light square in a shadow, both exactly rgb(120,120,120).
const shadowChecker = (() => {
  const cols = 7, rows = 5, sq = 96, x0 = (W - cols * sq) / 2, y0 = (H - rows * sq) / 2;
  const light = 200, dark = 120, shade = 0.4; // light * (1 - shade) = dark
  const gray = (v: number) => `rgb(${v},${v},${v})`;
  const A = { r: 0, c: 5 }, B = { r: 2, c: 2 };
  const ctr = (p: { r: number; c: number }) => [x0 + (p.c + 0.5) * sq, y0 + (p.r + 0.5) * sq];
  const [bx, by] = ctr(B), [ax, ay] = ctr(A);
  const R = 250, core = 0.36;
  if ((A.r + A.c) % 2 !== 1 || (B.r + B.c) % 2 !== 0) throw new Error('A must be dark, B light');
  if (core * R < Math.hypot(sq / 2, sq / 2)) throw new Error('B must sit inside the flat shadow core');
  if (Math.hypot(Math.max(0, Math.abs(ax - bx) - sq / 2), Math.max(0, Math.abs(ay - by) - sq / 2)) < R) throw new Error('A must be outside the shadow');
  let body = `<defs><radialGradient id="sh" cx="${bx}" cy="${by}" r="${R}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#000" stop-opacity="${shade}"/><stop offset="${core}" stop-color="#000" stop-opacity="${shade}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`;
  body += `<linearGradient id="cyl" x1="0" x2="1"><stop offset="0" stop-color="#2E7D4F"/><stop offset="0.45" stop-color="#5FBF84"/><stop offset="1" stop-color="#1E5E39"/></linearGradient></defs>`;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      body += `<rect x="${x0 + c * sq}" y="${y0 + r * sq}" width="${sq}" height="${sq}" fill="${gray((r + c) % 2 ? dark : light)}"/>`;
  body += `<rect x="${x0}" y="${y0}" width="${cols * sq}" height="${rows * sq}" fill="url(#sh)"/>`;
  // Redraw both squares flat so they are exactly the same value, whatever the renderer rounds.
  for (const p of [A, B]) body += `<rect x="${x0 + p.c * sq}" y="${y0 + p.r * sq}" width="${sq}" height="${sq}" fill="${gray(dark)}"/>`;
  // The cylinder casting the shadow.
  const cx = bx + 150, base = by + 40, cr = 58, top = base - 230;
  body += `<rect x="${cx - cr}" y="${top}" width="${2 * cr}" height="${base - top}" fill="url(#cyl)"/><ellipse cx="${cx}" cy="${base}" rx="${cr}" ry="18" fill="url(#cyl)"/><ellipse cx="${cx}" cy="${top}" rx="${cr}" ry="18" fill="#7FD3A0"/>`;
  body += `<rect x="${x0}" y="${y0}" width="${cols * sq}" height="${rows * sq}" fill="none" stroke="#3A3A3A" stroke-width="6"/>`;
  for (const [p, t] of [[A, 'A'], [B, 'B']] as const) {
    const [x, y] = ctr(p);
    body += `<text x="${x}" y="${y + 17}" text-anchor="middle" ${FONT} font-weight="bold" font-size="48" fill="#FFFFFF">${t}</text>`;
  }
  return defineCard({
    id: 'shadow-checker',
    title: 'In the shadow',
    category: 'illusions',
    difficulty: 3,
    prompt: 'Which square is darker, A or B?',
    kind: 'pick',
    svg: svgDoc(body, '#D9D4CA'),
    options: [
      { id: 'a', label: 'A', region: rectPx(x0 + A.c * sq, y0 + A.r * sq, sq, sq), jev: 'The square marked A.' },
      { id: 'b', label: 'B', region: rectPx(x0 + B.c * sq, y0 + B.r * sq, sq, sq), jev: 'The square marked B.' },
      { id: 'same', label: 'Same gray', jev: 'They are the same gray.' },
    ],
    answer: 'same',
    explain: `Both squares are exactly the same gray, rgb(${dark}, ${dark}, ${dark}): your eye brightens B because it sits in a shadow among dark squares (the checker shadow illusion).`,
    jev: {
      context: 'A checkerboard with a green cylinder casting a shadow on it; two squares are marked A and B.',
      instructions: 'In `card`, which of the squares marked A and B is printed in a darker gray, or are they the same gray?',
    },
    source: 'drawn',
  });
})();

// 3. One tile in a grid is a slightly lighter blue.
const oddShade = (() => {
  const cols = 8, rows = 6, t = 96, g = 14;
  const x0 = (W - (cols * t + (cols - 1) * g)) / 2, y0 = (H - (rows * t + (rows - 1) * g)) / 2;
  const odd = { r: 3, c: 5 };
  const base = [52, 120, 186], diff = [63, 131, 196];
  let body = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const v = r === odd.r && c === odd.c ? diff : base;
      body += `<rect x="${x0 + c * (t + g)}" y="${y0 + r * (t + g)}" width="${t}" height="${t}" rx="10" fill="rgb(${v.join(',')})"/>`;
    }
  return defineCard({
    id: 'odd-shade',
    title: 'Off by a shade',
    category: 'colors',
    difficulty: 2,
    prompt: 'One tile is a slightly different blue. Tap it.',
    kind: 'point',
    svg: svgDoc(body, '#F4F1EA'),
    target: rectPx(x0 + odd.c * (t + g) - g / 2, y0 + odd.r * (t + g) - g / 2, t + g, t + g),
    explain: `Every tile is rgb(${base.join(', ')}) except the one in row ${odd.r + 1}, column ${odd.c + 1}, which is a little lighter at rgb(${diff.join(', ')}).`,
    jev: {
      context: `A grid of ${cols * rows} blue tiles in ${rows} rows of ${cols}, nearly all the same shade.`,
      instructions: 'In `card`, one tile is a slightly different shade of blue from all the others. Where is it?',
    },
    source: 'drawn',
  });
})();

// 4. Match a sample color: the exact match sits on black, which makes it look lighter.
const swatchMatch = (() => {
  const sample = [70, 150, 150];
  const tiles: { fill: number[]; surround: string; note: string }[] = [
    { fill: [96, 176, 176], surround: '#FFFFFF', note: 'lighter' },
    { fill: [70, 150, 116], surround: '#7A4AA0', note: 'greener' },
    { fill: sample, surround: '#111111', note: 'exact' },
    { fill: [48, 122, 122], surround: '#9FD8D8', note: 'darker' },
  ];
  const rgb = (v: number[]) => `rgb(${v.join(',')})`;
  let body = `<rect x="330" y="40" width="300" height="150" rx="14" fill="${rgb(sample)}" stroke="#555" stroke-width="3"/>`;
  body += `<text x="480" y="236" text-anchor="middle" ${FONT} font-weight="bold" font-size="34" fill="${INK}">SAMPLE</text>`;
  const pos = ['far left', 'second from the left', 'second from the right', 'far right'];
  const options: Option[] = tiles.map((tl, i) => {
    const cx = 130 + i * 233, cy = 480, s = 200, ts = 90;
    body += `<rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" fill="${tl.surround}" stroke="#555" stroke-width="2"/>`;
    body += `<rect x="${cx - ts / 2}" y="${cy - ts / 2}" width="${ts}" height="${ts}" fill="${rgb(tl.fill)}"/>`;
    return { id: `t${i}`, label: `The ${tl.note} tile`, region: rectPx(cx - s / 2, cy - s / 2, s, s), jev: `The small tile in the ${pos[i]} square.` };
  });
  const exact = tiles.findIndex((tl) => tl.fill.join() === sample.join());
  if (tiles.filter((tl) => tl.fill.join() === sample.join()).length !== 1) throw new Error('exactly one exact match');
  return defineCard({
    id: 'swatch-match',
    title: 'Match the sample',
    category: 'colors',
    difficulty: 3,
    prompt: 'Tap the tile that is exactly the sample color.',
    kind: 'pick',
    svg: svgDoc(body, '#C9C9C9'),
    options,
    answer: `t${exact}`,
    explain: `The tile on black is exactly the sample, rgb(${sample.join(', ')}); the black around it makes it look lighter, while the others are lighter, darker or greener.`,
    jev: {
      context: 'A sample color swatch at the top and four small colored tiles below, each set inside a differently colored square.',
      instructions: 'In `card`, which of the four small tiles is exactly the same color as the sample swatch at the top?',
    },
    source: 'drawn',
  });
})();

// 5. Count the red dots in a scatter of colored dots.
const countRedDots = (() => {
  const rand = rng(4021);
  const colors = ['#D62828', '#1F5FD6', '#1E9E3A', '#E0A800', '#7B2CBF'];
  const reds = 11, total = 44;
  const dots: { x: number; y: number; r: number; color: string }[] = [];
  let tries = 0;
  while (dots.length < total) {
    if (++tries > 50000) throw new Error('could not place dots');
    const r = 18 + rand() * 20, x = 40 + r + rand() * (W - 80 - 2 * r), y = 40 + r + rand() * (H - 80 - 2 * r);
    if (dots.some((d) => Math.hypot(d.x - x, d.y - y) < d.r + r + 10)) continue;
    const color = dots.length < reds ? colors[0] : colors[1 + (dots.length % 4)];
    dots.push({ x, y, r, color });
  }
  const n = dots.filter((d) => d.color === colors[0]).length;
  const body = dots.map((d) => `<circle cx="${f1(d.x)}" cy="${f1(d.y)}" r="${f1(d.r)}" fill="${d.color}" stroke="${INK}" stroke-width="2"/>`).join('');
  return defineCard({
    id: 'count-red-dots',
    title: 'Red dots',
    category: 'counting',
    difficulty: 2,
    prompt: 'How many red dots?',
    kind: 'buttons',
    svg: svgDoc(body, '#FBF8F1'),
    options: [n - 2, n - 1, n, n + 1].map((k) => ({ id: `d${k}`, label: String(k), jev: `${k}.` })),
    answer: `d${n}`,
    explain: `There are ${n} red dots among ${total - n} blue, green, yellow and purple ones.`,
    jev: {
      context: 'A scatter of dots of different sizes in five colors.',
      instructions: 'How many red dots are there in `card`?',
    },
    source: 'drawn',
  });
})();

// 6. Count the cubes in a one-row stack: every cube shows its front face, so none is hidden.
const countCubes = (() => {
  const heights = [2, 4, 1, 3, 3, 1];
  const s = 66, c30 = Math.cos(rad(30)), s30 = 0.5;
  const ox = 337, oy = 361;
  // i runs to the right and toward the viewer, k is up; j = 0 for every cube (one row deep, so each front face shows).
  const P = (i: number, j: number, k: number): [number, number] => [ox + (i - j) * s * c30, oy + (i + j) * s * s30 - k * s];
  const poly = (pts: [number, number][], fill: string) => `<polygon points="${pts.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ')}" fill="${fill}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  let body = '';
  heights.forEach((h, i) => {
    for (let k = 0; k < h; k++) {
      body += poly([P(i, 0, k + 1), P(i + 1, 0, k + 1), P(i + 1, 1, k + 1), P(i, 1, k + 1)], '#F4D58D'); // top
      body += poly([P(i, 1, k), P(i + 1, 1, k), P(i + 1, 1, k + 1), P(i, 1, k + 1)], '#E07A5F'); // front (+j)
      body += poly([P(i + 1, 0, k), P(i + 1, 1, k), P(i + 1, 1, k + 1), P(i + 1, 0, k + 1)], '#B5523B'); // right (+i)
    }
  });
  const n = heights.reduce((a, b) => a + b, 0);
  return defineCard({
    id: 'count-cubes',
    title: 'Stack of cubes',
    category: 'counting',
    difficulty: 2,
    prompt: 'How many cubes?',
    kind: 'buttons',
    svg: svgDoc(body, '#DDE7EE'),
    options: [n - 2, n - 1, n, n + 1].map((k) => ({ id: `c${k}`, label: String(k), jev: `${k}.` })),
    answer: `c${n}`,
    explain: `The stack is one row deep, so every cube shows its front face: columns of ${heights.join(', ')} make ${n} cubes.`,
    jev: {
      context: 'Columns of cubes of different heights standing side by side in a single row, none hidden behind another.',
      instructions: 'How many cubes are there in `card`?',
    },
    source: 'drawn',
  });
})();

// 7. Roman numerals: the biggest value is one of the shortest to write.
const romanBiggest = (() => {
  const val: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const roman = (s: string) => [...s].reduce((sum, ch, i) => (val[ch] < (val[s[i + 1]] ?? 0) ? sum - val[ch] : sum + val[ch]), 0);
  const nums = ['LXXXVIII', 'XCIX', 'XLVIII', 'CI', 'LXXVII', 'XCVIII'];
  const where = ['top left', 'top middle', 'top right', 'bottom left', 'bottom middle', 'bottom right'];
  let body = '';
  const options: Option[] = nums.map((n, i) => {
    const cx = 170 + (i % 3) * 310, cy = 220 + Math.floor(i / 3) * 280;
    body += `<rect x="${cx - 140}" y="${cy - 100}" width="280" height="200" rx="16" fill="#FFFFFF" stroke="${INK}" stroke-width="4"/>`;
    body += `<text x="${cx}" y="${cy + 16}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="46" fill="${INK}">${n}</text>`;
    return { id: n.toLowerCase(), label: `${n} (${roman(n)})`, region: rectPx(cx - 140, cy - 100, 280, 200), jev: `The card in the ${where[i]}.` };
  });
  const best = nums.reduce((a, b) => (roman(b) > roman(a) ? b : a));
  if (nums.filter((n) => roman(n) === roman(best)).length !== 1) throw new Error('one biggest');
  return defineCard({
    id: 'roman-biggest',
    title: 'Roman numbers',
    category: 'reading',
    difficulty: 2,
    prompt: 'Tap the biggest number.',
    kind: 'pick',
    svg: svgDoc(body, '#EFE6D2'),
    options,
    answer: best.toLowerCase(),
    explain: `${best} is ${roman(best)}, the biggest; the long ones are smaller (${nums.filter((n) => n !== best).map((n) => `${n} = ${roman(n)}`).join(', ')}).`,
    jev: {
      context: 'Six cards, each showing a number written in Roman numerals.',
      instructions: 'Which card in `card` shows the Roman numeral with the largest value?',
    },
    source: 'drawn',
  });
})();

// 8. A clock with no numbers at 2:50: the hour hand is almost on 3.
const clockNoNumbers = (() => {
  const cx = W / 2, cy = 360, R = 300;
  const h = 2, m = 50;
  let body = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#FFFFFF" stroke="${INK}" stroke-width="14"/>`;
  for (let i = 0; i < 60; i++) {
    const a = rad(i * 6), big = i % 5 === 0, top = i === 0;
    const r1 = R - 18, r2 = R - (top ? 80 : big ? 52 : 30);
    body += `<line x1="${f1(cx + r1 * Math.sin(a))}" y1="${f1(cy - r1 * Math.cos(a))}" x2="${f1(cx + r2 * Math.sin(a))}" y2="${f1(cy - r2 * Math.cos(a))}" stroke="${top ? '#D62828' : INK}" stroke-width="${top ? 16 : big ? 9 : 3}"/>`;
  }
  const hand = (deg: number, len: number, width: number) =>
    `<line x1="${f1(cx - 26 * Math.sin(rad(deg)))}" y1="${f1(cy + 26 * Math.cos(rad(deg)))}" x2="${f1(cx + len * Math.sin(rad(deg)))}" y2="${f1(cy - len * Math.cos(rad(deg)))}" stroke="${INK}" stroke-width="${width}" stroke-linecap="round"/>`;
  body += hand((h + m / 60) * 30, 150, 18);
  body += hand(m * 6, 250, 8);
  body += `<circle cx="${cx}" cy="${cy}" r="16" fill="#D62828"/>`;
  const times = ['2:50', '3:50', '10:14', '9:50'];
  const answer = `${h}:${String(m).padStart(2, '0')}`;
  if (!times.includes(answer)) throw new Error('answer must be an option');
  return defineCard({
    id: 'clock-no-numbers',
    title: 'No numbers',
    category: 'reading',
    difficulty: 3,
    prompt: 'What time is it?',
    kind: 'buttons',
    svg: svgDoc(body, '#E3E8DC'),
    options: times.map((t) => ({ id: `t${t.replace(':', '')}`, label: t, jev: `${t}.` })),
    answer: `t${answer.replace(':', '')}`,
    explain: 'The long minute hand points at the 10 mark (50 minutes), and the short hour hand is just short of 3, so it is still 2:50.',
    jev: {
      context: 'An analog clock with tick marks but no numbers; the red mark is at 12.',
      instructions: 'What time does the clock in `card` show?',
    },
    source: 'drawn',
  });
})();

// 9. A chain of meshing gears: each one turns the opposite way to its neighbor.
const gearChain = (() => {
  const radii = [96, 66, 110, 60, 90, 74];
  const turns = [-35, 40, -40, 38, -35];
  const a = 11; // tooth height above and below the pitch circle
  const gears: { x: number; y: number; r: number; n: number; th: number }[] = [];
  let x = 160, y = 430;
  radii.forEach((r, i) => {
    if (i > 0) {
      const d = radii[i - 1] + r, ang = rad(turns[i - 1]);
      x += d * Math.cos(ang);
      y += d * Math.sin(ang);
    }
    gears.push({ x, y, r, n: Math.max(8, Math.round((2 * Math.PI * r) / 34)), th: 0 });
  });
  // Phase each gear so a tooth of one meets a gap of the next at the contact point.
  for (let i = 1; i < gears.length; i++) {
    const g0 = gears[i - 1], g1 = gears[i];
    const phi = Math.atan2(g1.y - g0.y, g1.x - g0.x);
    const p0 = (2 * Math.PI) / g0.n, p1 = (2 * Math.PI) / g1.n;
    const t = ((((phi - g0.th) % p0) + p0) % p0) / p0;
    g1.th = phi + Math.PI - (0.5 - t) * p1;
  }
  for (let i = 0; i < gears.length; i++)
    for (let j = i + 2; j < gears.length; j++)
      if (Math.hypot(gears[i].x - gears[j].x, gears[i].y - gears[j].y) < gears[i].r + gears[j].r + 2 * a + 16) throw new Error(`gears ${i} and ${j} touch`);
  for (const g of gears) if (g.x - g.r - a < 10 || g.x + g.r + a > W - 10 || g.y - g.r - a < 10 || g.y + g.r + a > H - 10) throw new Error('gear off the card');
  const fills = ['#E9C46A', '#8AB17D', '#F4A261', '#2A9D8F', '#E76F51', '#9DB4C0'];
  let body = '';
  gears.forEach((g, i) => {
    const p = (2 * Math.PI) / g.n, pts: string[] = [];
    for (let k = 0; k < g.n; k++) {
      const t = g.th + k * p;
      for (const [f, rr] of [[-0.5, g.r - a], [-0.27, g.r - a], [-0.15, g.r + a], [0.15, g.r + a], [0.27, g.r - a]] as const)
        pts.push(`${f1(g.x + rr * Math.cos(t + f * p))},${f1(g.y + rr * Math.sin(t + f * p))}`);
    }
    body += `<polygon points="${pts.join(' ')}" fill="${fills[i]}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
    body += `<circle cx="${f1(g.x)}" cy="${f1(g.y)}" r="${f1(i === gears.length - 1 ? g.r * 0.45 : g.r * 0.22)}" fill="#F7F3EA" stroke="${INK}" stroke-width="3"/>`;
  });
  // A clockwise arrow over the first gear (in screen coordinates, clockwise is increasing angle).
  const g0 = gears[0], ar = g0.r + a + 24, a1 = rad(-178), a2 = rad(-98);
  const ex = g0.x + ar * Math.cos(a2), ey = g0.y + ar * Math.sin(a2);
  const tx = -Math.sin(a2), ty = Math.cos(a2); // clockwise tangent
  const nx = Math.cos(a2), ny = Math.sin(a2);
  body += `<path d="M${f1(g0.x + ar * Math.cos(a1))},${f1(g0.y + ar * Math.sin(a1))} A${ar},${ar} 0 0 1 ${f1(ex)},${f1(ey)}" fill="none" stroke="#D62828" stroke-width="9"/>`;
  body += `<polygon points="${f1(ex + tx * 30)},${f1(ey + ty * 30)} ${f1(ex + nx * 18)},${f1(ey + ny * 18)} ${f1(ex - nx * 18)},${f1(ey - ny * 18)}" fill="#D62828"/>`;
  const last = gears[gears.length - 1];
  body += `<text x="${f1(last.x)}" y="${f1(last.y + 20)}" text-anchor="middle" ${FONT} font-weight="bold" font-size="56" fill="${INK}">?</text>`;
  const lastClockwise = gears.length % 2 === 1;
  return defineCard({
    id: 'gear-chain',
    title: 'Gear train',
    category: 'logic',
    difficulty: 2,
    prompt: 'The first gear turns clockwise. Which way does the last gear turn?',
    kind: 'buttons',
    svg: svgDoc(body, '#F7F3EA'),
    options: [
      { id: 'cw', label: 'Clockwise', jev: 'Clockwise.' },
      { id: 'ccw', label: 'Counterclockwise', jev: 'Counterclockwise.' },
    ],
    answer: lastClockwise ? 'cw' : 'ccw',
    explain: `Each gear turns the opposite way to the one driving it. There are ${gears.length} gears in the chain, so the last one turns ${lastClockwise ? 'clockwise' : 'counterclockwise'}.`,
    jev: {
      context: 'A chain of meshing gears; a red arrow shows the first gear on the left turning clockwise, and the last gear is marked with a question mark.',
      instructions: 'In `card`, the gear with the red arrow turns clockwise. Which way does the gear marked with a question mark turn?',
    },
    source: 'drawn',
  });
})();

// 10. Two balance scales: the heaviest shape is drawn the smallest.
const balanceHeaviest = (() => {
  type Kind = 'square' | 'circle' | 'triangle';
  const weight: Record<Kind, number> = { square: 3, circle: 2, triangle: 1 };
  const look: Record<Kind, { size: number; fill: string }> = {
    square: { size: 38, fill: '#1F5FD6' },
    circle: { size: 64, fill: '#E76F51' },
    triangle: { size: 58, fill: '#E9C46A' },
  };
  const shape = (k: Kind, x: number, yb: number, size: number) => {
    const st = `fill="${look[k].fill}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
    if (k === 'square') return `<rect x="${f1(x - size / 2)}" y="${f1(yb - size)}" width="${size}" height="${size}" ${st}/>`;
    if (k === 'circle') return `<circle cx="${f1(x)}" cy="${f1(yb - size / 2)}" r="${size / 2}" ${st}/>`;
    return `<polygon points="${f1(x - size / 2)},${f1(yb)} ${f1(x + size / 2)},${f1(yb)} ${f1(x)},${f1(yb - size * 0.9)}" ${st}/>`;
  };
  const scale = (cx: number, left: Kind, right: Kind) => {
    const py = 150, L = 150, tilt = rad(weight[right] > weight[left] ? 12 : weight[right] < weight[left] ? -12 : 0);
    if (weight[left] === weight[right]) throw new Error('scales must tip');
    let s = `<line x1="${cx}" y1="${py}" x2="${cx}" y2="370" stroke="${INK}" stroke-width="10"/><polygon points="${cx - 60},390 ${cx + 60},390 ${cx},360" fill="${INK}"/>`;
    s += `<line x1="${f1(cx - L * Math.cos(tilt))}" y1="${f1(py - L * Math.sin(tilt))}" x2="${f1(cx + L * Math.cos(tilt))}" y2="${f1(py + L * Math.sin(tilt))}" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>`;
    s += `<circle cx="${cx}" cy="${py}" r="11" fill="#D62828"/>`;
    for (const [side, k] of [[-1, left], [1, right]] as const) {
      const ex = cx + side * L * Math.cos(tilt), ey = py + side * L * Math.sin(tilt), pan = ey + 90;
      s += `<line x1="${f1(ex)}" y1="${f1(ey)}" x2="${f1(ex - 50)}" y2="${f1(pan)}" stroke="#555" stroke-width="3"/><line x1="${f1(ex)}" y1="${f1(ey)}" x2="${f1(ex + 50)}" y2="${f1(pan)}" stroke="#555" stroke-width="3"/>`;
      s += `<path d="M${f1(ex - 62)},${f1(pan)} Q${f1(ex)},${f1(pan + 34)} ${f1(ex + 62)},${f1(pan)} Z" fill="#9AA3AD" stroke="${INK}" stroke-width="3"/>`;
      s += shape(k, ex, pan, look[k].size);
    }
    return s;
  };
  let body = scale(250, 'triangle', 'circle') + scale(710, 'square', 'circle');
  body += `<line x1="40" y1="455" x2="${W - 40}" y2="455" stroke="#B9B2A3" stroke-width="3" stroke-dasharray="10 10"/>`;
  const row: Kind[] = ['circle', 'triangle', 'square'];
  const where = ['left', 'middle', 'right'];
  const options: Option[] = row.map((k, i) => {
    const x = 240 + i * 240;
    body += shape(k, x, 640, 110);
    return { id: k, label: k[0].toUpperCase() + k.slice(1), region: rectPx(x - 100, 500, 200, 170), jev: `The shape on the ${where[i]} of the bottom row.` };
  });
  const heaviest = row.reduce((a, b) => (weight[b] > weight[a] ? b : a));
  return defineCard({
    id: 'balance-heaviest',
    title: 'Weigh it up',
    category: 'logic',
    difficulty: 2,
    prompt: 'Which shape is heaviest?',
    kind: 'pick',
    svg: svgDoc(body, '#F4F1EA'),
    options,
    answer: heaviest,
    explain: 'The circle outweighs the triangle on the left scale, and the small square outweighs the circle on the right scale, so the square is heaviest despite its size.',
    jev: {
      context: 'Two balance scales with shapes in their pans at the top, and the same three shapes in a row at the bottom.',
      instructions: 'Judging by how the scales in `card` tip, which shape in the bottom row is the heaviest?',
    },
    source: 'drawn',
  });
})();

// 11. A maze with three entrances; only one reaches the star (checked by BFS on the same walls that are drawn).
const mazeEntrance = (() => {
  const cols = 13, rows = 9, cs = 58, x0 = 110, y0 = 92;
  const id = (r: number, c: number) => r * cols + c;
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const open = new Set<string>();
  const nbrs = (n: number) => {
    const r = Math.floor(n / cols), c = n % cols, out: number[] = [];
    if (r > 0) out.push(n - cols);
    if (r < rows - 1) out.push(n + cols);
    if (c > 0) out.push(n - 1);
    if (c < cols - 1) out.push(n + 1);
    return out;
  };
  // A perfect maze by depth-first search.
  const rand = rng(90210), seen = new Set([0]), stack = [0];
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const next = nbrs(cur).filter((n) => !seen.has(n));
    if (!next.length) {
      stack.pop();
      continue;
    }
    const n = next[Math.floor(rand() * next.length)];
    open.add(key(cur, n));
    seen.add(n);
    stack.push(n);
  }
  const path = (from: number, to: number): number[] | null => {
    const prev = new Map<number, number>([[from, -1]]), q = [from];
    while (q.length) {
      const cur = q.shift()!;
      if (cur === to) {
        const p = [cur];
        while (prev.get(p[0])! >= 0) p.unshift(prev.get(p[0])!);
        return p;
      }
      for (const n of nbrs(cur)) if (open.has(key(cur, n)) && !prev.has(n)) (prev.set(n, cur), q.push(n));
    }
    return null;
  };
  const star = id(4, 10);
  const ents = [
    { id: 'a', label: 'A', cell: id(2, 0), side: 'left', where: 'The entrance marked A on the left side.' },
    { id: 'b', label: 'B', cell: id(0, 7), side: 'top', where: 'The entrance marked B on the top side.' },
    { id: 'c', label: 'C', cell: id(rows - 1, 3), side: 'bottom', where: 'The entrance marked C on the bottom side.' },
  ] as const;
  const answer = 'c';
  const good = path(ents.find((e) => e.id === answer)!.cell, star)!;
  const goodEdges = new Set(good.slice(1).map((n, i) => key(good[i], n)));
  for (const e of ents) {
    if (e.id === answer) continue;
    const p = path(e.cell, star);
    if (!p) continue;
    const edges = p.slice(1).map((n, i) => key(p[i], n)).filter((k) => !goodEdges.has(k));
    if (!edges.length) throw new Error(`entrance ${e.label} lies on the answer's path`);
    open.delete(edges[Math.floor(edges.length / 2)]);
  }
  for (const e of ents) if (!!path(e.cell, star) !== (e.id === answer)) throw new Error(`maze check failed at ${e.label}`);
  // Walls.
  const mw = cols * cs, mh = rows * cs;
  const seg = (xa: number, ya: number, xb: number, yb: number) => `M${xa},${ya}L${xb},${yb}`;
  let d = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * cs, y = y0 + r * cs;
      if (c < cols - 1 && !open.has(key(id(r, c), id(r, c + 1)))) d += seg(x + cs, y, x + cs, y + cs);
      if (r < rows - 1 && !open.has(key(id(r, c), id(r + 1, c)))) d += seg(x, y + cs, x + cs, y + cs);
    }
  // Border with gaps at the entrances.
  for (let c = 0; c < cols; c++) {
    if (!ents.some((e) => e.side === 'top' && e.cell === id(0, c))) d += seg(x0 + c * cs, y0, x0 + (c + 1) * cs, y0);
    if (!ents.some((e) => e.side === 'bottom' && e.cell === id(rows - 1, c))) d += seg(x0 + c * cs, y0 + mh, x0 + (c + 1) * cs, y0 + mh);
  }
  for (let r = 0; r < rows; r++) {
    if (!ents.some((e) => e.side === 'left' && e.cell === id(r, 0))) d += seg(x0, y0 + r * cs, x0, y0 + (r + 1) * cs);
    d += seg(x0 + mw, y0 + r * cs, x0 + mw, y0 + (r + 1) * cs);
  }
  let body = `<rect x="${x0}" y="${y0}" width="${mw}" height="${mh}" fill="#FFFFFF"/><path d="${d}" stroke="${INK}" stroke-width="7" stroke-linecap="square" fill="none"/>`;
  const sr = star, sx = x0 + ((sr % cols) + 0.5) * cs, sy = y0 + (Math.floor(sr / cols) + 0.5) * cs;
  const starPts = Array.from({ length: 10 }, (_, i) => {
    const rr = i % 2 ? 10 : 24, t = rad(i * 36 - 90);
    return `${f1(sx + rr * Math.cos(t))},${f1(sy + rr * Math.sin(t))}`;
  }).join(' ');
  body += `<polygon points="${starPts}" fill="#F2B705" stroke="${INK}" stroke-width="2"/>`;
  const options: Option[] = ents.map((e) => {
    const r = Math.floor(e.cell / cols), c = e.cell % cols;
    let lx: number, ly: number;
    if (e.side === 'left') ((lx = x0 - 50), (ly = y0 + (r + 0.5) * cs));
    else if (e.side === 'top') ((lx = x0 + (c + 0.5) * cs), (ly = y0 - 34));
    else ((lx = x0 + (c + 0.5) * cs), (ly = y0 + mh + 34));
    body += `<circle cx="${lx}" cy="${ly}" r="27" fill="#1F5FD6"/><text x="${lx}" y="${ly + 13}" text-anchor="middle" ${FONT} font-weight="bold" font-size="38" fill="#FFFFFF">${e.label}</text>`;
    return { id: e.id, label: `Entrance ${e.label}`, region: rectPx(lx - 45, ly - 45, 90, 90), jev: e.where };
  });
  return defineCard({
    id: 'maze-entrance',
    title: 'Find the way in',
    category: 'logic',
    difficulty: 3,
    prompt: 'Which entrance leads to the star?',
    kind: 'pick',
    svg: svgDoc(body, '#DCE8E0'),
    options,
    answer,
    explain: `Only the path from entrance ${answer.toUpperCase()} reaches the star; the other two entrances run into dead ends.`,
    jev: {
      context: 'A square-grid maze with three entrances marked A, B and C and a yellow star inside.',
      instructions: 'In `card`, which entrance has a path through the maze to the star?',
    },
    source: 'drawn',
  });
})();

// 12. Which silhouette is the shape's? The others are mirrored, missing a block or have a block moved.
const shadowMatch = (() => {
  type Cells = [number, number][];
  const base: Cells = [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3]];
  const norm = (cs: Cells) => {
    const mx = Math.min(...cs.map((c) => c[0])), my = Math.min(...cs.map((c) => c[1]));
    return cs.map(([x, y]) => `${x - mx},${y - my}`).sort().join(' ');
  };
  const maxX = Math.max(...base.map((c) => c[0]));
  const variants: { cells: Cells; note: string }[] = [
    { cells: base.map(([x, y]) => [maxX - x, y]), note: 'mirrored' },
    { cells: base.filter(([x, y]) => !(x === 0 && y === 1)), note: 'missing a block' },
    { cells: base, note: 'exact' },
    { cells: base.map(([x, y]) => (x === 2 && y === 0 ? [0, 0] : [x, y])), note: 'one block moved' },
  ];
  const exactIdx = variants.findIndex((v) => v.note === 'exact');
  variants.forEach((v, i) => {
    if (i !== exactIdx && norm(v.cells) === norm(base)) throw new Error(`variant ${v.note} matches the shape`);
  });
  const draw = (cs: Cells, x: number, y: number, s: number, fill: string, grid: boolean) =>
    cs.map(([cx, cy]) => `<rect x="${x + cx * s}" y="${y + cy * s}" width="${s + (grid ? 0 : 0.6)}" height="${s + (grid ? 0 : 0.6)}" fill="${fill}"${grid ? ` stroke="${INK}" stroke-width="3"` : ''}/>`).join('');
  const big = 46;
  let body = `<rect x="0" y="0" width="${W}" height="300" fill="#FFF6E5"/>`;
  body += draw(base, 480 - 2 * big, 40, big, '#E76F51', true);
  const pos = ['far left', 'second from the left', 'second from the right', 'far right'];
  const small = 32;
  const options: Option[] = variants.map((v, i) => {
    const cx = 120 + i * 240;
    body += `<rect x="${cx - 105}" y="390" width="210" height="250" rx="14" fill="#E4E1DA"/>`;
    body += draw(v.cells, cx - 2 * small, 515 - 2 * small, small, '#222222', false);
    return { id: `s${i}`, label: `The ${v.note} shadow`, region: rectPx(cx - 105, 390, 210, 250), jev: `The silhouette ${pos[i]}.` };
  });
  return defineCard({
    id: 'shadow-match',
    title: 'Whose shadow',
    category: 'logic',
    difficulty: 2,
    prompt: 'Tap the silhouette that matches the shape.',
    kind: 'pick',
    svg: svgDoc(body, '#F4F1EA'),
    options,
    answer: `s${exactIdx}`,
    explain: 'Only that silhouette has the same blocks in the same places; the others are mirrored, missing a block or have a block moved.',
    jev: {
      context: 'An orange shape made of square blocks at the top, and four black silhouettes below, all drawn the same way up.',
      instructions: 'In `card`, which of the four black silhouettes has exactly the outline of the orange shape (same way up, not mirrored)?',
    },
    source: 'drawn',
  });
})();

// 13. What comes next: an arrow turning a quarter turn clockwise, alternating red and blue.
const sequenceNext = (() => {
  const colors = { red: '#D62828', blue: '#1F5FD6' };
  const arrow = (x: number, y: number, deg: number, color: string) =>
    `<polygon points="0,-52 40,-8 15,-8 15,50 -15,50 -15,-8 -40,-8" fill="${color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round" transform="translate(${x} ${y}) rotate(${deg})"/>`;
  const step = (i: number) => ({ deg: (i * 90) % 360, color: i % 2 ? 'blue' : 'red' }) as { deg: number; color: keyof typeof colors };
  let body = '';
  for (let i = 0; i < 5; i++) {
    const x = 160 + i * 160, y = 190;
    body += `<rect x="${x - 70}" y="${y - 70}" width="140" height="140" rx="12" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/>`;
    if (i < 4) body += arrow(x, y, step(i).deg, colors[step(i).color]);
    else body += `<text x="${x}" y="${y + 30}" text-anchor="middle" ${FONT} font-weight="bold" font-size="86" fill="${INK}">?</text>`;
  }
  const want = step(4);
  const cands: { deg: number; color: keyof typeof colors }[] = [
    { deg: 0, color: 'blue' },
    { deg: 180, color: 'red' },
    { deg: want.deg, color: want.color },
    { deg: 270, color: 'red' },
  ];
  const dirName = (deg: number) => ({ 0: 'up', 90: 'right', 180: 'down', 270: 'left' })[deg as 0];
  const pos = ['far left', 'second from the left', 'second from the right', 'far right'];
  body += `<line x1="60" y1="330" x2="${W - 60}" y2="330" stroke="#B9B2A3" stroke-width="3" stroke-dasharray="10 10"/>`;
  const options: Option[] = cands.map((c, i) => {
    const x = 210 + i * 180, y = 500;
    body += `<rect x="${x - 75}" y="${y - 75}" width="150" height="150" rx="12" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/>`;
    body += arrow(x, y, c.deg, colors[c.color]);
    return { id: `o${i}`, label: `${c.color[0].toUpperCase() + c.color.slice(1)} arrow pointing ${dirName(c.deg)}`, region: rectPx(x - 85, y - 85, 170, 170), jev: `The choice ${pos[i]} in the bottom row.` };
  });
  const ans = cands.findIndex((c) => c.deg === want.deg && c.color === want.color);
  if (cands.filter((c) => c.deg === want.deg && c.color === want.color).length !== 1) throw new Error('one right choice');
  return defineCard({
    id: 'sequence-next',
    title: 'What comes next',
    category: 'logic',
    difficulty: 1,
    prompt: 'What comes next?',
    kind: 'pick',
    svg: svgDoc(body, '#F4F1EA'),
    options,
    answer: `o${ans}`,
    explain: `The arrow turns a quarter turn clockwise each step and the color alternates red, blue, so the fifth is a ${want.color} arrow pointing ${dirName(want.deg)}.`,
    jev: {
      context: 'A row of four arrows followed by a question mark, and four candidate arrows in a row below.',
      instructions: 'In `card`, which of the four choices in the bottom row comes next in the top sequence?',
    },
    source: 'drawn',
  });
})();

// 14. Spot the difference: two copies of a scene, one shape recolored on the right.
const spotDifference = (() => {
  const rand = rng(5150);
  const pw = 440, ph = 600, lx = 20, rx = 500, py = 60;
  const palette = ['#E76F51', '#2A9D8F', '#E9C46A', '#8AB17D', '#1F5FD6', '#7B2CBF'];
  const kinds = ['circle', 'square', 'triangle', 'star'] as const;
  const shapes: { k: (typeof kinds)[number]; x: number; y: number; r: number; a: number; c: number }[] = [];
  let tries = 0;
  while (shapes.length < 13) {
    if (++tries > 50000) throw new Error('could not place shapes');
    const r = 26 + rand() * 24, x = 20 + r + rand() * (pw - 40 - 2 * r), y = 20 + r + rand() * (ph - 40 - 2 * r);
    if (shapes.some((s) => Math.hypot(s.x - x, s.y - y) < s.r + r + 16)) continue;
    shapes.push({ k: kinds[shapes.length % 4], x, y, r, a: Math.round(rand() * 90), c: shapes.length % palette.length });
  }
  // The difference: one triangle turned by 60 degrees, so it points the other way.
  const odd = shapes.findIndex((s, i) => i >= 3 && s.k === 'triangle' && s.r > 32);
  if (odd < 0) throw new Error('no triangle big enough to turn');
  const draw = (s: (typeof shapes)[number], ox: number, color: string, turn = 0) => {
    const st = `fill="${color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
    const x = ox + s.x, y = py + s.y, r = s.r;
    if (s.k === 'circle') return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" ${st}/>`;
    const n = s.k === 'square' ? 4 : s.k === 'triangle' ? 3 : 10;
    const pts = Array.from({ length: n }, (_, i) => {
      const rr = s.k === 'star' && i % 2 ? r * 0.45 : r * (s.k === 'square' ? 0.9 : 1);
      const t = rad(s.a + turn + (i * 360) / n - 90);
      return `${f1(x + rr * Math.cos(t))},${f1(y + rr * Math.sin(t))}`;
    });
    return `<polygon points="${pts.join(' ')}" ${st}/>`;
  };
  let body = '';
  for (const ox of [lx, rx]) body += `<rect x="${ox}" y="${py}" width="${pw}" height="${ph}" rx="12" fill="#FFFFFF" stroke="${INK}" stroke-width="4"/>`;
  shapes.forEach((s, i) => {
    body += draw(s, lx, palette[s.c]);
    body += draw(s, rx, palette[s.c], i === odd ? 60 : 0);
  });
  const s = shapes[odd], m = s.r + 18;
  return defineCard({
    id: 'spot-difference',
    title: 'Spot the difference',
    category: 'logic',
    difficulty: 2,
    prompt: 'Tap the one difference between the two pictures.',
    kind: 'point',
    svg: svgDoc(body, '#E4E1DA'),
    target: rectsPx([[lx + s.x - m, py + s.y - m, 2 * m, 2 * m], [rx + s.x - m, py + s.y - m, 2 * m, 2 * m]]),
    explain: `The two pictures are identical except for one triangle, which is turned to point the other way on the right.`,
    jev: {
      context: 'Two side-by-side pictures of the same scatter of colored shapes.',
      instructions: 'The two halves of `card` differ in exactly one place. Where is the difference?',
    },
    source: 'drawn',
  });
})();

const cards: CardSpec[] = [
  ponzoRails, shadowChecker, oddShade, swatchMatch, countRedDots, countCubes, romanBiggest,
  clockNoNumbers, gearChain, balanceHeaviest, mazeEntrance, shadowMatch, sequenceNext, spotDifference,
];
export default cards;
