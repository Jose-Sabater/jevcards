/**
 * Flag cards: flags drawn in SVG from their official construction sheets (proportions and colors).
 * Each flag is drawn in its own unit grid and scaled to a common height.
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

/** A Nordic cross: the vertical bar starts at x0, the horizontal at y0, each of width t (in flag units). */
function nordic(id: string, name: string, w: number, h: number, field: string, cross: string, x0: number, y0: number, t: number, inner?: { color: string; inset: number }): Flag {
  let body = `<rect width="${w}" height="${h}" fill="${field}"/>`;
  body += `<rect x="${x0}" width="${t}" height="${h}" fill="${cross}"/><rect y="${y0}" width="${w}" height="${t}" fill="${cross}"/>`;
  if (inner) {
    const i = inner.inset;
    body += `<rect x="${x0 + i}" width="${t - 2 * i}" height="${h}" fill="${inner.color}"/><rect y="${y0 + i}" width="${w}" height="${t - 2 * i}" fill="${inner.color}"/>`;
  }
  return { id, name, w, h, body };
}

const vertical = (id: string, name: string, w: number, h: number, colors: string[]): Flag => ({
  id,
  name,
  w,
  h,
  body: colors.map((c, i) => `<rect x="${(w / 3) * i}" width="${w / 3}" height="${h}" fill="${c}"/>`).join(''),
});

const horizontal = (id: string, name: string, w: number, h: number, colors: string[], extra = ''): Flag => ({
  id,
  name,
  w,
  h,
  body: colors.map((c, i) => `<rect y="${(h / 3) * i}" width="${w}" height="${h / 3}" fill="${c}"/>`).join('') + extra,
});

// Nordic crosses, official proportions.
const SWEDEN = nordic('sweden', 'Sweden', 16, 10, '#006AA7', '#FECC00', 5, 4, 2); // 5+2+9 by 4+2+4
const FINLAND = nordic('finland', 'Finland', 18, 11, '#FFFFFF', '#002F6C', 5, 4, 3); // 5+3+10 by 4+3+4
const NORWAY = nordic('norway', 'Norway', 22, 16, '#BA0C2F', '#FFFFFF', 6, 6, 4, { color: '#00205B', inset: 1 }); // 6+1+2+1+12 by 6+1+2+1+6
const DENMARK = nordic('denmark', 'Denmark', 37, 28, '#C8102E', '#FFFFFF', 12, 12, 4); // 12+4+21 by 12+4+12
const ICELAND = nordic('iceland', 'Iceland', 25, 18, '#02529C', '#FFFFFF', 7, 7, 4, { color: '#DC1E35', inset: 1 }); // 7+1+2+1+14 by 7+1+2+1+7

// Green, white and orange.
const IRELAND = vertical('ireland', 'Ireland', 2, 1, ['#169B62', '#FFFFFF', '#FF883E']);
const IVORY_COAST = vertical('ivory-coast', "Cote d'Ivoire", 3, 2, ['#F77F00', '#FFFFFF', '#009E60']);
const ITALY = vertical('italy', 'Italy', 3, 2, ['#009246', '#FFFFFF', '#CE2B37']);
const NIGER = horizontal('niger', 'Niger', 7, 6, ['#E05206', '#FFFFFF', '#0DB02B'], `<circle cx="3.5" cy="3" r="${(6 / 3) * 0.85 / 2}" fill="#E05206"/>`);
const HUNGARY = horizontal('hungary', 'Hungary', 2, 1, ['#CE2939', '#FFFFFF', '#477050']);

/** Lays flags out in rows at one common height, centered, and returns the SVG plus pick options. */
function layout(rows: Flag[][], height: number, where: (row: number, col: number, rowLen: number) => string): { svg: string; options: Option[] } {
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
      options.push({ id: f.id, label: f.name, region: rectPx(x - 8, y - 8, w + 16, height + 16), jev: where(ri, ci, row.length) });
      x += w + gap;
    });
    y += height + gap;
  });
  return { svg: svgDoc(body, '#EEF1F4'), options };
}

const place = (row: number, col: number, n: number, rows: number): string => {
  const r = rows === 1 ? '' : row === 0 ? 'top row' : 'bottom row';
  const c = n === 2 ? (col === 0 ? 'on the left' : 'on the right') : n === 3 ? ['on the left', 'in the middle', 'on the right'][col] : `number ${col + 1} from the left`;
  return r ? `The flag in the ${r}, ${c}.` : `The flag ${c}.`;
};

// Sweden sits in the bottom row so it is not the obvious first pick.
const nordicLayout = layout([[NORWAY, FINLAND, DENMARK], [ICELAND, SWEDEN]], 170, (r, c, n) => place(r, c, n, 2));
const greenLayout = layout([[IVORY_COAST, HUNGARY, ITALY], [NIGER, IRELAND]], 150, (r, c, n) => place(r, c, n, 2));

export default [
  defineCard({
    id: 'flag-sweden',
    title: 'Nordic crosses',
    category: 'flags',
    difficulty: 1,
    prompt: "Tap Sweden's flag.",
    kind: 'pick',
    svg: nordicLayout.svg,
    options: nordicLayout.options,
    answer: 'sweden',
    explain: "Sweden's flag is a yellow cross on blue; all five Nordic flags share the off-center cross that Denmark's flag started.",
    jev: {
      context: 'Five national flags with Nordic crosses, in two rows.',
      instructions: "Which flag in `card` is Sweden's flag?",
    },
    source: 'drawn',
  }),
  defineCard({
    id: 'flag-ireland',
    title: 'Green, white and orange',
    category: 'flags',
    difficulty: 2,
    prompt: 'Tap the flag of Ireland.',
    kind: 'pick',
    svg: greenLayout.svg,
    options: greenLayout.options,
    answer: 'ireland',
    explain: "Ireland's flag runs green, white, orange from the flagpole and is twice as wide as it is tall; Cote d'Ivoire uses the same colors in reverse order.",
    jev: {
      context: 'Five national flags in two rows, most of them striped.',
      instructions: 'Which flag in `card` is the flag of Ireland?',
    },
    source: 'drawn',
  }),
];
