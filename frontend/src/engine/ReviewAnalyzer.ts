/**
 * 基础复盘分析器
 *
 * 分析完整对局的每步走法质量，找出关键时刻（失误、错误、妙招等），
 * 用于对局结束后的复盘功能。
 */

import { EngineManager } from './EngineManager';
import { createGame, loadPgn, getFen, uciToSan } from '../utils/chess';
import type { PieceColor, ReviewMoment } from '../types/chess';

// ---------------------------------------------------------------------------
// 走法质量阈值（centipawns）
// ---------------------------------------------------------------------------

/** 小失误阈值 */
const INACCURACY_THRESHOLD = 100;
/** 错误阈值 */
const MISTAKE_THRESHOLD = 200;
/** 严重错误（漏招）阈值 */
const BLUNDER_THRESHOLD = 400;
/** 最大返回的关键时刻数量 */
const MAX_REVIEW_MOMENTS = 3;

// ---------------------------------------------------------------------------
// ReviewAnalyzer
// ---------------------------------------------------------------------------

export class ReviewAnalyzer {
  /**
   * 分析对局，返回关键时刻
   *
   * @param pgn PGN 字符串
   * @param userColor 用户执棋颜色
   * @param depth 分析深度，默认 12
   * @returns 最多 3 个最关键的时刻
   */
  static async analyzeGame(
    pgn: string,
    userColor: PieceColor,
    depth: number = 12,
  ): Promise<ReviewMoment[]> {
    const engine = EngineManager.getInstance();
    await engine.ensureReady();

    // 加载 PGN 获取着法历史
    const game = loadPgn(pgn);
    const history = game.history({ verbose: true });

    if (history.length === 0) {
      return [];
    }

    // 逐步回放，评估每步走法
    const moments: ReviewMoment[] = [];
    const replayGame = createGame(); // 从初始局面开始

    for (let i = 0; i < history.length; i++) {
      const move = history[i];
      const fenBefore = getFen(replayGame);
      const side: PieceColor = move.color === 'w' ? 'white' : 'black';

      // 只分析用户的走法
      if (side === userColor) {
        try {
          const evaluation = await ReviewAnalyzer.evaluateMove(
            fenBefore,
            move.san,
            depth,
          );

          // 只记录有意义的时刻（非 'good' 或特别好的走法）
          if (evaluation.quality !== 'good') {
            const moveNumber = Math.floor(i / 2) + 1;
            moments.push({
              moveNumber,
              side,
              moveSan: move.san,
              type: evaluation.quality,
              engineEval: evaluation.eval,
              bestMove: evaluation.bestMove,
              comment: ReviewAnalyzer.generateComment(
                evaluation.quality,
                move.san,
                evaluation.bestMove,
              ),
            });
          }
        } catch {
          // 跳过评估失败的走法
        }
      }

      // 在回放棋局上执行走法
      replayGame.move(move.san);
    }

    // 按严重程度排序，返回最关键的时刻
    const severityOrder: Record<string, number> = {
      blunder: 4,
      mistake: 3,
      inaccuracy: 2,
      brilliant: 1,
      good: 0,
    };

    moments.sort(
      (a, b) => (severityOrder[b.type] ?? 0) - (severityOrder[a.type] ?? 0),
    );

    return moments.slice(0, MAX_REVIEW_MOMENTS);
  }

  /**
   * 评估单步走法质量
   *
   * @param fen 走子前的 FEN
   * @param moveSan SAN 格式着法
   * @param depth 搜索深度
   */
  static async evaluateMove(
    fen: string,
    moveSan: string,
    depth: number,
  ): Promise<{
    quality: 'brilliant' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
    eval: number;
    bestMove: string;
  }> {
    const engine = EngineManager.getInstance();
    await engine.ensureReady();

    // 评估走子前的局面
    const evalBefore = await engine.evaluatePosition(fen, depth);

    // 获取引擎最佳走法
    const bestMoveUci = await engine.getBestMove(fen, depth);

    // 执行实际走法，获取走子后的局面
    const game = createGame(fen);
    const turn = game.turn(); // 'w' or 'b'

    game.move(moveSan);
    const fenAfter = getFen(game);

    // 评估走子后的局面
    const evalAfter = await engine.evaluatePosition(fenAfter, depth);

    // 将评估值统一到走子方视角
    // Stockfish 返回的评估始终从白方视角
    // 走子后轮到对方，所以 evalAfter 需要取反才是走子方视角
    const evalBeforeFromMover = turn === 'w' ? evalBefore : -evalBefore;
    const evalAfterFromMover = turn === 'w' ? -evalAfter : evalAfter;

    // 分数差（负值表示走法导致局面变差）
    const evalDrop = evalAfterFromMover - evalBeforeFromMover;

    // 获取最佳走法的 SAN 格式
    let bestMoveSan: string;
    try {
      const tempGame = createGame(fen);
      bestMoveSan = uciToSan(tempGame, bestMoveUci);
    } catch {
      bestMoveSan = bestMoveUci;
    }

    // 判定走法质量
    const quality = ReviewAnalyzer.classifyMoveQuality(evalDrop, moveSan, bestMoveSan);

    return {
      quality,
      eval: evalAfterFromMover,
      bestMove: bestMoveSan,
    };
  }

  // ---------------------------------------------------------------------------
  // 内部方法
  // ---------------------------------------------------------------------------

  /**
   * 根据评估值下降幅度判定走法质量
   */
  private static classifyMoveQuality(
    evalDrop: number,
    actualMove: string,
    bestMove: string,
  ): 'brilliant' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' {
    // 如果走的就是最佳走法
    if (actualMove === bestMove) {
      return 'good';
    }

    const drop = -evalDrop; // 转为正值表示"损失"

    if (drop >= BLUNDER_THRESHOLD) {
      return 'blunder';
    }
    if (drop >= MISTAKE_THRESHOLD) {
      return 'mistake';
    }
    if (drop >= INACCURACY_THRESHOLD) {
      return 'inaccuracy';
    }

    // 走法实际上比引擎推荐的还好（少见但可能在特定深度下出现）
    if (evalDrop > 50) {
      return 'brilliant';
    }

    return 'good';
  }

  /** 生成简单的中文评论 */
  private static generateComment(
    quality: 'brilliant' | 'good' | 'inaccuracy' | 'mistake' | 'blunder',
    moveSan: string,
    bestMove: string,
  ): string {
    switch (quality) {
      case 'brilliant':
        return `${moveSan} 是一步妙招！`;
      case 'inaccuracy':
        return `${moveSan} 不够精确，更好的选择是 ${bestMove}。`;
      case 'mistake':
        return `${moveSan} 是一步错误，应该走 ${bestMove}。`;
      case 'blunder':
        return `${moveSan} 是严重的失误！最佳走法是 ${bestMove}。`;
      default:
        return '';
    }
  }
}
