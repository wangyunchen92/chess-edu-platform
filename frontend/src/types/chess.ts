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

/** 走法质量分类 */
export type MoveQuality = 'brilliant' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

/** 复盘关键时刻标注 */
export interface ReviewMoment {
  moveNumber: number;
  side: PieceColor;
  moveSan: string;
  type: MoveQuality;
  engineEval: number;
  bestMove?: string;
  comment?: string;
}

/** 单步走法的完整分析结果 */
export interface MoveAnalysis {
  /** 半步索引（0-based） */
  plyIndex: number;
  /** 走法回合号（1-based，白方和黑方共享） */
  moveNumber: number;
  /** 走子方颜色 */
  side: PieceColor;
  /** SAN 格式走法 */
  moveSan: string;
  /** 走子前局面 FEN */
  fenBefore: string;
  /** 走子后局面 FEN */
  fenAfter: string;
  /** 走子后的评估值（centipawns，白方视角：正=白优，负=黑优） */
  evalAfter: number;
  /** 评估值变化（centipawns，正=局面改善，负=局面变差，从走子方视角） */
  evalDelta: number;
  /** 走法质量分类 */
  quality: MoveQuality;
  /** 引擎推荐的最佳走法（SAN 格式） */
  bestMove: string;
  /** 面向孩子的中文评论 */
  comment: string;
  /** 是否为转折点（局面优劣发生逆转） */
  isTurningPoint: boolean;
}

/** 完整对局分析结果 */
export interface GameAnalysisResult {
  /** 每步走法的分析 */
  moves: MoveAnalysis[];
  /** 面向孩子的局面总结 */
  summary: string;
  /** 统计信息 */
  stats: {
    /** 用户走法总数 */
    totalMoves: number;
    /** 各质量分类的数量 */
    brilliant: number;
    good: number;
    inaccuracy: number;
    mistake: number;
    blunder: number;
    /** 用户准确率（good + brilliant 占比） */
    accuracy: number;
  };
  /** 关键时刻（转折点、连续失误等），按重要程度排序 */
  keyMoments: MoveAnalysis[];
}

/** 单局面分析结果 */
export interface PositionAnalysis {
  /** 评估值（centipawns，白方视角） */
  eval: number;
  /** 最佳走法（SAN 格式） */
  bestMove: string;
  /** 前 3 个最佳走法 */
  topMoves: Array<{ move: string; eval: number }>;
  /** 面向孩子的通俗描述 */
  description: string;
}
