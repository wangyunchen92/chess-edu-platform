/**
 * 棋风控制器
 *
 * 将角色的 play_style_params（来自后端/角色 JSON）映射到实际的走法选择逻辑。
 * 每个角色有不同的棋风偏好（进攻/防守/陷阱/位置），控制器在 MultiPV 候选走法中
 * 根据棋风偏好打分，实现差异化对弈体验。
 */

import { MoveEvaluation } from './types';
import { createGame } from '../utils/chess';
import { MoveSelector, MoveStyle } from './MoveSelector';

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

/** 角色棋风参数（对应 play_style_params JSON） */
export interface PlayStyleParams {
  /** 偏好进攻性走法 */
  prefer_aggressive?: boolean;
  /** 偏好防守性走法 */
  prefer_defensive?: boolean;
  /** 偏好简单走法（初学者角色） */
  prefer_simple_moves?: boolean;
  /** 避免长变化 */
  avoid_long_sequences?: boolean;
  /** 偏好设陷阱 */
  prefer_traps?: boolean;
  /** 偏好战术走法 */
  prefer_tactical?: boolean;
  /** 偏好位置性走法 */
  positional_play?: boolean;
  /** 均衡下棋 */
  balanced_play?: boolean;
  /** 自适应风格（根据局面切换） */
  adaptive_style?: boolean;
  /** 防守倾向 0-1 */
  defensive_bias?: number;
  /** 进攻倾向 0-1 */
  aggressive_bias?: number;
  /** 位置型倾向 0-1 */
  positional_bias?: number;
  /** 陷阱频率 0-1 */
  trap_frequency?: number;
  /** 残局能力 0-1 */
  endgame_strength?: number;
  /** 偏好中心控制 */
  prefer_center_control?: boolean;
  /** 偏好稳固结构 */
  prefer_solid_structure?: boolean;
  /** 偏好开放局面 */
  prefer_open_positions?: boolean;
  /** 偏好封闭局面 */
  prefer_closed_positions?: boolean;
  /** 反击阈值 */
  counterattack_threshold?: number;
  /** 偏好子力活跃度 */
  prefer_piece_activity?: boolean;
  /** 王翼进攻权重 */
  kingside_attack_weight?: number;
  /** 弃子意愿 0-1 */
  sacrifice_willingness?: number;
  /** 毒兵倾向 0-1 */
  poison_pawn_tendency?: number;
  /** 开局选择多样性 */
  opening_repertoire?: string;
  /** 避免长残局 */
  avoid_long_endgames?: boolean;
}

/** 走法评分结果 */
export interface ScoredMove {
  candidate: MoveEvaluation;
  /** 综合得分 */
  totalScore: number;
  /** 引擎排名分 */
  rankScore: number;
  /** 棋风加成分 */
  styleScore: number;
  /** 走法风格分类 */
  moveStyle: MoveStyle;
  /** 是否为陷阱走法 */
  isTrap: boolean;
}

// ---------------------------------------------------------------------------
// PlayStyleController
// ---------------------------------------------------------------------------

export class PlayStyleController {
  private params: PlayStyleParams;

  constructor(params: PlayStyleParams) {
    this.params = { ...params };
  }

  /**
   * 根据棋风参数从候选走法中选择最终走法
   *
   * @param candidates Stockfish MultiPV 返回的候选走法（按引擎评估排序）
   * @param fen 当前局面 FEN
   * @param shouldError 是否应该犯错（由 error_rate 决定）
   * @param gamePhase 当前棋局阶段
   * @returns 选中的走法
   */
  selectMove(
    candidates: MoveEvaluation[],
    fen: string,
    shouldError: boolean,
    gamePhase: 'opening' | 'middlegame' | 'endgame',
  ): MoveEvaluation {
    if (candidates.length === 0) {
      throw new Error('No candidate moves to select from');
    }
    if (candidates.length === 1) {
      return candidates[0];
    }

    // 犯错模式：根据棋风选择不同的"犯错方式"
    if (shouldError) {
      return this.selectErrorMove(candidates, fen, gamePhase);
    }

    // 检查是否触发陷阱走法
    if (this.shouldSetTrap()) {
      const trapMove = this.selectTrapMove(candidates, fen);
      if (trapMove) {
        return trapMove;
      }
    }

    // 正常模式：对每个候选走法按棋风打分
    const scored = this.scoreAllMoves(candidates, fen, gamePhase);
    return scored[0].candidate;
  }

  /**
   * 对所有候选走法打分并排序
   */
  scoreAllMoves(
    candidates: MoveEvaluation[],
    fen: string,
    gamePhase: 'opening' | 'middlegame' | 'endgame',
  ): ScoredMove[] {
    const scored = candidates.map((candidate, index) => {
      const moveStyle = MoveSelector.classifyMove(fen, candidate.move);

      // 1. 引擎排名分（0-1）
      const rankScore = (candidates.length - index) / candidates.length;

      // 2. 棋风加成分（0-1）
      const styleScore = this.calculateStyleScore(moveStyle, gamePhase, fen, candidate);

      // 3. 局面特征加成
      const positionBonus = this.calculatePositionBonus(candidate, fen, gamePhase);

      // 4. 随机扰动（增加不可预测性）
      const randomFactor = Math.random() * this.getRandomWeight();

      // 综合得分
      // 引擎排名权重根据角色实力变化：弱角色更依赖风格，强角色更依赖引擎评估
      const rankWeight = this.getRankWeight();
      const styleWeight = this.getStyleWeight();

      const totalScore =
        rankScore * rankWeight +
        styleScore * styleWeight +
        positionBonus * 0.1 +
        randomFactor;

      return {
        candidate,
        totalScore,
        rankScore,
        styleScore,
        moveStyle,
        isTrap: false,
      };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore);
    return scored;
  }

  /**
   * 获取当前棋风参数（只读）
   */
  getParams(): Readonly<PlayStyleParams> {
    return { ...this.params };
  }

  /**
   * 更新棋风参数（用于自适应难度调整）
   */
  updateParams(updates: Partial<PlayStyleParams>): void {
    Object.assign(this.params, updates);
  }

  // ---------------------------------------------------------------------------
  // 棋风打分逻辑
  // ---------------------------------------------------------------------------

  /**
   * 根据棋风计算走法的风格加成分
   */
  private calculateStyleScore(
    moveStyle: MoveStyle,
    gamePhase: 'opening' | 'middlegame' | 'endgame',
    _fen: string,
    _candidate: MoveEvaluation,
  ): number {
    let score = 0.5; // 基础分

    // 进攻型偏好
    if (this.params.prefer_aggressive || (this.params.aggressive_bias ?? 0) > 0) {
      const bias = this.params.aggressive_bias ?? 0.6;
      if (moveStyle === 'aggressive') score += bias * 0.4;
      if (moveStyle === 'tactical') score += bias * 0.3;
      // 进攻型在中局更强
      if (gamePhase === 'middlegame') score += bias * 0.1;
    }

    // 防守型偏好
    if (this.params.prefer_defensive || (this.params.defensive_bias ?? 0) > 0) {
      const bias = this.params.defensive_bias ?? 0.6;
      if (moveStyle === 'defensive') score += bias * 0.4;
      if (moveStyle === 'positional') score += bias * 0.2;
      // 防守型惩罚过于进攻的走法
      if (moveStyle === 'aggressive') score -= bias * 0.15;
    }

    // 位置型偏好
    if (this.params.positional_play || (this.params.positional_bias ?? 0) > 0) {
      const bias = this.params.positional_bias ?? 0.6;
      if (moveStyle === 'positional') score += bias * 0.4;
      // 位置型在开局和残局更重要
      if (gamePhase === 'opening' && moveStyle === 'positional') score += bias * 0.15;
      if (gamePhase === 'endgame' && moveStyle === 'positional') score += bias * 0.1;
    }

    // 战术型偏好
    if (this.params.prefer_tactical) {
      if (moveStyle === 'tactical') score += 0.35;
      if (moveStyle === 'aggressive') score += 0.15;
    }

    // 均衡型
    if (this.params.balanced_play) {
      // 均衡型对所有风格都给适中加成，偏好排名靠前的走法
      if (moveStyle !== 'neutral') score += 0.1;
    }

    // 简单走法偏好（低阶角色）
    if (this.params.prefer_simple_moves) {
      // 偏好不吃子、不将军的"安静"走法
      if (moveStyle === 'neutral' || moveStyle === 'positional') score += 0.2;
      if (moveStyle === 'tactical') score -= 0.1;
    }

    // 自适应风格：根据局面阶段切换
    if (this.params.adaptive_style) {
      switch (gamePhase) {
        case 'opening':
          if (moveStyle === 'positional') score += 0.2;
          break;
        case 'middlegame':
          // 中局根据局势动态选择
          if (moveStyle === 'tactical') score += 0.15;
          if (moveStyle === 'aggressive') score += 0.1;
          break;
        case 'endgame':
          if (moveStyle === 'positional') score += 0.15;
          // 残局能力加成
          const endgameStr = this.params.endgame_strength ?? 0.5;
          score += endgameStr * 0.1;
          break;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 计算局面特征加成
   */
  private calculatePositionBonus(
    candidate: MoveEvaluation,
    _fen: string,
    gamePhase: 'opening' | 'middlegame' | 'endgame',
  ): number {
    let bonus = 0;

    // 中心控制偏好
    if (this.params.prefer_center_control) {
      const to = candidate.move.substring(2, 4);
      const centralSquares = ['d4', 'd5', 'e4', 'e5', 'c4', 'c5', 'f4', 'f5'];
      if (centralSquares.includes(to)) bonus += 0.3;
    }

    // 王翼进攻权重
    if ((this.params.kingside_attack_weight ?? 0) > 0 && gamePhase === 'middlegame') {
      const to = candidate.move.substring(2, 4);
      const kingsideFiles = ['f', 'g', 'h'];
      if (kingsideFiles.includes(to[0])) {
        bonus += this.params.kingside_attack_weight! * 0.2;
      }
    }

    // 弃子意愿：接受评分稍低但有战术前景的走法
    if ((this.params.sacrifice_willingness ?? 0) > 0) {
      // 如果走法是吃子或被吃但 PV 较长（有后续），给加成
      if (candidate.pv.length >= 4) {
        bonus += this.params.sacrifice_willingness! * 0.15;
      }
    }

    return bonus;
  }

  // ---------------------------------------------------------------------------
  // 陷阱走法
  // ---------------------------------------------------------------------------

  /**
   * 判断本步是否应该设陷阱
   */
  private shouldSetTrap(): boolean {
    if (!this.params.prefer_traps) return false;
    const frequency = this.params.trap_frequency ?? 0.15;
    return Math.random() < frequency;
  }

  /**
   * 从候选走法中选择"陷阱走法"
   *
   * 陷阱走法的特征：
   * 1. 不是最佳手（排名第2-4）
   * 2. 评估分与最佳手差距不大（看起来不像明显的错误）
   * 3. PV（后续变例）较长（说明有复杂后续）
   * 4. 偏好进攻/战术风格的走法（看似积极但暗藏杀机）
   */
  selectTrapMove(
    candidates: MoveEvaluation[],
    fen: string,
  ): MoveEvaluation | null {
    if (candidates.length < 3) return null;

    const bestScore = candidates[0].score;
    // 陷阱走法候选：排名2-4，评分差距在合理范围内
    const maxScoreDiff = 80; // 80 centipawns 以内
    const trapCandidates = candidates.slice(1, 4).filter((c) => {
      const diff = Math.abs(bestScore - c.score);
      return diff <= maxScoreDiff;
    });

    if (trapCandidates.length === 0) return null;

    // 对陷阱候选打分
    const scored = trapCandidates.map((candidate) => {
      const style = MoveSelector.classifyMove(fen, candidate.move);
      let trapScore = 0;

      // PV 越长，后续越复杂，越适合设陷阱
      trapScore += Math.min(candidate.pv.length / 10, 0.3);

      // 战术/进攻型走法更适合设陷阱
      if (style === 'tactical') trapScore += 0.3;
      if (style === 'aggressive') trapScore += 0.2;

      // 评分与最佳手越接近，越不容易被识破
      const diff = Math.abs(bestScore - candidate.score);
      trapScore += (1 - diff / maxScoreDiff) * 0.2;

      // 毒兵倾向
      if ((this.params.poison_pawn_tendency ?? 0) > 0) {
        // 检查是否是兵的走法（简化检测）
        const game = createGame(fen);
        const from = candidate.move.substring(0, 2);
        const board = game.board();
        const file = from.charCodeAt(0) - 'a'.charCodeAt(0);
        const rank = 8 - parseInt(from[1], 10);
        if (rank >= 0 && rank < 8 && file >= 0 && file < 8) {
          const piece = board[rank][file];
          if (piece && piece.type === 'p') {
            trapScore += this.params.poison_pawn_tendency! * 0.2;
          }
        }
      }

      return { candidate, trapScore };
    });

    scored.sort((a, b) => b.trapScore - a.trapScore);

    // 返回得分最高的陷阱走法
    if (scored[0].trapScore > 0.2) {
      return scored[0].candidate;
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // 犯错走法
  // ---------------------------------------------------------------------------

  /**
   * 根据棋风选择不同方式的犯错
   */
  private selectErrorMove(
    candidates: MoveEvaluation[],
    fen: string,
    _gamePhase: 'opening' | 'middlegame' | 'endgame',
  ): MoveEvaluation {
    if (candidates.length <= 2) {
      return candidates[candidates.length - 1];
    }

    // 简单走法偏好的角色犯错时选择"安静但不好"的走法
    if (this.params.prefer_simple_moves) {
      const quietErrors = candidates.slice(1).filter((c) => {
        const style = MoveSelector.classifyMove(fen, c.move);
        return style === 'neutral' || style === 'defensive';
      });
      if (quietErrors.length > 0) {
        return quietErrors[Math.floor(Math.random() * quietErrors.length)];
      }
    }

    // 进攻型角色犯错时可能过度进攻（选择进攻性但不好的走法）
    if (this.params.prefer_aggressive || (this.params.aggressive_bias ?? 0) > 0.5) {
      const aggressiveErrors = candidates.slice(2).filter((c) => {
        const style = MoveSelector.classifyMove(fen, c.move);
        return style === 'aggressive' || style === 'tactical';
      });
      if (aggressiveErrors.length > 0) {
        return aggressiveErrors[Math.floor(Math.random() * aggressiveErrors.length)];
      }
    }

    // 防守型角色犯错时可能过于保守（选择防守但不好的走法）
    if (this.params.prefer_defensive || (this.params.defensive_bias ?? 0) > 0.5) {
      const defensiveErrors = candidates.slice(2).filter((c) => {
        const style = MoveSelector.classifyMove(fen, c.move);
        return style === 'defensive' || style === 'neutral';
      });
      if (defensiveErrors.length > 0) {
        return defensiveErrors[Math.floor(Math.random() * defensiveErrors.length)];
      }
    }

    // 默认：从后半部分随机选
    const lowerHalf = candidates.slice(Math.floor(candidates.length / 2));
    return lowerHalf[Math.floor(Math.random() * lowerHalf.length)];
  }

  // ---------------------------------------------------------------------------
  // 权重计算
  // ---------------------------------------------------------------------------

  /** 引擎排名权重（角色越强越依赖引擎评估） */
  private getRankWeight(): number {
    // 有强棋风偏好的角色降低排名权重
    const maxBias = Math.max(
      this.params.aggressive_bias ?? 0,
      this.params.defensive_bias ?? 0,
      this.params.positional_bias ?? 0,
    );

    if (this.params.prefer_simple_moves) return 0.35;
    if (this.params.balanced_play && !maxBias) return 0.55;
    if (maxBias > 0.5) return 0.4;
    return 0.5;
  }

  /** 棋风权重 */
  private getStyleWeight(): number {
    const maxBias = Math.max(
      this.params.aggressive_bias ?? 0,
      this.params.defensive_bias ?? 0,
      this.params.positional_bias ?? 0,
    );

    if (this.params.prefer_simple_moves) return 0.25;
    if (this.params.balanced_play && !maxBias) return 0.3;
    if (maxBias > 0.5) return 0.4;
    return 0.35;
  }

  /** 随机扰动权重（低阶角色更随机） */
  private getRandomWeight(): number {
    if (this.params.prefer_simple_moves) return 0.3;
    if (this.params.balanced_play) return 0.15;
    if (this.params.adaptive_style) return 0.1;
    return 0.15;
  }
}
