/**
 * Calendars, angles and symmetry. Calendars are drawn from Date (UTC) and every weekday answer is computed
 * from the same Date; angles and triangles are drawn from their degrees; symmetry lines are counted by testing
 * reflections of the drawn vertices. The picture and the answer come from one source, so they cannot drift.
 */
import { defineCard, rectPx, svgDoc, W, type CardSpec, type Option } from './lib.ts';

const FONT = `font-family="Arial, Helvetica, sans-serif"`;
const INK = '#2B2D42';
const rad = (deg: number) => (deg * Math.PI) / 180;
const f1 = (n: number) => n.toFixed(1);
const pts = (p: [number, number][]) => p.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');
const text = (x: number, y: number, s: string | number, size = 44, fill = INK, extra = '') =>
  `<text x="${f1(x)}" y="${f1(y)}" text-anchor="middle" ${FONT} font-weight="bold" font-size="${size}" fill="${fill}" ${extra}>${s}</text>`;
const GRID4 = ['top left', 'top right', 'bottom left', 'bottom right'];

/** The only option index whose score is the minimum, or throw. */
function uniqueMin(scores: number[]): number {
  const best = Math.min(...scores);
  if (scores.filter((s) => Math.abs(s - best) < 1e-9).length !== 1) throw new Error('the minimum must be unique');
  return scores.indexOf(best);
}

/** Buttons from values; the answer must be among them exactly once. */
function numButtons(prefix: string, values: (number | string)[], answer: number | string, fmt = (v: number | string) => String(v)): { options: Option[]; answer: string } {
  if (values.filter((v) => v === answer).length !== 1) throw new Error(`${prefix}: answer must be one option`);
  if (new Set(values).size !== values.length) throw new Error(`${prefix}: options must differ`);
  const id = (v: number | string) => `${prefix}${String(v).replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
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

// ---------------------------------------------------------------- calendars

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']; // Date.getUTCDay order
const weekday = (y: number, m: number, d: number) => DAYS[new Date(Date.UTC(y, m, d)).getUTCDay()];
const nth = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/**
 * A wall calendar page. weekStart 1 = Monday-first columns, 0 = Sunday-first. cover hides whole rows
 * [from, to] under a sticky note.
 */
function calendar(year: number, month: number, weekStart: 0 | 1, cover?: { from: number; to: number; label: string }) {
  const first = (new Date(Date.UTC(year, month, 1)).getUTCDay() - weekStart + 7) % 7; // column of the 1st
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const rows = Math.ceil((first + days) / 7);
  const cw = 124, ch = 84, x0 = (W - 7 * cw) / 2, y0 = 170;
  const colDay = (c: number) => DAYS[(c + weekStart) % 7];
  let body = text(480, 80, `${MONTHS[month]} ${year}`, 48);
  for (let c = 0; c < 7; c++) body += text(x0 + c * cw + cw / 2, 140, colDay(c).slice(0, 2).toUpperCase(), 32, colDay(c) === 'Sunday' ? '#C0392B' : INK);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < 7; c++) body += `<rect x="${x0 + c * cw}" y="${y0 + r * ch}" width="${cw}" height="${ch}" fill="#FFFFFF" stroke="#B9B2A5" stroke-width="2"/>`;
  for (let d = 1; d <= days; d++) {
    const cell = first + d - 1, r = Math.floor(cell / 7), c = cell % 7;
    if (colDay(c) !== weekday(year, month, d)) throw new Error('calendar layout disagrees with Date');
    body += `<text x="${x0 + c * cw + cw - 14}" y="${y0 + r * ch + 42}" text-anchor="end" ${FONT} font-size="34" fill="${colDay(c) === 'Sunday' ? '#C0392B' : INK}">${d}</text>`;
  }
  if (cover) {
    const top = y0 + cover.from * ch - 12, bottom = y0 + (cover.to + 1) * ch + (cover.to + 1 >= rows ? 12 : 0);
    body += `<rect x="${x0 - 20}" y="${top}" width="${7 * cw + 40}" height="${bottom - top}" rx="6" fill="#FFE27A" stroke="#C9A93A" stroke-width="3" transform="rotate(-1.2 480 ${(top + bottom) / 2})"/>`;
    body += text(480, (top + bottom) / 2 + 20, cover.label, 56, '#7A5B00');
  }
  const rowOf = (d: number) => Math.floor((first + d - 1) / 7);
  const colOf = (d: number) => (first + d - 1) % 7;
  return { body, rows, days, rowOf, colOf, colDay, first };
}

const dayButtons = (choices: string[], answer: string) => {
  if (!choices.includes(answer)) throw new Error(`answer ${answer} must be an option`);
  return { options: choices.map((d) => ({ id: d.toLowerCase(), label: d, jev: `${d}.` })), answer: answer.toLowerCase() };
};

// 1. Sunday-first June 2026, rows from the third covered: what day is the 25th?
const sundayFirst = (() => {
  const year = 2026, month = 5, ask = 25;
  const cal = calendar(year, month, 0, { from: 2, to: 4, label: 'Back soon!' });
  if (cal.rowOf(ask) < 2 || cal.rowOf(ask) > 4) throw new Error('the asked day must be under the note');
  const ans = weekday(year, month, ask);
  // The slip: reading the columns as if the week started on Monday.
  const slip = DAYS[(cal.colOf(ask) + 1) % 7];
  if (slip === ans) throw new Error('the trap must differ');
  const { options, answer } = dayButtons(['Wednesday', 'Thursday', 'Friday', 'Saturday'], ans);
  if (!options.some((o) => o.label === slip)) throw new Error('the trap should be an option');
  return defineCard({
    id: 'calendar-sunday-first-25th',
    title: 'Sunday comes first',
    category: 'reading',
    difficulty: 2,
    prompt: `What day of the week is the ${nth(ask)}?`,
    kind: 'buttons',
    svg: svgDoc(cal.body, '#E3ECF2'),
    options,
    answer,
    explain: `This calendar starts its weeks on Sunday, and the 1st is a ${weekday(year, month, 1)}. The 4th, 11th, 18th and 25th share a column, so the ${nth(ask)} is a ${ans}.`,
    jev: {
      context: 'A wall calendar page for one month with weekday headings; a sticky note covers the lower rows.',
      instructions: `In \`card\`, what day of the week is the ${nth(ask)} of the month?`,
    },
    source: 'drawn',
  });
})();

// 2. Leap February: February 2028 with its last row covered. What day is March 1st?
const leapMarch = (() => {
  const year = 2028, month = 1;
  const cal = calendar(year, month, 1);
  const lastRow = cal.rows - 1;
  const covered = calendar(year, month, 1, { from: lastRow, to: lastRow, label: 'Ski trip' });
  if (cal.days !== 29) throw new Error('2028 must be a leap year');
  if (cal.rowOf(28) !== lastRow || cal.rowOf(27) === lastRow) throw new Error('the 28th and 29th should be the hidden row');
  const ans = weekday(year, 2, 1);
  const slip = weekday(year, month, 29); // what March 1st would be in a 28-day February
  const { options, answer } = dayButtons(['Monday', 'Tuesday', 'Wednesday', 'Thursday'], ans);
  if (!options.some((o) => o.label === slip)) throw new Error('the trap should be an option');
  return defineCard({
    id: 'calendar-leap-march-first',
    title: 'Leap day',
    category: 'reading',
    difficulty: 3,
    prompt: 'What day of the week is March 1st?',
    kind: 'buttons',
    svg: svgDoc(covered.body, '#EDE7DC'),
    options,
    answer,
    explain: `2028 is a leap year, so February has 29 days. The 27th is a Sunday, so the 28th is a Monday, the 29th a Tuesday and March 1st a ${ans}.`,
    jev: {
      context: 'A wall calendar page for February 2028; a sticky note covers the last row.',
      instructions: 'Using `card`, what day of the week is March 1st of that year?',
    },
    source: 'drawn',
  });
})();

// 3. How many Fridays in October 2027 (the 1st is a Friday, alone near the end of the first row).
const countFridays = (() => {
  const year = 2027, month = 9;
  const cal = calendar(year, month, 1);
  let n = 0;
  for (let d = 1; d <= cal.days; d++) if (weekday(year, month, d) === 'Friday') n++;
  const { options, answer } = numButtons('n', [3, 4, 5, 6], n);
  return defineCard({
    id: 'calendar-count-fridays',
    title: 'Friday count',
    category: 'reading',
    difficulty: 1,
    prompt: 'How many Fridays are in this month?',
    kind: 'buttons',
    svg: svgDoc(cal.body, '#EDE7DC'),
    options,
    answer,
    explain: `The Fridays are the ${Array.from({ length: cal.days }, (_, i) => i + 1).filter((d) => weekday(year, month, d) === 'Friday').join(', ')}: ${n} of them, because the month starts on a Friday and has 31 days.`,
    jev: {
      context: 'A wall calendar page for one month with weekday headings.',
      instructions: 'How many Fridays are in the month shown in `card`?',
    },
    source: 'drawn',
  });
})();

// 4. Third Tuesday of September 2027: the first row has no Tuesday, so the third row is the second Tuesday.
const thirdTuesday = (() => {
  const year = 2027, month = 8;
  const cal = calendar(year, month, 1);
  const tuesdays = Array.from({ length: cal.days }, (_, i) => i + 1).filter((d) => weekday(year, month, d) === 'Tuesday');
  const ans = tuesdays[2];
  const slip = tuesdays[1];
  if (cal.rowOf(slip) !== 2) throw new Error('the trap is the Tuesday in the third row');
  const { options, answer } = numButtons('d', [slip, slip + 1, ans, tuesdays[3]], ans, (v) => `The ${nth(Number(v))}`);
  return defineCard({
    id: 'calendar-third-tuesday',
    title: 'Third Tuesday',
    category: 'reading',
    difficulty: 2,
    prompt: 'Which date is the third Tuesday?',
    kind: 'buttons',
    svg: svgDoc(cal.body, '#E6EFE6'),
    options,
    answer,
    explain: `The month starts on a Wednesday, so the first row has no Tuesday. The Tuesdays are the ${tuesdays.join(', ')}, which makes the ${nth(ans)} the third one.`,
    jev: {
      context: 'A wall calendar page for one month with weekday headings.',
      instructions: 'In `card`, which date of the month is the third Tuesday?',
    },
    source: 'drawn',
  });
})();

// 5. Sunday-first January 2030 with the top two rows covered: work backwards to the 4th.
const tornTop = (() => {
  const year = 2030, month = 0, ask = 4;
  const cal = calendar(year, month, 0, { from: 0, to: 1, label: 'New Year plans' });
  if (cal.rowOf(ask) > 1) throw new Error('the asked day must be under the note');
  const ans = weekday(year, month, ask);
  const { options, answer } = dayButtons(['Wednesday', 'Thursday', 'Friday', 'Saturday'], ans);
  return defineCard({
    id: 'calendar-covered-top-4th',
    title: 'Count back',
    category: 'reading',
    difficulty: 2,
    prompt: `What day of the week is the ${nth(ask)}?`,
    kind: 'buttons',
    svg: svgDoc(cal.body, '#F1E6EC'),
    options,
    answer,
    explain: `The 18th is a ${weekday(year, month, 18)}, so the 11th and the 4th are too: one and two weeks earlier, same column.`,
    jev: {
      context: 'A wall calendar page for one month with weekday headings; a sticky note covers the top rows.',
      instructions: `In \`card\`, what day of the week is the ${nth(ask)} of the month?`,
    },
    source: 'drawn',
  });
})();

// ---------------------------------------------------------------- angles

/** An angle (two rays from a vertex with an arc), centered in a cell. rot is the first ray's direction, counterclockwise from east. */
function angleSvg(cx: number, cy: number, deg: number, rot: number, len: number, color: string): string {
  const dir = (a: number): [number, number] => [Math.cos(rad(a)), -Math.sin(rad(a))];
  const [ax, ay] = dir(rot), [bx, by] = dir(rot + deg);
  const P: [number, number][] = [[0, 0], [ax * len, ay * len], [bx * len, by * len]];
  const minX = Math.min(...P.map((p) => p[0])), maxX = Math.max(...P.map((p) => p[0]));
  const minY = Math.min(...P.map((p) => p[1])), maxY = Math.max(...P.map((p) => p[1]));
  if (maxX - minX > 400 || maxY - minY > 260) throw new Error(`angle ${deg} does not fit its box`);
  const ox = cx - (minX + maxX) / 2, oy = cy - (minY + maxY) / 2;
  const ar = 46;
  let s = `<path d="M${f1(ox + ax * ar)},${f1(oy + ay * ar)} A${ar},${ar} 0 ${deg > 180 ? 1 : 0} 0 ${f1(ox + bx * ar)},${f1(oy + by * ar)}" fill="none" stroke="${color}" stroke-width="5"/>`;
  s += `<polyline points="${pts([[ox + ax * len, oy + ay * len], [ox, oy], [ox + bx * len, oy + by * len]])}" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<circle cx="${f1(ox)}" cy="${f1(oy)}" r="9" fill="${color}"/>`;
  return s;
}

/** Four angles in a 2x2 grid of cells, optionally lettered A to D in the cell corners. */
function angleGrid(angles: { deg: number; rot: number; len: number }[], color: string, letters = false) {
  let body = '';
  const options: Option[] = angles.map((a, i) => {
    const x = 20 + (i % 2) * 470, y = 20 + Math.floor(i / 2) * 350;
    body += `<rect x="${x}" y="${y}" width="450" height="330" rx="18" fill="#FFFFFF" stroke="#B9BEC7" stroke-width="3"/>`;
    body += angleSvg(x + 225, y + (letters ? 175 : 165), a.deg, a.rot, a.len, color);
    if (letters) body += text(x + 38, y + 56, 'ABCD'[i], 44, '#5C677D');
    return { id: `a${i}`, label: `${a.deg}°`, region: rectPx(x, y, 450, 330), jev: `The angle in the ${GRID4[i]} box.` };
  });
  return { body, options };
}

// 6. Smallest angle: the narrowest one has by far the longest arms.
const smallestAngle = (() => {
  const angles = [
    { deg: 47, rot: 120, len: 120 },
    { deg: 41, rot: 300, len: 115 },
    { deg: 53, rot: 210, len: 135 },
    { deg: 35, rot: 8, len: 245 },
  ];
  const { body, options } = angleGrid(angles, '#2A9D8F');
  const best = uniqueMin(angles.map((a) => a.deg));
  return defineCard({
    id: 'angle-smallest-long-arms',
    title: 'Narrowest angle',
    category: 'math',
    difficulty: 3,
    prompt: 'Tap the smallest angle.',
    kind: 'pick',
    svg: svgDoc(body, '#E9EEF3'),
    options,
    answer: options[best].id,
    explain: `The angles are ${angles.map((a) => `${a.deg}°`).join(', ')} (reading across, then down). The ${angles[best].deg}° one is the narrowest even though its arms are the longest: arm length does not change an angle.`,
    jev: {
      context: 'Four angles, each drawn as two arms meeting at a dot, in four boxes; the arms are different lengths.',
      instructions: 'In `card`, which box holds the smallest angle (the narrowest opening between the two arms)?',
    },
    source: 'drawn',
  });
})();

// 7. Which two angles are equal: same opening, different turn and arm length.
const equalPair = (() => {
  const angles = [
    { deg: 62, rot: 15, len: 200 },
    { deg: 74, rot: 160, len: 150 },
    { deg: 74, rot: 250, len: 120 },
    { deg: 86, rot: 300, len: 190 },
  ];
  const { body } = angleGrid(angles, '#E76F51', true);
  const pairs: [number, number][] = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) pairs.push([i, j]);
  const equal = pairs.filter(([i, j]) => angles[i].deg === angles[j].deg);
  if (equal.length !== 1) throw new Error('exactly one equal pair');
  const L = (i: number) => 'ABCD'[i];
  const options: Option[] = pairs.map(([i, j]) => ({ id: `${L(i)}${L(j)}`.toLowerCase(), label: `${L(i)} and ${L(j)}`, jev: `Angles ${L(i)} and ${L(j)}.` }));
  const [ei, ej] = equal[0];
  return defineCard({
    id: 'angle-equal-pair',
    title: 'Matching angles',
    category: 'math',
    difficulty: 3,
    prompt: 'Which two angles are equal?',
    kind: 'buttons',
    svg: svgDoc(body, '#E9EEF3'),
    options,
    answer: `${L(ei)}${L(ej)}`.toLowerCase(),
    explain: `A is ${angles[0].deg}°, B is ${angles[1].deg}°, C is ${angles[2].deg}° and D is ${angles[3].deg}°, so ${L(ei)} and ${L(ej)} match even though they are turned differently and have different arm lengths.`,
    jev: {
      context: 'Four angles labeled A, B, C and D, each drawn as two arms meeting at a dot, turned different ways.',
      instructions: 'In `card`, which two of the labeled angles have the same size?',
    },
    source: 'drawn',
  });
})();

// 8. The acute one among obtuse angles: the 82 degree angle is tilted so it looks square-ish.
const acuteOne = (() => {
  const angles = [
    { deg: 112, rot: 200, len: 190 },
    { deg: 82, rot: 55, len: 200 },
    { deg: 98, rot: 0, len: 200 },
    { deg: 128, rot: 250, len: 175 },
  ];
  const { body, options } = angleGrid(angles, '#7B2CBF');
  const acute = angles.map((a) => a.deg < 90);
  if (acute.filter(Boolean).length !== 1) throw new Error('one acute angle');
  const k = acute.indexOf(true);
  return defineCard({
    id: 'angle-acute-odd-one',
    title: 'Sharp one out',
    category: 'math',
    difficulty: 3,
    prompt: 'Tap the acute angle.',
    kind: 'pick',
    svg: svgDoc(body, '#E9EEF3'),
    options,
    answer: options[k].id,
    explain: `An acute angle is less than 90°. Only the ${angles[k].deg}° one is; the others are ${angles.filter((_, i) => i !== k).map((a) => `${a.deg}°`).join(', ')}, all wider than a right angle.`,
    jev: {
      context: 'Four angles, each drawn as two arms meeting at a dot, in four boxes, turned different ways.',
      instructions: 'In `card`, which box holds the acute angle (less than 90 degrees)?',
    },
    source: 'drawn',
  });
})();

// 9. Missing angle in a triangle drawn true to its angles: 180 - 48 - 67 = 65.
const missingAngle = (() => {
  const a = 48, b = 67, c = 180 - a - b;
  const base = 640, A: [number, number] = [160, 600], B: [number, number] = [A[0] + base, A[1]];
  const AC = (base * Math.sin(rad(b))) / Math.sin(rad(a + b));
  const C: [number, number] = [A[0] + AC * Math.cos(rad(a)), A[1] - AC * Math.sin(rad(a))];
  if (C[1] < 40) throw new Error('triangle too tall');
  /** A label inside the corner at P, along the bisector toward the other two vertices. */
  const label = (P: [number, number], Q: [number, number], R: [number, number], s: string, d: number) => {
    const u = (V: [number, number]) => { const dx = V[0] - P[0], dy = V[1] - P[1], m = Math.hypot(dx, dy); return [dx / m, dy / m]; };
    const [qx, qy] = u(Q), [rx, ry] = u(R), bx = qx + rx, by = qy + ry, m = Math.hypot(bx, by);
    return text(P[0] + (bx / m) * d, P[1] + (by / m) * d + 16, s, 46, s === '?' ? '#D62828' : INK);
  };
  let body = `<polygon points="${pts([A, B, C])}" fill="#FFF6DA" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>`;
  body += label(A, B, C, `${a}°`, 130) + label(B, A, C, `${b}°`, 110) + label(C, A, B, '?', 105);
  const { options, answer } = numButtons('m', [55, c, 75, 115], c, (v) => `${v}°`);
  return defineCard({
    id: 'triangle-missing-angle',
    title: 'Missing corner',
    category: 'math',
    difficulty: 1,
    prompt: 'What is the missing angle?',
    kind: 'buttons',
    svg: svgDoc(body, '#DDE7EE'),
    options,
    answer,
    explain: `The angles of a triangle add up to 180°, so the missing one is 180 - ${a} - ${b} = ${c}°.`,
    jev: {
      context: 'A triangle with two of its angles written inside the corners and a question mark in the third.',
      instructions: 'What is the angle marked with a question mark in the triangle in `card`, in degrees?',
    },
    source: 'drawn',
  });
})();

// ---------------------------------------------------------------- symmetry

const regular = (n: number, cx: number, cy: number, r: number, start = 0): [number, number][] =>
  Array.from({ length: n }, (_, k) => [cx + r * Math.cos(rad(start + (360 * k) / n)), cy - r * Math.sin(rad(start + (360 * k) / n))]);

// 10. Regular hexagon: 6 lines (three through corners, three through edge midpoints).
const hexagonLines = (() => {
  const hex = regular(6, 480, 360, 270);
  const n = symmetryLines(hex);
  const body = `<polygon points="${pts(hex)}" fill="#8AB17D" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>`;
  const { options, answer } = numButtons('l', [2, 3, 6, 12], n);
  return defineCard({
    id: 'symmetry-hexagon-lines',
    title: 'Fold the hexagon',
    category: 'math',
    difficulty: 2,
    prompt: 'How many lines of symmetry does this shape have?',
    kind: 'buttons',
    svg: svgDoc(body, '#F4F1EA'),
    options,
    answer,
    explain: `A regular hexagon has ${n} lines of symmetry: three through opposite corners and three through the middles of opposite sides.`,
    jev: {
      context: 'A regular six-sided shape.',
      instructions: 'How many lines of mirror symmetry does the shape in `card` have?',
    },
    source: 'drawn',
  });
})();

// 11. Rectangle: 2 lines, not 4 (the diagonals do not fold it onto itself).
const rectangleLines = (() => {
  const x = 180, y = 190, w = 600, h = 340;
  const rect: [number, number][] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const n = symmetryLines(rect);
  const body = `<polygon points="${pts(rect)}" fill="#E9C46A" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>`;
  const { options, answer } = numButtons('l', [0, 1, 2, 4], n);
  return defineCard({
    id: 'symmetry-rectangle-lines',
    title: 'Fold the rectangle',
    category: 'math',
    difficulty: 2,
    prompt: 'How many lines of symmetry does this rectangle have?',
    kind: 'buttons',
    svg: svgDoc(body, '#264653'),
    options,
    answer,
    explain: `A rectangle that is not a square has ${n} lines of symmetry, across the middle and down the middle. Folding along a diagonal does not lay one half on the other.`,
    jev: {
      context: 'A rectangle that is wider than it is tall.',
      instructions: 'How many lines of mirror symmetry does the rectangle in `card` have?',
    },
    source: 'drawn',
  });
})();

// 12. The letter with no line of symmetry: H, A and T fold; G does not (C would, G's bar breaks it).
const letterNone = (() => {
  const letters: { ch: string; lines: number }[] = [
    { ch: 'H', lines: 2 },
    { ch: 'A', lines: 1 },
    { ch: 'G', lines: 0 },
    { ch: 'T', lines: 1 },
  ];
  let body = '';
  const options: Option[] = letters.map((l, i) => {
    const x = 20 + (i % 2) * 470, y = 20 + Math.floor(i / 2) * 350;
    body += `<rect x="${x}" y="${y}" width="450" height="330" rx="18" fill="#FFFFFF" stroke="#B9BEC7" stroke-width="3"/>`;
    body += text(x + 225, y + 255, l.ch, 260, '#1D3557');
    return { id: l.ch.toLowerCase(), label: l.ch, region: rectPx(x, y, 450, 330), jev: `The letter in the ${GRID4[i]} box.` };
  });
  if (letters.filter((l) => l.lines === 0).length !== 1) throw new Error('one letter without symmetry');
  const k = letters.findIndex((l) => l.lines === 0);
  return defineCard({
    id: 'symmetry-letter-none',
    title: 'Mirror letters',
    category: 'math',
    difficulty: 2,
    prompt: 'Tap the letter with no line of symmetry.',
    kind: 'pick',
    svg: svgDoc(body, '#E9EEF3'),
    options,
    answer: options[k].id,
    explain: `${letters[k].ch} has no mirror line: the bar on its right side breaks the fold that a C would have. H folds two ways, and A and T fold down the middle.`,
    jev: {
      context: 'Four capital letters, one in each of four boxes.',
      instructions: 'In `card`, which letter has no line of mirror symmetry?',
    },
    source: 'drawn',
  });
})();

// 13. Exactly two lines: square 4, rhombus 2, equilateral triangle 3, isosceles trapezoid 1.
const exactlyTwo = (() => {
  const shapes: { name: string; p: [number, number][]; color: string }[] = [
    { name: 'square', p: [[-110, -110], [110, -110], [110, 110], [-110, 110]], color: '#2A9D8F' },
    { name: 'equilateral triangle', p: regular(3, 0, 20, 145, 90), color: '#E9C46A' },
    { name: 'isosceles trapezoid', p: [[-70, -90], [70, -90], [150, 90], [-150, 90]], color: '#8AB17D' },
    { name: 'rhombus', p: [[0, -140], [100, 0], [0, 140], [-100, 0]], color: '#E76F51' },
  ];
  let body = '';
  const options: Option[] = shapes.map((s, i) => {
    const x = 20 + (i % 2) * 470, y = 20 + Math.floor(i / 2) * 350, cx = x + 225, cy = y + 165;
    body += `<rect x="${x}" y="${y}" width="450" height="330" rx="18" fill="#FFFFFF" stroke="#B9BEC7" stroke-width="3"/>`;
    body += `<polygon points="${pts(s.p.map(([a, b]) => [cx + a, cy + b]))}" fill="${s.color}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`;
    return { id: s.name.split(' ').pop()!, label: s.name[0].toUpperCase() + s.name.slice(1), region: rectPx(x, y, 450, 330), jev: `The shape in the ${GRID4[i]} box.` };
  });
  const lines = shapes.map((s) => symmetryLines(s.p));
  if (lines.join() !== '4,3,1,2') throw new Error(`unexpected symmetry counts ${lines}`);
  const k = lines.indexOf(2);
  return defineCard({
    id: 'symmetry-exactly-two',
    title: 'Two folds',
    category: 'math',
    difficulty: 2,
    prompt: 'Tap the shape with exactly 2 lines of symmetry.',
    kind: 'pick',
    svg: svgDoc(body, '#E9EEF3'),
    options,
    answer: options[k].id,
    explain: `The ${shapes[k].name} folds only along its two diagonals. The square has ${lines[0]} lines, the triangle ${lines[1]} and the trapezoid ${lines[2]}.`,
    jev: {
      context: 'Four flat shapes, one in each of four boxes.',
      instructions: 'In `card`, which shape has exactly two lines of mirror symmetry?',
    },
    source: 'drawn',
  });
})();

const cards: CardSpec[] = [
  sundayFirst, leapMarch, countFridays, thirdTuesday, tornTop,
  smallestAngle, equalPair, acuteOne, missingAngle,
  hexagonLines, rectangleLines, letterNone, exactlyTwo,
];
export default cards;
