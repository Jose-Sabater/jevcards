/**
 * Puzzle cards: counting shapes, reading a clock, adding dice and following tangled kite strings.
 * Everything is drawn from fixed coordinates, so rebuilding gives the same pictures.
 */
import { defineCard, rectPx, svgDoc, W, type CardSpec, type Option } from './lib.ts';

const FONT = `font-family="Arial, Helvetica, sans-serif"`;
const rad = (deg: number) => (deg * Math.PI) / 180;

// 1. Count the triangles among circles and squares.
const countTriangles = (() => {
  const stroke = `stroke="#2B2D42" stroke-width="3" stroke-linejoin="round"`;
  const circles: [number, number, number, string][] = [
    [275, 165, 48, '#F4A261'], [600, 110, 36, '#2A9D8F'], [880, 290, 52, '#E76F51'], [420, 330, 34, '#8AB17D'],
    [90, 330, 40, '#2A9D8F'], [650, 478, 44, '#E9C46A'], [400, 640, 38, '#E76F51'], [860, 615, 30, '#F4A261'],
  ];
  const squares: [number, number, number, number, string][] = [
    [180, 230, 80, 15, '#E9C46A'], [520, 230, 70, 40, '#E76F51'], [740, 300, 90, 0, '#8AB17D'],
    [300, 448, 60, 30, '#2A9D8F'], [90, 520, 70, 10, '#F4A261'], [810, 545, 64, 25, '#2A9D8F'], [560, 650, 50, 0, '#8AB17D'],
  ];
  const triangles: [number, number, number, number, string][] = [
    [120, 110, 62, 0, '#E76F51'], [440, 150, 46, 35, '#2A9D8F'], [770, 110, 70, 180, '#E9C46A'],
    [250, 380, 56, 70, '#8AB17D'], [560, 390, 80, 15, '#F4A261'], [880, 430, 42, 200, '#E76F51'],
    [200, 620, 52, 100, '#2A9D8F'], [720, 600, 64, 250, '#E9C46A'],
  ];
  let body = '';
  for (const [x, y, r, f] of circles) body += `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${stroke}/>`;
  for (const [x, y, s, a, f] of squares)
    body += `<rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" fill="${f}" ${stroke} transform="translate(${x} ${y}) rotate(${a})"/>`;
  for (const [x, y, r, a, f] of triangles) {
    const p = [0, 120, 240].map((d) => `${(r * Math.sin(rad(d + a))).toFixed(1)},${(-r * Math.cos(rad(d + a))).toFixed(1)}`).join(' ');
    body += `<polygon points="${p}" fill="${f}" ${stroke} transform="translate(${x} ${y})"/>`;
  }
  const n = triangles.length;
  return defineCard({
    id: 'count-triangles',
    title: 'Triangle count',
    category: 'counting',
    difficulty: 2,
    prompt: 'How many triangles?',
    kind: 'buttons',
    svg: svgDoc(body, '#FBF8F1'),
    options: [n - 2, n - 1, n, n + 1].map((k) => ({ id: `t${k}`, label: String(k), jev: `${k}.` })),
    answer: `t${n}`,
    explain: `There are ${n} triangles, in four colors and turned every which way among ${circles.length} circles and ${squares.length} squares.`,
    jev: {
      context: 'A scatter of colored circles, squares and triangles of different sizes.',
      instructions: 'How many triangles are there in `card`?',
    },
    source: 'drawn',
  });
})();

// 2. An analog clock at 4:40.
const clockTime = (() => {
  const cx = W / 2, cy = 360, R = 300;
  const h = 4, m = 40;
  let body = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#FFFFFF" stroke="#2B2D42" stroke-width="14"/>`;
  for (let i = 0; i < 60; i++) {
    const a = rad(i * 6), big = i % 5 === 0;
    const r1 = R - 18, r2 = R - (big ? 48 : 30);
    body += `<line x1="${(cx + r1 * Math.sin(a)).toFixed(1)}" y1="${(cy - r1 * Math.cos(a)).toFixed(1)}" x2="${(cx + r2 * Math.sin(a)).toFixed(1)}" y2="${(cy - r2 * Math.cos(a)).toFixed(1)}" stroke="#2B2D42" stroke-width="${big ? 7 : 3}"/>`;
  }
  for (let k = 1; k <= 12; k++) {
    const a = rad(k * 30), r = R - 92;
    body += `<text x="${(cx + r * Math.sin(a)).toFixed(1)}" y="${(cy - r * Math.cos(a) + 18).toFixed(1)}" text-anchor="middle" ${FONT} font-weight="bold" font-size="52" fill="#2B2D42">${k}</text>`;
  }
  const hand = (deg: number, len: number, width: number, color: string) =>
    `<line x1="${(cx - 26 * Math.sin(rad(deg))).toFixed(1)}" y1="${(cy + 26 * Math.cos(rad(deg))).toFixed(1)}" x2="${(cx + len * Math.sin(rad(deg))).toFixed(1)}" y2="${(cy - len * Math.cos(rad(deg))).toFixed(1)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  body += hand((h + m / 60) * 30, 140, 18, '#2B2D42');
  body += hand(m * 6, 245, 8, '#2B2D42');
  body += `<circle cx="${cx}" cy="${cy}" r="16" fill="#D62828"/>`;
  return defineCard({
    id: 'clock-time',
    title: 'Read the clock',
    category: 'reading',
    difficulty: 2,
    prompt: 'What time is it?',
    kind: 'buttons',
    svg: svgDoc(body, '#E9EEF3'),
    options: ['3:40', '4:40', '5:40', '8:20'].map((t) => ({ id: `t${t.replace(':', '')}`, label: t, jev: `${t}.` })),
    answer: 't440',
    explain: 'The long minute hand points at 8 (40 minutes) and the short hour hand sits two thirds of the way from 4 to 5, so it is 4:40.',
    jev: {
      context: 'An analog clock face with an hour hand and a minute hand.',
      instructions: 'What time does the clock in `card` show?',
    },
    source: 'drawn',
  });
})();

// 3. Three dice: 5 + 6 + 3 = 14.
const diceTotal = (() => {
  const pipsFor: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-1, -1], [1, 1]],
    3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  };
  const dice: { v: number; x: number; y: number; a: number; face: string; pip: string }[] = [
    { v: 5, x: 220, y: 350, a: -14, face: '#FFFFFF', pip: '#2B2D42' },
    { v: 6, x: 480, y: 390, a: 9, face: '#D62828', pip: '#FFFFFF' },
    { v: 3, x: 740, y: 340, a: 22, face: '#FFFFFF', pip: '#2B2D42' },
  ];
  const s = 180, g = 50;
  let body = '';
  for (const d of dice) {
    body += `<g transform="translate(${d.x} ${d.y}) rotate(${d.a})">`;
    body += `<rect x="${-s / 2 + 8}" y="${-s / 2 + 12}" width="${s}" height="${s}" rx="28" fill="#00000022"/>`;
    body += `<rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" rx="28" fill="${d.face}" stroke="#2B2D42" stroke-width="4"/>`;
    for (const [px, py] of pipsFor[d.v]) body += `<circle cx="${px * g}" cy="${py * g}" r="17" fill="${d.pip}"/>`;
    body += `</g>`;
  }
  const total = dice.reduce((a, d) => a + d.v, 0);
  return defineCard({
    id: 'dice-total',
    title: 'Roll',
    category: 'counting',
    difficulty: 1,
    prompt: 'What is the total?',
    kind: 'buttons',
    svg: svgDoc(body, '#2F6B4F'),
    options: [total - 1, total, total + 1, total + 2].map((k) => ({ id: `s${k}`, label: String(k), jev: `${k}.` })),
    answer: `s${total}`,
    explain: `The dice show ${dice.map((d) => d.v).join(', ')}, which add up to ${total}.`,
    jev: {
      context: 'Three dice lying on a green table.',
      instructions: 'What is the total of the pips showing on the dice in `card`?',
    },
    source: 'drawn',
  });
})();

// 4. Tangled kite strings.
const tangledStrings = (() => {
  /** Smooth path through points (Catmull-Rom as cubic Beziers). */
  const smooth = (p: [number, number][]) => {
    let d = `M${p[0][0]},${p[0][1]}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
    }
    return d;
  };
  const people = [150, 370, 590, 810];
  const handY = 520;
  const kites: { color: string; name: string; x: number; y: number; to: number; via: number[] }[] = [
    // via: x of the string at y = 250, 340, 430 on its way down
    { color: '#1F5FD6', name: 'blue', x: 150, y: 90, to: 2, via: [330, 560, 760] },
    { color: '#D62828', name: 'red', x: 380, y: 120, to: 3, via: [170, 260, 520] },
    { color: '#1E9E3A', name: 'green', x: 600, y: 80, to: 0, via: [820, 470, 300] },
    { color: '#E0A800', name: 'yellow', x: 820, y: 110, to: 1, via: [620, 820, 600] },
  ];
  let body = '';
  // clouds
  body += `<g fill="#FFFFFF" opacity="0.8"><ellipse cx="270" cy="60" rx="70" ry="22"/><ellipse cx="710" cy="200" rx="80" ry="24"/></g>`;
  // ground
  body += `<rect x="0" y="610" width="${W}" height="110" fill="#7CB66B"/>`;
  for (const k of kites) {
    const hx = people[k.to] + 50;
    body += `<path d="${smooth([[k.x, k.y + 52], [k.via[0], 250], [k.via[1], 340], [k.via[2], 430], [hx, handY]])}" fill="none" stroke="#3A3A3A" stroke-width="3"/>`;
  }
  for (const k of kites) {
    const { x, y } = k;
    body += `<path d="M${x},${y + 52} q-14,26 6,40 q20,14 -4,34" fill="none" stroke="${k.color}" stroke-width="3"/>`;
    body += `<polygon points="${x},${y - 48} ${x + 36},${y} ${x},${y + 52} ${x - 36},${y}" fill="${k.color}" stroke="#2B2D42" stroke-width="3"/>`;
    body += `<line x1="${x}" y1="${y - 48}" x2="${x}" y2="${y + 52}" stroke="#2B2D42" stroke-width="2"/><line x1="${x - 36}" y1="${y}" x2="${x + 36}" y2="${y}" stroke="#2B2D42" stroke-width="2"/>`;
  }
  const letters = ['A', 'B', 'C', 'D'];
  const options: Option[] = [];
  const pos = ['on the far left', 'second from the left', 'second from the right', 'on the far right'];
  people.forEach((px, i) => {
    const s = `stroke="#2B2D42" stroke-width="10" stroke-linecap="round"`;
    body += `<circle cx="${px - 8}" cy="550" r="26" fill="#F1C7A0" stroke="#2B2D42" stroke-width="3"/>`;
    body += `<line x1="${px}" y1="576" x2="${px}" y2="640" ${s}/>`;
    body += `<line x1="${px}" y1="595" x2="${px + 50}" y2="${handY}" ${s}/><line x1="${px}" y1="595" x2="${px - 30}" y2="625" ${s}/>`;
    body += `<line x1="${px}" y1="640" x2="${px - 20}" y2="690" ${s}/><line x1="${px}" y1="640" x2="${px + 20}" y2="690" ${s}/>`;
    body += `<circle cx="${px + 50}" cy="${handY}" r="8" fill="#F1C7A0" stroke="#2B2D42" stroke-width="3"/>`;
    body += `<text x="${px + 70}" y="700" text-anchor="middle" ${FONT} font-weight="bold" font-size="34" fill="#2B2D42">${letters[i]}</text>`;
    options.push({ id: letters[i].toLowerCase(), label: `Person ${letters[i]}`, region: rectPx(px - 60, 500, 160, 210), jev: `The person ${pos[i]}.` });
  });
  const red = kites.find((k) => k.name === 'red')!;
  return defineCard({
    id: 'tangled-strings',
    title: 'Tangled kites',
    category: 'logic',
    difficulty: 3,
    prompt: 'Who is holding the red kite?',
    kind: 'pick',
    svg: svgDoc(body, '#BFE3F7'),
    options,
    answer: letters[red.to].toLowerCase(),
    explain: `Follow the red kite's string: it crosses the others and ends in the hand of person ${letters[red.to]}.`,
    jev: {
      context: 'Four kites in the sky whose strings cross on the way down to four people standing on the grass.',
      instructions: 'In `card`, which person is holding the string of the red kite?',
    },
    source: 'drawn',
  });
})();

const cards: CardSpec[] = [countTriangles, clockTime, diceTotal, tangledStrings];
export default cards;
