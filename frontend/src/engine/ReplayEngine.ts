/**
 * 复盘回放引擎
 *
 * 从 PGN 字符串中解析所有走法，提供前进、后退、跳转等回放操作。
 * 依赖 chess.js 进行 PGN 解析。
 */

import { Chess } from 'chess.js';

export interface ReplayMove {
  /** 标准代数记谱（SAN），如 "e4"、"Nf3" */
  san: string;
  /** 走完这步后的局面 FEN */
  fen: string;
}

export interface ReplayStepResult {
  fen: string;
  move: string;
}

export class ReplayEngine {
  /** 所有走法及对应 FEN（不含初始局面） */
  private moves: ReplayMove[];
  /** 初始局面 FEN */
  private startFen: string;
  /** 当前回放位置，-1 表示在起始局面，0 表示第一步之后 */
  private currentIndex: number;

  /**
   * @param pgn 完整的 PGN 字符串
   * @throws 如果 PGN 解析失败则抛出错误
   */
  constructor(pgn: string) {
    const game = new Chess();
    try {
      game.loadPgn(pgn);
    } catch {
      throw new Error('无法解析 PGN 字符串，请检查格式是否正确。');
    }

    // 提取所有走法历史
    const history = game.history();

    // 重新逐步走一遍来记录每步的 FEN
    const replay = new Chess();

    // 如果 PGN 包含 FEN 头，使用该 FEN 作为起始
    const fenHeader = pgn.match(/\[FEN\s+"([^"]+)"\]/);
    if (fenHeader) {
      replay.load(fenHeader[1]);
      this.startFen = fenHeader[1];
    } else {
      this.startFen = replay.fen();
    }

    this.moves = [];
    for (const san of history) {
      replay.move(san);
      this.moves.push({ san, fen: replay.fen() });
    }

    this.currentIndex = -1;
  }

  /** 获取当前局面 FEN */
  getCurrentFen(): string {
    if (this.currentIndex < 0) {
      return this.startFen;
    }
    return this.moves[this.currentIndex].fen;
  }

  /** 获取当前走法索引（-1 表示初始局面） */
  getCurrentMoveIndex(): number {
    return this.currentIndex;
  }

  /** 获取总走法数 */
  getTotalMoves(): number {
    return this.moves.length;
  }

  /** 前进一步，返回走法信息；已在末尾则返回 null */
  forward(): ReplayStepResult | null {
    if (this.currentIndex >= this.moves.length - 1) {
      return null;
    }
    this.currentIndex++;
    const move = this.moves[this.currentIndex];
    return { fen: move.fen, move: move.san };
  }

  /** 后退一步，返回走法信息；已在起始则返回 null */
  backward(): ReplayStepResult | null {
    if (this.currentIndex < 0) {
      return null;
    }
    const move = this.moves[this.currentIndex];
    this.currentIndex--;
    return {
      fen: this.getCurrentFen(),
      move: move.san,
    };
  }

  /** 跳到指定步（-1 为初始局面，0 为第一步之后） */
  goToMove(index: number): { fen: string } {
    if (index < -1) {
      this.currentIndex = -1;
    } else if (index >= this.moves.length) {
      this.currentIndex = this.moves.length - 1;
    } else {
      this.currentIndex = index;
    }
    return { fen: this.getCurrentFen() };
  }

  /** 回到起始局面 */
  goToStart(): { fen: string } {
    this.currentIndex = -1;
    return { fen: this.startFen };
  }

  /** 跳到最后一步 */
  goToEnd(): { fen: string } {
    if (this.moves.length === 0) {
      return { fen: this.startFen };
    }
    this.currentIndex = this.moves.length - 1;
    return { fen: this.moves[this.currentIndex].fen };
  }

  /** 获取所有走法列表 */
  getAllMoves(): ReplayMove[] {
    return [...this.moves];
  }
}
