/**
 * More flag cards: look-alike sets where the difference is real and visible (stripe order, proportions, a star,
 * the number of serration points). Flags are drawn in SVG to their official proportions and colors, each in its
 * own unit grid and scaled to a common height. Flags whose emblems are too detailed to draw well (Mexico,
 * Ecuador, Slovenia, Nicaragua, El Salvador) only ever appear as button names, never as pictures.
 */
import { defineCard, rectPx, svgDoc, type Option } from './lib.ts';

interface Flag {
  id: string;
  name: string;
  /** Width and height in the flag's own construction units. */
  w: number;
  h: number;
  /** SVG content in those units. */
  body: string;
}

/** A star polygon centered at (cx, cy) with outer radius r, pointing up (rot in degrees turns it clockwise). */
function star(cx: number, cy: number, r: number, fill: string, points = 5, inner = 0.382, rot = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = ((rot + (i * 180) / points) * Math.PI) / 180;
    const rr = i % 2 === 0 ? r : r * inner;
    pts.push(`${(cx + rr * Math.sin(a)).toFixed(3)},${(cy - rr * Math.cos(a)).toFixed(3)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
}

const vertical = (id: string, name: string, w: number, h: number, colors: string[], extra = ''): Flag => ({
  id,
  name,
  w,
  h,
  body: colors.map((c, i) => `<rect x="${(w / colors.length) * i}" width="${w / colors.length}" height="${h}" fill="${c}"/>`).join('') + extra,
});

const horizontal = (id: string, name: string, w: number, h: number, colors: string[], extra = ''): Flag => ({
  id,
  name,
  w,
  h,
  body: colors.map((c, i) => `<rect y="${(h / colors.length) * i}" width="${w}" height="${h / colors.length}" fill="${c}"/>`).join('') + extra,
});

/** The Union Flag in a 60 x 30 box at the origin (for a canton of a 120 x 60 flag). Ids are prefixed per flag. */
const unionJack = (p: string): string =>
  `<defs><clipPath id="${p}-s"><rect width="60" height="30"/></clipPath><clipPath id="${p}-t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath></defs>` +
  `<g clip-path="url(#${p}-s)"><rect width="60" height="30" fill="#012169"/>` +
  `<path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" stroke-width="6"/>` +
  `<path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#${p}-t)" stroke="#C8102E" stroke-width="4"/>` +
  `<path d="M30,0 v30 M0,15 h60" stroke="#FFFFFF" stroke-width="10"/>` +
  `<path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6"/></g>`;

// Red and white bicolors: same colors, different proportions and order.
const INDONESIA = horizontal('indonesia', 'Indonesia', 3, 2, ['#E70011', '#FFFFFF']); // 2:3
const MONACO = horizontal('monaco', 'Monaco', 5, 4, ['#CE1126', '#FFFFFF']); // 4:5
const POLAND = horizontal('poland', 'Poland', 8, 5, ['#FFFFFF', '#DC143C']); // 5:8

// Red, white and blue horizontal tricolors.
const NETHERLANDS = horizontal('netherlands', 'Netherlands', 3, 2, ['#AE1C28', '#FFFFFF', '#21468B']); // 2:3, dark blue
const LUXEMBOURG = horizontal('luxembourg', 'Luxembourg', 5, 3, ['#EA141D', '#FFFFFF', '#00A2E1']); // 3:5, sky blue
const RUSSIA = horizontal('russia', 'Russia', 3, 2, ['#FFFFFF', '#0039A6', '#D52B1E']);

// Australia and New Zealand, 1:2, drawn in a 120 x 60 grid with the Union Flag in the 60 x 30 canton.
// Australia: the seven-pointed Commonwealth Star (outer diameter 3/10 of the hoist) under the canton, and the
// Southern Cross in white: four seven-pointed stars (diameter 1/7 of the hoist) and the small five-pointed Epsilon.
const AUSTRALIA: Flag = {
  id: 'australia',
  name: 'Australia',
  w: 120,
  h: 60,
  body:
    `<rect width="120" height="60" fill="#012169"/>` +
    unionJack('au') +
    star(30, 45, 9, '#FFFFFF', 7, 4 / 9) +
    star(90, 50, 30 / 7, '#FFFFFF', 7, 4 / 9) + // Alpha
    star(75, 26.25, 30 / 7, '#FFFFFF', 7, 4 / 9) + // Beta
    star(90, 10, 30 / 7, '#FFFFFF', 7, 4 / 9) + // Gamma
    star(103.33, 22.25, 30 / 7, '#FFFFFF', 7, 4 / 9) + // Delta
    star(96, 32.5, 2.5, '#FFFFFF', 5, 0.382), // Epsilon
};
// New Zealand: four red five-pointed stars edged in white, no Commonwealth Star and no Epsilon.
const nzStar = (cx: number, cy: number, r: number) => star(cx, cy, r + 1, '#FFFFFF') + star(cx, cy, r, '#C8102E');
const NEW_ZEALAND: Flag = {
  id: 'new-zealand',
  name: 'New Zealand',
  w: 120,
  h: 60,
  body: `<rect width="120" height="60" fill="#012169"/>` + unionJack('nz') + nzStar(90, 48, 5) + nzStar(78, 27, 4.5) + nzStar(90, 12, 4.5) + nzStar(102, 23.5, 3.9),
};

// Yellow, blue and red.
const COLOMBIA: Flag = {
  id: 'colombia',
  name: 'Colombia',
  w: 3,
  h: 2,
  body: `<rect width="3" height="1" fill="#FCD116"/><rect y="1" width="3" height="0.5" fill="#003893"/><rect y="1.5" width="3" height="0.5" fill="#CE1126"/>`,
};
// Venezuela's national flag: equal stripes, eight white stars in an arc on the blue (the coat of arms is only on the state flag).
const venezuelaStars = [-70, -50, -30, -10, 10, 30, 50, 70]
  .map((a) => {
    const t = (a * Math.PI) / 180;
    return star(90 + 36 * Math.sin(t), 84 - 36 * Math.cos(t), 5.2, '#FFFFFF', 5, 0.382, a);
  })
  .join('');
const VENEZUELA = horizontal('venezuela', 'Venezuela', 180, 120, ['#FFCC00', '#00247D', '#CF142B'], venezuelaStars);
const LITHUANIA = horizontal('lithuania', 'Lithuania', 5, 3, ['#FDB913', '#006A44', '#C1272D']);
const ARMENIA = horizontal('armenia', 'Armenia', 2, 1, ['#D90012', '#0033A0', '#F2A800']);

// West African vertical tricolors, all 2:3.
const MALI = vertical('mali', 'Mali', 3, 2, ['#14B53A', '#FCD116', '#CE1126']);
const GUINEA = vertical('guinea', 'Guinea', 3, 2, ['#CE1126', '#FCD116', '#009460']);
const SENEGAL = vertical('senegal', 'Senegal', 3, 2, ['#00853F', '#FDEF42', '#E31B23'], star(1.5, 1, 0.34, '#00853F'));
const CAMEROON = vertical('cameroon', 'Cameroon', 3, 2, ['#007A5E', '#CE1126', '#FCD116'], star(1.5, 1, 0.34, '#FCD116'));

// Slovakia: white, blue, red with the coat of arms (a white double cross on three blue hills, on a red shield
// edged in white) in the hoist half, over all three stripes. Drawn in a 900 x 600 grid.
const shield = (inset: number) => {
  const x0 = 140 + inset, x1 = 360 - inset, top = 130 + inset, side = 360, bottom = 470 - inset;
  return `M${x0},${top} H${x1} V${side} C${x1},${bottom - 40} ${290},${bottom - 8} 250,${bottom} C${210},${bottom - 8} ${x0},${bottom - 40} ${x0},${side} Z`;
};
const SLOVAKIA: Flag = {
  id: 'slovakia',
  name: 'Slovakia',
  w: 900,
  h: 600,
  body:
    `<rect width="900" height="200" fill="#FFFFFF"/><rect y="200" width="900" height="200" fill="#0B4EA2"/><rect y="400" width="900" height="200" fill="#EE1C25"/>` +
    `<defs><clipPath id="sk-in"><path d="${shield(10)}"/></clipPath></defs>` +
    `<path d="${shield(0)}" fill="#FFFFFF"/><path d="${shield(10)}" fill="#EE1C25"/>` +
    `<g clip-path="url(#sk-in)">` +
    `<rect x="239" y="168" width="22" height="232" fill="#FFFFFF"/>` +
    `<rect x="203" y="208" width="94" height="22" fill="#FFFFFF"/>` +
    `<rect x="186" y="268" width="128" height="24" fill="#FFFFFF"/>` +
    `<path d="M130,480 V420 C150,400 180,398 205,410 C215,378 285,378 295,410 C320,398 350,400 370,420 V480 Z" fill="#0B4EA2"/>` +
    `</g>`,
};

const ITALY = vertical('italy', 'Italy', 3, 2, ['#009246', '#FFFFFF', '#CE2B37']);

// Discs.
const JAPAN: Flag = { id: 'japan', name: 'Japan', w: 900, h: 600, body: `<rect width="900" height="600" fill="#FFFFFF"/><circle cx="450" cy="300" r="180" fill="#BC002D"/>` };
const BANGLADESH: Flag = { id: 'bangladesh', name: 'Bangladesh', w: 1000, h: 600, body: `<rect width="1000" height="600" fill="#006A4E"/><circle cx="450" cy="300" r="200" fill="#F42A41"/>` };
const PALAU: Flag = { id: 'palau', name: 'Palau', w: 800, h: 500, body: `<rect width="800" height="500" fill="#4AADD6"/><circle cx="350" cy="250" r="150" fill="#FFDE00"/>` };
const LAOS: Flag = {
  id: 'laos',
  name: 'Laos',
  w: 900,
  h: 600,
  body: `<rect width="900" height="600" fill="#CE1126"/><rect y="150" width="900" height="300" fill="#002868"/><circle cx="450" cy="300" r="120" fill="#FFFFFF"/>`,
};

// Serrated hoist bands: Qatar (11:28, maroon, nine points) and Bahrain (3:5, red, five points).
function serrated(id: string, name: string, w: number, h: number, field: string, points: number, valley: number, tip: number): Flag {
  const d = [`M0,0 L${valley},0`];
  for (let i = 0; i < points; i++) d.push(`L${tip},${((i + 0.5) * h) / points} L${valley},${((i + 1) * h) / points}`);
  d.push(`L0,${h} Z`);
  return { id, name, w, h, body: `<rect width="${w}" height="${h}" fill="${field}"/><path d="${d.join(' ')}" fill="#FFFFFF"/>` };
}
const QATAR = serrated('qatar', 'Qatar', 28, 11, '#8A1538', 9, 7, 9.5);
const BAHRAIN = serrated('bahrain', 'Bahrain', 5, 3, '#CE1126', 5, 1.25, 2);

// Pan-Arab colors, all 1:2 in a 1200 x 600 grid.
const PALESTINE = horizontal('palestine', 'Palestine', 1200, 600, ['#000000', '#FFFFFF', '#007A3D'], `<path d="M0,0 L400,300 L0,600 Z" fill="#CE1126"/>`);
const JORDAN = horizontal(
  'jordan',
  'Jordan',
  1200,
  600,
  ['#000000', '#FFFFFF', '#007A3D'],
  `<path d="M0,0 L600,300 L0,600 Z" fill="#CE1126"/>` + star(200, 300, 60, '#FFFFFF', 7, 0.5),
);
const SUDAN = horizontal('sudan', 'Sudan', 1200, 600, ['#D21034', '#FFFFFF', '#000000'], `<path d="M0,0 L400,300 L0,600 Z" fill="#007229"/>`);
const KUWAIT = horizontal('kuwait', 'Kuwait', 1200, 600, ['#007A3D', '#FFFFFF', '#CE1126'], `<path d="M0,0 L300,200 V400 L0,600 Z" fill="#000000"/>`);

// Black, yellow and red.
const BELGIUM = vertical('belgium', 'Belgium', 15, 13, ['#000000', '#FDDA24', '#EF3340']); // 13:15
const GERMANY = horizontal('germany', 'Germany', 5, 3, ['#000000', '#DD0000', '#FFCE00']);
const ROMANIA = vertical('romania', 'Romania', 3, 2, ['#002B7F', '#FCD116', '#CE1126']);

// Honduras: turquoise, white, turquoise with five stars in an X on the white stripe (1:2, 72 x 36 grid).
const HONDURAS = horizontal(
  'honduras',
  'Honduras',
  72,
  36,
  ['#00BCE4', '#FFFFFF', '#00BCE4'],
  [
    [36, 18],
    [27, 14.6],
    [27, 21.4],
    [45, 14.6],
    [45, 21.4],
  ]
    .map(([x, y]) => star(x, y, 1.9, '#00BCE4'))
    .join(''),
);

// Stars and triangles.
const CUBA: Flag = {
  id: 'cuba',
  name: 'Cuba',
  w: 200,
  h: 100,
  body:
    [0, 1, 2, 3, 4].map((i) => `<rect y="${i * 20}" width="200" height="20" fill="${i % 2 ? '#FFFFFF' : '#002A8F'}"/>`).join('') +
    `<path d="M0,0 L86.6,50 L0,100 Z" fill="#CF142B"/>` +
    star(28.87, 50, 15, '#FFFFFF'),
};
const PUERTO_RICO: Flag = {
  id: 'puerto-rico',
  name: 'Puerto Rico',
  w: 150,
  h: 100,
  body:
    [0, 1, 2, 3, 4].map((i) => `<rect y="${i * 20}" width="150" height="20" fill="${i % 2 ? '#FFFFFF' : '#ED0000'}"/>`).join('') +
    `<path d="M0,0 L86.6,50 L0,100 Z" fill="#0050F0"/>` +
    star(28.87, 50, 15, '#FFFFFF'),
};
const CHILE: Flag = {
  id: 'chile',
  name: 'Chile',
  w: 3,
  h: 2,
  body: `<rect width="3" height="1" fill="#FFFFFF"/><rect y="1" width="3" height="1" fill="#D52B1E"/><rect width="1" height="1" fill="#0039A6"/>` + star(0.5, 0.5, 0.25, '#FFFFFF'),
};
const CZECHIA: Flag = {
  id: 'czechia',
  name: 'Czechia',
  w: 3,
  h: 2,
  body: `<rect width="3" height="1" fill="#FFFFFF"/><rect y="1" width="3" height="1" fill="#D7141A"/><path d="M0,0 L1.5,1 L0,2 Z" fill="#11457E"/>`,
};

/** Lays flags out in rows at one common height, centered, and returns the SVG plus pick options. */
function layout(rows: Flag[][], height: number): { svg: string; options: Option[] } {
  const gap = 60;
  const totalH = rows.length * height + (rows.length - 1) * gap;
  let y = (720 - totalH) / 2;
  let body = '';
  const options: Option[] = [];
  rows.forEach((row, ri) => {
    const widths = row.map((f) => (f.w / f.h) * height);
    const rowW = widths.reduce((a, b) => a + b, 0) + gap * (row.length - 1);
    let x = (960 - rowW) / 2;
    row.forEach((f, ci) => {
      const w = widths[ci];
      const s = height / f.h;
      body += `<rect x="${x + 3}" y="${y + 4}" width="${w}" height="${height}" fill="#000" opacity="0.12"/>`;
      body += `<g transform="translate(${x} ${y}) scale(${s})">${f.body}</g>`;
      body += `<rect x="${x}" y="${y}" width="${w}" height="${height}" fill="none" stroke="#9A9A9A" stroke-width="1"/>`;
      options.push({ id: f.id, label: f.name, region: rectPx(x - 8, y - 8, w + 16, height + 16), jev: place(ri, ci, row.length, rows.length) });
      x += w + gap;
    });
    y += height + gap;
  });
  return { svg: svgDoc(body, '#EEF1F4'), options };
}

function place(row: number, col: number, n: number, rows: number): string {
  if (n === 1) return row === 0 ? 'The top flag.' : 'The bottom flag.';
  const r = rows === 1 ? '' : row === 0 ? 'top row' : 'bottom row';
  const c = n === 2 ? (col === 0 ? 'on the left' : 'on the right') : n === 3 ? ['on the left', 'in the middle', 'on the right'][col] : `number ${col + 1} from the left`;
  return r ? `The flag in the ${r}, ${c}.` : `The flag ${c}.`;
}

/** One big flag, centered, for "Whose flag is this?" cards. */
function single(f: Flag, maxW = 760, maxH = 500): string {
  const s = Math.min(maxW / f.w, maxH / f.h);
  const w = f.w * s, h = f.h * s;
  const x = (960 - w) / 2, y = (720 - h) / 2;
  return svgDoc(
    `<rect x="${x + 4}" y="${y + 5}" width="${w}" height="${h}" fill="#000" opacity="0.12"/><g transform="translate(${x} ${y}) scale(${s})">${f.body}</g><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#9A9A9A" stroke-width="1"/>`,
    '#EEF1F4',
  );
}

const buttons = (names: string[]): Option[] => names.map((n) => ({ id: n.toLowerCase().replace(/[^a-z]+/g, '-'), label: n, jev: n }));

const redWhite = layout([[INDONESIA, MONACO, POLAND]], 165);
const tricolor = layout([[NETHERLANDS, RUSSIA, LUXEMBOURG]], 170);
const southernCross = layout([[AUSTRALIA], [NEW_ZEALAND]], 230);
const yellowTop = layout([[VENEZUELA, LITHUANIA], [ARMENIA, COLOMBIA]], 190);
const westAfrica = layout([[GUINEA, SENEGAL], [MALI, CAMEROON]], 190);
const discs = layout([[PALAU, JAPAN], [LAOS, BANGLADESH]], 190);
const gulf = layout([[QATAR], [BAHRAIN]], 230);
const panArab = layout([[PALESTINE, KUWAIT], [JORDAN, SUDAN]], 165);
const blackYellowRed = layout([[GERMANY, ROMANIA, BELGIUM]], 180);
const caribbean = layout([[PUERTO_RICO, CHILE], [CZECHIA, CUBA]], 190);

const pickJev = (context: string, country: string) => ({ context, instructions: `Which flag in \`card\` is the flag of ${country}?` });
const whoseJev = { context: 'One national flag on a plain background.', instructions: 'Which country does the flag in `card` belong to?' };

export default [
  defineCard({
    id: 'flag-monaco',
    title: 'Red over white',
    category: 'flags',
    difficulty: 3,
    prompt: "Tap Monaco's flag.",
    kind: 'pick',
    svg: redWhite.svg,
    options: redWhite.options,
    answer: 'monaco',
    explain: "Monaco and Indonesia both fly red over white; Monaco's flag is 4:5, almost square, while Indonesia's is 2:3. Poland's is white over red.",
    jev: pickJev('Three red and white national flags in a row, drawn at the same height.', 'Monaco'),
    source: 'drawn',
  }),
  defineCard({
    id: 'flag-luxembourg',
    title: 'Red, white and blue',
    category: 'flags',
    difficulty: 3,
    prompt: "Tap Luxembourg's flag.",
    kind: 'pick',
    svg: tricolor.svg,
    options: tricolor.options,
    answer: 'luxembourg',
    explain: "Luxembourg's red, white and blue uses a light sky blue and is longer (3:5); the Netherlands uses a dark blue at 2:3. Russia's runs white, blue, red.",
    jev: pickJev('Three horizontal tricolor flags in a row, drawn at the same height.', 'Luxembourg'),
    source: 'drawn',
  }),
  defineCard({
    id: 'flag-new-zealand',
    title: 'Southern Cross',
    category: 'flags',
    difficulty: 2,
    prompt: "Tap New Zealand's flag.",
    kind: 'pick',
    svg: southernCross.svg,
    options: southernCross.options,
    answer: 'new-zealand',
    explain: "New Zealand's flag has four red stars edged in white; Australia's has white stars, five in the Southern Cross plus the big seven-pointed Commonwealth Star.",
    jev: pickJev('Two blue flags with the Union Flag in the corner, one above the other.', 'New Zealand'),
    source: 'drawn',
  }),
  defineCard({
    id: 'flag-colombia',
    title: 'Yellow on top',
    category: 'flags',
    difficulty: 2,
    prompt: "Tap Colombia's flag.",
    kind: 'pick',
    svg: yellowTop.svg,
    options: yellowTop.options,
    answer: 'colombia',
    explain: "Colombia's yellow stripe takes the whole top half, over blue and red quarters; Venezuela's three stripes are equal and carry an arc of eight stars.",
    jev: pickJev('Four horizontally striped national flags in two rows.', 'Colombia'),
    source: 'drawn',
  }),
  defineCard({
    id: 'flag-mali',
    title: 'Green, yellow, red',
    category: 'flags',
    difficulty: 3,
    prompt: "Tap Mali's flag.",
    kind: 'pick',
    svg: westAfrica.svg,
    options: westAfrica.options,
    answer: 'mali',
    explain: "Mali's flag runs green, yellow, red from the flagpole with no star; Guinea's is the same colors in reverse, and Senegal's adds a green star.",
    jev: pickJev('Four vertical tricolor flags in green, yellow and red, in two rows.', 'Mali'),
    source: 'drawn',
  }),
  defineCard({
    id: 'flag-whose-senegal',
    title: 'Green star on yellow',
    category: 'flags',
    difficulty: 2,
    prompt: 'Whose flag is this?',
    kind: 'buttons',
    svg: single(SENEGAL),
    options: buttons(['Cameroon', 'Senegal', 'Mali', 'Guinea']),
    answer: 'senegal',
    explain: "Senegal's flag is green, yellow, red with a green star in the middle; Cameroon's is green, red, yellow with a yellow star on the red.",
    jev: whoseJev,
    source: 'drawn',
  }),
  defineCard({
    id: 'flag-whose-slovakia',
    title: 'Shield on a tricolor',
    category: 'flags',
    difficulty: 2,
    prompt: 'Whose flag is this?',
    kind: 'buttons',
    svg: single(SLOVAKIA),
    options: buttons(['Slovenia', 'Russia', 'Slovakia', 'Serbia']),
    answer: 'slovakia',
    explain: "Slovakia's flag carries a red shield with a white double cross on three blue hills; Slovenia's shield is blue with a white mountain, and Russia's flag has no shield.",
    jev: whoseJev,
    source: 'drawn',
  }),
  defineCard({
    id: 'flag-whose-italy',
    title: 'Green, white, red',
    category: 'flags',
    difficulty: 1,
    prompt: 'Whose flag is this?',
    kind: 'buttons',
    svg: single(ITALY),
    options: buttons(['Mexico', 'Ireland', 'Italy', "Cote d'Ivoire"]),
    answer: 'italy',
    explain: "Italy's flag is a plain green, white and red tricolor; Mexico's uses the same colors but always has its eagle emblem in the middle.",
    jev: whoseJev,
    source: 'drawn',
  }),
  defineCard({
    id: 'flag-bangladesh',
    title: 'Discs',
    category: 'flags',
    difficulty: 1,
    prompt: "Tap Bangladesh's flag.",
    kind: 'pick',
    svg: discs.svg,
    options: discs.options,
    answer: 'bangladesh',
    explain: "Bangladesh's flag is a red disc on dark green, set a little toward the flagpole; Japan's is red on white and Palau's is yellow on light blue.",
    jev: pickJev('Four national flags with a disc on them, in two rows.', 'Bangladesh'),
    source: 'drawn',
  }),
  defineCard({
    id: 'flag-bahrain',
    title: 'Serrated edge',
    category: 'flags',
    difficulty: 2,
    prompt: "Tap Bahrain's flag.",
    kind: 'pick',
    svg: gulf.svg,
    options: gulf.options,
    answer: 'bahrain',
    explain: "Bahrain's flag is red with a white band of five points; Qatar's is maroon, much longer, with nine points.",
    jev: pickJev('Two flags with a white serrated band at the flagpole, one above the other.', 'Bahrain'),
    source: 'drawn',
  }),
  defineCard({
    id: 'flag-jordan',
    title: 'Pan-Arab colors',
    category: 'flags',
    difficulty: 3,
    prompt: "Tap Jordan's flag.",
    kind: 'pick',
    svg: panArab.svg,
    options: panArab.options,
    answer: 'jordan',
    explain: "Jordan's flag is Palestine's black, white and green with a red triangle, but the triangle reaches halfway across and holds a white seven-pointed star.",
    jev: pickJev('Four national flags in red, white, black and green, in two rows.', 'Jordan'),
    source: 'drawn',
  }),
  defineCard({
    id: 'flag-belgium',
    title: 'Black, yellow, red',
    category: 'flags',
    difficulty: 1,
    prompt: "Tap Belgium's flag.",
    kind: 'pick',
    svg: blackYellowRed.svg,
    options: blackYellowRed.options,
    answer: 'belgium',
    explain: "Belgium's flag has vertical black, yellow and red stripes and is almost square; Germany's stripes are horizontal, black, red, gold.",
    jev: pickJev('Three striped national flags in a row, drawn at the same height.', 'Belgium'),
    source: 'drawn',
  }),
  defineCard({
    id: 'flag-whose-honduras',
    title: 'Five stars',
    category: 'flags',
    difficulty: 2,
    prompt: 'Whose flag is this?',
    kind: 'buttons',
    svg: single(HONDURAS),
    options: buttons(['Nicaragua', 'El Salvador', 'Guatemala', 'Honduras']),
    answer: 'honduras',
    explain: 'Honduras has five blue stars on the white stripe, one for each country of the old Central American federation; Nicaragua and El Salvador put a coat of arms there instead.',
    jev: whoseJev,
    source: 'drawn',
  }),
  defineCard({
    id: 'flag-cuba',
    title: 'Stripes and a star',
    category: 'flags',
    difficulty: 2,
    prompt: "Tap Cuba's flag.",
    kind: 'pick',
    svg: caribbean.svg,
    options: caribbean.options,
    answer: 'cuba',
    explain: "Cuba's flag has blue stripes and a red triangle; Puerto Rico's swaps them, red stripes and a blue triangle.",
    jev: pickJev('Four red, white and blue flags in two rows.', 'Cuba'),
    source: 'drawn',
  }),
];
