/**
 * Everyday science in pictures: circuits, magnets, the moon, levers, pulleys, water, shadows, density, food
 * chains, planets, thermometers, states of matter, floating ice and mirrors. Every picture is drawn from fixed
 * coordinates, and every answer is computed from the same data that draws it (or follows a rule stated in the
 * explanation), so the answers cannot drift from the pictures.
 */
import { defineCard, H, rectPx, svgDoc, W, type CardSpec, type Option, type Region } from './lib.ts';

const FONT = `font-family="Arial, Helvetica, sans-serif"`;
const rad = (deg: number) => (deg * Math.PI) / 180;
const f1 = (n: number) => n.toFixed(1);
const INK = '#2B2D42';
type Pt = [number, number];
const pts = (p: Pt[]) => p.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');
const circlePx = (cx: number, cy: number, r: number): Region => ({ type: 'circle', cx: cx / W, cy: cy / H, r: r / W });
const text = (x: number, y: number, s: string, size = 32, fill = INK, extra = '') =>
  `<text x="${f1(x)}" y="${f1(y)}" text-anchor="middle" ${FONT} font-weight="bold" font-size="${size}" fill="${fill}" ${extra}>${s}</text>`;

/** Deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Clip a convex polygon to the half-plane where f(p) <= 0 (Sutherland-Hodgman, one edge). */
function clipBelow(poly: Pt[], f: (p: Pt) => number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa <= 0) out.push(a);
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

const panel3 = ['left', 'middle', 'right'];

// 1. Three circuits: one has an open switch, one wires both bulb leads to the same battery end, one is closed.
const circuitBulb = (() => {
  type Edge = { a: string; b: string; path: Pt[]; sw?: 'open' | 'closed' };
  const build = (cx: number, kind: 'open' | 'same-end' | 'closed') => {
    const L: Pt = [cx - 30, 300], R: Pt = [cx + 30, 300], neg: Pt = [cx - 75, 520], pos: Pt = [cx + 75, 520];
    const edges: Edge[] = [];
    if (kind === 'same-end') {
      edges.push({ a: 'L', b: '+', path: [L, [cx - 115, 300], [cx - 115, 600], [cx + 115, 600], [cx + 115, 520], pos] });
      edges.push({ a: 'R', b: '+', path: [R, [cx + 115, 300], [cx + 115, 520], pos] });
    } else {
      edges.push({ a: 'L', b: '-', path: [L, [cx - 115, 300], [cx - 115, 520], neg] });
      edges.push({ a: 'R', b: 's1', path: [R, [cx + 115, 300], [cx + 115, 370]] });
      edges.push({ a: 's1', b: 's2', path: [[cx + 115, 370], [cx + 115, 450]], sw: kind === 'open' ? 'open' : 'closed' });
      edges.push({ a: 's2', b: '+', path: [[cx + 115, 450], [cx + 115, 520], pos] });
    }
    return { edges, L, R, neg, pos };
  };
  const kinds = ['open', 'same-end', 'closed'] as const;
  const circuits = kinds.map((k, i) => ({ kind: k, cx: 170 + i * 310, ...build(170 + i * 310, k) }));
  // A bulb lights when its two leads connect, through wires and closed switches only, to opposite battery ends.
  const lit = (edges: Edge[]) => {
    const conn = (from: string, to: string) => {
      const seen = new Set([from]), q = [from];
      while (q.length) {
        const n = q.shift()!;
        if (n === to) return true;
        for (const e of edges) {
          if (e.sw === 'open') continue;
          const m = e.a === n ? e.b : e.b === n ? e.a : null;
          if (m && !seen.has(m)) (seen.add(m), q.push(m));
        }
      }
      return false;
    };
    if (conn('+', '-')) return false; // a short across the battery
    return (conn('L', '+') && conn('R', '-')) || (conn('L', '-') && conn('R', '+'));
  };
  const litIdx = circuits.map((c) => lit(c.edges));
  if (litIdx.filter(Boolean).length !== 1) throw new Error('exactly one bulb lights');
  let body = '';
  const options: Option[] = circuits.map((c, i) => {
    const { cx } = c;
    body += `<rect x="${cx - 150}" y="70" width="300" height="580" rx="18" fill="#FFFFFF" stroke="#C9C2B3" stroke-width="3"/>`;
    for (const e of c.edges) {
      if (e.sw) {
        const [[x1, y1], [x2, y2]] = e.path;
        body += `<circle cx="${x1}" cy="${y1}" r="9" fill="${INK}"/><circle cx="${x2}" cy="${y2}" r="9" fill="${INK}"/>`;
        const tip: Pt = e.sw === 'open' ? [x1 - 48, y1 + 64] : [x2, y2];
        body += `<line x1="${x1}" y1="${y1}" x2="${f1(tip[0])}" y2="${f1(tip[1])}" stroke="#D62828" stroke-width="9" stroke-linecap="round"/>`;
      } else body += `<polyline points="${pts(e.path)}" fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>`;
    }
    // Bulb: glass, filament, base with two leads.
    body += `<circle cx="${cx}" cy="190" r="62" fill="#F3F1E8" stroke="${INK}" stroke-width="5"/>`;
    body += `<path d="M${cx - 18},250 L${cx - 18},205 Q${cx - 9},180 ${cx},205 Q${cx + 9},180 ${cx + 18},205 L${cx + 18},250" fill="none" stroke="#6B6B6B" stroke-width="4"/>`;
    body += `<rect x="${cx - 34}" y="246" width="68" height="44" rx="6" fill="#9AA3AD" stroke="${INK}" stroke-width="4"/>`;
    body += `<line x1="${cx - 30}" y1="290" x2="${cx - 30}" y2="300" stroke="${INK}" stroke-width="7"/><line x1="${cx + 30}" y1="290" x2="${cx + 30}" y2="300" stroke="${INK}" stroke-width="7"/>`;
    // Battery lying flat: minus on the left, plus (with the nub) on the right.
    body += `<rect x="${cx - 75}" y="490" width="140" height="60" rx="8" fill="#2A9D8F" stroke="${INK}" stroke-width="4"/>`;
    body += `<rect x="${cx + 65}" y="508" width="12" height="24" fill="#9AA3AD" stroke="${INK}" stroke-width="3"/>`;
    body += text(cx - 46, 532, '-', 36, '#FFFFFF') + text(cx + 42, 532, '+', 36, '#FFFFFF');
    return { id: c.kind, label: c.kind === 'open' ? 'Open switch' : c.kind === 'same-end' ? 'Both wires to plus' : 'Closed loop', region: rectPx(cx - 150, 70, 300, 580), jev: `The circuit on the ${panel3[i]}.` };
  });
  return defineCard({
    id: 'circuit-which-bulb',
    title: 'Closed loop',
    category: 'science',
    difficulty: 2,
    prompt: 'Which bulb lights up?',
    kind: 'pick',
    svg: svgDoc(body, '#EDE7DA'),
    options,
    answer: circuits[litIdx.indexOf(true)].kind,
    explain: 'Current needs a closed loop from one end of the battery, through the bulb, to the other end. The left switch is open, and the middle bulb has both wires on the plus end, so only the right bulb lights.',
    jev: {
      context: 'Three simple circuits side by side, each with a battery, a bulb and wires; two have a red switch.',
      instructions: 'In `card`, which of the three bulbs lights up?',
    },
    source: 'drawn',
  });
})();

// 2. Three pairs of bar magnets; the ends that face each other decide attract or repel.
const magnetPair = (() => {
  const pairs = [['NS', 'SN'], ['NS', 'NS'], ['SN', 'NS']] as const;
  const col = { N: '#D62828', S: '#1F5FD6' } as const;
  const attracts = pairs.map(([a, b]) => a[1] !== b[0]);
  if (attracts.filter(Boolean).length !== 1) throw new Error('exactly one pair attracts');
  let body = '';
  const where = ['top', 'middle', 'bottom'];
  const options: Option[] = pairs.map((p, i) => {
    const y = 130 + i * 230, mw = 300, mh = 100, gap = 120;
    const x1 = (W - 2 * mw - gap) / 2, x2 = x1 + mw + gap;
    for (const [x, m] of [[x1, p[0]], [x2, p[1]]] as const) {
      for (let h = 0; h < 2; h++) {
        const pole = m[h] as 'N' | 'S';
        body += `<rect x="${x + h * (mw / 2)}" y="${y - mh / 2}" width="${mw / 2}" height="${mh}" fill="${col[pole]}" stroke="${INK}" stroke-width="4"/>`;
        body += text(x + h * (mw / 2) + mw / 4, y + 20, pole, 56, '#FFFFFF');
      }
    }
    return { id: `p${i}`, label: `${p[0][0]}-${p[0][1]} and ${p[1][0]}-${p[1][1]}`, region: rectPx(x1 - 20, y - mh / 2 - 30, 2 * mw + gap + 40, mh + 60), jev: `The ${where[i]} pair of magnets.` };
  });
  const ans = attracts.indexOf(true);
  return defineCard({
    id: 'magnet-pair-attract',
    title: 'Opposites attract',
    category: 'science',
    difficulty: 1,
    prompt: 'Which pair of magnets pulls together?',
    kind: 'pick',
    svg: svgDoc(body, '#F4F1EA'),
    options,
    answer: `p${ans}`,
    explain: 'Unlike poles attract and like poles repel. Only the middle pair has a south end facing a north end; the others face S to S and N to N.',
    jev: {
      context: 'Three pairs of bar magnets, each end marked N or S, with a gap between the two magnets of each pair.',
      instructions: 'In `card`, which pair of magnets attracts each other?',
    },
    source: 'drawn',
  });
})();

// 3. Moon phases as seen from the Northern Hemisphere: waxing means lit on the right.
const moonWaxingCrescent = (() => {
  type Phase = { id: string; label: string; lit: 'right' | 'left'; k: number };
  const phases: Phase[] = [
    { id: 'waning-crescent', label: 'Waning crescent', lit: 'left', k: 0.2 },
    { id: 'first-quarter', label: 'First quarter', lit: 'right', k: 0.5 },
    { id: 'waxing-crescent', label: 'Waxing crescent', lit: 'right', k: 0.2 },
    { id: 'waning-gibbous', label: 'Waning gibbous', lit: 'left', k: 0.8 },
  ];
  const isAnswer = (p: Phase) => p.lit === 'right' && p.k < 0.5; // Northern Hemisphere: waxing is lit on the right
  if (phases.filter(isAnswer).length !== 1) throw new Error('one waxing crescent');
  const rand = rng(77);
  let body = '';
  for (let i = 0; i < 90; i++) body += `<circle cx="${f1(rand() * W)}" cy="${f1(rand() * H)}" r="${f1(1 + rand() * 2)}" fill="#FFFFFF" opacity="${f1(0.4 + rand() * 0.5)}"/>`;
  const R = 95;
  const where = ['far left', 'second from the left', 'second from the right', 'far right'];
  const options: Option[] = phases.map((p, i) => {
    const cx = 130 + i * 233, cy = 360;
    // Lit part for the right side: right limb from top to bottom, then back up along the terminator ellipse.
    const t = R * Math.abs(1 - 2 * p.k);
    const d = `M${cx},${cy - R} A${R},${R} 0 0 1 ${cx},${cy + R} A${f1(t)},${R} 0 0 ${p.k < 0.5 ? 0 : 1} ${cx},${cy - R} Z`;
    body += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#3A4150"/>`;
    body += `<path d="${d}" fill="#F2EBC9" ${p.lit === 'left' ? `transform="translate(${2 * cx},0) scale(-1,1)"` : ''}/>`;
    return { id: p.id, label: p.label, region: circlePx(cx, cy, R + 15), jev: `The moon in the ${where[i]} position.` };
  });
  return defineCard({
    id: 'moon-waxing-crescent',
    title: 'Waxing moon',
    category: 'science',
    difficulty: 3,
    prompt: 'Seen from the Northern Hemisphere, tap the waxing crescent.',
    kind: 'pick',
    svg: svgDoc(body, '#141A2E'),
    options,
    answer: phases.find(isAnswer)!.id,
    explain: 'From the Northern Hemisphere a waxing moon is lit on the right, and a crescent is less than half lit, so it is the thin sliver lit on the right (the thin one lit on the left is waning).',
    jev: {
      context: 'Four phases of the moon in a row against a starry sky, as seen from the Northern Hemisphere.',
      instructions: 'In `card`, seen from the Northern Hemisphere, which moon is a waxing crescent?',
    },
    source: 'drawn',
  });
})();

// 4. Three levers with the same box; the fulcrum sits at a different place on each. Push = load x load arm / push arm.
const leverLeastForce = (() => {
  const load = 60, len = 560, x0 = 200;
  const fulcrum = [0.5, 0.75, 0.25];
  const push = fulcrum.map((f) => (load * f) / (1 - f));
  const best = push.indexOf(Math.min(...push));
  if (push.filter((p) => p === push[best]).length !== 1) throw new Error('one least push');
  let body = '';
  const where = ['top', 'middle', 'bottom'];
  const options: Option[] = fulcrum.map((f, i) => {
    const y = 160 + i * 220, fx = x0 + f * len;
    body += `<line x1="40" y1="${y + 60}" x2="${W - 40}" y2="${y + 60}" stroke="#B9B2A3" stroke-width="3"/>`;
    body += `<polygon points="${pts([[fx, y + 6], [fx - 40, y + 60], [fx + 40, y + 60]])}" fill="#8B6A4A" stroke="${INK}" stroke-width="3"/>`;
    // The box is centered on the load point x0 and the arrow pushes at x0 + len, so the arms are exactly f and 1 - f of len.
    body += `<rect x="${x0 - 60}" y="${y - 6}" width="${len + 75}" height="12" rx="4" fill="#E9C46A" stroke="${INK}" stroke-width="3"/>`;
    body += `<rect x="${x0 - 50}" y="${y - 96}" width="100" height="90" rx="6" fill="#B5523B" stroke="${INK}" stroke-width="3"/>`;
    body += text(x0, y - 38, `${load} kg`, 30, '#FFFFFF');
    const ex = x0 + len;
    body += `<line x1="${ex}" y1="${y - 100}" x2="${ex}" y2="${y - 30}" stroke="#D62828" stroke-width="10"/><polygon points="${pts([[ex - 20, y - 36], [ex + 20, y - 36], [ex, y - 10]])}" fill="#D62828"/>`;
    return { id: `f${i}`, label: `Fulcrum ${f === 0.5 ? 'in the middle' : f < 0.5 ? 'near the box' : 'near the push'}`, region: rectPx(30, y - 110, W - 60, 190), jev: `The ${where[i]} lever.` };
  });
  return defineCard({
    id: 'lever-least-force',
    title: 'Lever arms',
    category: 'science',
    difficulty: 2,
    prompt: 'Which lever needs the smallest push to lift the box?',
    kind: 'pick',
    svg: svgDoc(body, '#F4F1EA'),
    options,
    answer: `f${best}`,
    explain: `Push times push arm equals load times load arm (for a light beam). With the pivot near the box the push arm is three times as long, so ${load} kg needs only the force of ${push[best]} kg, against ${load} kg and ${push[fulcrum.indexOf(0.75)]} kg on the others.`,
    jev: {
      context: 'Three levers, each a beam on a triangular pivot with the same box on the left end and a red arrow pushing down on the right end; the pivot is in a different place on each.',
      instructions: 'In `card`, which lever needs the smallest downward push at the red arrow to lift the box?',
    },
    source: 'drawn',
  });
})();

// 5. Three pulley systems lifting the same load; the pull is the load divided by the rope segments holding it up.
const pulleyLeastForce = (() => {
  const load = 90;
  const rope = (p: Pt[]) => `<polyline points="${pts(p)}" fill="none" stroke="#8B6A4A" stroke-width="6" stroke-linejoin="round"/>`;
  const pulley = (x: number, y: number, r: number) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#C9CED6" stroke="${INK}" stroke-width="4"/><circle cx="${x}" cy="${y}" r="7" fill="${INK}"/>`;
  const strap = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="6"/>`;
  const box = (cx: number, top: number) => `<rect x="${cx - 60}" y="${top}" width="120" height="90" rx="6" fill="#B5523B" stroke="${INK}" stroke-width="3"/>` + text(cx, top + 56, `${load} kg`, 30, '#FFFFFF');
  const arrow = (x: number, y: number, dir: 1 | -1) => `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + dir * 60}" stroke="#D62828" stroke-width="10"/><polygon points="${pts([[x - 20, y + dir * 54], [x + 20, y + dir * 54], [x, y + dir * 84]])}" fill="#D62828"/>`;
  const over = (x: number, y: number, r: number) => `<path d="M${x - r},${y} A${r},${r} 0 0 1 ${x + r},${y}" fill="none" stroke="#8B6A4A" stroke-width="6"/>`;
  const under = (x: number, y: number, r: number) => `<path d="M${x - r},${y} A${r},${r} 0 0 0 ${x + r},${y}" fill="none" stroke="#8B6A4A" stroke-width="6"/>`;
  const ceil = 80;
  // Each system: the drawing and the x positions of the rope segments that hold up the moving load.
  const systems = [
    // One fixed pulley: the load hangs straight on the rope.
    (cx: number) => {
      const r = 40, py = 170;
      const s = strap(cx, ceil, cx, py) + rope([[cx - r, py], [cx - r, 470]]) + rope([[cx + r, py], [cx + r, 380]]) + pulley(cx, py, r) + over(cx, py, r) + box(cx - r, 470) + arrow(cx + r, 380, 1);
      return { s, holding: 1 };
    },
    // A rope tied to the moving block, over a fixed pulley, under the moving pulley, up to the hand: three segments.
    (cx: number) => {
      const r = 30, uy = 170, ly = 360, ux = cx - 30, lx = cx + 30;
      let s = strap(ux, ceil, ux, uy);
      s += rope([[cx - 60, 430], [cx - 60, uy]]) + rope([[cx, uy], [cx, ly]]) + rope([[cx + 60, ly], [cx + 60, 240]]);
      s += pulley(ux, uy, r) + pulley(lx, ly, r) + over(ux, uy, r) + under(lx, ly, r);
      s += `<rect x="${cx - 74}" y="428" width="148" height="14" rx="4" fill="${INK}"/>` + strap(lx, ly, lx, 432) + strap(cx, 442, cx, 470) + box(cx, 470);
      s += arrow(cx + 60, 240, -1);
      return { s, holding: 3 };
    },
    // Rope fixed to the ceiling, under a moving pulley, over a fixed pulley, down to the hand: two segments.
    (cx: number) => {
      const r = 40, mx = cx - 40, my = 380, fx = cx + 40, fy = 170;
      let s = strap(fx, ceil, fx, fy);
      s += rope([[mx - r, ceil], [mx - r, my]]) + rope([[mx + r, my], [mx + r, fy]]) + rope([[fx + r, fy], [fx + r, 400]]);
      s += pulley(fx, fy, r) + pulley(mx, my, r) + over(fx, fy, r) + under(mx, my, r) + strap(mx, my, mx, 470) + box(mx, 470) + arrow(fx + r, 400, 1);
      return { s, holding: 2 };
    },
  ];
  let body = `<rect x="0" y="${ceil - 24}" width="${W}" height="24" fill="#6B6B6B"/>`;
  const built = systems.map((sys, i) => ({ cx: 175 + i * 305, ...sys(175 + i * 305) }));
  const pull = built.map((b) => load / b.holding);
  const best = pull.indexOf(Math.min(...pull));
  const options: Option[] = built.map((b, i) => {
    body += b.s;
    return { id: `r${b.holding}`, label: `${b.holding} rope${b.holding > 1 ? 's' : ''} holding the load`, region: rectPx(b.cx - 145, ceil, 290, 520), jev: `The pulley system on the ${panel3[i]}.` };
  });
  return defineCard({
    id: 'pulley-least-force',
    title: 'Pulleys',
    category: 'science',
    difficulty: 3,
    prompt: 'Which setup needs the smallest pull to lift the box?',
    kind: 'pick',
    svg: svgDoc(body, '#F4F1EA'),
    options,
    answer: `r${built[best].holding}`,
    explain: `The pull is the load divided by the rope segments holding up the moving part (ideal pulleys). The middle setup has ${built[best].holding}, so ${load} kg needs a pull of ${pull[best]} kg, against ${pull.filter((_, i) => i !== best).join(' kg and ')} kg.`,
    jev: {
      context: 'Three pulley systems hanging from a ceiling, each lifting the same box; red arrows show where the rope is pulled.',
      instructions: 'In `card`, which pulley system needs the smallest pull on the rope to lift the box?',
    },
    source: 'drawn',
  });
})();

// 6. Three tilted glasses: only the one whose water surface stays horizontal is right.
const tiltedGlass = (() => {
  const tilt = 28, gw = 150, gh = 270, floor = 600;
  const kinds = ['with-glass', 'level', 'against'] as const;
  let body = `<rect x="0" y="${floor}" width="${W}" height="${H - floor}" fill="#C9B79C"/><line x1="0" y1="${floor}" x2="${W}" y2="${floor}" stroke="${INK}" stroke-width="4"/>`;
  const options: Option[] = kinds.map((k, i) => {
    const pivot: Pt = [240 + i * 290, floor];
    const th = rad(tilt);
    // Glass corners in its own frame (x right, y up from the bottom right corner), rotated clockwise by tilt about that corner.
    const toScreen = ([u, v]: Pt): Pt => [pivot[0] + u * Math.cos(th) + v * Math.sin(th), pivot[1] + u * Math.sin(th) - v * Math.cos(th)];
    const glass: Pt[] = [[-gw, 0], [0, 0], [0, gh], [-gw, gh]].map((p) => toScreen(p as Pt));
    const mid = toScreen([-gw / 2, gh * 0.45]);
    // The water surface: horizontal, turned with the glass, or turned the other way.
    const ang = k === 'level' ? 0 : k === 'with-glass' ? th : -th;
    const water = clipBelow(glass, ([x, y]) => -((x - mid[0]) * -Math.sin(ang) + (y - mid[1]) * Math.cos(ang)));
    body += `<polygon points="${pts(water)}" fill="#5FA8D3" opacity="0.9"/>`;
    body += `<polyline points="${pts([glass[3], glass[0], glass[1], glass[2]])}" fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>`;
    const xs = glass.map((p) => p[0]), ys = glass.map((p) => p[1]);
    const [x1, x2, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys)];
    return { id: k, label: k === 'level' ? 'Level surface' : k === 'with-glass' ? 'Surface tilted with the glass' : 'Surface tilted the other way', region: rectPx(x1 - 20, y1 - 20, x2 - x1 + 40, floor - y1 + 30), jev: `The glass on the ${panel3[i]}.` };
  });
  return defineCard({
    id: 'tilted-glass-level',
    title: 'Tilt the glass',
    category: 'science',
    difficulty: 2,
    prompt: 'Which tilted glass shows the water right?',
    kind: 'pick',
    svg: svgDoc(body, '#EAF2F6'),
    options,
    answer: 'level',
    explain: 'Gravity pulls the water down evenly, so the surface of still water stays horizontal however the glass is tilted. Only the middle glass shows that.',
    jev: {
      context: 'Three identical glasses of water, each tilted the same way, with the water surface drawn differently in each.',
      instructions: 'In `card`, which glass shows the water surface the way it really sits when a glass is tilted?',
    },
    source: 'drawn',
  });
})();

// 7. A post and its shadow: the shadow points away from the sun and grows long when the sun is low.
const shadowSun = (() => {
  const px = 470, ground = 560, h = 160, elev = 24;
  const L = h / Math.tan(rad(elev));
  const top: Pt = [px, ground - h];
  const suns = [
    { id: 'high-left', side: -1, e: 65 },
    { id: 'low-right', side: 1, e: elev },
    { id: 'low-left', side: -1, e: elev },
    { id: 'high-right', side: 1, e: 65 },
  ];
  const D = 300;
  // The sun that casts this shadow is opposite it (shadow to the right, sun to the left) at the elevation atan(h / L).
  const ans = suns.find((s) => s.side === -1 && Math.abs(s.e - (Math.atan(h / L) * 180) / Math.PI) < 1e-9)!;
  let body = `<rect x="0" y="${ground}" width="${W}" height="${H - ground}" fill="#9CC37A"/>`;
  body += `<polygon points="${pts([[px - 6, ground], [px + L, ground + 4], [px + L, ground + 14], [px - 6, ground + 20]])}" fill="#3E5A2E" opacity="0.8"/>`;
  body += `<rect x="${px - 12}" y="${top[1]}" width="24" height="${h}" fill="#7A5230" stroke="${INK}" stroke-width="3"/>`;
  const options: Option[] = suns.map((s) => {
    const x = px + s.side * D * Math.cos(rad(s.e)), y = top[1] - D * Math.sin(rad(s.e));
    body += `<circle cx="${f1(x)}" cy="${f1(y)}" r="42" fill="#FFC300" stroke="#E08E00" stroke-width="5"/>`;
    for (let k = 0; k < 8; k++) {
      const a = rad(k * 45);
      body += `<line x1="${f1(x + 52 * Math.cos(a))}" y1="${f1(y + 52 * Math.sin(a))}" x2="${f1(x + 68 * Math.cos(a))}" y2="${f1(y + 68 * Math.sin(a))}" stroke="#E08E00" stroke-width="5" stroke-linecap="round"/>`;
    }
    const side = s.side < 0 ? 'left' : 'right', hi = s.e > 45 ? 'high' : 'low';
    return { id: s.id, label: `${hi[0].toUpperCase() + hi.slice(1)} on the ${side}`, region: circlePx(x, y, 75), jev: `The ${hi} sun on the ${side}.` };
  });
  return defineCard({
    id: 'shadow-sun-position',
    title: 'Where is the sun',
    category: 'science',
    difficulty: 2,
    prompt: 'Which sun casts this shadow?',
    kind: 'pick',
    svg: svgDoc(body, '#CFE8F7'),
    options,
    answer: ans.id,
    explain: `A shadow points away from the sun, and it is long when the sun is low. This shadow runs right and is ${(L / h).toFixed(1)} times the post's height, so the sun is low on the left.`,
    jev: {
      context: 'A wooden post on grass with its shadow on the ground, and four suns in the sky at different places.',
      instructions: 'In `card`, which of the four suns casts the shadow of the post?',
    },
    source: 'drawn',
  });
})();

// 8. Balls with their densities written on them; the one below water's 1.0 floats.
const densityFloats = (() => {
  const balls = [
    { d: 2.7, r: 70, fill: '#C9CED6' },
    { d: 1.3, r: 110, fill: '#E9C46A' },
    { d: 7.9, r: 60, fill: '#A3ACB8' },
    { d: 0.8, r: 75, fill: '#D9B38C' },
  ];
  const water = 1.0;
  if (balls.filter((b) => b.d < water).length !== 1) throw new Error('exactly one floats');
  let body = `<rect x="60" y="440" width="${W - 120}" height="240" rx="10" fill="#5FA8D3" stroke="${INK}" stroke-width="5"/>`;
  body += text(W / 2, 580, `WATER: ${water.toFixed(1)} g/cm³`, 40, '#FFFFFF');
  const where = ['far left', 'second from the left', 'second from the right', 'far right'];
  const options: Option[] = balls.map((b, i) => {
    const cx = 140 + i * 227, cy = 400 - 30 - b.r;
    body += `<circle cx="${cx}" cy="${cy}" r="${b.r}" fill="${b.fill}" stroke="${INK}" stroke-width="4"/>`;
    body += text(cx, cy + 14, b.d.toFixed(1), 40);
    return { id: `d${String(b.d).replace('.', '')}`, label: `${b.d.toFixed(1)} g/cm³`, region: circlePx(cx, cy, b.r + 12), jev: `The ball in the ${where[i]} position.` };
  });
  const floater = balls.find((b) => b.d < water)!;
  return defineCard({
    id: 'density-ball-floats',
    title: 'Sink or float',
    category: 'science',
    difficulty: 1,
    prompt: 'Each ball shows its density. Which one floats in water?',
    kind: 'pick',
    svg: svgDoc(body, '#F4F1EA'),
    options,
    answer: `d${String(floater.d).replace('.', '')}`,
    explain: `A solid ball floats when it is less dense than water (1.0 g/cm³), whatever its size. Only the ${floater.d.toFixed(1)} ball is lighter than water; the big 1.3 ball sinks.`,
    jev: {
      context: 'Four balls of different sizes above a tank of water; each ball has its density in g/cm³ written on it, and the tank is labeled with water\'s density.',
      instructions: 'In `card`, which ball would float in the water?',
    },
    source: 'drawn',
  });
})();

// 9. Four living things; the producer makes its own food from sunlight. The mushroom is a fungus, not a producer.
const foodChainProducer = (() => {
  const draw: Record<string, (x: number, y: number) => string> = {
    mushroom: (x, y) => `<rect x="${x - 22}" y="${y - 20}" width="44" height="90" rx="12" fill="#F3E9D2" stroke="${INK}" stroke-width="4"/><path d="M${x - 95},${y - 10} Q${x},${y - 140} ${x + 95},${y - 10} Z" fill="#C0392B" stroke="${INK}" stroke-width="4"/><circle cx="${x - 35}" cy="${y - 50}" r="12" fill="#FFF"/><circle cx="${x + 25}" cy="${y - 65}" r="10" fill="#FFF"/><circle cx="${x + 50}" cy="${y - 30}" r="9" fill="#FFF"/>`,
    rabbit: (x, y) => `<ellipse cx="${x - 30}" cy="${y - 100}" rx="16" ry="48" fill="#B8B0A6" stroke="${INK}" stroke-width="4" transform="rotate(-12 ${x - 30} ${y - 100})"/><ellipse cx="${x + 5}" cy="${y - 104}" rx="16" ry="48" fill="#B8B0A6" stroke="${INK}" stroke-width="4" transform="rotate(10 ${x + 5} ${y - 104})"/><ellipse cx="${x + 10}" cy="${y + 20}" rx="80" ry="55" fill="#B8B0A6" stroke="${INK}" stroke-width="4"/><circle cx="${x - 15}" cy="${y - 40}" r="42" fill="#B8B0A6" stroke="${INK}" stroke-width="4"/><circle cx="${x - 28}" cy="${y - 48}" r="6" fill="${INK}"/><circle cx="${x + 92}" cy="${y + 10}" r="18" fill="#FFF" stroke="${INK}" stroke-width="3"/>`,
    clover: (x, y) => `<path d="M${x},${y + 70} Q${x + 10},${y + 20} ${x},${y - 20}" fill="none" stroke="#2E7D32" stroke-width="8"/>` + [[-38, -42], [38, -42], [0, -88]].map(([dx, dy]) => `<circle cx="${x + dx}" cy="${y + dy}" r="40" fill="#43A047" stroke="${INK}" stroke-width="4"/>`).join(''),
    fox: (x, y) => `<polygon points="${pts([[x - 70, y - 60], [x - 50, y - 125], [x - 25, y - 72], [x + 25, y - 72], [x + 50, y - 125], [x + 70, y - 60], [x, y + 50]])}" fill="#E07A2F" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><polygon points="${pts([[x - 40, y - 10], [x + 40, y - 10], [x, y + 50]])}" fill="#FFF" stroke="${INK}" stroke-width="3"/><circle cx="${x}" cy="${y + 44}" r="10" fill="${INK}"/><circle cx="${x - 28}" cy="${y - 40}" r="7" fill="${INK}"/><circle cx="${x + 28}" cy="${y - 40}" r="7" fill="${INK}"/>`,
  };
  const order = ['fox', 'mushroom', 'rabbit', 'clover'];
  const producers = new Set(['clover']); // green plants photosynthesize; fungi and animals do not
  if (order.filter((o) => producers.has(o)).length !== 1) throw new Error('one producer');
  let body = '';
  const where = ['top left', 'top right', 'bottom left', 'bottom right'];
  const options: Option[] = order.map((o, i) => {
    const cx = 250 + (i % 2) * 460, cy = 190 + Math.floor(i / 2) * 340;
    body += `<rect x="${cx - 200}" y="${cy - 160}" width="400" height="310" rx="18" fill="#FFFFFF" stroke="#C9C2B3" stroke-width="3"/>`;
    body += draw[o](cx, cy - 10);
    body += text(cx, cy + 128, o.toUpperCase(), 34);
    return { id: o, label: o[0].toUpperCase() + o.slice(1), region: rectPx(cx - 200, cy - 160, 400, 310), jev: `The picture in the ${where[i]}.` };
  });
  return defineCard({
    id: 'food-chain-producer',
    title: 'Who makes food',
    category: 'science',
    difficulty: 2,
    prompt: 'Tap the producer.',
    kind: 'pick',
    svg: svgDoc(body, '#EEF3E6'),
    options,
    answer: 'clover',
    explain: 'A producer makes its own food from sunlight by photosynthesis, which green plants like clover do. A mushroom is a fungus that feeds on dead matter, so it is a decomposer, not a producer.',
    jev: {
      context: 'Four labeled pictures of living things that can be part of a food chain.',
      instructions: 'In `card`, which living thing is the producer in a food chain?',
    },
    source: 'drawn',
  });
})();

// 10. Four planets; only one is drawn with a broad ring system.
const planetSaturn = (() => {
  const planets = [
    { id: 'blue', r: 75, fill: '#3F7FBF', rings: false },
    { id: 'banded', r: 110, fill: '#D9A066', rings: false, bands: true },
    { id: 'ringed', r: 80, fill: '#E3C98B', rings: true },
    { id: 'red', r: 55, fill: '#C1440E', rings: false },
  ];
  if (planets.filter((p) => p.rings).length !== 1) throw new Error('one ringed planet');
  const rand = rng(1610);
  let body = '';
  for (let i = 0; i < 110; i++) body += `<circle cx="${f1(rand() * W)}" cy="${f1(rand() * H)}" r="${f1(1 + rand() * 2)}" fill="#FFFFFF" opacity="${f1(0.4 + rand() * 0.5)}"/>`;
  const where = ['far left', 'second from the left', 'second from the right', 'far right'];
  const options: Option[] = planets.map((p, i) => {
    const cx = [125, 345, 610, 845][i], cy = 360;
    body += `<defs><clipPath id="c${i}"><circle cx="${cx}" cy="${cy}" r="${p.r}"/></clipPath></defs>`;
    if (p.rings) body += `<ellipse cx="${cx}" cy="${cy}" rx="${p.r * 1.9}" ry="${p.r * 0.5}" fill="none" stroke="#CDB57A" stroke-width="22" transform="rotate(-15 ${cx} ${cy})"/>`;
    body += `<circle cx="${cx}" cy="${cy}" r="${p.r}" fill="${p.fill}"/>`;
    if (p.bands) for (const [dy, c] of [[-60, '#B9784A'], [-20, '#F0D3A8'], [20, '#A8603A'], [55, '#E8C597']] as const) body += `<rect x="${cx - p.r}" y="${cy + dy}" width="${2 * p.r}" height="18" fill="${c}" clip-path="url(#c${i})"/>`;
    if (p.rings) body += `<path d="M${f1(cx - p.r * 1.9)},${cy} A${f1(p.r * 1.9)},${f1(p.r * 0.5)} 0 0 0 ${f1(cx + p.r * 1.9)},${cy}" fill="none" stroke="#CDB57A" stroke-width="22" transform="rotate(-15 ${cx} ${cy})"/>`;
    return { id: p.id, label: p.rings ? 'Saturn' : 'Not Saturn', region: circlePx(cx, cy, p.rings ? p.r * 1.7 : p.r + 15), jev: `The planet in the ${where[i]} position.` };
  });
  return defineCard({
    id: 'planet-saturn',
    title: 'Ringed planet',
    category: 'science',
    difficulty: 1,
    prompt: 'Tap Saturn.',
    kind: 'pick',
    svg: svgDoc(body, '#0E1224'),
    options,
    answer: 'ringed',
    explain: 'Saturn is the planet known for its wide, bright rings of ice and rock. The other planets drawn here have no rings.',
    jev: {
      context: 'Four planets of different sizes and colors against a starry sky.',
      instructions: 'In `card`, which planet is Saturn?',
    },
    source: 'drawn',
  });
})();

// 11. Four Celsius thermometers; boiling water at sea level reads 100.
const thermometerBoiling = (() => {
  const readings = [37, 90, 100, 0];
  const boil = 100; // degrees Celsius at sea level (1 atmosphere)
  if (readings.filter((r) => r === boil).length !== 1) throw new Error('one boiling reading');
  const lo = -10, hi = 110, yTop = 100, yBot = 580;
  const yOf = (t: number) => yBot - ((t - lo) / (hi - lo)) * (yBot - yTop);
  let body = '';
  const where = ['far left', 'second from the left', 'second from the right', 'far right'];
  const options: Option[] = readings.map((r, i) => {
    const cx = 140 + i * 227;
    body += `<rect x="${cx - 95}" y="40" width="190" height="650" rx="20" fill="#FFFFFF" stroke="#C9C2B3" stroke-width="3"/>`;
    body += `<rect x="${cx - 14}" y="${yTop - 30}" width="28" height="${yBot - yTop + 60}" rx="14" fill="#F3F1E8" stroke="${INK}" stroke-width="4"/>`;
    body += `<rect x="${cx - 7}" y="${f1(yOf(r))}" width="14" height="${f1(yBot + 40 - yOf(r))}" fill="#D62828"/>`;
    body += `<circle cx="${cx}" cy="${yBot + 58}" r="32" fill="#D62828" stroke="${INK}" stroke-width="4"/>`;
    for (let t = lo; t <= hi; t += 10) {
      const y = yOf(t), major = t % 50 === 0;
      body += `<line x1="${cx + 16}" y1="${f1(y)}" x2="${cx + (major ? 44 : 30)}" y2="${f1(y)}" stroke="${INK}" stroke-width="${major ? 4 : 2}"/>`;
      if (major) body += `<text x="${cx - 24}" y="${f1(y + 11)}" text-anchor="end" ${FONT} font-weight="bold" font-size="30" fill="${INK}">${t}</text>`;
    }
    body += text(cx + 50, 76, '°C', 28);
    return { id: `t${r}`, label: `${r} °C`, region: rectPx(cx - 95, 40, 190, 650), jev: `The thermometer in the ${where[i]} position.` };
  });
  return defineCard({
    id: 'thermometer-boiling',
    title: 'Boiling point',
    category: 'science',
    difficulty: 1,
    prompt: 'Which thermometer is in boiling water at sea level?',
    kind: 'pick',
    svg: svgDoc(body, '#EAF2F6'),
    options,
    answer: `t${boil}`,
    explain: 'At sea level water boils at 100 °C. The others read body temperature (37 °C), hot but not boiling (90 °C) and freezing (0 °C).',
    jev: {
      context: 'Four Celsius thermometers side by side, each showing a different temperature on a scale marked 0, 50 and 100.',
      instructions: 'In `card`, which thermometer shows the temperature of boiling water at sea level?',
    },
    source: 'drawn',
  });
})();

// 12. Particles in three boxes: packed in a lattice, packed loosely at the bottom, and spread out.
const statesGas = (() => {
  const bw = 260, bh = 380, by = 200, r = 18;
  const kinds = ['liquid', 'gas', 'solid'] as const;
  let body = '';
  const options: Option[] = kinds.map((k, i) => {
    const bx = 50 + i * 310;
    const parts: Pt[] = [];
    if (k === 'solid') {
      for (let row = 0; row < 5; row++) for (let c = 0; c < 6; c++) parts.push([bx + 30 + c * 40, by + bh - 30 - row * 40]);
    } else if (k === 'liquid') {
      // Close together but out of order: a jittered, staggered grid in the bottom half, a few gaps, no overlaps.
      const rand = rng(11);
      for (let row = 0; row < 4; row++)
        for (let c = 0; c < 5; c++) {
          if (rand() < 0.12) continue;
          parts.push([bx + 36 + c * 47 + (row % 2 ? 10 : -4) + (rand() - 0.5) * 10, by + bh - 28 - row * 44 + (rand() - 0.5) * 8]);
        }
      for (let a = 0; a < parts.length; a++) for (let b = a + 1; b < parts.length; b++) if (Math.hypot(parts[a][0] - parts[b][0], parts[a][1] - parts[b][1]) < 2 * r) throw new Error('liquid particles overlap');
    } else {
      const rand = rng(5), n = 10;
      const [ymin, ymax, minGap] = [by + 30, by + bh - 30, 70];
      let tries = 0;
      while (parts.length < n) {
        if (++tries > 100000) throw new Error('could not place particles');
        const p: Pt = [bx + 24 + rand() * (bw - 48), ymin + rand() * (ymax - ymin)];
        if (parts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= minGap)) parts.push(p);
      }
    }
    body += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="8" fill="#FFFFFF" stroke="${INK}" stroke-width="5"/>`;
    for (const [x, y] of parts) body += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}" fill="#1F5FD6" stroke="${INK}" stroke-width="2"/>`;
    return { id: k, label: k[0].toUpperCase() + k.slice(1), region: rectPx(bx - 10, by - 10, bw + 20, bh + 20), jev: `The box on the ${panel3[i]}.` };
  });
  body += text(W / 2, 120, 'Same particles, three states', 38);
  return defineCard({
    id: 'states-gas-particles',
    title: 'States of matter',
    category: 'science',
    difficulty: 1,
    prompt: 'Which box holds a gas?',
    kind: 'pick',
    svg: svgDoc(body, '#F4F1EA'),
    options,
    answer: 'gas',
    explain: 'In a gas the particles are far apart and spread through the whole container. A solid is packed in a regular pattern, and a liquid is packed close but loosely at the bottom.',
    jev: {
      context: 'Three boxes of the same particles, arranged differently in each.',
      instructions: 'In `card`, which box shows the particles of a gas?',
    },
    source: 'drawn',
  });
})();

// 13. Ice in water: it floats with about 92% of its height below the surface (density 0.917 vs 1.000).
const iceFloat = (() => {
  const ice = 0.917, water = 1.0, s = 130;
  const below = Math.round((s * ice) / water); // a floating cube sinks until it displaces its own weight
  const gw = 240, gh = 400, gy = 220, surf = gy + 120;
  const kinds = [
    { id: 'high', top: surf - s / 2 },
    { id: 'bottom', top: gy + gh - s - 6 },
    { id: 'right', top: surf + below - s },
  ];
  let body = '';
  const options: Option[] = kinds.map((k, i) => {
    const gx = 60 + i * 310;
    body += `<rect x="${gx}" y="${surf}" width="${gw}" height="${gy + gh - surf}" fill="#7FBCE0"/>`;
    const cx = gx + gw / 2;
    body += `<rect x="${cx - s / 2}" y="${f1(k.top)}" width="${s}" height="${s}" rx="10" fill="#E6F4FB" fill-opacity="0.85" stroke="#4F8FB5" stroke-width="4"/>`;
    body += `<line x1="${gx}" y1="${surf}" x2="${gx + gw}" y2="${surf}" stroke="#2F6F95" stroke-width="4"/>`;
    body += `<polyline points="${pts([[gx, gy], [gx, gy + gh], [gx + gw, gy + gh], [gx + gw, gy]])}" fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>`;
    return { id: k.id, label: k.id === 'right' ? 'Mostly under the surface' : k.id === 'high' ? 'Half out of the water' : 'On the bottom', region: rectPx(gx - 20, gy - 40, gw + 40, gh + 60), jev: `The glass on the ${panel3[i]}.` };
  });
  if (Math.abs(kinds[2].top + s - surf - below) > 0.5) throw new Error('right cube must sit at its floating depth');
  return defineCard({
    id: 'ice-float-depth',
    title: 'Floating ice',
    category: 'science',
    difficulty: 3,
    prompt: 'Which glass shows the ice cube right?',
    kind: 'pick',
    svg: svgDoc(body, '#F4F1EA'),
    options,
    answer: 'right',
    explain: `Ice (0.917 g/cm³) is a little less dense than water, so it floats with about ${Math.round(ice * 100)}% of it under the surface and only a thin slice above.`,
    jev: {
      context: 'Three glasses of water, each with one ice cube drawn at a different height.',
      instructions: 'In `card`, which glass shows an ice cube sitting in water the way it really does?',
    },
    source: 'drawn',
  });
})();

// 14. A laser beam hits a flat mirror; the reflection leaves at the same angle to the mirror as it came in.
const mirrorBeam = (() => {
  const laser: Pt = [70, 560], hit: Pt = [720, 560], mirrorDeg = 60, targetY = 120;
  // Incoming beam travels at 0 degrees; reflecting a direction across a line at angle a gives 2a minus the angle.
  const outDeg = 2 * mirrorDeg; // math angle, y up
  const dx = Math.cos(rad(outDeg)), dy = -Math.sin(rad(outDeg)); // screen
  const tHit = (targetY - hit[1]) / dy, hitX = hit[0] + tHit * dx;
  const targets = [
    { id: 'a', x: 240 },
    { id: 'b', x: Math.round(hitX) },
    { id: 'c', x: hit[0] },
  ];
  const ans = targets.find((t) => Math.abs(t.x - hitX) < 1)!;
  if (targets.some((t) => t !== ans && Math.abs(t.x - hitX) < 120)) throw new Error('targets too close');
  let body = '';
  // Mirror: a line through the hit point at mirrorDeg, silvered on the side facing the laser, hatched behind.
  const mx = Math.cos(rad(mirrorDeg)), my = -Math.sin(rad(mirrorDeg)), half = 110;
  const m1: Pt = [hit[0] - half * mx, hit[1] - half * my], m2: Pt = [hit[0] + half * mx, hit[1] + half * my];
  const nx = Math.sin(rad(mirrorDeg)), ny = Math.cos(rad(mirrorDeg)); // screen normal pointing away from the laser side
  for (let k = -5; k <= 5; k++) {
    const bx = hit[0] + ((k * half) / 5.5) * mx, byy = hit[1] + ((k * half) / 5.5) * my;
    body += `<line x1="${f1(bx + 4 * nx)}" y1="${f1(byy + 4 * ny)}" x2="${f1(bx + 26 * nx - 14 * mx)}" y2="${f1(byy + 26 * ny - 14 * my)}" stroke="#6B6B6B" stroke-width="3"/>`;
  }
  body += `<line x1="${f1(m1[0])}" y1="${f1(m1[1])}" x2="${f1(m2[0])}" y2="${f1(m2[1])}" stroke="#7FA7C9" stroke-width="12" stroke-linecap="round"/>`;
  body += `<rect x="${laser[0] - 40}" y="${laser[1] - 26}" width="90" height="52" rx="8" fill="${INK}"/>`;
  body += `<line x1="${laser[0] + 50}" y1="${laser[1]}" x2="${hit[0]}" y2="${hit[1]}" stroke="#E01E37" stroke-width="7"/>`;
  body += `<polygon points="${pts([[400, 544], [400, 576], [430, 560]])}" fill="#E01E37"/>`;
  const options: Option[] = targets.map((t) => {
    body += `<circle cx="${t.x}" cy="${targetY}" r="50" fill="#FFFFFF" stroke="${INK}" stroke-width="5"/><circle cx="${t.x}" cy="${targetY}" r="30" fill="none" stroke="#D62828" stroke-width="5"/>`;
    body += text(t.x, targetY + 100, t.id.toUpperCase(), 44);
    return { id: t.id, label: t.id.toUpperCase(), region: rectPx(t.x - 70, targetY - 60, 140, 180), jev: `The target marked ${t.id.toUpperCase()}.` };
  });
  return defineCard({
    id: 'mirror-beam-target',
    title: 'Bounce the beam',
    category: 'science',
    difficulty: 3,
    prompt: 'The beam hits the mirror. Which target does it reach?',
    kind: 'pick',
    svg: svgDoc(body, '#EDF0F5'),
    options,
    answer: ans.id,
    explain: `A mirror reflects light at the same angle it arrives. The beam meets the mirror at ${mirrorDeg} degrees and leaves at ${mirrorDeg} degrees on the other side, turning it ${outDeg} degrees, up and to the left, to target ${ans.id.toUpperCase()}.`,
    jev: {
      context: 'A laser on the left shines a red beam to the right onto a tilted flat mirror; three targets marked A, B and C are at the top.',
      instructions: 'In `card`, after the beam reflects off the mirror, which target does it hit?',
    },
    source: 'drawn',
  });
})();

const cards: CardSpec[] = [
  circuitBulb, magnetPair, moonWaxingCrescent, leverLeastForce, pulleyLeastForce, tiltedGlass, shadowSun,
  densityFloats, foodChainProducer, planetSaturn, thermometerBoiling, statesGas, iceFloat, mirrorBeam,
];
export default cards;
