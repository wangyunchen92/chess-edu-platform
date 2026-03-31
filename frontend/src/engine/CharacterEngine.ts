/**
 * AI 角色行为引擎
 *
 * 为不同的 AI 对手角色提供个性化的走法生成。
 * 根据角色配置（等级、风格权重、失误率等）从引擎候选走法中选择最终走法，
 * 模拟不同水平和风格的对手。
 *
 * Phase 2a 增强：
 * - 集成 PlayStyleController 实现 9 个角色的差异化棋风
 * - 集成 AdaptiveDifficulty 实现动态难度调整
 * - 支持从后端 play_style_params 构建角色配置
 */

import { EngineManager } from './EngineManager';
import { MoveSelector } from './MoveSelector';
import { PlayStyleController, PlayStyleParams } from './PlayStyleController';
import {
  AdaptiveDifficulty,
  AdaptiveDifficultyConfig,
  AdjustedEngineParams,
} from './AdaptiveDifficulty';
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
  /** Phase 2a: 棋风参数（来自后端 play_style_params） */
  playStyleParams?: PlayStyleParams;
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
  /** Phase 2a: 走法选择原因 */
  selectionReason?: 'best' | 'style' | 'trap' | 'error';
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
  private playStyleController: PlayStyleController | null = null;
  private adaptiveDifficulty: AdaptiveDifficulty;

  constructor(config: CharacterConfig) {
    this.config = { ...config };
    this.engineManager = EngineManager.getInstance();
    this.adaptiveDifficulty = new AdaptiveDifficulty();

    // 如果有棋风参数，创建 PlayStyleController
    if (config.playStyleParams) {
      this.playStyleController = new PlayStyleController(config.playStyleParams);
    }
  }

  /**
   * 根据当前局面生成角色的走法
   *
   * @param fen 当前局面 FEN
   * @param userRating 用户等级分（用于微调深度）
   */
  async getMove(fen: string, userRating: number): Promise<CharacterMove> {
    // 1. 获取自适应调整后的引擎参数
    const adjustedParams = this.adaptiveDifficulty.calculateAdjustedParams(
      this.config.depthMin,
      this.config.depthMax,
      this.config.errorRate,
      this.config.id,
    );

    // 2. 确定搜索深度
    const depth = this.calculateDepth(userRating, adjustedParams);

    // 3. 获取 Top 5 候选走法（使用调整后的最大深度保证质量）
    const searchDepth = Math.max(depth, adjustedParams.depthMax);
    const candidates = await this.engineManager.getTopMoves(fen, 5, searchDepth);

    if (candidates.length === 0) {
      throw new Error('No legal moves available for the current position');
    }

    // 4. 决定是否犯错（使用调整后的失误率）
    const shouldError = Math.random() < adjustedParams.errorRate;

    // 5. 获取棋局阶段
    const gamePhase = MoveSelector.getGamePhase(fen);

    // 6. 选择走法（优先使用 PlayStyleController）
    let selected;
    let selectionReason: CharacterMove['selectionReason'] = 'best';

    if (this.playStyleController) {
      selected = this.playStyleController.selectMove(
        candidates,
        fen,
        shouldError,
        gamePhase,
      );

      // 判断选择原因
      if (shouldError && selected.move !== candidates[0].move) {
        selectionReason = 'error';
      } else if (selected.move !== candidates[0].move) {
        // 检查是否是陷阱走法
        const params = this.playStyleController.getParams();
        if (params.prefer_traps && params.trap_frequency) {
          selectionReason = 'trap';
        } else {
          selectionReason = 'style';
        }
      }
    } else {
      // 回退到旧的 MoveSelector 逻辑
      selected = MoveSelector.selectMoveWithFen(
        candidates,
        this.config,
        shouldError,
        gamePhase,
        fen,
      );
      if (shouldError && selected.move !== candidates[0].move) {
        selectionReason = 'error';
      }
    }

    // 7. 转换 UCI -> SAN
    const game = createGame(fen);
    let san: string;
    try {
      san = uciToSan(game, selected.move);
    } catch {
      san = selected.move;
    }

    // 8. 生成模拟思考时间（根据棋风调整）
    const thinkTimeMs = this.generateThinkTime(gamePhase);

    // 9. 判断是否为失误走法
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
      selectionReason,
    };
  }

  /**
   * 设置自适应难度配置（来自后端）
   */
  setAdaptiveConfig(config: AdaptiveDifficultyConfig): void {
    this.adaptiveDifficulty.setServerConfig(config);
  }

  /**
   * 记录对局结果（用于本地自适应计算）
   */
  recordGameResult(result: 'win' | 'loss' | 'draw'): void {
    this.adaptiveDifficulty.addGameRecord({
      result,
      characterId: this.config.id,
      timestamp: Date.now(),
    });
  }

  /**
   * 自适应难度：根据用户近期胜率微调配置
   *
   * @param recentWinRate 用户近期胜率 0-1
   * @deprecated 使用 setAdaptiveConfig 或 recordGameResult 代替
   */
  adjustDifficulty(recentWinRate: number): void {
    // 保持向后兼容
    if (recentWinRate > 0.65) {
      this.config.errorRate = Math.max(0, this.config.errorRate - 0.05);
      this.config.depthMin = Math.min(this.config.depthMin + 1, 20);
      this.config.depthMax = Math.min(this.config.depthMax + 1, 22);
    } else if (recentWinRate < 0.35) {
      this.config.errorRate = Math.min(1, this.config.errorRate + 0.05);
      this.config.depthMin = Math.max(this.config.depthMin - 1, 1);
      this.config.depthMax = Math.max(this.config.depthMax - 1, 2);
    } else if (recentWinRate > 0.55) {
      this.config.errorRate = Math.max(0, this.config.errorRate - 0.02);
    } else if (recentWinRate < 0.45) {
      this.config.errorRate = Math.min(1, this.config.errorRate + 0.02);
    }
  }

  /**
   * 获取对话触发事件（根据局面变化判断）
   */
  getDialogueEvent(
    prevFen: string,
    currentFen: string,
    lastMove: string,
  ): DialogueEvent | null {
    const currentGame = createGame(currentFen);

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

    if (currentGame.inCheck()) {
      return 'check_given';
    }

    if (moveResult.captured) {
      return 'capture_given';
    }

    const style = MoveSelector.classifyMove(prevFen, lastMove);
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

  /**
   * 获取当前难度模式
   */
  getCurrentDifficultyMode(): 'easy' | 'normal' | 'hard' {
    const adjusted = this.adaptiveDifficulty.calculateAdjustedParams(
      this.config.depthMin,
      this.config.depthMax,
      this.config.errorRate,
      this.config.id,
    );
    return adjusted.difficultyMode;
  }

  // ---------------------------------------------------------------------------
  // 内部方法
  // ---------------------------------------------------------------------------

  /** 计算搜索深度 */
  private calculateDepth(
    userRating: number,
    adjustedParams?: AdjustedEngineParams,
  ): number {
    const depthMin = adjustedParams?.depthMin ?? this.config.depthMin;
    const depthMax = adjustedParams?.depthMax ?? this.config.depthMax;
    const rating = this.config.rating + (adjustedParams?.ratingOffset ?? 0);

    const ratingDiff = rating - userRating;
    const ratio = Math.max(0, Math.min(1, (ratingDiff + 400) / 800));
    const depth = Math.round(depthMin + (depthMax - depthMin) * ratio);

    return Math.max(depthMin, Math.min(depthMax, depth));
  }

  /** 生成随机思考时间（根据棋风和局面阶段调整） */
  private generateThinkTime(
    gamePhase?: 'opening' | 'middlegame' | 'endgame',
  ): number {
    const { thinkTimeMinMs, thinkTimeMaxMs } = this.config;
    let base =
      thinkTimeMinMs +
      Math.floor(Math.random() * (thinkTimeMaxMs - thinkTimeMinMs));

    if (this.playStyleController) {
      const params = this.playStyleController.getParams();

      // 防守型角色思考更久
      if (params.prefer_defensive || (params.defensive_bias ?? 0) > 0.5) {
        base = Math.round(base * 1.2);
      }

      // 进攻型角色思考更快
      if (params.prefer_aggressive || (params.aggressive_bias ?? 0) > 0.5) {
        base = Math.round(base * 0.8);
      }

      // 中局思考时间较长
      if (gamePhase === 'middlegame') {
        base = Math.round(base * 1.15);
      }

      // 简单走法偏好的角色思考更快
      if (params.prefer_simple_moves) {
        base = Math.round(base * 0.7);
      }
    }

    return base;
  }
}

// ---------------------------------------------------------------------------
// 工具函数：从后端 CharacterDetail 构建 CharacterConfig
// ---------------------------------------------------------------------------

/**
 * 从后端 API 返回的角色详情构建 CharacterConfig
 *
 * 此函数将后端的 engine_depth_min/max, mistake_rate, play_style_params
 * 映射到前端 CharacterEngine 所需的 CharacterConfig。
 */
export function buildCharacterConfigFromAPI(detail: {
  id?: string;
  slug?: string;
  name: string;
  base_rating: number;
  engine_depth_min: number;
  engine_depth_max: number;
  mistake_rate: number;
  play_style_params?: Record<string, unknown>;
}): CharacterConfig {
  const playStyleParams = detail.play_style_params
    ? (detail.play_style_params as PlayStyleParams)
    : undefined;

  // 根据棋风参数推算 styleWeights
  const styleWeights = calculateStyleWeights(playStyleParams);

  // 根据 Rating 推算思考时间
  const rating = detail.base_rating;
  const thinkTimeMinMs = Math.max(300, Math.round(rating * 0.5));
  const thinkTimeMaxMs = Math.max(1000, Math.round(rating * 2));

  return {
    id: detail.id ?? detail.slug ?? 'unknown',
    name: detail.name,
    rating,
    depthMin: detail.engine_depth_min,
    depthMax: detail.engine_depth_max,
    errorRate: detail.mistake_rate,
    styleWeights,
    thinkTimeMinMs,
    thinkTimeMaxMs,
    playStyleParams,
  };
}

/**
 * 从角色 JSON（content/characters/*.json）的 engine_params 构建 CharacterConfig
 */
export function buildCharacterConfigFromJSON(json: {
  id: string;
  name: string;
  rating: number;
  engine_params: Record<string, unknown>;
}): CharacterConfig {
  const ep = json.engine_params;

  const playStyleParams: PlayStyleParams = {};
  // 逐一映射 engine_params 中的棋风参数
  if (ep.prefer_simple_moves) playStyleParams.prefer_simple_moves = true;
  if (ep.avoid_long_sequences) playStyleParams.avoid_long_sequences = true;
  if (ep.prefer_aggressive) playStyleParams.prefer_aggressive = true;
  if (ep.prefer_defensive) playStyleParams.prefer_defensive = true;
  if (ep.prefer_traps) playStyleParams.prefer_traps = true;
  if (ep.prefer_tactical) playStyleParams.prefer_tactical = true;
  if (ep.positional_play) playStyleParams.positional_play = true;
  if (ep.balanced_play) playStyleParams.balanced_play = true;
  if (ep.adaptive_style) playStyleParams.adaptive_style = true;
  if (ep.prefer_center_control) playStyleParams.prefer_center_control = true;
  if (ep.prefer_solid_structure) playStyleParams.prefer_solid_structure = true;
  if (ep.prefer_open_positions) playStyleParams.prefer_open_positions = true;
  if (ep.prefer_closed_positions) playStyleParams.prefer_closed_positions = true;
  if (ep.prefer_piece_activity) playStyleParams.prefer_piece_activity = true;
  if (ep.avoid_long_endgames) playStyleParams.avoid_long_endgames = true;
  if (typeof ep.defensive_bias === 'number') playStyleParams.defensive_bias = ep.defensive_bias;
  if (typeof ep.aggressive_bias === 'number') playStyleParams.aggressive_bias = ep.aggressive_bias;
  if (typeof ep.positional_bias === 'number') playStyleParams.positional_bias = ep.positional_bias;
  if (typeof ep.trap_frequency === 'number') playStyleParams.trap_frequency = ep.trap_frequency;
  if (typeof ep.endgame_strength === 'number') playStyleParams.endgame_strength = ep.endgame_strength;
  if (typeof ep.counterattack_threshold === 'number') playStyleParams.counterattack_threshold = ep.counterattack_threshold;
  if (typeof ep.kingside_attack_weight === 'number') playStyleParams.kingside_attack_weight = ep.kingside_attack_weight;
  if (typeof ep.sacrifice_willingness === 'number') playStyleParams.sacrifice_willingness = ep.sacrifice_willingness;
  if (typeof ep.poison_pawn_tendency === 'number') playStyleParams.poison_pawn_tendency = ep.poison_pawn_tendency;
  if (typeof ep.opening_repertoire === 'string') playStyleParams.opening_repertoire = ep.opening_repertoire;

  const styleWeights = calculateStyleWeights(playStyleParams);

  const depthMin = (ep.depth_min as number) ?? 3;
  const depthMax = (ep.depth_max as number) ?? 5;
  const errorRate = (ep.error_rate as number) ?? 0.3;
  const rating = json.rating;

  return {
    id: json.id,
    name: json.name,
    rating,
    depthMin,
    depthMax,
    errorRate,
    styleWeights,
    thinkTimeMinMs: Math.max(300, Math.round(rating * 0.5)),
    thinkTimeMaxMs: Math.max(1000, Math.round(rating * 2)),
    playStyleParams,
  };
}

/**
 * 从 PlayStyleParams 推算 styleWeights
 */
function calculateStyleWeights(
  params?: PlayStyleParams,
): CharacterConfig['styleWeights'] {
  if (!params) {
    return { attack: 0.25, defense: 0.25, tactics: 0.25, positional: 0.25 };
  }

  let attack = 0.25;
  let defense = 0.25;
  let tactics = 0.25;
  let positional = 0.25;

  if (params.prefer_aggressive || (params.aggressive_bias ?? 0) > 0) {
    attack = Math.max(attack, params.aggressive_bias ?? 0.6);
  }
  if (params.prefer_defensive || (params.defensive_bias ?? 0) > 0) {
    defense = Math.max(defense, params.defensive_bias ?? 0.6);
  }
  if (params.prefer_traps || params.prefer_tactical) {
    tactics = Math.max(tactics, 0.5);
    if (params.trap_frequency) tactics = Math.max(tactics, params.trap_frequency + 0.3);
  }
  if (params.positional_play || (params.positional_bias ?? 0) > 0) {
    positional = Math.max(positional, params.positional_bias ?? 0.6);
  }

  // 归一化
  const total = attack + defense + tactics + positional;
  return {
    attack: attack / total,
    defense: defense / total,
    tactics: tactics / total,
    positional: positional / total,
  };
}
