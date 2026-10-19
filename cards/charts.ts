/**
 * Reading charts and gauges: bar, pie and line charts, a truncated axis, and the dials and scales of daily life
 * (thermometer, measuring jug, ruler, kitchen scale, speedometer, fuel gauge, batteries, a gas meter, a calendar
 * and a map scale). Everything is drawn from the data in this file and every answer is computed from that same
 * data, so the picture and the answer cannot drift apart.
 */
import { defineCard, H, rectPx, svgDoc, W, type CardSpec, type Option, type Region } from './lib.ts';

const FONT = `font-family="Arial, Helvetica, sans-serif"`;
const rad = (deg: number) => (deg * Math.PI) / 180;
const f1 = (n: number) => n.toFixed(1);
const INK = '#2B2D42';

/** A point at `r` from (cx, cy), `deg` measured clockwise from 12 o'clock. */
const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => [cx + r * Math.sin(rad(deg)), cy - r * Math.cos(rad(deg))];

const text = (x: number, y: number, s: string, size = 32, opts = '') =>
  `<text x="${f1(x)}" y="${f1(y)}" text-anchor="middle" ${FONT} font-size="${size}" ${opts.includes('fill=') ? '' : `fill="${INK}"`} ${opts}>${s}</text>`;

/** A dial tick from radius r1 to r2 at `deg`. */
const tick = (cx: number, cy: number, r1: number, r2: number, deg: number, width: number, color = INK) => {
  const [x1, y1] = polar(cx, cy, r1, deg), [x2, y2] = polar(cx, cy, r2, deg);
  return `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
};

/** A needle from the hub to radius `len` at `deg`. */
const needle = (cx: number, cy: number, len: number, deg: number, color = '#D62828', width = 8) =>
  tick(cx, cy, -24, len, deg, width, color) + `<circle cx="${cx}" cy="${cy}" r="16" fill="${INK}"/>`;

/** Shuffle-free option list: numbers as buttons, answer checked to be among them. */
function numberButtons(values: (number | string)[], answer: number | string, unit = ''): { options: Option[]; answer: string } {
  const id = (v: number | string) => `v${String(v).replace(/[^0-9a-z]/gi, (c) => (c === '-' ? 'm' : c === '.' ? 'p' : ''))}`;
  if (!values.includes(answer)) throw new Error(`answer ${answer} must be an option`);
  if (new Set(values).size !== values.length) throw new Error('options must differ');
  return {
    options: values.map((v) => ({ id: id(v), label: `${v}${unit}`, jev: `${v}${unit}.` })),
    answer: id(answer),
  };
}

const ordinal = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

// 1. Bar chart: the two tallest bars differ by 2.5% and are not neighbors.
const barTallest = (() => {
  const vals = [62, 81, 70, 79, 55];
  const names = ['A', 'B', 'C', 'D', 'E'];
  const base = 600, k = 5, bw = 120, gap = 50, x0 = (W - (5 * bw + 4 * gap)) / 2;
  let body = `<line x1="${x0 - 30}" y1="${base}" x2="${W - x0 + 30}" y2="${base}" stroke="${INK}" stroke-width="5"/>`;
  const options: Option[] = vals.map((v, i) => {
    const x = x0 + i * (bw + gap), h = v * k;
    body += `<rect x="${x}" y="${base - h}" width="${bw}" height="${h}" fill="#3A7CA5"/>`;
    body += text(x + bw / 2, base + 52, names[i], 40, 'font-weight="bold"');
    return { id: names[i].toLowerCase(), label: names[i], region: rectPx(x - gap / 2, base - h - 20, bw + gap, h + 90), jev: `The bar labeled ${names[i]}, ${ordinal[i]} from the left.` };
  });
  const top = vals.indexOf(Math.max(...vals));
  const sorted = [...vals].sort((a, b) => b - a);
  if ((sorted[0] - sorted[1]) / sorted[0] > 0.03) throw new Error('top two bars must be close');
  return defineCard({
    id: 'chart-tallest-bar',
    title: 'Tallest bar',
    category: 'charts',
    difficulty: 2,
    prompt: 'Tap the tallest bar.',
    kind: 'pick',
    svg: svgDoc(body, '#F6F3EC'),
    options,
    answer: names[top].toLowerCase(),
    explain: `Bar ${names[top]} is ${sorted[0] * k} pixels tall and the runner up is ${sorted[1] * k}: only ${(sorted[0] - sorted[1]) * k} pixels apart, and they are not side by side.`,
    jev: {
      context: 'A bar chart with five blue bars labeled A to E and no axis numbers.',
      instructions: 'Which bar in `card` is the tallest?',
    },
    source: 'drawn',
  });
})();

// 2. Pie chart: the biggest slice (27%) sits next to an exploded 25% slice that looks bigger.
const pieBiggest = (() => {
  const slices = [
    { name: 'A', pct: 25, color: '#E07A5F', explode: 40 },
    { name: 'B', pct: 12, color: '#81B29A', explode: 0 },
    { name: 'C', pct: 21, color: '#F2CC8F', explode: 0 },
    { name: 'D', pct: 27, color: '#3D85C6', explode: 0 },
    { name: 'E', pct: 15, color: '#9C6ADE', explode: 0 },
  ];
  if (slices.reduce((s, x) => s + x.pct, 0) !== 100) throw new Error('slices must add to 100');
  const cx = 480, cy = 370, R = 290;
  let body = '';
  const options: Option[] = [];
  let a0 = -40;
  for (const s of slices) {
    const a1 = a0 + s.pct * 3.6, mid = (a0 + a1) / 2;
    const [ox, oy] = polar(0, 0, s.explode, mid);
    const pts: [number, number][] = [[cx + ox, cy + oy]];
    for (let a = a0; a <= a1 + 1e-9; a += (a1 - a0) / 24) {
      const [x, y] = polar(cx + ox, cy + oy, R, a);
      pts.push([x, y]);
    }
    const big = a1 - a0 > 180 ? 1 : 0;
    const [sx, sy] = polar(cx + ox, cy + oy, R, a0), [ex, ey] = polar(cx + ox, cy + oy, R, a1);
    body += `<path d="M ${f1(cx + ox)} ${f1(cy + oy)} L ${f1(sx)} ${f1(sy)} A ${R} ${R} 0 ${big} 1 ${f1(ex)} ${f1(ey)} Z" fill="${s.color}" stroke="#FFFFFF" stroke-width="4"/>`;
    const [lx, ly] = polar(cx + ox, cy + oy, R * 0.62, mid);
    body += text(lx, ly + 16, s.name, 46, 'font-weight="bold"');
    options.push({
      id: s.name.toLowerCase(),
      label: `${s.name} (${s.pct}%)`,
      region: { type: 'poly', rings: [pts.map(([x, y]) => [x / W, y / H] as [number, number])] },
      jev: `The slice labeled ${s.name}.`,
    });
    a0 = a1;
  }
  const best = slices.reduce((a, b) => (b.pct > a.pct ? b : a));
  if (slices.filter((s) => s.pct === best.pct).length !== 1) throw new Error('one biggest slice');
  return defineCard({
    id: 'chart-biggest-slice',
    title: 'Biggest slice',
    category: 'charts',
    difficulty: 3,
    prompt: 'Tap the biggest slice.',
    kind: 'pick',
    svg: svgDoc(body, '#F6F3EC'),
    options,
    answer: best.name.toLowerCase(),
    explain: `Slice ${best.name} is ${best.pct}% of the pie; the pulled-out slice A only looks bigger, it is ${slices[0].pct}%.`,
    jev: {
      context: 'A pie chart with five slices labeled A to E; one slice is pulled out from the center.',
      instructions: 'Which slice in `card` is the largest share of the whole pie?',
    },
    source: 'drawn',
  });
})();

// 3. Line chart: in which month did sales peak?
const linePeak = (() => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sales = [32, 38, 35, 47, 55, 61, 58, 74, 66, 52, 44, 49];
  const x0 = 100, x1 = 900, y0 = 600, y1 = 80, max = 80;
  const px = (i: number) => x0 + (i * (x1 - x0)) / 11, py = (v: number) => y0 - ((y0 - y1) * v) / max;
  let body = '';
  for (let v = 0; v <= max; v += 20) {
    body += `<line x1="${x0}" y1="${py(v)}" x2="${x1}" y2="${py(v)}" stroke="#D5D0C4" stroke-width="2"/>`;
    body += `<text x="${x0 - 16}" y="${py(v) + 10}" text-anchor="end" ${FONT} font-size="28" fill="${INK}">${v}</text>`;
  }
  body += `<polyline points="${sales.map((v, i) => `${f1(px(i))},${f1(py(v))}`).join(' ')}" fill="none" stroke="#C0392B" stroke-width="7" stroke-linejoin="round"/>`;
  sales.forEach((v, i) => (body += `<circle cx="${f1(px(i))}" cy="${f1(py(v))}" r="9" fill="#C0392B"/>`));
  months.forEach((m, i) => (body += `<text x="${f1(px(i))}" y="${y0 + 44}" text-anchor="middle" ${FONT} font-size="24" fill="${INK}" font-weight="bold">${m}</text>`));
  body += text(480, 700, 'Monthly sales, January to December', 30);
  const peak = sales.indexOf(Math.max(...sales));
  const choices = ['Jun', 'Jul', 'Aug', 'Sep'];
  const full = { Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September' } as Record<string, string>;
  if (!choices.includes(months[peak])) throw new Error('peak must be an option');
  return defineCard({
    id: 'chart-line-peak',
    title: 'Best month',
    category: 'charts',
    difficulty: 1,
    prompt: 'In which month did sales peak?',
    kind: 'buttons',
    svg: svgDoc(body, '#FBF8F1'),
    options: choices.map((m) => ({ id: m.toLowerCase(), label: full[m], jev: `${full[m]}.` })),
    answer: months[peak].toLowerCase(),
    explain: `The highest point is the 8th month, ${full[months[peak]]}, at ${sales[peak]}.`,
    jev: {
      context: 'A line chart of monthly sales, with the months labelled Jan to Dec.',
      instructions: 'In `card`, in which month were sales highest?',
    },
    source: 'drawn',
  });
})();

// 4. Truncated axis: the y axis starts at 90, so a 6.5% gap looks like four times.
const truncatedAxis = (() => {
  const a = 92, b = 98, lo = 90, hi = 100;
  const x0 = 170, base = 600, top = 90, py = (v: number) => base - ((base - top) * (v - lo)) / (hi - lo);
  let body = '';
  for (let v = lo; v <= hi; v += 2) {
    body += `<line x1="${x0}" y1="${py(v)}" x2="860" y2="${py(v)}" stroke="#D5D0C4" stroke-width="2"/>`;
    body += `<text x="${x0 - 16}" y="${py(v) + 11}" text-anchor="end" ${FONT} font-size="32" fill="${INK}">${v}</text>`;
  }
  body += `<line x1="${x0}" y1="${top}" x2="${x0}" y2="${base}" stroke="${INK}" stroke-width="4"/><line x1="${x0}" y1="${base}" x2="860" y2="${base}" stroke="${INK}" stroke-width="4"/>`;
  for (const [name, v, x, c] of [['A', a, 300, '#9AA5B1'], ['B', b, 600, '#E07A5F']] as const) {
    body += `<rect x="${x}" y="${f1(py(v))}" width="160" height="${f1(base - py(v))}" fill="${c}"/>`;
    body += text(x + 80, base + 56, name, 44, 'font-weight="bold"');
  }
  const ratio = b / a, looks = (b - lo) / (a - lo);
  const choices = ['About 4 times', 'About 2 times', 'About 1.5 times', `About ${ratio.toFixed(2)} times`];
  return defineCard({
    id: 'chart-truncated-axis',
    title: 'Mind the axis',
    category: 'charts',
    difficulty: 3,
    prompt: "B's value is how many times A's?",
    kind: 'buttons',
    svg: svgDoc(body, '#FBF8F1'),
    options: choices.map((c, i) => ({ id: `r${i}`, label: c, jev: `${c}.` })),
    answer: 'r3',
    explain: `The axis starts at ${lo}, not 0: A is ${a} and B is ${b}, so B is only ${ratio.toFixed(2)} times A, though its bar is drawn ${looks} times as tall.`,
    jev: {
      context: 'A bar chart with two bars, A and B, and a numbered vertical axis.',
      instructions: "In `card`, B's value is about how many times A's value?",
    },
    source: 'drawn',
  });
})();

// 5. Thermometer below zero: -6, a trap for counting the wrong way from -10.
const thermometer = (() => {
  const lo = -20, hi = 20, reading = -6;
  const cx = 420, yTop = 70, yBot = 570, py = (t: number) => yBot - ((yBot - yTop) * (t - lo)) / (hi - lo);
  let body = `<rect x="${cx - 26}" y="${yTop - 30}" width="52" height="${yBot - yTop + 60}" rx="26" fill="#FFFFFF" stroke="${INK}" stroke-width="5"/>`;
  body += `<circle cx="${cx}" cy="${yBot + 70}" r="52" fill="#D62828" stroke="${INK}" stroke-width="5"/>`;
  body += `<rect x="${cx - 12}" y="${f1(py(reading))}" width="24" height="${f1(yBot + 40 - py(reading))}" fill="#D62828"/>`;
  for (let t = lo; t <= hi; t++) {
    const len = t % 10 === 0 ? 44 : t % 5 === 0 ? 30 : 16;
    body += `<line x1="${cx + 34}" y1="${f1(py(t))}" x2="${cx + 34 + len}" y2="${f1(py(t))}" stroke="${INK}" stroke-width="${t % 5 === 0 ? 4 : 2}"/>`;
    if (t % 10 === 0) body += `<text x="${cx + 92}" y="${f1(py(t) + 11)}" ${FONT} font-size="34" font-weight="bold" fill="${INK}">${t}</text>`;
  }
  body += `<text x="${cx - 60}" y="80" text-anchor="end" ${FONT} font-size="40" font-weight="bold" fill="${INK}">°C</text>`;
  const { options, answer } = numberButtons([-4, -6, -14, 6], reading, ' °C');
  return defineCard({
    id: 'gauge-thermometer-below-zero',
    title: 'Below zero',
    category: 'reading',
    difficulty: 2,
    prompt: 'What temperature does it show?',
    kind: 'buttons',
    svg: svgDoc(body, '#E6EEF2'),
    options,
    answer,
    explain: `The red column stops one small mark below the -5 mark, at ${reading} °C; below zero the numbers grow toward the bottom.`,
    jev: {
      context: 'A thermometer in degrees Celsius with a mark every degree, a longer mark every 5 and numbers every 10.',
      instructions: 'What temperature does the thermometer in `card` show?',
    },
    source: 'drawn',
  });
})();

// 6. Measuring jug: water at 350 ml, halfway between two labels.
const measuringJug = (() => {
  const max = 500, ml = 350;
  const x0 = 300, x1 = 640, yTop = 110, yBot = 640, py = (v: number) => yBot - ((yBot - 150) * v) / max;
  let body = `<rect x="${x0}" y="${f1(py(ml))}" width="${x1 - x0}" height="${f1(yBot - py(ml))}" fill="#8EC5E8"/>`;
  body += `<path d="M ${x0} ${yTop} L ${x0} ${yBot} L ${x1} ${yBot} L ${x1} ${yTop}" fill="none" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>`;
  body += `<path d="M ${x1} 190 C 760 190 760 520 ${x1} 520" fill="none" stroke="${INK}" stroke-width="16"/>`;
  for (let v = 50; v <= max; v += 50) {
    const big = v % 100 === 0;
    body += `<line x1="${x0}" y1="${f1(py(v))}" x2="${x0 + (big ? 70 : 40)}" y2="${f1(py(v))}" stroke="${INK}" stroke-width="${big ? 5 : 3}"/>`;
    if (big) body += `<text x="${x0 - 16}" y="${f1(py(v) + 11)}" text-anchor="end" ${FONT} font-size="34" font-weight="bold" fill="${INK}">${v}</text>`;
  }
  body += `<text x="${x0 - 16}" y="${yTop - 6}" text-anchor="end" ${FONT} font-size="34" fill="${INK}">ml</text>`;
  const { options, answer } = numberButtons([300, 325, 350, 400], ml, ' ml');
  return defineCard({
    id: 'gauge-measuring-jug',
    title: 'Measuring jug',
    category: 'reading',
    difficulty: 1,
    prompt: 'How much water is in the jug?',
    kind: 'buttons',
    svg: svgDoc(body, '#F4F1EA'),
    options,
    answer,
    explain: `The water reaches the short mark between 300 and 400, which is ${ml} ml.`,
    jev: {
      context: 'A measuring jug with water in it and a scale in millilitres on its side.',
      instructions: 'How much water is in the jug in `card`?',
    },
    source: 'drawn',
  });
})();

// 7. Ruler: the pencil starts at 2 cm, not at 0.
const rulerPencil = (() => {
  const pxcm = 68, rx = 72, ry = 380, cmMax = 12, start = 2, end = 9.5;
  const x = (cm: number) => rx + cm * pxcm;
  let body = `<rect x="${rx - 30}" y="${ry}" width="${cmMax * pxcm + 60}" height="150" rx="8" fill="#F2D16B" stroke="${INK}" stroke-width="4"/>`;
  for (let mm = 0; mm <= cmMax * 10; mm++) {
    const len = mm % 10 === 0 ? 50 : mm % 5 === 0 ? 34 : 20;
    body += `<line x1="${f1(x(mm / 10))}" y1="${ry}" x2="${f1(x(mm / 10))}" y2="${ry + len}" stroke="${INK}" stroke-width="${mm % 10 === 0 ? 3 : 2}"/>`;
    if (mm % 10 === 0) body += text(x(mm / 10), ry + 92, String(mm / 10), 32, 'font-weight="bold"');
  }
  body += text(x(cmMax) - 20, ry + 136, 'cm', 28);
  // The pencil: blunt end at `start`, graphite tip at `end`.
  const top = ry - 80, ph = 56, cone = 1.4;
  const xs = x(start), xc = x(end - cone), xe = x(end);
  body += `<rect x="${xs}" y="${top}" width="${f1(xc - xs)}" height="${ph}" fill="#E8833A" stroke="${INK}" stroke-width="3"/>`;
  body += `<rect x="${xs}" y="${top}" width="40" height="${ph}" fill="#E0A0B0" stroke="${INK}" stroke-width="3"/>`;
  body += `<polygon points="${f1(xc)},${top} ${f1(xe)},${top + ph / 2} ${f1(xc)},${top + ph}" fill="#F1D7B0" stroke="${INK}" stroke-width="3"/>`;
  body += `<polygon points="${f1(xe - 0.4 * pxcm)},${f1(top + ph / 2 - 0.2 * ph)} ${f1(xe)},${top + ph / 2} ${f1(xe - 0.4 * pxcm)},${f1(top + ph / 2 + 0.2 * ph)}" fill="${INK}"/>`;
  body += `<line x1="${xs}" y1="${top + ph}" x2="${xs}" y2="${ry}" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5"/>`;
  body += `<line x1="${f1(xe)}" y1="${top + ph / 2}" x2="${f1(xe)}" y2="${ry}" stroke="${INK}" stroke-width="2" stroke-dasharray="6 5"/>`;
  const len = end - start;
  const { options, answer } = numberButtons([7, 7.5, 8, 9.5], len, ' cm');
  return defineCard({
    id: 'gauge-ruler-pencil',
    title: 'How long',
    category: 'reading',
    difficulty: 3,
    prompt: 'How long is the pencil?',
    kind: 'buttons',
    svg: svgDoc(body, '#EDEBE6'),
    options,
    answer,
    explain: `The pencil runs from ${start} cm to ${end} cm, so it is ${len} cm long; it does not start at 0.`,
    jev: {
      context: 'A pencil lying above a ruler marked in centimetres and millimetres.',
      instructions: 'How long is the pencil in `card`?',
    },
    source: 'drawn',
  });
})();

// 8. Kitchen scale dial: 0 to 1000 g, a mark every 25 g, needle at 625.
const kitchenScale = (() => {
  const cx = 480, cy = 380, R = 300, max = 1000, grams = 625, sweep = 300;
  const ang = (g: number) => -sweep / 2 + (sweep * g) / max;
  let body = `<rect x="${cx - R - 30}" y="${cy - R - 30}" width="${2 * R + 60}" height="${2 * R + 30}" rx="60" fill="#B8C4CC"/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#FFFFFF" stroke="${INK}" stroke-width="8"/>`;
  for (let g = 0; g <= max; g += 25) {
    const big = g % 100 === 0, mid = g % 50 === 0;
    body += tick(cx, cy, R - 14, R - (big ? 60 : mid ? 42 : 28), ang(g), big ? 6 : 3);
    if (big) {
      const [lx, ly] = polar(cx, cy, R - 102, ang(g));
      body += text(lx, ly + 12, String(g), 34, 'font-weight="bold"');
    }
  }
  body += text(cx, cy + 130, 'grams', 34);
  body += needle(cx, cy, R - 30, ang(grams));
  const { options, answer } = numberButtons([600, 625, 650, 675], grams, ' g');
  return defineCard({
    id: 'gauge-kitchen-scale',
    title: 'Kitchen scale',
    category: 'reading',
    difficulty: 2,
    prompt: 'How heavy is it?',
    kind: 'buttons',
    svg: svgDoc(body, '#EFE9DF'),
    options,
    answer,
    explain: `There is a mark every 25 g: the needle sits on the first short mark after 600 (the middle-length mark is 650), so it reads ${grams} g.`,
    jev: {
      context: 'The dial of a kitchen scale from 0 to 1000 grams with marks every 25 grams and a red needle.',
      instructions: 'What weight does the scale in `card` show?',
    },
    source: 'drawn',
  });
})();

// 9. Speedometer with km/h outside and mph inside: the needle is on 100 km/h, near the 60 mph label.
const speedometer = (() => {
  const cx = 480, cy = 400, R = 310, maxKmh = 200, sweep = 240, kmh = 100, MPH = 1.609344;
  const ang = (k: number) => -sweep / 2 + (sweep * k) / maxKmh;
  let body = `<circle cx="${cx}" cy="${cy}" r="${R + 14}" fill="#1E2229"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="#2B303A"/>`;
  for (let k = 0; k <= maxKmh; k += 10) {
    const big = k % 20 === 0;
    body += tick(cx, cy, R - 10, R - (big ? 46 : 26), ang(k), big ? 6 : 3, '#FFFFFF');
    if (big) {
      const [lx, ly] = polar(cx, cy, R - 80, ang(k));
      body += `<text x="${f1(lx)}" y="${f1(ly + 12)}" text-anchor="middle" ${FONT} font-size="34" font-weight="bold" fill="#FFFFFF">${k}</text>`;
    }
  }
  for (let m = 0; m * MPH <= maxKmh; m += 20) {
    body += tick(cx, cy, R - 128, R - 146, ang(m * MPH), 4, '#F2B134');
    const [lx, ly] = polar(cx, cy, R - 176, ang(m * MPH));
    body += `<text x="${f1(lx)}" y="${f1(ly + 10)}" text-anchor="middle" ${FONT} font-size="28" fill="#F2B134">${m}</text>`;
  }
  body += `<text x="${cx}" y="${cy + 120}" text-anchor="middle" ${FONT} font-size="34" font-weight="bold" fill="#FFFFFF">km/h</text>`;
  body += `<text x="${cx}" y="${cy + 165}" text-anchor="middle" ${FONT} font-size="30" fill="#F2B134">mph</text>`;
  body += needle(cx, cy, R - 20, ang(kmh), '#FF4D3D', 9).replace(`fill="${INK}"`, 'fill="#888"');
  const { options, answer } = numberButtons([60, 90, 100, 110], kmh, ' km/h');
  return defineCard({
    id: 'gauge-speedometer-kmh',
    title: 'How fast',
    category: 'reading',
    difficulty: 2,
    prompt: 'How fast is the car going, in km/h?',
    kind: 'buttons',
    svg: svgDoc(body, '#D9DDE2'),
    options,
    answer,
    explain: `The needle points at ${kmh} on the outer white km/h scale; the 60 nearby is on the inner mph scale (${kmh} km/h is about ${(kmh / MPH).toFixed(0)} mph).`,
    jev: {
      context: 'A car speedometer with a white km/h scale on the outside and an orange mph scale on the inside.',
      instructions: 'What speed in km/h does the speedometer in `card` show?',
    },
    source: 'drawn',
  });
})();

// 10. Fuel gauge at a quarter of a 60 litre tank.
const fuelGauge = (() => {
  const cx = 480, cy = 520, R = 340, tank = 60, level = 0.25, sweep = 120;
  const ang = (f: number) => -sweep / 2 + sweep * f;
  let body = `<path d="M ${f1(polar(cx, cy, R + 20, -80)[0])} ${f1(polar(cx, cy, R + 20, -80)[1])} A ${R + 20} ${R + 20} 0 0 1 ${f1(polar(cx, cy, R + 20, 80)[0])} ${f1(polar(cx, cy, R + 20, 80)[1])} L ${cx} ${cy + 40} Z" fill="#20242B"/>`;
  for (let i = 0; i <= 8; i++) {
    const big = i % 2 === 0;
    body += tick(cx, cy, R - 10, R - (big ? 60 : 34), ang(i / 8), big ? 8 : 4, i === 0 ? '#FF4D3D' : '#FFFFFF');
  }
  const labels: [number, string][] = [[0, 'E'], [0.5, '1/2'], [1, 'F']];
  for (const [f, s] of labels) {
    const [lx, ly] = polar(cx, cy, R - 108, ang(f));
    body += `<text x="${f1(lx)}" y="${f1(ly + 16)}" text-anchor="middle" ${FONT} font-size="46" font-weight="bold" fill="#FFFFFF">${s}</text>`;
  }
  body += needle(cx, cy, R - 24, ang(level), '#FF4D3D', 10).replace(`fill="${INK}"`, 'fill="#888"');
  body += text(cx, 680, `The tank holds ${tank} litres when full.`, 36, 'font-weight="bold"');
  const litres = tank * level;
  const { options, answer } = numberButtons([15, 20, 30, 45], litres, ' litres');
  return defineCard({
    id: 'gauge-fuel-left',
    title: 'Fuel left',
    category: 'reading',
    difficulty: 2,
    prompt: 'About how much fuel is left?',
    kind: 'buttons',
    svg: svgDoc(body, '#C9CED6'),
    options,
    answer,
    explain: `The needle is on the mark halfway between E and 1/2, a quarter of the tank: a quarter of ${tank} litres is ${litres} litres.`,
    jev: {
      context: 'A car fuel gauge from E to F with a red needle, and a note saying how much the full tank holds.',
      instructions: 'About how much fuel is left according to `card`?',
    },
    source: 'drawn',
  });
})();

// 11. Batteries: tap the fullest.
const batteryFullest = (() => {
  const levels = [64, 30, 71, 48];
  const color = (p: number) => (p < 35 ? '#E0A800' : '#2E9E4F');
  const bw = 150, bh = 380, gap = 70, x0 = (W - (4 * bw + 3 * gap)) / 2, y0 = 200;
  let body = '';
  const where = ['first', 'second', 'third', 'fourth'];
  const options: Option[] = levels.map((p, i) => {
    const x = x0 + i * (bw + gap), inner = bh - 24, fill = (inner * p) / 100;
    body += `<rect x="${x + bw / 2 - 34}" y="${y0 - 34}" width="68" height="40" rx="8" fill="${INK}"/>`;
    body += `<rect x="${x}" y="${y0}" width="${bw}" height="${bh}" rx="18" fill="#FFFFFF" stroke="${INK}" stroke-width="10"/>`;
    body += `<rect x="${x + 12}" y="${f1(y0 + 12 + inner - fill)}" width="${bw - 24}" height="${f1(fill)}" rx="8" fill="${color(p)}"/>`;
    return { id: `b${i + 1}`, label: `${where[i][0].toUpperCase()}${where[i].slice(1)} (${p}%)`, region: rectPx(x - gap / 2, y0 - 50, bw + gap, bh + 80), jev: `The ${where[i]} battery from the left.` };
  });
  const best = levels.indexOf(Math.max(...levels));
  return defineCard({
    id: 'gauge-fullest-battery',
    title: 'Fullest battery',
    category: 'reading',
    difficulty: 1,
    prompt: 'Tap the fullest battery.',
    kind: 'pick',
    svg: svgDoc(body, '#EAF0F4'),
    options,
    answer: `b${best + 1}`,
    explain: `The ${where[best]} battery is ${levels[best]}% full, a little more than the ${levels[0]}% one on the far left.`,
    jev: {
      context: 'Four battery icons in a row, each filled to a different level.',
      instructions: 'Which battery in `card` has the most charge?',
    },
    source: 'drawn',
  });
})();

// 12. Gas meter with four dials turning alternately clockwise and anticlockwise. Each pointer sits where the
// exact reading puts it, so every dial is read from the number it has just passed.
const gasMeter = (() => {
  const reading = 3546.5;
  const places = [1000, 100, 10, 1];
  const dirs = [-1, 1, -1, 1]; // -1 anticlockwise, 1 clockwise
  const r = 104, cy = 340, gap = 228, x0 = (W - 3 * gap) / 2;
  const digits = places.map((p) => Math.floor(reading / p) % 10);
  let body = `<rect x="20" y="170" width="920" height="420" rx="24" fill="#E9E4D8" stroke="${INK}" stroke-width="4"/>`;
  places.forEach((p, i) => {
    const cx = x0 + i * gap, dir = dirs[i];
    const ang = (d: number) => dir * d * 36;
    body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF" stroke="${INK}" stroke-width="5"/>`;
    for (let d = 0; d < 10; d++) {
      body += tick(cx, cy, r - 4, r - 14, ang(d), 3);
      const [lx, ly] = polar(cx, cy, r - 36, ang(d));
      body += text(lx, ly + 10, String(d), 28, 'font-weight="bold"');
    }
    const pos = (reading / p) % 10;
    body += tick(cx, cy, -12, r - 22, ang(pos), 7, '#D62828') + `<circle cx="${cx}" cy="${cy}" r="10" fill="${INK}"/>`;
    // A curved arrow above the dial shows which way it turns.
    const a0 = dir > 0 ? -25 : 25, a1 = -a0, rr = r + 22;
    const [sx, sy] = polar(cx, cy, rr, a0), [ex, ey] = polar(cx, cy, rr, a1);
    const [hx, hy] = polar(cx, cy, rr, a1 + dir * 2);
    body += `<path d="M ${f1(sx)} ${f1(sy)} A ${rr} ${rr} 0 0 ${dir > 0 ? 1 : 0} ${f1(ex)} ${f1(ey)}" fill="none" stroke="${INK}" stroke-width="4"/>`;
    const [b1x, b1y] = polar(cx, cy, rr - 12, a1 - dir * 6), [b2x, b2y] = polar(cx, cy, rr + 12, a1 - dir * 6);
    body += `<polygon points="${f1(hx)},${f1(hy)} ${f1(b1x)},${f1(b1y)} ${f1(b2x)},${f1(b2y)}" fill="${INK}"/>`;
    body += text(cx, cy + r + 52, `x${p}`, 32, 'font-weight="bold"');
  });
  const answerStr = digits.join('');
  const higher = digits.map((d) => (d + 1) % 10).join('');
  const reversed = [...digits].reverse().join('');
  const tens = digits.map((d, i) => (i === 2 ? (d + 1) % 10 : d)).join('');
  const values = [answerStr, higher, reversed, tens];
  if (new Set(values).size !== 4) throw new Error('options must differ');
  for (const [i, p] of places.entries()) {
    const frac = (reading / p) % 1;
    if (frac < 0.3 || frac > 0.7) throw new Error(`dial ${i} pointer too close to a digit`);
  }
  return defineCard({
    id: 'gauge-gas-meter-dials',
    title: 'Meter dials',
    category: 'reading',
    difficulty: 3,
    prompt: 'What does the meter read?',
    kind: 'buttons',
    svg: svgDoc(body, '#CFC8B8'),
    options: values.map((v) => ({ id: `m${v}`, label: v, jev: `${v}.` })),
    answer: `m${answerStr}`,
    explain: `Read each dial from the number its pointer has just passed, following the dial's own direction: ${digits.join(', ')} gives ${answerStr}.`,
    jev: {
      context: 'An old gas meter with four dials marked x1000, x100, x10 and x1; neighbouring dials turn in opposite directions, shown by the arrows.',
      instructions: 'What reading does the meter in `card` show, reading the dials from x1000 to x1?',
    },
    source: 'drawn',
  });
})();

// 13. Calendar: August 2027 starts on a Sunday in a Monday-first layout; the second half is covered by a note.
const calendarWeekday = (() => {
  const year = 2027, month = 7, ask = 21;
  const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const first = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7; // 0 = Monday
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cw = 124, ch = 84, x0 = (W - 7 * cw) / 2, y0 = 170;
  let body = text(480, 80, `AUGUST ${year}`, 48, 'font-weight="bold"');
  names.forEach((n, i) => (body += text(x0 + i * cw + cw / 2, 140, n.slice(0, 2).toUpperCase(), 32, `font-weight="bold" fill="${i === 6 ? '#C0392B' : INK}"`)));
  const rows = Math.ceil((first + days) / 7);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < 7; c++) body += `<rect x="${x0 + c * cw}" y="${y0 + r * ch}" width="${cw}" height="${ch}" fill="#FFFFFF" stroke="#B9B2A5" stroke-width="2"/>`;
  for (let d = 1; d <= days; d++) {
    const cell = first + d - 1, r = Math.floor(cell / 7), c = cell % 7;
    body += `<text x="${x0 + c * cw + cw - 14}" y="${y0 + r * ch + 42}" text-anchor="end" ${FONT} font-size="34" fill="${c === 6 ? '#C0392B' : INK}">${d}</text>`;
  }
  // The note covers every row from the third on.
  const noteY = y0 + 2 * ch + 10;
  body += `<rect x="${x0 - 20}" y="${noteY}" width="${7 * cw + 40}" height="${y0 + rows * ch - noteY + 20}" rx="6" fill="#FFE27A" stroke="#C9A93A" stroke-width="3" transform="rotate(-1.5 480 ${noteY + 120})"/>`;
  body += text(480, noteY + 120, 'Holiday!', 56, 'font-weight="bold" fill="#7A5B00"');
  const askDay = names[(first + ask - 1) % 7];
  if (Math.floor((first + ask - 1) / 7) < 2) throw new Error('the asked day must be under the note');
  if (first !== 6) throw new Error('the month should start on a Sunday for the trap');
  const choices = ['Friday', 'Saturday', 'Sunday', 'Wednesday'];
  if (!choices.includes(askDay)) throw new Error('answer must be an option');
  return defineCard({
    id: 'calendar-weekday-21st',
    title: 'Under the note',
    category: 'reading',
    difficulty: 2,
    prompt: `What day of the week is the ${ask}st?`,
    kind: 'buttons',
    svg: svgDoc(body, '#EDE7DC'),
    options: choices.map((d) => ({ id: d.toLowerCase(), label: d, jev: `${d}.` })),
    answer: askDay.toLowerCase(),
    explain: `The week starts on Monday here, so the 1st is a Sunday; the 7th, 14th and 21st fall on the same weekday as each other, ${names[(first + 6) % 7]}, and that makes the 21st a ${askDay}.`,
    jev: {
      context: 'A wall calendar page for one month with weekday headings; a sticky note covers the lower rows.',
      instructions: `In \`card\`, what day of the week is the ${ask}st of the month?`,
    },
    source: 'drawn',
  });
})();

// 14. Map scale: A to B is 300 pixels and the bar says 100 px = 50 km.
const mapScale = (() => {
  const A: [number, number] = [190, 470], dx = 240, dy = -180, B: [number, number] = [A[0] + dx, A[1] + dy];
  const barPx = 200, barKm = 100;
  const km = (Math.hypot(dx, dy) / barPx) * barKm;
  let body = `<path d="M 80 640 C 40 520 90 360 70 250 C 60 150 160 90 280 110 C 400 130 470 60 600 90 C 720 120 760 220 720 330 C 690 420 760 520 700 600 C 640 680 300 690 80 640 Z" fill="#CFE3B4" stroke="#7D9B5B" stroke-width="4"/>`;
  body += `<path d="M 120 200 C 220 260 300 330 330 420 C 360 520 470 560 560 640" fill="none" stroke="#6FA8DC" stroke-width="10"/>`;
  for (const [p, n] of [[A, 'A'], [B, 'B']] as const) {
    body += `<circle cx="${p[0]}" cy="${p[1]}" r="14" fill="#C0392B" stroke="#FFFFFF" stroke-width="4"/>`;
    body += `<text x="${p[0] + 24}" y="${p[1] - 18}" ${FONT} font-size="44" font-weight="bold" fill="${INK}">${n}</text>`;
  }
  const bx = 640, by = 640;
  body += `<rect x="${bx}" y="${by}" width="${barPx / 2}" height="16" fill="${INK}"/><rect x="${bx + barPx / 2}" y="${by}" width="${barPx / 2}" height="16" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/>`;
  for (const [i, s] of [[0, '0'], [1, String(barKm / 2)], [2, `${barKm} km`]] as const)
    body += text(bx + (i * barPx) / 2 + (i === 2 ? 20 : 0), by - 14, s, 30, 'font-weight="bold"');
  const { options, answer } = numberButtons([100, 150, 200, 300], km, ' km');
  return defineCard({
    id: 'map-scale-distance',
    title: 'Use the scale',
    category: 'reading',
    difficulty: 2,
    prompt: 'How far is A from B in a straight line?',
    kind: 'buttons',
    svg: svgDoc(body, '#CFE6F2'),
    options,
    answer,
    explain: `A to B is one and a half times the length of the ${barKm} km scale bar, so it is ${km} km.`,
    jev: {
      context: 'A simple map with two places marked A and B and a scale bar in the corner.',
      instructions: 'Using the scale bar, how far apart are A and B in `card`, in a straight line?',
    },
    source: 'drawn',
  });
})();

const cards: CardSpec[] = [
  barTallest, pieBiggest, linePeak, truncatedAxis, thermometer, measuringJug, rulerPencil,
  kitchenScale, speedometer, fuelGauge, batteryFullest, gasMeter, calendarWeekday, mapScale,
];
export default cards;
