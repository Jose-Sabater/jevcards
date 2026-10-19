/**
 * Perception cards: color words, classic size illusions, a mirrored shape hunt and numbers in misleading sizes.
 * Everything is drawn from fixed coordinates (or a seeded PRNG), so rebuilding gives the same pictures.
 */
import { defineCard, esc, rectPx, svgDoc, W, type CardSpec, type Option } from './lib.ts';

const FONT = `font-family="Arial, Helvetica, sans-serif"`;

const INK = {
  red: '#D62828',
  blue: '#1F5FD6',
  green: '#1E9E3A',
  purple: '#7B2CBF',
  orange: '#F27A00',
} as const;

/** Deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1. The word ORANGE in green ink.
const stroopInk = defineCard({
  id: 'stroop-ink',
  title: 'Ink, not word',
  category: 'colors',
  difficulty: 1,
  prompt: 'What color is the ink?',
  kind: 'buttons',
  svg: svgDoc(
    `<text x="${W / 2}" y="420" text-anchor="middle" ${FONT} font-weight="bold" font-size="170" letter-spacing="8" fill="${INK.green}">ORANGE</text>`,
    '#F7F5EF',
  ),
  options: [
    { id: 'orange', label: 'Orange', jev: 'Orange.' },
    { id: 'green', label: 'Green', jev: 'Green.' },
    { id: 'blue', label: 'Blue', jev: 'Blue.' },
    { id: 'purple', label: 'Purple', jev: 'Purple.' },
  ],
  answer: 'green',
  explain: 'The word says ORANGE but it is printed in green ink: the Stroop effect makes reading get in the way of naming the color.',
  jev: {
    context: 'A single color word printed in colored ink on a plain background.',
    instructions: 'What color is the ink of the word in `card`?',
  },
  source: 'drawn',
});

// 2. Eight color words in clashing inks: find the one that says BLUE.
const stroopWord = (() => {
  // Four rows of two words.
  const rows: [string, keyof typeof INK][][] = [
    [['RED', 'blue'], ['GREEN', 'red']],
    [['PURPLE', 'green'], ['ORANGE', 'blue']],
    [['GREEN', 'orange'], ['BLUE', 'red']],
    [['RED', 'purple'], ['PURPLE', 'blue']],
  ];
  const rowName = ['top row', 'second row', 'third row', 'bottom row'];
  const colName = ['on the left', 'on the right'];
  let body = '';
  const options: Option[] = [];
  rows.forEach((row, r) =>
    row.forEach(([word, ink], c) => {
      const cx = 260 + c * 440;
      const cy = 135 + r * 150;
      body += `<text x="${cx}" y="${cy + 26}" text-anchor="middle" ${FONT} font-weight="bold" font-size="76" fill="${INK[ink]}">${word}</text>`;
      options.push({
        id: `r${r}c${c}`,
        label: `${word} in ${ink} ink`,
        region: rectPx(cx - 200, cy - 65, 400, 130),
        jev: `The word in the ${rowName[r]}, ${colName[c]}.`,
      });
    }),
  );
  return defineCard({
    id: 'stroop-word',
    title: 'Read the word',
    category: 'colors',
    difficulty: 2,
    prompt: 'Tap the word that says BLUE.',
    kind: 'pick',
    svg: svgDoc(body, '#F7F5EF'),
    options,
    answer: 'r2c1',
    explain: 'BLUE is printed in red ink, while three other words are printed in blue ink to pull your eye away (a Stroop twist).',
    jev: {
      context: 'Eight color words in four rows of two, each printed in a colored ink.',
      instructions: 'Which word in `card` spells the word BLUE?',
    },
    source: 'drawn',
  });
})();

// 3. Muller-Lyer: two identical blue shafts, one with inward fins, one with outward fins.
const mullerLyer = (() => {
  const x1 = 260, x2 = 700, fin = 60, spread = 48;
  const shaft = (y: number) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#1F5FD6" stroke-width="9" stroke-linecap="round"/>`;
  const fins = (y: number, dir: 1 | -1) => {
    // dir 1: arrowheads (fins point back over the shaft); dir -1: tails (fins splay outward).
    const s = `stroke="#333" stroke-width="9" stroke-linecap="round"`;
    return [
      [x1, x1 + dir * fin],
      [x2, x2 - dir * fin],
    ]
      .map(([x, fx]) => `<line x1="${x}" y1="${y}" x2="${fx}" y2="${y - spread}" ${s}/><line x1="${x}" y1="${y}" x2="${fx}" y2="${y + spread}" ${s}/>`)
      .join('');
  };
  return defineCard({
    id: 'muller-lyer',
    title: 'Fins',
    category: 'illusions',
    difficulty: 2,
    prompt: 'Tap the longer blue line, or say they are the same.',
    kind: 'pick',
    svg: svgDoc(fins(220, 1) + shaft(220) + fins(500, -1) + shaft(500), '#FBF8F1'),
    options: [
      { id: 'top', label: 'Top', region: rectPx(180, 150, 600, 140), jev: 'The top blue line.' },
      { id: 'bottom', label: 'Bottom', region: rectPx(180, 430, 600, 140), jev: 'The bottom blue line.' },
      { id: 'same', label: 'Same length', jev: 'Same length.' },
    ],
    answer: 'same',
    explain: 'Both blue lines are exactly 440 pixels long: the Muller-Lyer illusion makes the one with outward fins look longer.',
    jev: {
      context: 'Two horizontal blue lines, each with gray fins at both ends.',
      instructions: 'In `card`, which of the two blue lines is longer, or are they the same length?',
    },
    source: 'drawn',
  });
})();

// 4. Ebbinghaus with a twist: the left orange circle really is bigger (radius 50 vs 44).
const ebbinghaus = (() => {
  const ring = (cx: number, cy: number, n: number, d: number, r: number) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * 2 * Math.PI - Math.PI / 2;
      return `<circle cx="${(cx + d * Math.cos(a)).toFixed(1)}" cy="${(cy + d * Math.sin(a)).toFixed(1)}" r="${r}" fill="#9AA3AD"/>`;
    }).join('');
  const body =
    ring(260, 360, 6, 150, 68) +
    `<circle cx="260" cy="360" r="50" fill="#F27A00"/>` +
    ring(700, 360, 8, 82, 18) +
    `<circle cx="700" cy="360" r="44" fill="#F27A00"/>`;
  return defineCard({
    id: 'ebbinghaus',
    title: 'Big neighbours',
    category: 'illusions',
    difficulty: 3,
    prompt: 'Tap the bigger orange circle, or say they are the same.',
    kind: 'pick',
    svg: svgDoc(body, '#FFFFFF'),
    options: [
      { id: 'left', label: 'Left', region: rectPx(40, 140, 440, 440), jev: 'The left orange circle.' },
      { id: 'right', label: 'Right', region: rectPx(560, 220, 280, 280), jev: 'The right orange circle.' },
      { id: 'same', label: 'Same size', jev: 'Same size.' },
    ],
    answer: 'left',
    explain: 'The left circle is really bigger (radius 50 against 44), but big neighbours shrink it to the eye: the Ebbinghaus illusion, with a twist.',
    jev: {
      context: 'Two orange circles, each surrounded by a ring of gray circles.',
      instructions: 'In `card`, which orange circle is bigger, or are they the same size?',
    },
    source: 'drawn',
  });
})();

// 5. Odd one out: 24 rotated F shapes, one of them mirrored.
const oddOneOut = (() => {
  const cols = 6, rows = 4, cw = 140, ch = 150, x0 = (W - cols * cw) / 2, y0 = 60;
  const odd = { r: 2, c: 4 };
  // An F in a 60 x 80 box centred on the origin.
  const F: [number, number][] = [[0, 0], [60, 0], [60, 18], [20, 18], [20, 34], [48, 34], [48, 52], [20, 52], [20, 80], [0, 80]];
  const pts = (mirror: boolean) => F.map(([x, y]) => `${((mirror ? 60 - x : x) - 30).toFixed(0)},${y - 40}`).join(' ');
  const rand = rng(1714);
  let body = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const angle = Math.round(rand() * 360);
      const cx = x0 + c * cw + cw / 2, cy = y0 + r * ch + ch / 2;
      const mirror = r === odd.r && c === odd.c;
      body += `<polygon points="${pts(mirror)}" transform="translate(${cx} ${cy}) rotate(${angle})" fill="#1B7F86"/>`;
    }
  return defineCard({
    id: 'odd-one-out',
    title: 'Mirror image',
    category: 'logic',
    difficulty: 3,
    prompt: 'One shape is a mirror image. Tap it.',
    kind: 'point',
    svg: svgDoc(body, '#F4F1EA'),
    target: rectPx(x0 + odd.c * cw, y0 + odd.r * ch, cw, ch),
    explain: 'Every shape is the same F turned to a different angle, except the one in the third row, fifth column, which is flipped and cannot be turned into the others.',
    jev: {
      context: 'A grid of 24 identical teal shapes, each turned to a different angle.',
      instructions: 'In `card`, one shape is a mirror image of the others rather than just a rotation. Where is it?',
    },
    source: 'drawn',
  });
})();

// 6. Biggest number: the biggest value is in the smallest font.
const biggestNumber = (() => {
  const nums: { n: string; x: number; y: number; fs: number; color: string; where: string }[] = [
    { n: '9', x: 170, y: 380, fs: 300, color: '#2B2D42', where: 'The number on the far left.' },
    { n: '88', x: 520, y: 250, fs: 170, color: '#D62828', where: 'The number at the top middle.' },
    { n: '101', x: 830, y: 170, fs: 70, color: '#1F5FD6', where: 'The number in the top right corner.' },
    { n: '640', x: 790, y: 470, fs: 100, color: '#1E9E3A', where: 'The number on the right, halfway down.' },
    { n: '998', x: 410, y: 600, fs: 130, color: '#7B2CBF', where: 'The number at the bottom, left of center.' },
    { n: '1012', x: 760, y: 650, fs: 34, color: '#F27A00', where: 'The small number at the bottom right.' },
  ];
  let body = '';
  const options: Option[] = nums.map((d) => {
    body += `<text x="${d.x}" y="${d.y}" text-anchor="middle" ${FONT} font-weight="bold" font-size="${d.fs}" fill="${d.color}">${esc(d.n)}</text>`;
    const w = Math.max(d.n.length * 0.6 * d.fs + 24, 110);
    const h = Math.max(0.76 * d.fs + 24, 70);
    return { id: `n${d.n}`, label: d.n, region: rectPx(d.x - w / 2, d.y - 0.72 * d.fs - (h - 0.72 * d.fs) / 2, w, h), jev: d.where };
  });
  return defineCard({
    id: 'biggest-number',
    title: 'Size is not value',
    category: 'reading',
    difficulty: 1,
    prompt: 'Tap the biggest number.',
    kind: 'pick',
    svg: svgDoc(body, '#FBF8F1'),
    options,
    answer: 'n1012',
    explain: '1012 is the biggest value even though it is printed the smallest; the huge 9 is the smallest number.',
    jev: {
      context: 'Six whole numbers printed in very different font sizes.',
      instructions: 'Which number in `card` has the largest value?',
    },
    source: 'drawn',
  });
})();

const cards: CardSpec[] = [stroopInk, stroopWord, mullerLyer, ebbinghaus, oddOneOut, biggestNumber];
export default cards;
