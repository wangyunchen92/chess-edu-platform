/**
 * 自适应难度控制器
 *
 * 根据用户近期对弈表现动态调整 AI 引擎参数，
 * 维持 40%-60% 的目标胜率区间，确保对弈体验既不无聊也不挫败。
 *
 * 设计思路：
 * - 读取后端返回的 adaptive_difficulty_configs（如有）
 * - 根据近 N 局的胜率计算 rating_offset / depth_adjustment / mistake_rate_adjustment
 * - 将调整值应用到角色的基础引擎参数上
 */

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

/** 后端返回的自适应难度配置 */
export interface AdaptiveDifficultyConfig {
  /** 相对角色 base_rating 的偏移 */
  rating_offset: number;
  /** 搜索深度调整量 */
  depth_adjustment: number;
  /** 失误率调整量 */
  mistake_rate_adjustment: number;
  /** 近期胜率 */
  recent_win_rate: number;
  /** 参考的近期对局数 */
  recent_games_count: number;
}

/** 调整后的引擎参数 */
export interface AdjustedEngineParams {
  depthMin: number;
  depthMax: number;
  errorRate: number;
  ratingOffset: number;
  difficultyMode: 'easy' | 'normal' | 'hard';
}

/** 对局结果记录（用于本地计算） */
export interface GameRecord {
  result: 'win' | 'loss' | 'draw';
  characterId: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 目标胜率区间 */
const TARGET_WIN_RATE_MIN = 0.40;
const TARGET_WIN_RATE_MAX = 0.60;

/** 参考的近期对局数 */
const RECENT_GAMES_WINDOW = 5;

/** 最大 Rating 偏移量 */
const MAX_RATING_OFFSET = 200;

/** 最大深度调整量 */
const MAX_DEPTH_ADJUSTMENT = 3;

/** 最大失误率调整量 */
const MAX_MISTAKE_RATE_ADJUSTMENT = 0.15;

// ---------------------------------------------------------------------------
// AdaptiveDifficulty
// ---------------------------------------------------------------------------

export class AdaptiveDifficulty {
  private recentGames: GameRecord[] = [];
  private serverConfig: AdaptiveDifficultyConfig | null = null;

  /**
   * 设置来自后端的自适应配置
   */
  setServerConfig(config: AdaptiveDifficultyConfig): void {
    this.serverConfig = config;
  }

  /**
   * 记录一局对弈结果
   */
  addGameRecord(record: GameRecord): void {
    this.recentGames.push(record);
    // 只保留最近的对局
    if (this.recentGames.length > RECENT_GAMES_WINDOW * 2) {
      this.recentGames = this.recentGames.slice(-RECENT_GAMES_WINDOW * 2);
    }
  }

  /**
   * 计算近期胜率
   *
   * @param characterId 可选，只统计与特定角色的对局
   */
  getRecentWinRate(characterId?: string): number {
    let games = this.recentGames;
    if (characterId) {
      games = games.filter((g) => g.characterId === characterId);
    }

    const recent = games.slice(-RECENT_GAMES_WINDOW);
    if (recent.length === 0) return 0.5; // 无数据时假设均衡

    const wins = recent.filter((g) => g.result === 'win').length;
    const draws = recent.filter((g) => g.result === 'draw').length;
    return (wins + draws * 0.5) / recent.length;
  }

  /**
   * 计算调整后的引擎参数
   *
   * @param baseDepthMin 角色基础最小搜索深度
   * @param baseDepthMax 角色基础最大搜索深度
   * @param baseErrorRate 角色基础失误率
   * @param characterId 角色 ID
   */
  calculateAdjustedParams(
    baseDepthMin: number,
    baseDepthMax: number,
    baseErrorRate: number,
    characterId?: string,
  ): AdjustedEngineParams {
    // 优先使用后端配置
    if (this.serverConfig) {
      return this.applyServerConfig(baseDepthMin, baseDepthMax, baseErrorRate);
    }

    // 本地计算
    const winRate = this.getRecentWinRate(characterId);
    return this.calculateLocalAdjustment(
      baseDepthMin,
      baseDepthMax,
      baseErrorRate,
      winRate,
    );
  }

  /**
   * 获取近期对局数量
   */
  getRecentGamesCount(characterId?: string): number {
    let games = this.recentGames;
    if (characterId) {
      games = games.filter((g) => g.characterId === characterId);
    }
    return Math.min(games.length, RECENT_GAMES_WINDOW);
  }

  // ---------------------------------------------------------------------------
  // 内部方法
  // ---------------------------------------------------------------------------

  /**
   * 应用后端下发的自适应配置
   */
  private applyServerConfig(
    baseDepthMin: number,
    baseDepthMax: number,
    baseErrorRate: number,
  ): AdjustedEngineParams {
    const config = this.serverConfig!;

    const depthMin = Math.max(1, baseDepthMin + config.depth_adjustment);
    const depthMax = Math.max(depthMin + 1, baseDepthMax + config.depth_adjustment);
    const errorRate = Math.max(0, Math.min(1, baseErrorRate + config.mistake_rate_adjustment));

    let difficultyMode: 'easy' | 'normal' | 'hard';
    if (config.rating_offset > 50) {
      difficultyMode = 'hard';
    } else if (config.rating_offset < -50) {
      difficultyMode = 'easy';
    } else {
      difficultyMode = 'normal';
    }

    return {
      depthMin,
      depthMax,
      errorRate,
      ratingOffset: config.rating_offset,
      difficultyMode,
    };
  }

  /**
   * 本地自适应计算
   */
  private calculateLocalAdjustment(
    baseDepthMin: number,
    baseDepthMax: number,
    baseErrorRate: number,
    winRate: number,
  ): AdjustedEngineParams {
    let depthAdjust = 0;
    let errorAdjust = 0;
    let ratingOffset = 0;
    let difficultyMode: 'easy' | 'normal' | 'hard' = 'normal';

    if (winRate > TARGET_WIN_RATE_MAX) {
      // 用户赢太多，提高难度
      const excess = winRate - TARGET_WIN_RATE_MAX;
      const factor = Math.min(excess / 0.4, 1); // 归一化到 0-1

      depthAdjust = Math.round(factor * MAX_DEPTH_ADJUSTMENT);
      errorAdjust = -(factor * MAX_MISTAKE_RATE_ADJUSTMENT);
      ratingOffset = Math.round(factor * MAX_RATING_OFFSET);
      difficultyMode = 'hard';
    } else if (winRate < TARGET_WIN_RATE_MIN) {
      // 用户输太多，降低难度
      const deficit = TARGET_WIN_RATE_MIN - winRate;
      const factor = Math.min(deficit / 0.4, 1);

      depthAdjust = -Math.round(factor * MAX_DEPTH_ADJUSTMENT);
      errorAdjust = factor * MAX_MISTAKE_RATE_ADJUSTMENT;
      ratingOffset = -Math.round(factor * MAX_RATING_OFFSET);
      difficultyMode = 'easy';
    }

    const depthMin = Math.max(1, baseDepthMin + depthAdjust);
    const depthMax = Math.max(depthMin + 1, baseDepthMax + depthAdjust);
    const errorRate = Math.max(0, Math.min(1, baseErrorRate + errorAdjust));

    return {
      depthMin,
      depthMax,
      errorRate,
      ratingOffset,
      difficultyMode,
    };
  }
}
