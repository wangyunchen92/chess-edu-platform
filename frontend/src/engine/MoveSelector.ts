/**
 * 走法选择器
 *
 * 根据 AI 角色的风格权重和错误率，从候选走法中选择最终走法。
 */

import { Chess } from 'chess.js';
import { MoveEvaluation } from './types';
import { createGame } from '../utils/chess';

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

/** 走法风格分类 */
export type MoveStyle =
  | 'aggressive'
  | 'defensive'
  | 'tactical'
  | 'positional'
  | 'neutral';

/** 角色配置（仅选择器需要的部分） */
export interface CharacterStyleWeights {
  attack: number;
  defense: number;
  tactics: number;
  positional: number;
}

export interface CharacterConfigForSelector {
  styleWeights: CharacterStyleWeights;
}

// ---------------------------------------------------------------------------
// MoveSelector
// ---------------------------------------------------------------------------

export class MoveSelector {
  /**
   * 从候选走法中根据权重选择一步
   */
  static selectMove(
    candidates: MoveEvaluation[],
    config: CharacterConfigForSelector,
    shouldError: boolean,
    gamePhase: 'opening' | 'middlegame' | 'endgame',
  ): MoveEvaluation {
    if (candidates.length === 0) {
      throw new Error('No candidate moves to select from');
    }
    if (candidates.length === 1) {
      return candidates[0];
    }

    if (shouldError) {
      // 犯错模式：偏向选择较差的走法（排名靠后的候选）
      return MoveSelector.selectErrorMove(candidates);
    }

    // 正常模式：根据风格权重对候选走法打分
    return MoveSelector.selectStyledMove(candidates, config, gamePhase);
  }

  /**
   * 判断走法的风格类型（简化版）
   *
   * @param fen 走子前的 FEN
   * @param move UCI 格式着法
   */
  static classifyMove(fen: string, move: string): MoveStyle {
    const game = createGame(fen);
    const from = move.substring(0, 2);
    const to = move.substring(2, 4);
    const promotion = move.length > 4 ? move[4] : undefined;

    // 在副本上执行走法以获取详细信息
    const copy = createGame(fen);
    let moveObj;
    try {
      moveObj = copy.move({
        from: from as any,
        to: to as any,
        promotion: promotion as any,
      });
    } catch {
      return 'neutral';
    }

    if (!moveObj) {
      return 'neutral';
    }

    // 将军 → tactical
    if (moveObj.san.includes('+') || moveObj.san.includes('#')) {
      return 'tactical';
    }

    // 吃子 → aggressive
    if (moveObj.captured) {
      return 'aggressive';
    }

    const toRank = parseInt(to[1], 10);
    const turn = game.turn(); // 走子方

    // 兵推进到对方阵地（第5排及以上对白方，第4排及以下对黑方）
    if (moveObj.piece === 'p') {
      if ((turn === 'w' && toRank >= 5) || (turn === 'b' && toRank <= 4)) {
        return 'aggressive';
      }
    }

    // 子力移动到对方半场 → aggressive
    if ((turn === 'w' && toRank >= 5) || (turn === 'b' && toRank <= 4)) {
      // 排除王的移动
      if (moveObj.piece !== 'k') {
        return 'aggressive';
      }
    }

    // 王周围走子 → defensive
    const kingSquare = MoveSelector.findKingSquare(game, turn);
    if (kingSquare && MoveSelector.isNearSquare(to, kingSquare)) {
      return 'defensive';
    }

    // 子力回到己方半场 → defensive
    if ((turn === 'w' && toRank <= 3) || (turn === 'b' && toRank >= 6)) {
      if (from !== to) {
        const fromRank = parseInt(from[1], 10);
        // 从更远的地方退回来
        if (
          (turn === 'w' && fromRank > toRank) ||
          (turn === 'b' && fromRank < toRank)
        ) {
          return 'defensive';
        }
      }
    }

    // 控制中心（d4/d5/e4/e5）→ positional
    const centralSquares = ['d4', 'd5', 'e4', 'e5'];
    if (centralSquares.includes(to)) {
      return 'positional';
    }

    // 子力发展（马/象从初始位置出发）→ positional
    if (
      (moveObj.piece === 'n' || moveObj.piece === 'b') &&
      MoveSelector.isStartingSquare(from, moveObj.piece, turn)
    ) {
      return 'positional';
    }

    // 王车易位 → positional
    if (moveObj.san === 'O-O' || moveObj.san === 'O-O-O') {
      return 'positional';
    }

    return 'neutral';
  }

  /**
   * 判断当前棋局阶段
   */
  static getGamePhase(fen: string): 'opening' | 'middlegame' | 'endgame' {
    const game = createGame(fen);
    const board = game.board();

    // 统计非兵、非王的子力数量
    let minorMajorCount = 0;
    let queenCount = 0;

    for (const row of board) {
      for (const square of row) {
        if (square && square.type !== 'p' && square.type !== 'k') {
          minorMajorCount++;
          if (square.type === 'q') {
            queenCount++;
          }
        }
      }
    }

    // 获取走了多少步
    const fullMoveNumber = parseInt(fen.split(' ')[5] ?? '1', 10);

    // 开局：步数少且大部分子力还在
    if (fullMoveNumber <= 10 && minorMajorCount >= 8) {
      return 'opening';
    }

    // 残局：子力很少（去掉皇后后不超过4个轻/重子，或无皇后且不超过6个）
    if (queenCount === 0 && minorMajorCount <= 4) {
      return 'endgame';
    }
    if (minorMajorCount <= 3) {
      return 'endgame';
    }

    return 'middlegame';
  }

  // ---------------------------------------------------------------------------
  // 内部方法
  // ---------------------------------------------------------------------------

  /** 犯错时倾向选择排名较差的走法 */
  private static selectErrorMove(
    candidates: MoveEvaluation[],
  ): MoveEvaluation {
    // 从排名靠后的候选中选取（排除最佳走法）
    if (candidates.length <= 2) {
      return candidates[candidates.length - 1];
    }
    // 从后一半候选中随机选
    const lowerHalf = candidates.slice(Math.floor(candidates.length / 2));
    const idx = Math.floor(Math.random() * lowerHalf.length);
    return lowerHalf[idx];
  }

  /**
   * 正常模式：无 FEN 时的简化选择（根据排名 + 随机扰动）
   * 优先使用 selectMoveWithFen 获取完整的风格加权选择。
   */
  private static selectStyledMove(
    candidates: MoveEvaluation[],
    _config: CharacterConfigForSelector,
    _gamePhase: 'opening' | 'middlegame' | 'endgame',
  ): MoveEvaluation {
    // 计算每个候选走法的综合分数
    const scored = candidates.map((candidate, index) => {
      // 基础分：排名越高（引擎评估越好）分数越高
      const rankBonus = (candidates.length - index) / candidates.length;

      // 无 FEN 时简化处理：排名权重 + 随机扰动
      const randomFactor = Math.random() * 0.4;
      const score = rankBonus * 0.6 + randomFactor;

      return { candidate, score };
    });

    // 按综合得分降序排列
    scored.sort((a, b) => b.score - a.score);

    return scored[0].candidate;
  }

  /**
   * 根据风格权重对候选走法打分（含 FEN 信息）
   * 供 CharacterEngine 使用
   */
  static selectMoveWithFen(
    candidates: MoveEvaluation[],
    config: CharacterConfigForSelector,
    shouldError: boolean,
    gamePhase: 'opening' | 'middlegame' | 'endgame',
    fen: string,
  ): MoveEvaluation {
    if (candidates.length === 0) {
      throw new Error('No candidate moves to select from');
    }
    if (candidates.length === 1) {
      return candidates[0];
    }

    if (shouldError) {
      return MoveSelector.selectErrorMove(candidates);
    }

    const { styleWeights } = config;

    const styleToWeight: Record<MoveStyle, number> = {
      aggressive: styleWeights.attack,
      defensive: styleWeights.defense,
      tactical: styleWeights.tactics,
      positional: styleWeights.positional,
      neutral: 0.5,
    };

    const scored = candidates.map((candidate, index) => {
      // 排名加成：越靠前越高
      const rankBonus = (candidates.length - index) / candidates.length;

      // 风格加成
      const style = MoveSelector.classifyMove(fen, candidate.move);
      const styleBonus = styleToWeight[style] ?? 0.5;

      // 阶段加成
      let phaseMultiplier = 1.0;
      if (gamePhase === 'opening' && style === 'positional') {
        phaseMultiplier = 1.2; // 开局偏好位置型走法
      } else if (gamePhase === 'middlegame' && style === 'tactical') {
        phaseMultiplier = 1.15; // 中局偏好战术型走法
      } else if (gamePhase === 'endgame' && style === 'positional') {
        phaseMultiplier = 1.1;
      }

      // 综合得分：引擎排名(0.5) + 风格(0.35) + 随机(0.15)
      const randomFactor = Math.random() * 0.15;
      const score =
        rankBonus * 0.5 +
        styleBonus * 0.35 * phaseMultiplier +
        randomFactor;

      return { candidate, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].candidate;
  }

  /** 查找王的位置 */
  private static findKingSquare(
    game: Chess,
    color: 'w' | 'b',
  ): string | null {
    const board = game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = board[r][c];
        if (sq && sq.type === 'k' && sq.color === color) {
          const file = String.fromCharCode('a'.charCodeAt(0) + c);
          const rank = 8 - r;
          return `${file}${rank}`;
        }
      }
    }
    return null;
  }

  /** 判断两个格子是否相邻（含对角） */
  private static isNearSquare(sq1: string, sq2: string): boolean {
    const f1 = sq1.charCodeAt(0);
    const r1 = parseInt(sq1[1], 10);
    const f2 = sq2.charCodeAt(0);
    const r2 = parseInt(sq2[1], 10);
    return Math.abs(f1 - f2) <= 1 && Math.abs(r1 - r2) <= 1;
  }

  /** 判断是否为马/象的初始位置 */
  private static isStartingSquare(
    square: string,
    piece: string,
    color: 'w' | 'b',
  ): boolean {
    const whiteKnightSquares = ['b1', 'g1'];
    const whiteBishopSquares = ['c1', 'f1'];
    const blackKnightSquares = ['b8', 'g8'];
    const blackBishopSquares = ['c8', 'f8'];

    if (color === 'w') {
      if (piece === 'n') return whiteKnightSquares.includes(square);
      if (piece === 'b') return whiteBishopSquares.includes(square);
    } else {
      if (piece === 'n') return blackKnightSquares.includes(square);
      if (piece === 'b') return blackBishopSquares.includes(square);
    }
    return false;
  }
}
