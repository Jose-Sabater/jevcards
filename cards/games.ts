/**
 * Board and game cards: chess, tic-tac-toe, connect four, sudoku, poker, a cube net and battleship.
 * Every answer is checked in code when the module loads (chess.js for chess, small solvers and a poker hand
 * evaluator for the rest), so a wrong or ambiguous position fails the build.
 */
import { Chess, type Square } from 'chess.js';
import { defineCard, esc, rectPx, svgDoc, type CardSpec, type Option, type Region } from './lib.ts';

const ARIAL = `font-family="Arial, Helvetica, sans-serif"`;

function fail(what: string): never {
  throw new Error(`games: ${what}`);
}
function expect(what: string, got: unknown, want: unknown): void {
  if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

// ---------------------------------------------------------------------------------------------------------
// Chess (same drawing as cards/chess.ts)

const SQ = 72;
const BX = 64;
const BY = 72;
const FILES = 'abcdefgh';
const PIECE_FONT = "'Arial Unicode MS', 'Apple Symbols', sans-serif";
const SOLID: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const OUTLINE: Record<string, string> = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' };
const NAMES: Record<string, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };

function squareXY(sq: string): [number, number] {
  return [BX + FILES.indexOf(sq[0]) * SQ, BY + (8 - Number(sq[1])) * SQ];
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
      s += `<rect x="${BX + f * SQ}" y="${BY + r * SQ}" width="${SQ}" height="${SQ}" fill="${(r + f) % 2 === 0 ? '#F0D9B5' : '#B58863'}"/>`;
    }
  }
  for (let i = 0; i < 8; i++) {
    s += `<text x="${BX + i * SQ + SQ / 2}" y="${BY + SQ * 8 + 30}" font-family="Arial" font-size="22" fill="#333" text-anchor="middle">${FILES[i]}</text>`;
    s += `<text x="${BX - 22}" y="${BY + i * SQ + SQ / 2 + 8}" font-family="Arial" font-size="22" fill="#333" text-anchor="middle">${8 - i}</text>`;
  }
  for (const row of c.board()) {
    for (const p of row) {
      if (!p) continue;
      const [x, y] = squareXY(p.square);
      const cx = x + SQ / 2;
      const by = y + SQ * 0.8;
      if (p.color === 'w') {
        s += `<text x="${cx}" y="${by}" font-family="${PIECE_FONT}" font-size="60" text-anchor="middle" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round">${SOLID[p.type]}</text>`;
        s += `<text x="${cx}" y="${by}" font-family="${PIECE_FONT}" font-size="60" text-anchor="middle" fill="#1A1A1A">${OUTLINE[p.type]}</text>`;
      } else {
        s += `<text x="${cx}" y="${by}" font-family="${PIECE_FONT}" font-size="60" text-anchor="middle" fill="#1A1A1A">${SOLID[p.type]}</text>`;
      }
    }
  }
  caption.forEach((line, i) => {
    s += `<text x="${BX + SQ * 8 + 36}" y="${BY + 40 + i * 44}" font-family="Arial" font-size="${i === 0 ? 32 : 28}" font-weight="${i === 0 ? 'bold' : 'normal'}" fill="#222">${esc(line)}</text>`;
  });
  return svgDoc(s, '#FAF7F2');
}

function mates(fen: string): string[] {
  const c = new Chess(fen);
  return c
    .moves({ verbose: true })
    .filter((m) => {
      c.move(m.san);
      const mate = c.isCheckmate();
      c.undo();
      return mate;
    })
    .map((m) => `${m.from}${m.to}`);
}

function pieceOptions(fen: string, squares: string[]): Option[] {
  const c = new Chess(fen);
  return squares.map((sq) => {
    const p = c.get(sq as Square);
    if (!p) fail(`no piece on ${sq}`);
    return { id: sq, label: `${p.color === 'w' ? 'White' : 'Black'} ${NAMES[p.type]} on ${sq}`, region: squareRegion(sq), jev: `The piece on ${sq}.` };
  });
}

const CHESS_CONTEXT = 'A chess position drawn as a board with file letters and rank numbers.';

// 1. Arabian mate: rook and knight. Rh7# is the only mate.
const ARABIAN = 'r6k/1R6/p4N2/1p6/8/6P1/5PKP/8 w - - 0 1';
expect('arabian mates', mates(ARABIAN), ['b7h7']);

// 2. Knight fork: Nf7+ hits the king on h8 and the queen on d6, and no black piece guards f7.
const FORK = 'r6k/pp4pp/3q4/6N1/8/1P6/P4PPP/2R3K1 w - - 0 1';
(() => {
  const c = new Chess(FORK);
  const king = c.findPiece({ type: 'k', color: 'b' })[0];
  const queen = c.findPiece({ type: 'q', color: 'b' })[0];
  const hops = (sq: string) => {
    const f = FILES.indexOf(sq[0]), r = Number(sq[1]);
    return [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]
      .map(([df, dr]) => [f + df, r + dr])
      .filter(([a, b]) => a >= 0 && a < 8 && b >= 1 && b <= 8)
      .map(([a, b]) => `${FILES[a]}${b}`);
  };
  const forks = c
    .moves({ verbose: true })
    .filter((m) => m.piece === 'n' && hops(m.to).includes(king) && hops(m.to).includes(queen))
    .map((m) => m.to);
  expect('fork squares', forks, ['f7']);
  expect('fork square safe', c.isAttacked('f7', 'b'), false);
})();

// 3. Hanging piece: exactly one black piece is attacked by White and defended by nothing.
const HANGING = 'r2q1rk1/pp3ppp/2n1b3/2bp4/8/1NN1B3/PPP2PPP/R2Q1RK1 w - - 0 1';
const HANGING_OPTIONS = ['c6', 'e6', 'c5', 'd5', 'd8'];
const hanging = (fen: string): string[] => {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const row of c.board())
    for (const p of row) if (p && p.color === 'b' && p.type !== 'k' && c.attackers(p.square, 'w').length && !c.attackers(p.square, 'b').length) out.push(p.square);
  return out;
};
expect('hanging pieces', hanging(HANGING), ['c5']);

// 4. Castling: rights intact, f1 and g1 empty, king not in check, but the bishop on a6 covers f1.
const CASTLE = 'rn1qkbnr/p1p2ppp/bp1p4/4p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4';
(() => {
  const c = new Chess(CASTLE);
  expect('castle rights', c.getCastlingRights('w').k, true);
  expect('castle not in check', c.inCheck(), false);
  expect('castle squares empty', [c.get('f1'), c.get('g1')].map((x) => x ?? null), [null, null]);
  expect('castle f1 attacked', c.attackers('f1', 'b'), ['a6']);
  expect('castle g1 safe', c.isAttacked('g1', 'b'), false);
  expect('castle illegal', c.moves().includes('O-O'), false);
})();

// 5. Who gives check: only the bishop on a2, down the long diagonal; the knight on f5 only looks close.
const CHECK_FEN = 'r2q1rk1/pp4pp/2n5/5N2/8/8/BPP2PPP/R2QR1K1 b - - 0 1';
expect('check in check', new Chess(CHECK_FEN).inCheck(), true);
expect('check attackers', new Chess(CHECK_FEN).attackers('g8', 'w'), ['a2']);

// 6. Is it mate? Qh7+ looks like mate, but the bishop on b1 is blocked by White's own pawn on e4: Kxh7.
const NOT_MATE = 'r4rk1/ppp2ppQ/8/8/4P3/8/PPP2PPP/1B4K1 b - - 0 1';
(() => {
  const c = new Chess(NOT_MATE);
  expect('not-mate in check', c.inCheck(), true);
  expect('not-mate is mate', c.isCheckmate(), false);
  expect('not-mate moves', c.moves(), ['Kxh7']);
})();

const chessCards: CardSpec[] = [
  defineCard({
    id: 'chess-arabian-mate',
    title: 'Rook and knight',
    category: 'chess',
    difficulty: 2,
    prompt: 'Tap the square White moves to for mate in one.',
    kind: 'point',
    svg: drawBoard(ARABIAN, ['White to move', 'Mate in one']),
    target: squareRegion('h7'),
    explain: 'Rook to h7 is mate: the knight on f6 guards the rook and covers g8, and the rook covers g7.',
    jev: {
      context: 'A chess position with White to move, drawn as a board with file letters and rank numbers.',
      instructions: 'White has exactly one move that checkmates. Where is the square that move lands on in `card`?',
    },
    source: 'drawn',
  }),
  defineCard({
    id: 'chess-knight-fork',
    title: 'Knight fork',
    category: 'chess',
    difficulty: 2,
    prompt: 'Tap the square where the knight forks king and queen.',
    kind: 'point',
    svg: drawBoard(FORK, ['White to move', 'Find the fork']),
    target: squareRegion('f7'),
    explain: 'Knight to f7 checks the king on h8 and attacks the queen on d6 at the same time, and nothing can take the knight.',
    jev: {
      context: 'A chess position with White to move, drawn as a board with file letters and rank numbers.',
      instructions: 'White has one knight move that attacks the black king and the black queen at once. Where is the square the knight lands on in `card`?',
    },
    source: 'drawn',
  }),
  defineCard({
    id: 'chess-hanging-piece',
    title: 'Loose piece',
    category: 'chess',
    difficulty: 3,
    prompt: 'Tap the black piece that is attacked and not defended.',
    kind: 'pick',
    svg: drawBoard(HANGING, ['White to move', 'Find the loose', 'black piece']),
    options: pieceOptions(HANGING, HANGING_OPTIONS),
    answer: 'c5',
    explain: 'The bishop on c5 is attacked by the knight on b3 and the bishop on e3, and no black piece defends it. The pawn on d5 is attacked too, but the queen and the e6 bishop guard it.',
    jev: {
      context: CHESS_CONTEXT,
      instructions: 'Exactly one black piece is attacked by a white piece and defended by no black piece. Which piece is it in `card`?',
    },
    source: 'drawn',
  }),
  defineCard({
    id: 'chess-castle-kingside',
    title: 'Castling',
    category: 'chess',
    difficulty: 3,
    prompt: 'Can White castle kingside now?',
    kind: 'buttons',
    svg: drawBoard(CASTLE, ['White to move', 'Neither king nor', 'rook has moved']),
    options: [
      { id: 'yes', label: 'Yes', jev: 'Yes.' },
      { id: 'no', label: 'No', jev: 'No.' },
    ],
    answer: 'no',
    explain: 'The black bishop on a6 attacks f1, and a king may not castle through a square that is under attack.',
    jev: {
      context: 'A chess position with White to move, drawn as a board with file letters and rank numbers. Neither the white king nor the h1 rook has moved yet.',
      instructions: 'Is castling kingside (O-O) a legal move for White in `card`?',
    },
    source: 'drawn',
  }),
  defineCard({
    id: 'chess-checking-piece',
    title: 'Who gives check',
    category: 'chess',
    difficulty: 2,
    prompt: 'The black king is in check. Tap the piece giving check.',
    kind: 'pick',
    svg: drawBoard(CHECK_FEN, ['Black to move', 'Black is in check']),
    options: pieceOptions(CHECK_FEN, ['a2', 'f5', 'd1', 'e1', 'g1']),
    answer: 'a2',
    explain: 'The bishop on a2 checks the king on g8 along the long diagonal. The knight on f5 is close but does not reach g8.',
    jev: {
      context: 'A chess position with Black to move, drawn as a board with file letters and rank numbers.',
      instructions: 'The black king is in check from exactly one white piece. Which piece gives the check in `card`?',
    },
    source: 'drawn',
  }),
  defineCard({
    id: 'chess-is-it-mate',
    title: 'Mate or not',
    category: 'chess',
    difficulty: 3,
    prompt: 'White just played Qh7+. Is it checkmate?',
    kind: 'buttons',
    svg: drawBoard(NOT_MATE, ['Black to move', 'White played', 'Queen to h7']),
    options: [
      { id: 'yes', label: 'Yes', jev: 'Yes.' },
      { id: 'no', label: 'No', jev: 'No.' },
    ],
    answer: 'no',
    explain: 'The king can take the queen on h7: the bishop on b1 would guard it, but White\'s own pawn on e4 blocks the diagonal.',
    jev: {
      context: 'A chess position with Black to move, drawn as a board with file letters and rank numbers. White just moved the queen to h7.',
      instructions: 'Is Black checkmated in `card`?',
    },
    source: 'drawn',
  }),
];

// ---------------------------------------------------------------------------------------------------------
// Tic-tac-toe

const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const TC = 170, TX = 90, TY = 105;
const tttWinner = (b: string): string | null => {
  for (const [a, c, d] of TTT_LINES) if (b[a] !== '.' && b[a] === b[c] && b[a] === b[d]) return b[a];
  return null;
};
/** Empty cells where `who` wins at once. */
const tttWins = (b: string, who: string): number[] =>
  [...b].flatMap((v, i) => (v === '.' && tttWinner(b.slice(0, i) + who + b.slice(i + 1)) === who ? [i] : []));
const tttCell = (i: number): Region => rectPx(TX + (i % 3) * TC, TY + Math.floor(i / 3) * TC, TC, TC);

function drawTtt(b: string, caption: string[]): string {
  let s = `<rect x="${TX - 16}" y="${TY - 16}" width="${TC * 3 + 32}" height="${TC * 3 + 32}" rx="20" fill="#FFFFFF"/>`;
  for (let k = 1; k < 3; k++) {
    s += `<line x1="${TX + k * TC}" y1="${TY + 6}" x2="${TX + k * TC}" y2="${TY + TC * 3 - 6}" stroke="#2B2D42" stroke-width="10" stroke-linecap="round"/>`;
    s += `<line x1="${TX + 6}" y1="${TY + k * TC}" x2="${TX + TC * 3 - 6}" y2="${TY + k * TC}" stroke="#2B2D42" stroke-width="10" stroke-linecap="round"/>`;
  }
  [...b].forEach((v, i) => {
    const cx = TX + (i % 3) * TC + TC / 2, cy = TY + Math.floor(i / 3) * TC + TC / 2, r = 52;
    if (v === 'X') s += `<path d="M${cx - r},${cy - r}L${cx + r},${cy + r}M${cx + r},${cy - r}L${cx - r},${cy + r}" stroke="#D62828" stroke-width="18" stroke-linecap="round"/>`;
    if (v === 'O') s += `<circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="none" stroke="#1D5FAF" stroke-width="18"/>`;
  });
  caption.forEach((line, i) => {
    s += `<text x="${TX + TC * 3 + 60}" y="${TY + 60 + i * 50}" ${ARIAL} font-size="${i === 0 ? 44 : 32}" font-weight="${i === 0 ? 'bold' : 'normal'}" fill="#222">${esc(line)}</text>`;
  });
  return svgDoc(s, '#E9EEF3');
}
const CELL_NAMES = ['top left', 'top middle', 'top right', 'middle left', 'center', 'middle right', 'bottom left', 'bottom middle', 'bottom right'];

// X to move (3 each). X wins only at the top right; O threatens the middle right, a decoy for blockers.
const TTT_WIN = 'XX.' + 'OO.' + 'XO.';
expect('ttt-win to move', [...TTT_WIN].filter((v) => v === 'X').length, [...TTT_WIN].filter((v) => v === 'O').length);
expect('ttt-win no winner', tttWinner(TTT_WIN), null);
expect('ttt-win squares', tttWins(TTT_WIN, 'X'), [2]);
expect('ttt-win O threat', tttWins(TTT_WIN, 'O'), [5]);

// O to move (X 3, O 2). X threatens only the bottom right; the other diagonal looks live but O holds it.
const TTT_BLOCK = 'XOX' + '.X.' + 'O..';
expect('ttt-block to move', [...TTT_BLOCK].filter((v) => v === 'X').length, [...TTT_BLOCK].filter((v) => v === 'O').length + 1);
expect('ttt-block no winner', tttWinner(TTT_BLOCK), null);
expect('ttt-block X threats', tttWins(TTT_BLOCK, 'X'), [8]);
expect('ttt-block O wins', tttWins(TTT_BLOCK, 'O'), []);

const tttCards: CardSpec[] = [
  defineCard({
    id: 'tictactoe-x-wins',
    title: 'Three in a row',
    category: 'logic',
    difficulty: 1,
    prompt: 'X to move. Tap where X wins.',
    kind: 'point',
    svg: drawTtt(TTT_WIN, ['X to move']),
    target: tttCell(tttWins(TTT_WIN, 'X')[0]),
    explain: 'An X in the top right completes the top row. The middle right only blocks O.',
    jev: {
      context: 'A tic-tac-toe board with red X marks and blue O marks; X is about to move.',
      instructions: 'X has exactly one square that wins at once. Where is that square in `card`?',
    },
    source: 'drawn',
  }),
  defineCard({
    id: 'tictactoe-o-blocks',
    title: 'Block it',
    category: 'logic',
    difficulty: 2,
    prompt: 'O to move. Tap where O must block.',
    kind: 'point',
    svg: drawTtt(TTT_BLOCK, ['O to move']),
    target: tttCell(tttWins(TTT_BLOCK, 'X')[0]),
    explain: `X threatens the diagonal from the top left, so O must take the ${CELL_NAMES[8]}. The other diagonal is already blocked by the O in the bottom left.`,
    jev: {
      context: 'A tic-tac-toe board with red X marks and blue O marks; O is about to move.',
      instructions: 'X threatens to win on exactly one square. Where must O play to block it in `card`?',
    },
    source: 'drawn',
  }),
];

// ---------------------------------------------------------------------------------------------------------
// Connect four: 7 columns, 6 rows, discs fall to the bottom.

const C4 = 84, C4X = 186, C4Y = 150;
/** Columns listed bottom up. */
const C4_COLS = ['RY', 'YR', 'YYR', 'YRY', 'RR', 'YR', ''];
const c4Grid = (cols: string[]): string[][] => cols.map((c) => [...c].concat(Array(6 - c.length).fill('.')));
function c4Winner(g: string[][]): string | null {
  for (let c = 0; c < 7; c++)
    for (let r = 0; r < 6; r++) {
      const v = g[c][r];
      if (v === '.') continue;
      for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        let k = 1;
        while (k < 4 && g[c + dc * k]?.[r + dr * k] === v) k++;
        if (k === 4) return v;
      }
    }
  return null;
}
const c4WinningColumns = (cols: string[], who: string): number[] =>
  cols.flatMap((col, i) => (col.length < 6 && c4Winner(c4Grid(cols.map((c, j) => (j === i ? c + who : c)))) === who ? [i] : []));
(() => {
  const all = C4_COLS.join('');
  expect('c4 counts', [...all].filter((v) => v === 'R').length, [...all].filter((v) => v === 'Y').length);
  expect('c4 no winner', c4Winner(c4Grid(C4_COLS)), null);
  expect('c4 red wins', c4WinningColumns(C4_COLS, 'R'), [3]);
  // The decoy: red has three in a row on the second row, but the cell that would finish it floats in an empty column.
  expect('c4 decoy floats', c4Winner(c4Grid(C4_COLS.map((c, j) => (j === 6 ? 'YR' : c)))), 'R');
})();
const c4Column = (i: number): Region => rectPx(C4X + i * C4, C4Y, C4, C4 * 6);
function drawC4(cols: string[]): string {
  let s = `<text x="480" y="100" text-anchor="middle" ${ARIAL} font-size="40" font-weight="bold" fill="#222">Red to move</text>`;
  s += `<rect x="${C4X - 14}" y="${C4Y - 14}" width="${C4 * 7 + 28}" height="${C4 * 6 + 28}" rx="22" fill="#1D4FA8"/>`;
  const g = c4Grid(cols);
  for (let c = 0; c < 7; c++)
    for (let r = 0; r < 6; r++) {
      const v = g[c][r];
      const fill = v === 'R' ? '#D62828' : v === 'Y' ? '#F2C40F' : '#F3F1EA';
      s += `<circle cx="${C4X + c * C4 + C4 / 2}" cy="${C4Y + (5 - r) * C4 + C4 / 2}" r="34" fill="${fill}" stroke="#163C80" stroke-width="3"/>`;
    }
  for (let c = 0; c < 7; c++) s += `<text x="${C4X + c * C4 + C4 / 2}" y="${C4Y + C4 * 6 + 56}" text-anchor="middle" ${ARIAL} font-size="30" fill="#333">${c + 1}</text>`;
  return svgDoc(s, '#F3F1EA');
}

const c4Card = defineCard({
  id: 'connect-four-win',
  title: 'Four in a row',
  category: 'logic',
  difficulty: 2,
  prompt: 'Red to move. Tap the column that wins.',
  kind: 'point',
  svg: drawC4(C4_COLS),
  target: c4Column(c4WinningColumns(C4_COLS, 'R')[0]),
  explain: 'A red disc in column 4 lands on the fourth row and completes a diagonal from the bottom left. The red three on the second row cannot be finished yet: column 7 is empty.',
  jev: {
    context: 'A connect four board with red and yellow discs; discs dropped into a column fall to the lowest empty hole. The columns are numbered 1 to 7 under the board.',
    instructions: 'Red has exactly one column that wins at once. Where is that column in `card`?',
  },
  source: 'drawn',
});

// ---------------------------------------------------------------------------------------------------------
// Sudoku: the classic puzzle from Wikipedia; the center cell is forced by its row, column and box together.

const SUDOKU = ['53..7....', '6..195...', '.98....6.', '8...6...3', '4..8.3..1', '7...2...6', '.6....28.', '...419..5', '....8..79'];
const SOLUTION = ['534678912', '672195348', '198342567', '859761423', '426853791', '713924856', '961537284', '287419635', '345286179'];
const SR = 4, SC = 4;
const sudokuAnswer = (() => {
  const units = (r: number, c: number) => {
    const row = [...SOLUTION[r]];
    const col = SOLUTION.map((l) => l[c]);
    const box = SOLUTION.slice(r - (r % 3), r - (r % 3) + 3).flatMap((l) => [...l.slice(c - (c % 3), c - (c % 3) + 3)]);
    return [row, col, box];
  };
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) for (const u of units(r, c)) expect(`sudoku unit ${r},${c}`, [...u].sort().join(''), '123456789');
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (SUDOKU[r][c] !== '.' && SUDOKU[r][c] !== SOLUTION[r][c]) fail(`sudoku given ${r},${c}`);
  if (SUDOKU[SR][SC] !== '.') fail('sudoku target is given');
  const row = new Set([...SUDOKU[SR]]);
  const col = new Set(SUDOKU.map((l) => l[SC]));
  const box = new Set(SUDOKU.slice(3, 6).flatMap((l) => [...l.slice(3, 6)]));
  const cand = [...'123456789'].filter((d) => !row.has(d) && !col.has(d) && !box.has(d));
  expect('sudoku candidates', cand, [SOLUTION[SR][SC]]);
  // No single unit is enough on its own: the row and the column are both needed.
  for (const u of [row, col, box]) if ([...'123456789'].filter((d) => !u.has(d)).length === 1) fail('sudoku: one unit alone decides');
  return cand[0];
})();
function drawSudoku(): string {
  const cs = 68, x0 = (960 - cs * 9) / 2, y0 = (720 - cs * 9) / 2;
  let s = `<rect x="${x0}" y="${y0}" width="${cs * 9}" height="${cs * 9}" fill="#FFFFFF"/>`;
  s += `<rect x="${x0 + SC * cs}" y="${y0 + SR * cs}" width="${cs}" height="${cs}" fill="#FFD54F"/>`;
  for (let k = 0; k <= 9; k++) {
    const w = k % 3 === 0 ? 5 : 1.5;
    s += `<line x1="${x0 + k * cs}" y1="${y0}" x2="${x0 + k * cs}" y2="${y0 + cs * 9}" stroke="#222" stroke-width="${w}"/>`;
    s += `<line x1="${x0}" y1="${y0 + k * cs}" x2="${x0 + cs * 9}" y2="${y0 + k * cs}" stroke="#222" stroke-width="${w}"/>`;
  }
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      const v = SUDOKU[r][c];
      if (v !== '.') s += `<text x="${x0 + c * cs + cs / 2}" y="${y0 + r * cs + cs / 2 + 15}" text-anchor="middle" ${ARIAL} font-size="42" fill="#222">${v}</text>`;
    }
  s += `<text x="${x0 + SC * cs + cs / 2}" y="${y0 + SR * cs + cs / 2 + 15}" text-anchor="middle" ${ARIAL} font-size="42" font-weight="bold" fill="#8A6D00">?</text>`;
  return svgDoc(s, '#E9EEF3');
}
const sudokuCard = defineCard({
  id: 'sudoku-center-cell',
  title: 'Sudoku',
  category: 'logic',
  difficulty: 3,
  prompt: 'Which number goes in the yellow cell?',
  kind: 'buttons',
  svg: drawSudoku(),
  options: ['2', '5', '7', '9'].map((d) => ({ id: `d${d}`, label: d, jev: `${d}.` })),
  answer: `d${sudokuAnswer}`,
  explain: 'The center row has 4, 8, 3 and 1, the center column has 7, 9, 6, 2, 1 and 8, and the center box adds nothing new. The only digit missing from all of them is 5.',
  jev: {
    context: 'A 9 by 9 sudoku grid, partly filled in, with one empty cell highlighted in yellow and marked with a question mark.',
    instructions: 'By the sudoku rules (each digit 1 to 9 once per row, column and 3 by 3 box), which digit must go in the highlighted cell in `card`?',
  },
  source: 'drawn',
});

// ---------------------------------------------------------------------------------------------------------
// Poker: cards drawn as SVG (suits are paths), hands ranked by a small evaluator.

type Hand = string[]; // 'AS', 'TH', '9C'...
const RANKS = '23456789TJQKA';
const HAND_NAMES = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
/** [category, ...tiebreak ranks], compared lexicographically. */
function evaluate(hand: Hand): number[] {
  if (hand.length !== 5) fail(`poker hand ${hand}`);
  const ranks = hand.map((c) => RANKS.indexOf(c[0]) + 2).sort((a, b) => b - a);
  const flush = new Set(hand.map((c) => c[1])).size === 1;
  const uniq = [...new Set(ranks)];
  let straightHigh = 0;
  if (uniq.length === 5 && ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
  if (uniq.join() === '14,5,4,3,2') straightHigh = 5;
  const counts = uniq.map((r) => [ranks.filter((x) => x === r).length, r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const shape = counts.map((c) => c[0]).join('');
  const byCount = counts.map((c) => c[1]);
  if (straightHigh && flush) return [8, straightHigh];
  if (shape === '41') return [7, ...byCount];
  if (shape === '32') return [6, ...byCount];
  if (flush) return [5, ...ranks];
  if (straightHigh) return [4, straightHigh];
  if (shape === '311') return [3, ...byCount];
  if (shape === '221') return [2, ...byCount];
  if (shape === '2111') return [1, ...byCount];
  return [0, ...ranks];
}
const cmp = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  return 0;
};
function pokerWinner(hands: Hand[]): number {
  const all = hands.flat();
  if (new Set(all).size !== all.length) fail('poker: a card appears twice');
  for (const c of all) if (!RANKS.includes(c[0]) || !'SHDC'.includes(c[1])) fail(`poker card ${c}`);
  const scores = hands.map(evaluate);
  const best = scores.reduce((b, s, i) => (cmp(s, scores[b]) > 0 ? i : b), 0);
  for (let i = 0; i < scores.length; i++) if (i !== best && cmp(scores[i], scores[best]) === 0) fail('poker: tie');
  return best;
}
// Self-check of the evaluator on known orderings.
(() => {
  const ladder: Hand[] = [
    ['2H', '4D', '7S', '9C', 'JD'], ['2H', '2D', '7S', '9C', 'JD'], ['2H', '2D', '7S', '7C', 'JD'], ['2H', '2D', '2S', '9C', 'JD'],
    ['AH', '2D', '3S', '4C', '5D'], ['6H', '7D', '8S', '9C', 'TD'], ['2H', '4H', '7H', '9H', 'JH'], ['2H', '2D', '2S', '9C', '9D'],
    ['2H', '2D', '2S', '2C', 'JD'], ['5S', '6S', '7S', '8S', '9S'],
  ];
  const s = ladder.map(evaluate);
  for (let i = 1; i < s.length; i++) if (cmp(s[i], s[i - 1]) <= 0) fail(`poker evaluator ladder at ${i}`);
})();

const SUIT_COLOR: Record<string, string> = { H: '#C62828', D: '#C62828', S: '#1A1A1A', C: '#1A1A1A' };
/** A suit shape centred on (x, y), about `s` tall. */
function suit(kind: string, x: number, y: number, s: number): string {
  const f = SUIT_COLOR[kind];
  const p = (pts: number[][]) => pts.map(([a, b]) => `${(x + a * s).toFixed(1)},${(y + b * s).toFixed(1)}`);
  if (kind === 'D') return `<polygon points="${p([[0, -0.5], [0.38, 0], [0, 0.5], [-0.38, 0]]).join(' ')}" fill="${f}"/>`;
  if (kind === 'H') {
    const [a, b1, b2, b3, c1, c2, c3, d1, d2, d3, e1, e2] = p([[0, 0.45], [-0.62, 0.0], [-0.5, -0.48], [-0.25, -0.48], [-0.08, -0.48], [0, -0.36], [0, -0.26], [0, -0.36], [0.08, -0.48], [0.25, -0.48], [0.5, -0.48], [0.62, 0.0]]);
    return `<path d="M${a}C${b1} ${b2} ${b3}C${c1} ${c2} ${c3}C${d1} ${d2} ${d3}C${e1} ${e2} ${a}Z" fill="${f}"/>`;
  }
  const stem = `<polygon points="${p([[0, 0.12], [-0.2, 0.5], [0.2, 0.5]]).join(' ')}" fill="${f}"/>`;
  if (kind === 'S') {
    const [a, b1, b2, b3, c1, c2, c3, d1, d2, d3, e1, e2] = p([[0, -0.5], [-0.62, -0.05], [-0.5, 0.36], [-0.25, 0.36], [-0.08, 0.36], [0, 0.26], [0, 0.18], [0, 0.26], [0.08, 0.36], [0.25, 0.36], [0.5, 0.36], [0.62, -0.05]]);
    return `<path d="M${a}C${b1} ${b2} ${b3}C${c1} ${c2} ${c3}C${d1} ${d2} ${d3}C${e1} ${e2} ${a}Z" fill="${f}"/>` + stem;
  }
  const r = (0.21 * s).toFixed(1);
  return [[0, -0.24], [-0.24, 0.08], [0.24, 0.08]].map(([a, b]) => `<circle cx="${(x + a * s).toFixed(1)}" cy="${(y + b * s).toFixed(1)}" r="${r}" fill="${f}"/>`).join('') + stem;
}
function playingCard(card: string, x: number, y: number, w: number, h: number): string {
  const rank = card[0] === 'T' ? '10' : card[0];
  const fs = Math.round(w * 0.3);
  let s = `<rect x="${x + 4}" y="${y + 6}" width="${w}" height="${h}" rx="12" fill="#00000030"/>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#FFFFFF" stroke="#555" stroke-width="2"/>`;
  s += `<text x="${x + w * 0.2}" y="${y + fs + 4}" text-anchor="middle" ${ARIAL} font-weight="bold" font-size="${fs}" fill="${SUIT_COLOR[card[1]]}">${rank}</text>`;
  s += suit(card[1], x + w * 0.2, y + fs + 26, w * 0.2);
  s += suit(card[1], x + w * 0.58, y + h * 0.62, w * 0.55);
  return s;
}
function drawHands(hands: Hand[], cw: number, ch: number, rowY: number[]): { svg: string; regions: Region[] } {
  const gap = cw * 0.18;
  const total = cw * 5 + gap * 4;
  const x0 = (960 - total) / 2;
  let s = '';
  const regions: Region[] = [];
  hands.forEach((hand, i) => {
    hand.forEach((c, k) => (s += playingCard(c, x0 + k * (cw + gap), rowY[i], cw, ch)));
    regions.push(rectPx(x0 - 16, rowY[i] - 12, total + 32, ch + 24));
  });
  return { svg: svgDoc(s, '#2F6B4F'), regions };
}
const POS = ['top', 'middle', 'bottom'];

const POKER_TWO: Hand[] = [['5C', '6D', '7S', '8D', '9C'], ['2H', '5H', '8H', 'JH', 'KH']];
const POKER_THREE: Hand[] = [['QS', 'QD', 'JC', 'JH', '4S'], ['7C', '7H', '7D', 'KS', '2C'], ['AD', 'KC', 'QH', 'JD', '9S']];
function pokerCard(id: string, hands: Hand[], cw: number, ch: number, rowY: number[], difficulty: 1 | 2 | 3, explain: string): CardSpec {
  const win = pokerWinner(hands);
  const { svg, regions } = drawHands(hands, cw, ch, rowY);
  const pos = hands.length === 2 ? ['top', 'bottom'] : POS;
  return defineCard({
    id,
    title: 'Best hand',
    category: 'logic',
    difficulty,
    prompt: 'Which poker hand wins?',
    kind: 'pick',
    svg,
    options: hands.map((h, i) => ({ id: pos[i], label: `${HAND_NAMES[evaluate(h)[0]]} (${pos[i]} row)`, region: regions[i], jev: `The ${pos[i]} row of cards.` })),
    answer: pos[win],
    explain,
    jev: {
      context: `${hands.length} rows of five playing cards on a green table; each row is one poker hand.`,
      instructions: 'By standard poker hand rankings, which row of cards is the winning hand in `card`?',
    },
    source: 'drawn',
  });
}
const pokerCards: CardSpec[] = [
  pokerCard('poker-flush-straight', POKER_TWO, 128, 182, [110, 420], 2, 'The bottom row is a flush, five hearts, and a flush beats the straight from 5 to 9 on top.'),
  pokerCard('poker-three-hands', POKER_THREE, 110, 158, [40, 281, 522], 2, 'Three sevens in the middle row beat the two pair (queens and jacks) on top and the ace-high bottom row.'),
];

// ---------------------------------------------------------------------------------------------------------
// Cube net: fold it in code to find which faces end up opposite.

/** Grid cells [col, row] and the number written on each. */
const NET: [number, number, number][] = [[0, 0, 6], [1, 0, 2], [1, 1, 4], [2, 1, 3], [2, 2, 1], [3, 2, 5]];
function foldNet(net: [number, number, number][]): Map<number, string> {
  type V = [number, number, number];
  const neg = (v: V): V => [-v[0], -v[1], -v[2]];
  const key = (v: V) => v.join(',');
  const normal = new Map<number, string>();
  const seen = new Set<string>();
  // Each cell: the outward normal of its face, and the 3D directions of grid +x and +y on that face.
  const walk = (i: number, n: V, u: V, v: V) => {
    const [c, r, label] = net[i];
    seen.add(`${c},${r}`);
    normal.set(label, key(n));
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = net.findIndex(([a, b]) => a === c + dc && b === r + dr);
      if (j < 0 || seen.has(`${c + dc},${r + dr}`)) continue;
      if (dc === 1) walk(j, u, neg(n), v);
      if (dc === -1) walk(j, neg(u), n, v);
      if (dr === 1) walk(j, v, u, neg(n));
      if (dr === -1) walk(j, neg(v), u, n);
    }
  };
  walk(0, [0, 0, -1], [1, 0, 0], [0, 1, 0]);
  if (new Set(normal.values()).size !== 6) fail('cube net does not fold into a cube');
  return normal;
}
const oppositeOf = (k: number): number => {
  const n = foldNet(NET);
  const want = n.get(k)!.split(',').map((x) => String(-Number(x) || 0)).join(',');
  const hit = [...n].find(([, v]) => v.split(',').map((x) => String(Number(x) || 0)).join(',') === want);
  if (!hit) fail('cube net opposite');
  return hit[0];
};
// Sanity check of the fold on a plain cross: the face two steps along a line is opposite.
(() => {
  const saved = NET.splice(0, NET.length, [1, 0, 1], [0, 1, 2], [1, 1, 3], [2, 1, 4], [1, 2, 5], [1, 3, 6]);
  expect('cube cross 1', oppositeOf(1), 5);
  expect('cube cross 2', oppositeOf(2), 4);
  expect('cube cross 3', oppositeOf(3), 6);
  NET.splice(0, NET.length, ...saved);
})();
const cubeAnswer = oppositeOf(6);
expect('cube answer', cubeAnswer, 3);
function drawNet(): string {
  const cs = 140, cols = 4, rows = 3;
  const x0 = (960 - cs * cols) / 2, y0 = (720 - cs * rows) / 2 + 10;
  let s = '';
  for (const [c, r, label] of NET) {
    s += `<rect x="${x0 + c * cs}" y="${y0 + r * cs}" width="${cs}" height="${cs}" fill="#FFFFFF" stroke="#2B2D42" stroke-width="5"/>`;
    s += `<text x="${x0 + c * cs + cs / 2}" y="${y0 + r * cs + cs / 2 + 28}" text-anchor="middle" ${ARIAL} font-weight="bold" font-size="80" fill="#2B2D42">${label}</text>`;
  }
  return svgDoc(s, '#F4E9D8');
}
const cubeCard = defineCard({
  id: 'cube-net-opposite',
  title: 'Fold the cube',
  category: 'logic',
  difficulty: 3,
  prompt: 'Fold this into a cube. Which number is opposite the 6?',
  kind: 'buttons',
  svg: drawNet(),
  options: [1, 3, 4, 5].map((k) => ({ id: `n${k}`, label: String(k), jev: `${k}.` })),
  answer: `n${cubeAnswer}`,
  explain: 'Fold it with the 4 as the floor: 2 and 1 become the back and front walls, 6 and 3 the left and right walls, and 5 the lid. It is not a die, so the dice rule (opposite faces add up to 7) does not apply.',
  jev: {
    context: 'A flat net of six squares, each with a number, that folds into a cube.',
    instructions: 'If the net in `card` is folded into a cube, which number ends up on the face opposite the 6?',
  },
  source: 'drawn',
});

// ---------------------------------------------------------------------------------------------------------
// Battleship: one ship of four is left; enumerate every placement that fits the shots.

const BS = 8, BC = 66, BXo = 90, BYo = 110;
const ROWS = 'ABCDEFGH';
const HITS = ['D3', 'D4', 'D5'];
const MISSES = ['D6', 'C4', 'E4', 'B7', 'F2', 'G6', 'A3', 'H8', 'C2'];
const SUNK = [['F4', 'G4', 'H4'], ['A6', 'A7']];
const cell = (s: string): [number, number] => [ROWS.indexOf(s[0]), Number(s.slice(1)) - 1];
const name = (r: number, c: number) => `${ROWS[r]}${c + 1}`;
const bsAnswer = (() => {
  const blocked = new Set([...MISSES, ...SUNK.flat()]);
  const placements: string[][] = [];
  for (let r = 0; r < BS; r++)
    for (let c = 0; c < BS; c++)
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const sq = [0, 1, 2, 3].map((k) => [r + dr * k, c + dc * k]);
        if (sq.some(([a, b]) => a >= BS || b >= BS)) continue;
        const names = sq.map(([a, b]) => name(a, b));
        if (names.some((n) => blocked.has(n))) continue;
        if (!HITS.every((h) => names.includes(h))) continue;
        placements.push(names);
      }
  expect('battleship placements', placements.length, 1);
  const open = placements[0].filter((n) => !HITS.includes(n));
  expect('battleship open squares', open.length, 1);
  return open[0];
})();
expect('battleship answer', bsAnswer, 'D2');
function drawBattleship(): string {
  let s = `<rect x="${BXo}" y="${BYo}" width="${BC * BS}" height="${BC * BS}" fill="#CFE6F5"/>`;
  for (let k = 0; k <= BS; k++) {
    s += `<line x1="${BXo + k * BC}" y1="${BYo}" x2="${BXo + k * BC}" y2="${BYo + BC * BS}" stroke="#5B7A90" stroke-width="2"/>`;
    s += `<line x1="${BXo}" y1="${BYo + k * BC}" x2="${BXo + BC * BS}" y2="${BYo + k * BC}" stroke="#5B7A90" stroke-width="2"/>`;
  }
  for (let k = 0; k < BS; k++) {
    s += `<text x="${BXo + k * BC + BC / 2}" y="${BYo - 16}" text-anchor="middle" ${ARIAL} font-size="28" fill="#333">${k + 1}</text>`;
    s += `<text x="${BXo - 26}" y="${BYo + k * BC + BC / 2 + 10}" text-anchor="middle" ${ARIAL} font-size="28" fill="#333">${ROWS[k]}</text>`;
  }
  const at = (n: string): [number, number] => {
    const [r, c] = cell(n);
    return [BXo + c * BC + BC / 2, BYo + r * BC + BC / 2];
  };
  for (const ship of SUNK)
    for (const n of ship) {
      const [x, y] = at(n);
      s += `<rect x="${x - BC / 2 + 4}" y="${y - BC / 2 + 4}" width="${BC - 8}" height="${BC - 8}" rx="8" fill="#5A5F66"/>`;
      s += `<path d="M${x - 14},${y - 14}L${x + 14},${y + 14}M${x + 14},${y - 14}L${x - 14},${y + 14}" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>`;
    }
  for (const n of HITS) {
    const [x, y] = at(n);
    s += `<circle cx="${x}" cy="${y}" r="24" fill="#D62828"/>`;
  }
  for (const n of MISSES) {
    const [x, y] = at(n);
    s += `<circle cx="${x}" cy="${y}" r="10" fill="#FFFFFF" stroke="#5B7A90" stroke-width="3"/>`;
  }
  const lx = BXo + BC * BS + 40;
  s += `<circle cx="${lx + 20}" cy="${BYo + 30}" r="20" fill="#D62828"/><text x="${lx + 56}" y="${BYo + 40}" ${ARIAL} font-size="28" fill="#222">Hit</text>`;
  s += `<circle cx="${lx + 20}" cy="${BYo + 100}" r="10" fill="#FFFFFF" stroke="#5B7A90" stroke-width="3"/><text x="${lx + 56}" y="${BYo + 110}" ${ARIAL} font-size="28" fill="#222">Miss</text>`;
  s += `<rect x="${lx}" y="${BYo + 150}" width="40" height="40" rx="6" fill="#5A5F66"/><text x="${lx + 56}" y="${BYo + 180}" ${ARIAL} font-size="28" fill="#222">Sunk</text>`;
  s += `<text x="${lx}" y="${BYo + 270}" ${ARIAL} font-size="28" font-weight="bold" fill="#222">Ship left:</text>`;
  for (let k = 0; k < 4; k++) s += `<rect x="${lx + k * 44}" y="${BYo + 290}" width="40" height="40" rx="6" fill="#8FA3B3" stroke="#5B7A90" stroke-width="2"/>`;
  s += `<text x="${lx}" y="${BYo + 375}" ${ARIAL} font-size="28" fill="#222">4 squares long</text>`;
  return svgDoc(s, '#F3F1EA');
}
const bsRegion = (() => {
  const [r, c] = cell(bsAnswer);
  return rectPx(BXo + c * BC, BYo + r * BC, BC, BC);
})();
const battleshipCard = defineCard({
  id: 'battleship-sink',
  title: 'Sink it',
  category: 'logic',
  difficulty: 2,
  prompt: 'One ship of four is left. Tap the square that sinks it.',
  kind: 'point',
  svg: drawBattleship(),
  target: bsRegion,
  explain: 'The three hits run along row D from 3 to 5. A ship of four needs one more square in that row, and D6 is a miss, so it has to be D2.',
  jev: {
    context: 'A battleship grid with rows A to H and columns 1 to 8, showing hits, misses and sunk ships, with a legend on the right. One ship, four squares long, is still afloat.',
    instructions: 'Exactly one square must hold the last unhit part of the remaining ship. Where is that square in `card`?',
  },
  source: 'drawn',
});

export default [...chessCards, ...tttCards, c4Card, sudokuCard, ...pokerCards, cubeCard, battleshipCard];
