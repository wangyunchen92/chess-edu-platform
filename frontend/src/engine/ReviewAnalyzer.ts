/**
 * 对局复盘分析器
 *
 * 利用 Stockfish 引擎逐步评估对局中的每步走法，判定走法质量，
 * 生成面向 4-12 岁儿童的通俗中文评论，标注关键时刻（转折点、连续失误等）。
 *
 * 评估值约定：
 * - Stockfish 始终从当前走子方（side-to-move）视角返回评估值
 * - EngineManager.evaluatePosition() 已将评估值统一转为白方视角（正=白优，负=黑优）
 * - 本模块内部计算 evalDelta 时，先转为走子方视角再比较
 *
 * 走法质量阈值（centipawns 损失）：
 * - brilliant: 走法使局面改善超出预期（在劣势局面找到唯一好手）
 * - good: 损失 <= 20cp
 * - inaccuracy: 损失 >= 50cp
 * - mistake: 损失 >= 100cp
 * - blunder: 损失 >= 200cp
 */

import { EngineManager } from './EngineManager';
import { createGame, loadPgn, getFen, uciToSan } from '../utils/chess';
import type {
  PieceColor,
  MoveQuality,
  MoveAnalysis,
  GameAnalysisResult,
  PositionAnalysis,
} from '../types/chess';

// ---------------------------------------------------------------------------
// 走法质量阈值（centipawns 损失，正值表示损失）
// ---------------------------------------------------------------------------

/** 好棋上限：损失不超过此值视为好棋 */
const GOOD_THRESHOLD = 20;
/** 小失误下限 */
const INACCURACY_THRESHOLD = 50;
/** 错误下限 */
const MISTAKE_THRESHOLD = 100;
/** 严重失误（漏着）下限 */
const BLUNDER_THRESHOLD = 200;

/**
 * Brilliant 判定：
 * 在己方劣势 >= BRILLIANT_LOSING_THRESHOLD 时，走出的棋导致
 * 局面改善 >= BRILLIANT_IMPROVEMENT_THRESHOLD，且该走法是引擎推荐的最佳手
 */
const BRILLIANT_LOSING_THRESHOLD = 100;
const BRILLIANT_IMPROVEMENT_THRESHOLD = 80;

/** 转折点判定：评估值符号（优势方）发生翻转，且幅度 >= 此值 */
const TURNING_POINT_THRESHOLD = 100;

/** 关键时刻最多返回数量 */
const MAX_KEY_MOMENTS = 5;

/** 默认分析深度 */
const DEFAULT_DEPTH = 8;

// ---------------------------------------------------------------------------
// ReviewAnalyzer
// ---------------------------------------------------------------------------

export class ReviewAnalyzer {
  /**
   * 分析完整对局
   *
   * @param pgn PGN 字符串
   * @param userColor 用户执棋颜色
   * @param depth 分析深度，默认 12（平衡速度和准确度）
   * @param onProgress 进度回调 (当前步数, 总步数)
   * @returns 完整分析结果
   */
  static async analyzeGame(
    pgn: string,
    userColor: PieceColor,
    depth: number = DEFAULT_DEPTH,
    onProgress?: (current: number, total: number) => void,
  ): Promise<GameAnalysisResult> {
    const engine = EngineManager.getInstance();
    await engine.ensureReady();

    // 加载 PGN 获取着法历史
    const game = loadPgn(pgn);
    const history = game.history({ verbose: true });

    if (history.length === 0) {
      return ReviewAnalyzer.emptyResult();
    }

    const total = history.length;
    const allMoves: MoveAnalysis[] = [];
    const replayGame = createGame(); // 从初始局面开始回放

    // 评估初始局面
    let prevEvalWhite = await engine.evaluatePosition(getFen(replayGame), depth);

    for (let i = 0; i < history.length; i++) {
      const move = history[i];
      const fenBefore = getFen(replayGame);
      const side: PieceColor = move.color === 'w' ? 'white' : 'black';
      const moveNumber = Math.floor(i / 2) + 1;

      // 在回放棋局上执行走法
      replayGame.move(move.san);
      const fenAfter = getFen(replayGame);

      // 评估走子后局面（白方视角）
      const evalAfterWhite = await engine.evaluatePosition(fenAfter, depth);

      // 获取走子前局面的最佳走法
      let bestMoveSan = move.san; // 默认值
      try {
        const bestMoveUci = await engine.getBestMove(fenBefore, depth);
        const tempGame = createGame(fenBefore);
        bestMoveSan = uciToSan(tempGame, bestMoveUci);
      } catch {
        // 如果获取最佳走法失败，保持默认值
      }

      // 计算评估值变化（从走子方视角）
      // prevEvalWhite 和 evalAfterWhite 都是白方视角
      // 走子方视角：白方走棋时正值好，黑方走棋时负值好
      const evalBeforeMover = side === 'white' ? prevEvalWhite : -prevEvalWhite;
      const evalAfterMover = side === 'white' ? evalAfterWhite : -evalAfterWhite;
      const evalDelta = evalAfterMover - evalBeforeMover;

      // 损失值（正值表示损失了多少）
      const loss = -evalDelta;

      // 判定走法质量
      const quality = ReviewAnalyzer.classifyMove(
        loss,
        evalBeforeMover,
        evalDelta,
        move.san,
        bestMoveSan,
      );

      // 判定是否为转折点
      const isTurningPoint = ReviewAnalyzer.isTurningPoint(
        prevEvalWhite,
        evalAfterWhite,
      );

      // 生成评论
      const comment = ReviewAnalyzer.generateComment(
        quality,
        move.san,
        bestMoveSan,
        evalAfterWhite,
        side,
        isTurningPoint,
      );

      allMoves.push({
        plyIndex: i,
        moveNumber,
        side,
        moveSan: move.san,
        fenBefore,
        fenAfter,
        evalAfter: evalAfterWhite,
        evalDelta,
        quality,
        bestMove: bestMoveSan,
        comment,
        isTurningPoint,
      });

      // 更新前一步评估值
      prevEvalWhite = evalAfterWhite;

      // 进度回调
      onProgress?.(i + 1, total);
    }

    // 生成统计和关键时刻（仅针对用户的走法）
    const userMoves = allMoves.filter((m) => m.side === userColor);
    const stats = ReviewAnalyzer.computeStats(userMoves);
    const keyMoments = ReviewAnalyzer.findKeyMoments(allMoves, userColor);
    const summary = ReviewAnalyzer.generateSummary(stats, userColor, keyMoments);

    return {
      moves: allMoves,
      summary,
      stats,
      keyMoments,
    };
  }

  /**
   * 分析单个局面
   *
   * @param fen FEN 字符串
   * @param depth 搜索深度，默认 12
   * @returns 局面分析结果
   */
  static async analyzePosition(
    fen: string,
    depth: number = DEFAULT_DEPTH,
  ): Promise<PositionAnalysis> {
    const engine = EngineManager.getInstance();
    await engine.ensureReady();

    // 获取评估值（白方视角）
    const evalWhite = await engine.evaluatePosition(fen, depth);

    // 获取前 3 个最佳走法
    const topMovesRaw = await engine.getTopMoves(fen, 3, depth);

    const topMoves = topMovesRaw.map((m) => {
      let san: string;
      try {
        const tempGame = createGame(fen);
        san = uciToSan(tempGame, m.move);
      } catch {
        san = m.move;
      }
      return { move: san, eval: m.score };
    });

    const bestMove = topMoves.length > 0 ? topMoves[0].move : '?';
    const description = ReviewAnalyzer.describeEval(evalWhite);

    return {
      eval: evalWhite,
      bestMove,
      topMoves,
      description,
    };
  }

  // ---------------------------------------------------------------------------
  // 走法分类
  // ---------------------------------------------------------------------------

  /**
   * 判定走法质量
   *
   * @param loss 损失值（正值=变差，负值=改善）
   * @param evalBeforeMover 走子前评估值（走子方视角）
   * @param evalDelta 评估变化（走子方视角，正=改善）
   * @param actualMove 实际走法 SAN
   * @param bestMove 最佳走法 SAN
   */
  static classifyMove(
    loss: number,
    evalBeforeMover: number,
    evalDelta: number,
    actualMove: string,
    bestMove: string,
  ): MoveQuality {
    // 走的就是最佳走法 -> good
    if (actualMove === bestMove) {
      return 'good';
    }

    // Brilliant 判定：在劣势中找到使局面大幅改善的走法
    // 条件：走子前己方劣势明显，但走完后局面大幅改善
    if (
      evalBeforeMover <= -BRILLIANT_LOSING_THRESHOLD &&
      evalDelta >= BRILLIANT_IMPROVEMENT_THRESHOLD
    ) {
      return 'brilliant';
    }

    // 根据损失值分级
    if (loss >= BLUNDER_THRESHOLD) {
      return 'blunder';
    }
    if (loss >= MISTAKE_THRESHOLD) {
      return 'mistake';
    }
    if (loss >= INACCURACY_THRESHOLD) {
      return 'inaccuracy';
    }

    // 损失很小，视为好棋
    if (loss <= GOOD_THRESHOLD) {
      return 'good';
    }

    // 介于 GOOD_THRESHOLD 和 INACCURACY_THRESHOLD 之间，也算 good
    return 'good';
  }

  // ---------------------------------------------------------------------------
  // 转折点检测
  // ---------------------------------------------------------------------------

  /**
   * 判断一步棋是否为转折点（优势方发生翻转）
   */
  static isTurningPoint(
    evalBeforeWhite: number,
    evalAfterWhite: number,
  ): boolean {
    // 符号不同（一个正一个负）且幅度足够大
    if (evalBeforeWhite * evalAfterWhite < 0) {
      const swing = Math.abs(evalAfterWhite - evalBeforeWhite);
      return swing >= TURNING_POINT_THRESHOLD;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // 面向儿童的通俗评论
  // ---------------------------------------------------------------------------

  /**
   * 根据评估值生成通俗描述（面向 4-12 岁孩子）
   */
  static describeEval(evalWhite: number): string {
    const abs = Math.abs(evalWhite);
    const whiteAhead = evalWhite > 0;

    if (abs <= 30) {
      return '势均力敌，双方旗鼓相当！';
    }
    if (abs <= 80) {
      return whiteAhead
        ? '白棋稍微领先一点点。'
        : '黑棋稍微领先一点点。';
    }
    if (abs <= 200) {
      return whiteAhead
        ? '白棋占有优势！'
        : '黑棋占有优势！';
    }
    if (abs <= 500) {
      return whiteAhead
        ? '白棋优势很大，要抓住机会！'
        : '黑棋优势很大，要抓住机会！';
    }
    // >= 500cp 或将杀
    if (abs >= 10000) {
      return whiteAhead
        ? '白棋即将将杀对手！'
        : '黑棋即将将杀对手！';
    }
    return whiteAhead
      ? '白棋优势非常明显，胜利在望！'
      : '黑棋优势非常明显，胜利在望！';
  }

  /**
   * 生成单步走法的中文评论（面向 4-12 岁孩子）
   */
  static generateComment(
    quality: MoveQuality,
    moveSan: string,
    bestMove: string,
    evalAfterWhite: number,
    side: PieceColor,
    isTurningPoint: boolean,
  ): string {
    const parts: string[] = [];

    // 走法质量评论
    switch (quality) {
      case 'brilliant':
        parts.push(`太厉害了！${moveSan} 是一步超级妙招，在困难的局面里找到了最好的走法！`);
        break;
      case 'good':
        // good 走法不额外评论，保持简洁
        break;
      case 'inaccuracy':
        parts.push(`${moveSan} 这步有点小瑕疵哦，如果走 ${bestMove} 会更好一些。`);
        break;
      case 'mistake':
        parts.push(`${moveSan} 这步走错啦！更好的选择是 ${bestMove}，下次注意看看全局。`);
        break;
      case 'blunder':
        parts.push(`哎呀！${moveSan} 是一个很大的失误，最好应该走 ${bestMove}。别灰心，每个人都会犯错，知道了就能进步！`);
        break;
    }

    // 转折点提示
    if (isTurningPoint) {
      parts.push('这一步让局面发生了大逆转！');
    }

    // 局面描述（仅在非 good 走法时附加）
    if (quality !== 'good') {
      const evalDesc = ReviewAnalyzer.describeEvalForSide(evalAfterWhite, side);
      if (evalDesc) {
        parts.push(evalDesc);
      }
    }

    return parts.join(' ');
  }

  /**
   * 从指定方视角描述局面
   */
  private static describeEvalForSide(
    evalWhite: number,
    side: PieceColor,
  ): string {
    const evalForSide = side === 'white' ? evalWhite : -evalWhite;
    const abs = Math.abs(evalForSide);

    if (abs <= 30) {
      return '现在双方差不多。';
    }
    if (evalForSide > 0) {
      if (abs <= 100) return '你现在稍微领先。';
      if (abs <= 300) return '你的优势不错，继续保持！';
      return '你优势很大，加油冲刺！';
    } else {
      if (abs <= 100) return '对手稍微领先，还有机会！';
      if (abs <= 300) return '对手优势不小，要小心走好每一步。';
      return '局面比较困难，但别放弃！';
    }
  }

  // ---------------------------------------------------------------------------
  // 统计与关键时刻
  // ---------------------------------------------------------------------------

  /**
   * 计算用户走法统计
   */
  private static computeStats(
    userMoves: MoveAnalysis[],
  ): GameAnalysisResult['stats'] {
    const total = userMoves.length;
    if (total === 0) {
      return {
        totalMoves: 0,
        brilliant: 0,
        good: 0,
        inaccuracy: 0,
        mistake: 0,
        blunder: 0,
        accuracy: 100,
      };
    }

    const counts = { brilliant: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
    for (const m of userMoves) {
      counts[m.quality]++;
    }

    const accuracy = Math.round(
      ((counts.good + counts.brilliant) / total) * 100,
    );

    return {
      totalMoves: total,
      ...counts,
      accuracy,
    };
  }

  /**
   * 找出关键时刻（按重要程度排序）
   *
   * 关键时刻包括：
   * 1. 转折点（优势方翻转）
   * 2. 用户的 blunder 和 mistake
   * 3. 用户的 brilliant
   */
  private static findKeyMoments(
    allMoves: MoveAnalysis[],
    userColor: PieceColor,
  ): MoveAnalysis[] {
    const candidates: Array<{ move: MoveAnalysis; weight: number }> = [];

    const severityWeight: Record<MoveQuality, number> = {
      blunder: 5,
      mistake: 4,
      brilliant: 3,
      inaccuracy: 2,
      good: 0,
    };

    for (const m of allMoves) {
      let weight = 0;

      // 转折点额外加权
      if (m.isTurningPoint) {
        weight += 3;
      }

      // 仅用户走法的质量问题
      if (m.side === userColor) {
        weight += severityWeight[m.quality];
      }

      if (weight > 0) {
        candidates.push({ move: m, weight });
      }
    }

    // 按权重降序排列
    candidates.sort((a, b) => b.weight - a.weight);

    return candidates.slice(0, MAX_KEY_MOMENTS).map((c) => c.move);
  }

  /**
   * 生成对局总结（面向孩子）
   */
  private static generateSummary(
    stats: GameAnalysisResult['stats'],
    _userColor: PieceColor,
    keyMoments: MoveAnalysis[],
  ): string {
    const parts: string[] = [];

    // 整体表现
    if (stats.accuracy >= 90) {
      parts.push(`这盘棋你下得非常棒！准确率 ${stats.accuracy}%。`);
    } else if (stats.accuracy >= 70) {
      parts.push(`这盘棋你下得不错！准确率 ${stats.accuracy}%，继续加油。`);
    } else if (stats.accuracy >= 50) {
      parts.push(`这盘棋的准确率是 ${stats.accuracy}%，有进步空间。`);
    } else {
      parts.push(`这盘棋的准确率是 ${stats.accuracy}%，多练习就会越来越好！`);
    }

    // 亮点
    if (stats.brilliant > 0) {
      parts.push(`你走出了 ${stats.brilliant} 步妙招，很厉害！`);
    }

    // 问题
    const errors = stats.mistake + stats.blunder;
    if (errors === 0) {
      parts.push('没有大的失误，非常稳定！');
    } else if (errors <= 2) {
      parts.push(`有 ${errors} 步需要改进的地方。`);
    } else {
      parts.push(`有 ${errors} 步失误，看看哪里可以做得更好。`);
    }

    // 转折点提示
    const turningPoints = keyMoments.filter((m) => m.isTurningPoint);
    if (turningPoints.length > 0) {
      const tp = turningPoints[0];
      parts.push(`第 ${tp.moveNumber} 手是一个关键转折点，可以重点复习。`);
    }

    return parts.join(' ');
  }

  // ---------------------------------------------------------------------------
  // 辅助方法
  // ---------------------------------------------------------------------------

  /**
   * 返回空分析结果
   */
  private static emptyResult(): GameAnalysisResult {
    return {
      moves: [],
      summary: '这盘棋没有走法记录。',
      stats: {
        totalMoves: 0,
        brilliant: 0,
        good: 0,
        inaccuracy: 0,
        mistake: 0,
        blunder: 0,
        accuracy: 100,
      },
      keyMoments: [],
    };
  }
}
