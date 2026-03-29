/**
 * 谜题验证引擎
 *
 * 接收一个 FEN 局面和正确走法序列（SAN 格式），
 * 逐步验证用户的走法是否与解题路径匹配。
 * 依赖 chess.js 进行走法合法性检验和格式转换。
 */

import { Chess } from 'chess.js';

export interface ValidateMoveResult {
  /** 用户走法是否正确 */
  correct: boolean;
  /** 是否已完成全部步骤 */
  isComplete: boolean;
  /** 如果走错，给出当前步骤的正确走法（SAN） */
  expectedMove?: string;
  /** 走对后的新 FEN（包含对手的应着之后） */
  nextFen?: string;
  /** 提示信息 */
  hint?: string;
}

export interface StepInfo {
  /** 当前步骤序号（从 1 开始） */
  step: number;
  /** 总步骤数（仅用户需走的步数） */
  total: number;
  /** 当前局面 FEN */
  fen: string;
}

export class PuzzleValidator {
  /** 正确走法序列（SAN 格式），包含用户走法和对手应着交替排列 */
  private solutionMoves: string[];
  /** 用户当前需要完成的步骤索引（对应 solutionMoves 中的下标） */
  private currentStep: number;
  /** 内部棋局实例 */
  private game: Chess;
  /** 初始 FEN，用于 reset */
  private initialFen: string;
  /** 用户需要走的步数（solution 中奇数索引 0,2,4... 为用户走法） */
  private userStepCount: number;

  /**
   * @param fen      初始局面 FEN
   * @param solution 正确走法序列（SAN），如 ["Nf7+", "Kg8", "Nh6#"]
   *                 其中索引 0, 2, 4... 为当前走子方（用户）的走法，
   *                 索引 1, 3, 5... 为对手的应着。
   */
  constructor(fen: string, solution: string[]) {
    this.initialFen = fen;
    this.solutionMoves = solution;
    this.currentStep = 0;
    this.game = new Chess(fen);
    this.userStepCount = Math.ceil(solution.length / 2);
  }

  /**
   * 验证用户走法是否匹配当前步骤的正确解。
   *
   * @param from       起始格（如 "e2"）
   * @param to         目标格（如 "e4"）
   * @param promotion  升变棋子（可选，如 "q"）
   */
  validateMove(from: string, to: string, promotion?: string): ValidateMoveResult {
    if (this.currentStep >= this.solutionMoves.length) {
      return { correct: false, isComplete: true, hint: '谜题已完成。' };
    }

    // 尝试在当前局面上走这步棋
    const testGame = new Chess(this.game.fen());
    const moveResult = testGame.move({ from, to, promotion });

    if (!moveResult) {
      return {
        correct: false,
        isComplete: false,
        hint: '这不是一步合法的走法，请重新试试。',
      };
    }

    const expectedSan = this.solutionMoves[this.currentStep];
    const userSan = moveResult.san;

    // 比较走法：去掉 +、# 等注释符号后比较核心走法
    if (this._normalizeSan(userSan) !== this._normalizeSan(expectedSan)) {
      return {
        correct: false,
        isComplete: false,
        expectedMove: expectedSan,
        hint: `这步不太对哦。正确的走法是 ${expectedSan}，想想为什么？`,
      };
    }

    // 走法正确，在内部棋局上执行
    this.game.move({ from, to, promotion });
    this.currentStep++;

    // 如果还有对手的应着，自动执行
    if (this.currentStep < this.solutionMoves.length) {
      const opponentMove = this.solutionMoves[this.currentStep];
      const opResult = this.game.move(opponentMove);
      if (opResult) {
        this.currentStep++;
      }
    }

    const isComplete = this.currentStep >= this.solutionMoves.length;
    const userStep = Math.ceil(this.currentStep / 2);

    return {
      correct: true,
      isComplete,
      nextFen: this.game.fen(),
      hint: isComplete
        ? `太棒了！你完成了这道谜题！`
        : `第 ${userStep}/${this.userStepCount} 步正确！继续加油！`,
    };
  }

  /** 重置到初始状态 */
  reset(): void {
    this.game = new Chess(this.initialFen);
    this.currentStep = 0;
  }

  /** 获取当前步骤信息 */
  getCurrentStep(): StepInfo {
    return {
      step: Math.min(Math.ceil(this.currentStep / 2) + 1, this.userStepCount),
      total: this.userStepCount,
      fen: this.game.fen(),
    };
  }

  /**
   * 标准化 SAN 走法用于比较：去掉 +、# 符号。
   * 例如 "Nf7+" -> "Nf7", "Nh6#" -> "Nh6"
   */
  private _normalizeSan(san: string): string {
    return san.replace(/[+#]/g, '');
  }
}
