/**
 * Chess cards: boards drawn from a FEN, every claim (mate count, the one mating move, the one pinned piece)
 * checked with chess.js when the module loads, so a wrong position fails the build.
 */
import { Chess, type Square } from 'chess.js';
import { defineCard, esc, rectPx, svgDoc, type Option, type Region } from './lib.ts';

const SQ = 72;
const BX = 64;
const BY = 72;
const LIGHT = '#F0D9B5';
const DARK = '#B58863';
const FILES = 'abcdefgh';
const FONT = "'Arial Unicode MS', 'Apple Symbols', sans-serif";

/** Solid glyphs (U+265A..F); white pieces get the outline glyph (U+2654..9) drawn over a white-filled solid one. */
const SOLID: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const OUTLINE: Record<string, string> = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' };
const NAMES: Record<string, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };

function squareXY(sq: string): [number, number] {
  const f = FILES.indexOf(sq[0]);
  const r = Number(sq[1]);
  return [BX + f * SQ, BY + (8 - r) * SQ];
}

const squareRegion = (sq: string): Region => {
  const [x, y] = squareXY(sq);
  return rectPx(x, y, SQ, SQ);
};

function drawBoard(fen: string, caption: string[]): string {
  const c = new Chess(fen);
  let s = `<rect x="${BX - 4}" y="${BY - 4}" width="${SQ * 8 + 8}" height="${SQ * 8 + 8}" fill="#5A4632"/>`;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      s += `<rect x="${BX + f * SQ}" y="${BY + r * SQ}" width="${SQ}" height="${SQ}" fill="${(r + f) % 2 === 0 ? LIGHT : DARK}"/>`;
    }
  }
  for (let i = 0; i < 8; i++) {
    s += `<text x="${BX + i * SQ + SQ / 2}" y="${BY + SQ * 8 + 30}" font-family="Arial" font-size="20" fill="#333" text-anchor="middle">${FILES[i]}</text>`;
    s += `<text x="${BX - 22}" y="${BY + i * SQ + SQ / 2 + 7}" font-family="Arial" font-size="20" fill="#333" text-anchor="middle">${8 - i}</text>`;
  }
  for (const row of c.board()) {
    for (const p of row) {
      if (!p) continue;
      const [x, y] = squareXY(p.square);
      const cx = x + SQ / 2;
      const by = y + SQ * 0.8;
      if (p.color === 'w') {
        s += `<text x="${cx}" y="${by}" font-family="${FONT}" font-size="60" text-anchor="middle" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round">${SOLID[p.type]}</text>`;
        s += `<text x="${cx}" y="${by}" font-family="${FONT}" font-size="60" text-anchor="middle" fill="#1A1A1A">${OUTLINE[p.type]}</text>`;
      } else {
        s += `<text x="${cx}" y="${by}" font-family="${FONT}" font-size="60" text-anchor="middle" fill="#1A1A1A">${SOLID[p.type]}</text>`;
      }
    }
  }
  caption.forEach((line, i) => {
    s += `<text x="${BX + SQ * 8 + 40}" y="${BY + 40 + i * 40}" font-family="Arial" font-size="${i === 0 ? 30 : 24}" font-weight="${i === 0 ? 'bold' : 'normal'}" fill="#222">${esc(line)}</text>`;
  });
  return svgDoc(s, '#FAF7F2');
}

/** All mating moves for the side to move. */
function mates(fen: string): string[] {
  const c = new Chess(fen);
  return c.moves({ verbose: true }).filter((m) => {
    c.move(m.san);
    const mate = c.isCheckmate();
    c.undo();
    return mate;
  }).map((m) => `${m.from}${m.to}`);
}

/** Pieces (non-kings) whose removal leaves their own king attacked: pinned to the king. */
function pinned(fen: string): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const row of c.board()) {
    for (const p of row) {
      if (!p || p.type === 'k') continue;
      const t = new Chess(fen);
      t.remove(p.square);
      const king = t.findPiece({ type: 'k', color: p.color })[0];
      if (t.isAttacked(king, p.color === 'w' ? 'b' : 'w')) out.push(p.square);
    }
  }
  return out;
}

function expect(what: string, got: string[], want: string[]): void {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`chess: ${what}: got ${got.join(',')}, want ${want.join(',')}`);
}

function pieceOptions(fen: string, squares: string[]): Option[] {
  const c = new Chess(fen);
  return squares.map((sq) => {
    const p = c.get(sq as Square);
    if (!p) throw new Error(`chess: no piece on ${sq}`);
    return { id: sq, label: `${p.color === 'w' ? 'White' : 'Black'} ${NAMES[p.type]} on ${sq}`, region: squareRegion(sq), jev: `The piece on ${sq}.` };
  });
}

// 1. Smothered mate: Nf7# is the only mate; the queen, rook and bishop all look dangerous.
const MATE_PIECE = '6rk/pp4pp/8/q5N1/2B5/8/PPP2PPP/3QR1K1 w - - 0 1';
expect('mate-piece mates', mates(MATE_PIECE), ['g5f7']);

// 2. Qg7#, the queen covered by the bishop on h6; Qh8+ and Qxf7+ are checks but not mate.
const MATE_SQUARE = '2r2rk1/pb3p1p/1p3QpB/8/8/2N5/PPP2PPP/R5K1 w - - 0 1';
expect('mate-square mates', mates(MATE_SQUARE), ['f6g7']);

// 3. The bishop on b5 pins the knight on d7 to the king on e8; nothing else is pinned.
const PIN = 'r3k2r/ppqnbppp/4pn2/1B6/8/2NQ4/PPP2PPP/4R1K1 w kq - 0 1';
expect('pin pinned', pinned(PIN), ['d7']);

export default [
  defineCard({
    id: 'chess-mate-piece',
    title: 'Mate in one',
    category: 'chess',
    difficulty: 2,
    prompt: 'White mates in one. Tap the piece that moves.',
    kind: 'pick',
    svg: drawBoard(MATE_PIECE, ['White to move', 'Mate in one']),
    options: pieceOptions(MATE_PIECE, ['d1', 'e1', 'c4', 'g5']),
    answer: 'g5',
    explain: 'Knight to f7 is a smothered mate: the black king is boxed in by its own rook and pawns.',
    jev: {
      context: 'A chess position with White to move, drawn as a board with file letters and rank numbers.',
      instructions: 'White has exactly one move that checkmates. Which white piece makes that move in `card`?',
    },
    source: 'drawn',
  }),
  defineCard({
    id: 'chess-mate-square',
    title: 'Mate in one',
    category: 'chess',
    difficulty: 2,
    prompt: 'Tap the square White moves to for mate in one.',
    kind: 'point',
    svg: drawBoard(MATE_SQUARE, ['White to move', 'Mate in one']),
    target: squareRegion('g7'),
    explain: 'Queen to g7 is mate: the bishop on h6 guards the queen, so the king cannot take it.',
    jev: {
      context: 'A chess position with White to move, drawn as a board with file letters and rank numbers.',
      instructions: 'White has exactly one move that checkmates. Where is the square that move lands on in `card`?',
    },
    source: 'drawn',
  }),
  defineCard({
    id: 'chess-pinned-piece',
    title: 'Find the pin',
    category: 'chess',
    difficulty: 2,
    prompt: 'Tap the black piece that is pinned to its king.',
    kind: 'pick',
    svg: drawBoard(PIN, ['Find the pin']),
    options: pieceOptions(PIN, ['c7', 'd7', 'e7', 'f6', 'e6', 'f7']),
    answer: 'd7',
    explain: 'The bishop on b5 pins the knight on d7 to the king on e8, so the knight is not allowed to move.',
    jev: {
      context: 'A chess position drawn as a board with file letters and rank numbers.',
      instructions: 'Exactly one black piece is pinned to the black king (it cannot move without exposing the king to check). Which piece is it in `card`?',
    },
    source: 'drawn',
  }),
];
