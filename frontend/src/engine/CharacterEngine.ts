/**
 * AI 角色行为引擎
 *
 * 为不同的 AI 对手角色提供个性化的走法生成。
 * 根据角色配置（等级、风格权重、失误率等）从引擎候选走法中选择最终走法，
 * 模拟不同水平和风格的对手。
 */

import { EngineManager } from './EngineManager';
import { MoveSelector } from './MoveSelector';
import { createGame, uciToSan } from '../utils/chess';

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

/** AI 角色配置 */
export interface CharacterConfig {
  id: string;
  name: string;
  rating: number;
  depthMin: number;
  depthMax: number;
  /** 失误概率 0-1 */
  errorRate: number;
  styleWeights: {
    attack: number;
    defense: number;
    tactics: number;
    positional: number;
  };
  thinkTimeMinMs: number;
  thinkTimeMaxMs: number;
}

/** 角色生成的走法 */
export interface CharacterMove {
  /** UCI 格式走法 */
  uci: string;
  /** SAN 格式走法 */
  san: string;
  /** 模拟思考时间（毫秒） */
  thinkTimeMs: number;
  /** 是否是故意的失误 */
  isError: boolean;
  /** 局面评估（centipawns） */
  evaluation: number;
}

/** 对话触发事件类型 */
export type DialogueEvent =
  | 'good_move'
  | 'blunder'
  | 'check_given'
  | 'check_received'
  | 'capture_given'
  | 'capture_received'
  | 'advantage'
  | 'disadvantage';

// ---------------------------------------------------------------------------
// CharacterEngine
// ---------------------------------------------------------------------------

export class CharacterEngine {
  private config: CharacterConfig;
  private engineManager: EngineManager;

  constructor(config: CharacterConfig) {
    this.config = { ...config };
    this.engineManager = EngineManager.getInstance();
  }

  /**
   * 根据当前局面生成角色的走法
   *
   * @param fen 当前局面 FEN
   * @param userRating 用户等级分（用于微调深度）
   */
  async getMove(fen: string, userRating: number): Promise<CharacterMove> {
    // 1. 确定搜索深度（根据角色等级和用户等级微调）
    const depth = this.calculateDepth(userRating);

    // 2. 获取 Top 5 候选走法
    const candidates = await this.engineManager.getTopMoves(fen, 5, depth);

    if (candidates.length === 0) {
      throw new Error('No legal moves available for the current position');
    }

    // 3. 决定是否犯错
    const shouldError = Math.random() < this.config.errorRate;

    // 4. 获取棋局阶段
    const gamePhase = MoveSelector.getGamePhase(fen);

    // 5. 使用 MoveSelector 选择走法
    const selected = MoveSelector.selectMoveWithFen(
      candidates,
      this.config,
      shouldError,
      gamePhase,
      fen,
    );

    // 6. 转换 UCI → SAN
    const game = createGame(fen);
    let san: string;
    try {
      san = uciToSan(game, selected.move);
    } catch {
      san = selected.move;
    }

    // 7. 生成模拟思考时间
    const thinkTimeMs = this.generateThinkTime();

    // 8. 判断是否为失误走法
    const isError =
      shouldError &&
      candidates.length > 1 &&
      selected.move !== candidates[0].move;

    return {
      uci: selected.move,
      san,
      thinkTimeMs,
      isError,
      evaluation: selected.score,
    };
  }

  /**
   * 自适应难度：根据用户近期胜率微调配置
   *
   * @param recentWinRate 用户近期胜率 0-1
   */
  adjustDifficulty(recentWinRate: number): void {
    // 用户赢得太多 → 提高难度
    if (recentWinRate > 0.65) {
      this.config.errorRate = Math.max(0, this.config.errorRate - 0.05);
      this.config.depthMin = Math.min(this.config.depthMin + 1, 20);
      this.config.depthMax = Math.min(this.config.depthMax + 1, 22);
    }
    // 用户赢得太少 → 降低难度
    else if (recentWinRate < 0.35) {
      this.config.errorRate = Math.min(1, this.config.errorRate + 0.05);
      this.config.depthMin = Math.max(this.config.depthMin - 1, 1);
      this.config.depthMax = Math.max(this.config.depthMax - 1, 2);
    }
    // 适中范围 → 微调
    else if (recentWinRate > 0.55) {
      this.config.errorRate = Math.max(0, this.config.errorRate - 0.02);
    } else if (recentWinRate < 0.45) {
      this.config.errorRate = Math.min(1, this.config.errorRate + 0.02);
    }
  }

  /**
   * 获取对话触发事件（根据局面变化判断）
   *
   * @param prevFen 走子前的 FEN
   * @param currentFen 走子后的 FEN
   * @param lastMove 最近走的一步（UCI 格式）
   */
  getDialogueEvent(
    prevFen: string,
    currentFen: string,
    lastMove: string,
  ): DialogueEvent | null {
    const currentGame = createGame(currentFen);

    // 在走子前的局面上执行走法获取详细信息
    const from = lastMove.substring(0, 2);
    const to = lastMove.substring(2, 4);
    const promotion = lastMove.length > 4 ? lastMove[4] : undefined;

    const gameCopy = createGame(prevFen);
    let moveResult;
    try {
      moveResult = gameCopy.move({
        from: from as any,
        to: to as any,
        promotion: promotion as any,
      });
    } catch {
      return null;
    }

    if (!moveResult) {
      return null;
    }

    // 将军检测
    if (currentGame.inCheck()) {
      // 走子后对方被将军
      return 'check_given';
    }

    // 吃子检测
    if (moveResult.captured) {
      return 'capture_given';
    }

    // 走法质量判断：使用 MoveSelector 分类
    const style = MoveSelector.classifyMove(prevFen, lastMove);

    // 好棋判断（战术型走法或进攻型走法在特定条件下）
    if (style === 'tactical') {
      return 'good_move';
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // 获取当前配置（只读副本）
  // ---------------------------------------------------------------------------

  getConfig(): Readonly<CharacterConfig> {
    return { ...this.config };
  }

  // ---------------------------------------------------------------------------
  // 内部方法
  // ---------------------------------------------------------------------------

  /** 计算搜索深度 */
  private calculateDepth(userRating: number): number {
    const { depthMin, depthMax, rating } = this.config;

    // 根据角色等级和用户等级之差微调深度
    const ratingDiff = rating - userRating;
    const ratio = Math.max(0, Math.min(1, (ratingDiff + 400) / 800));
    const depth = Math.round(depthMin + (depthMax - depthMin) * ratio);

    return Math.max(depthMin, Math.min(depthMax, depth));
  }

  /** 生成随机思考时间 */
  private generateThinkTime(): number {
    const { thinkTimeMinMs, thinkTimeMaxMs } = this.config;
    return (
      thinkTimeMinMs +
      Math.floor(Math.random() * (thinkTimeMaxMs - thinkTimeMinMs))
    );
  }

}
