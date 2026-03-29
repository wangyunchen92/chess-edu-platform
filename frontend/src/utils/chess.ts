/**
 * chess.js 工具函数封装
 *
 * 对 chess.js 库的常用操作进行封装，提供类型安全的接口。
 */

import { Chess, Square as ChessSquare } from 'chess.js';

// ---------------------------------------------------------------------------
// 棋局创建
// ---------------------------------------------------------------------------

/** 创建新棋局，可选传入 FEN 起始局面 */
export function createGame(fen?: string): Chess {
  return fen ? new Chess(fen) : new Chess();
}

// ---------------------------------------------------------------------------
// 着法操作
// ---------------------------------------------------------------------------

/** 检查着法是否合法 */
export function isValidMove(
  game: Chess,
  from: string,
  to: string
): boolean {
  const moves = game.moves({ square: from as ChessSquare, verbose: true });
  return moves.some((m) => m.from === from && m.to === to);
}

/**
 * 执行着法
 * @returns 是否成功
 */
export function makeMove(
  game: Chess,
  from: string,
  to: string,
  promotion?: string
): boolean {
  try {
    const result = game.move({
      from: from as ChessSquare,
      to: to as ChessSquare,
      promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined,
    });
    return result !== null;
  } catch {
    return false;
  }
}

/**
 * 获取合法着法列表
 * @param square 可选，指定某个格子的合法目标格
 * @returns 目标格子数组（verbose 模式下的 to 字段）
 */
export function getValidMoves(game: Chess, square?: string): string[] {
  if (square) {
    const moves = game.moves({
      square: square as ChessSquare,
      verbose: true,
    });
    return moves.map((m) => m.to);
  }
  const moves = game.moves({ verbose: true });
  return moves.map((m) => `${m.from}${m.to}`);
}

// ---------------------------------------------------------------------------
// 棋局状态
// ---------------------------------------------------------------------------

/** 检查棋局是否结束 */
export function isGameOver(game: Chess): {
  over: boolean;
  reason?: string;
  winner?: 'white' | 'black' | 'draw';
} {
  if (!game.isGameOver()) {
    return { over: false };
  }

  if (game.isCheckmate()) {
    // 被将杀的一方是当前走子方，所以赢家是对方
    const winner = game.turn() === 'w' ? 'black' : 'white';
    return { over: true, reason: 'checkmate', winner };
  }

  if (game.isStalemate()) {
    return { over: true, reason: 'stalemate', winner: 'draw' };
  }

  if (game.isThreefoldRepetition()) {
    return { over: true, reason: 'repetition', winner: 'draw' };
  }

  if (game.isInsufficientMaterial()) {
    return { over: true, reason: 'insufficient_material', winner: 'draw' };
  }

  if (game.isDraw()) {
    return { over: true, reason: 'draw', winner: 'draw' };
  }

  return { over: true, reason: 'unknown', winner: 'draw' };
}

// ---------------------------------------------------------------------------
// FEN / PGN
// ---------------------------------------------------------------------------

/** 获取当前 FEN */
export function getFen(game: Chess): string {
  return game.fen();
}

/** 获取当前 PGN */
export function getPgn(game: Chess): string {
  return game.pgn();
}

/** 从 PGN 加载棋局 */
export function loadPgn(pgn: string): Chess {
  const game = new Chess();
  game.loadPgn(pgn);
  return game;
}

// ---------------------------------------------------------------------------
// 着法格式转换
// ---------------------------------------------------------------------------

/**
 * UCI 着法转 SAN（标准代数记谱法）
 * @param game 当前棋局（用于确定上下文）
 * @param uci UCI 格式着法，例如 "e2e4"
 * @returns SAN 格式，例如 "e4"
 */
export function uciToSan(game: Chess, uci: string): string {
  const from = uci.substring(0, 2);
  const to = uci.substring(2, 4);
  const promotion = uci.length > 4 ? uci[4] : undefined;

  // 在副本上尝试着法以获取 SAN
  const copy = new Chess(game.fen());
  const move = copy.move({
    from: from as ChessSquare,
    to: to as ChessSquare,
    promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined,
  });

  if (!move) {
    throw new Error(`Invalid UCI move "${uci}" for position ${game.fen()}`);
  }

  return move.san;
}

/**
 * SAN 着法转 UCI
 * @param game 当前棋局
 * @param san SAN 格式着法，例如 "e4"
 * @returns UCI 格式，例如 "e2e4"
 */
export function sanToUci(game: Chess, san: string): string {
  const copy = new Chess(game.fen());
  const move = copy.move(san);

  if (!move) {
    throw new Error(`Invalid SAN move "${san}" for position ${game.fen()}`);
  }

  let uci = `${move.from}${move.to}`;
  if (move.promotion) {
    uci += move.promotion;
  }
  return uci;
}

// ---------------------------------------------------------------------------
// 子力统计
// ---------------------------------------------------------------------------

/** 棋子对应的子力值 */
const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
};

/**
 * 获取被吃掉的棋子列表
 * @returns white: 白方被吃掉的棋子, black: 黑方被吃掉的棋子
 */
export function getCapturedPieces(
  game: Chess
): { white: string[]; black: string[] } {
  const history = game.history({ verbose: true });
  const captured: { white: string[]; black: string[] } = {
    white: [],
    black: [],
  };

  for (const move of history) {
    if (move.captured) {
      // move.color 是走子方的颜色，被吃的棋子属于对方
      if (move.color === 'w') {
        // 白方吃掉了黑方的子
        captured.black.push(move.captured);
      } else {
        // 黑方吃掉了白方的子
        captured.white.push(move.captured);
      }
    }
  }

  return captured;
}

/**
 * 计算子力差
 * @returns 正值表示白方子力优势，负值表示黑方优势
 */
export function getMaterialBalance(game: Chess): number {
  const captured = getCapturedPieces(game);

  let whiteLost = 0;
  let blackLost = 0;

  for (const piece of captured.white) {
    whiteLost += PIECE_VALUES[piece] ?? 0;
  }
  for (const piece of captured.black) {
    blackLost += PIECE_VALUES[piece] ?? 0;
  }

  // 白方优势 = 黑方损失 - 白方损失
  return blackLost - whiteLost;
}
