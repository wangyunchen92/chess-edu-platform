/**
 * 国际象棋类型定义
 * 供整个应用使用的棋局相关类型
 */

/** 棋子颜色 */
export type PieceColor = 'white' | 'black';

/** 棋子类型（小写字母表示） */
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

/** 棋盘格子，代数记谱法，例如 'e4' */
export type Square = string;

/** 完整的棋局状态快照 */
export interface GameState {
  fen: string;
  pgn: string;
  turn: PieceColor;
  moveNumber: number;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  isGameOver: boolean;
  lastMove?: { from: Square; to: Square; san: string };
  capturedPieces: { white: string[]; black: string[] };
  materialBalance: number;
}

/** 单步着法的详细信息 */
export interface MoveInfo {
  from: Square;
  to: Square;
  san: string;
  uci: string;
  captured?: PieceType;
  promotion?: PieceType;
  isCheck: boolean;
  isCheckmate: boolean;
}

/** 棋局结果 */
export interface GameResult {
  winner: PieceColor | 'draw';
  reason:
    | 'checkmate'
    | 'stalemate'
    | 'timeout'
    | 'resignation'
    | 'draw_agreement'
    | 'repetition'
    | 'fifty_moves'
    | 'insufficient';
}

/** 复盘关键时刻标注 */
export interface ReviewMoment {
  moveNumber: number;
  side: PieceColor;
  moveSan: string;
  type: 'brilliant' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
  engineEval: number;
  bestMove?: string;
  comment?: string;
}
