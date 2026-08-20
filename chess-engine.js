/* Minimal dependency-free chess rules engine.
 * Board convention: board[row][col], row 0 = rank 8 (top), row 7 = rank 1 (bottom).
 * col 0 = file a, col 7 = file h.
 * Piece strings: color 'w'|'b' + type 'P','N','B','R','Q','K'  e.g. "wP", "bK". Empty square = null.
 */

const KNIGHT_OFFSETS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KING_OFFSETS   = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const BISHOP_DIRS    = [[-1,-1],[-1,1],[1,-1],[1,1]];
const ROOK_DIRS      = [[-1,0],[1,0],[0,-1],[0,1]];
const QUEEN_DIRS     = [...BISHOP_DIRS, ...ROOK_DIRS];

function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function fileOf(c) { return "abcdefgh"[c]; }
function rankOf(r) { return 8 - r; }
function sqName(r, c) { return fileOf(c) + rankOf(r); }

function cloneBoard(board) {
  return board.map(row => row.slice());
}

function initialState() {
  const back = ["R","N","B","Q","K","B","N","R"];
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = "b" + back[c];
    board[1][c] = "bP";
    board[6][c] = "wP";
    board[7][c] = "w" + back[c];
  }
  return {
    board,
    turn: "w",
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null, // {r,c} square a pawn can capture into
    halfmove: 0,
    fullmove: 1,
    lastMove: null, // {from:{r,c}, to:{r,c}, piece, captured, promotion, castle, enPassantCapture}
  };
}

function findKing(board, color) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] === color + "K") return { r, c };
  return null;
}

function isSquareAttacked(board, r, c, byColor) {
  // Pawn attacks
  const dir = byColor === "w" ? 1 : -1; // white pawns attack upward (toward lower row index), so from attacker's perspective the attacked square is dir below
  for (const dc of [-1, 1]) {
    const pr = r + dir, pc = c + dc;
    if (inBounds(pr, pc) && board[pr][pc] === byColor + "P") return true;
  }
  // Knights
  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const nr = r + dr, nc = c + dc;
    if (inBounds(nr, nc) && board[nr][nc] === byColor + "N") return true;
  }
  // King
  for (const [dr, dc] of KING_OFFSETS) {
    const nr = r + dr, nc = c + dc;
    if (inBounds(nr, nc) && board[nr][nc] === byColor + "K") return true;
  }
  // Sliding: bishop/queen diagonals
  for (const [dr, dc] of BISHOP_DIRS) {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const p = board[nr][nc];
      if (p) {
        if (p[0] === byColor && (p[1] === "B" || p[1] === "Q")) return true;
        break;
      }
      nr += dr; nc += dc;
    }
  }
  // Sliding: rook/queen straights
  for (const [dr, dc] of ROOK_DIRS) {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const p = board[nr][nc];
      if (p) {
        if (p[0] === byColor && (p[1] === "R" || p[1] === "Q")) return true;
        break;
      }
      nr += dr; nc += dc;
    }
  }
  return false;
}

function inCheck(state, color) {
  const k = findKing(state.board, color);
  if (!k) return false;
  return isSquareAttacked(state.board, k.r, k.c, color === "w" ? "b" : "w");
}

// Pseudo-legal moves for the piece at (r,c), ignoring self-check.
function pseudoMovesFor(state, r, c) {
  const board = state.board;
  const piece = board[r][c];
  if (!piece) return [];
  const color = piece[0], type = piece[1];
  const moves = [];
  const addIfOk = (nr, nc, opts = {}) => {
    if (!inBounds(nr, nc)) return;
    const target = board[nr][nc];
    if (target && target[0] === color) return;
    moves.push({ from: { r, c }, to: { r: nr, c: nc }, capture: !!target, ...opts });
  };

  if (type === "P") {
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    const promoRow = color === "w" ? 0 : 7;
    // forward
    if (inBounds(r + dir, c) && !board[r + dir][c]) {
      if (r + dir === promoRow) {
        for (const promo of ["Q", "R", "B", "N"]) moves.push({ from: { r, c }, to: { r: r + dir, c }, capture: false, promotion: promo });
      } else {
        moves.push({ from: { r, c }, to: { r: r + dir, c }, capture: false });
        if (r === startRow && !board[r + 2 * dir][c]) {
          moves.push({ from: { r, c }, to: { r: r + 2 * dir, c }, capture: false, doubleStep: true });
        }
      }
    }
    // captures
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (target && target[0] !== color) {
        if (nr === promoRow) {
          for (const promo of ["Q", "R", "B", "N"]) moves.push({ from: { r, c }, to: { r: nr, c: nc }, capture: true, promotion: promo });
        } else {
          moves.push({ from: { r, c }, to: { r: nr, c: nc }, capture: true });
        }
      } else if (state.enPassant && state.enPassant.r === nr && state.enPassant.c === nc) {
        moves.push({ from: { r, c }, to: { r: nr, c: nc }, capture: true, enPassantCapture: true });
      }
    }
  } else if (type === "N") {
    for (const [dr, dc] of KNIGHT_OFFSETS) addIfOk(r + dr, c + dc);
  } else if (type === "K") {
    for (const [dr, dc] of KING_OFFSETS) addIfOk(r + dr, c + dc);
    // castling
    const backRank = color === "w" ? 7 : 0;
    if (r === backRank && c === 4) {
      const rights = state.castling;
      const kingSideOk = color === "w" ? rights.wK : rights.bK;
      const queenSideOk = color === "w" ? rights.wQ : rights.bQ;
      const enemy = color === "w" ? "b" : "w";
      const notAttacked = (cc) => !isSquareAttacked(board, backRank, cc, enemy);
      if (kingSideOk && !board[backRank][5] && !board[backRank][6] &&
          board[backRank][7] === color + "R" &&
          notAttacked(4) && notAttacked(5) && notAttacked(6)) {
        moves.push({ from: { r, c }, to: { r: backRank, c: 6 }, capture: false, castle: "K" });
      }
      if (queenSideOk && !board[backRank][1] && !board[backRank][2] && !board[backRank][3] &&
          board[backRank][0] === color + "R" &&
          notAttacked(4) && notAttacked(3) && notAttacked(2)) {
        moves.push({ from: { r, c }, to: { r: backRank, c: 2 }, capture: false, castle: "Q" });
      }
    }
  } else {
    const dirs = type === "B" ? BISHOP_DIRS : type === "R" ? ROOK_DIRS : QUEEN_DIRS;
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const target = board[nr][nc];
        if (target) {
          if (target[0] !== color) moves.push({ from: { r, c }, to: { r: nr, c: nc }, capture: true });
          break;
        }
        moves.push({ from: { r, c }, to: { r: nr, c: nc }, capture: false });
        nr += dr; nc += dc;
      }
    }
  }
  return moves;
}

function applyMove(state, move) {
  const board = cloneBoard(state.board);
  const { from, to } = move;
  const piece = board[from.r][from.c];
  const color = piece[0], type = piece[1];
  let captured = board[to.r][to.c];

  if (move.enPassantCapture) {
    const capR = color === "w" ? to.r + 1 : to.r - 1;
    captured = board[capR][to.c];
    board[capR][to.c] = null;
  }

  board[to.r][to.c] = move.promotion ? color + move.promotion : piece;
  board[from.r][from.c] = null;

  if (move.castle) {
    const backRank = from.r;
    if (move.castle === "K") {
      board[backRank][5] = board[backRank][7];
      board[backRank][7] = null;
    } else {
      board[backRank][3] = board[backRank][0];
      board[backRank][0] = null;
    }
  }

  const castling = { ...state.castling };
  if (type === "K") {
    if (color === "w") { castling.wK = false; castling.wQ = false; }
    else { castling.bK = false; castling.bQ = false; }
  }
  if (type === "R") {
    if (color === "w" && from.r === 7 && from.c === 0) castling.wQ = false;
    if (color === "w" && from.r === 7 && from.c === 7) castling.wK = false;
    if (color === "b" && from.r === 0 && from.c === 0) castling.bQ = false;
    if (color === "b" && from.r === 0 && from.c === 7) castling.bK = false;
  }
  // rook captured on its home square
  if (captured && captured[1] === "R") {
    if (to.r === 7 && to.c === 0) castling.wQ = false;
    if (to.r === 7 && to.c === 7) castling.wK = false;
    if (to.r === 0 && to.c === 0) castling.bQ = false;
    if (to.r === 0 && to.c === 7) castling.bK = false;
  }

  const enPassant = move.doubleStep ? { r: (from.r + to.r) / 2, c: from.c } : null;
  const halfmove = (type === "P" || move.capture) ? 0 : state.halfmove + 1;
  const fullmove = color === "b" ? state.fullmove + 1 : state.fullmove;

  return {
    board,
    turn: color === "w" ? "b" : "w",
    castling,
    enPassant,
    halfmove,
    fullmove,
    lastMove: { ...move, piece, captured },
  };
}

function legalMovesFor(state, r, c) {
  const piece = state.board[r][c];
  if (!piece) return [];
  const color = piece[0];
  const pseudo = pseudoMovesFor(state, r, c);
  return pseudo.filter(m => {
    const next = applyMove(state, m);
    return !inCheck(next, color);
  });
}

function allLegalMoves(state, color) {
  const out = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p[0] === color) out.push(...legalMovesFor(state, r, c));
    }
  return out;
}

function gameStatus(state) {
  const color = state.turn;
  const moves = allLegalMoves(state, color);
  const check = inCheck(state, color);
  if (moves.length === 0) {
    return check ? { over: true, result: (color === "w" ? "black" : "white") + " wins by checkmate", checkmate: true } :
                   { over: true, result: "Draw by stalemate", stalemate: true };
  }
  if (state.halfmove >= 100) return { over: true, result: "Draw by 50-move rule" };
  return { over: false, check };
}

function algebraic(move, board) {
  const piece = board[move.from.r][move.from.c];
  const type = piece[1];
  const dest = sqName(move.to.r, move.to.c);
  if (move.castle === "K") return "O-O";
  if (move.castle === "Q") return "O-O-O";
  const capture = move.capture ? "x" : "";
  const promo = move.promotion ? "=" + move.promotion : "";
  if (type === "P") {
    const fromFile = move.capture ? fileOf(move.from.c) : "";
    return fromFile + capture + dest + promo;
  }
  return type + capture + dest;
}

const ChessEngine = {
  initialState, cloneBoard, legalMovesFor, allLegalMoves, applyMove,
  inCheck, gameStatus, algebraic, sqName, findKing,
};

if (typeof window !== "undefined") window.ChessEngine = ChessEngine;
