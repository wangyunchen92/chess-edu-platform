/**
 * Stockfish WASM Web Worker 封装
 *
 * 通过 postMessage/onmessage 与 stockfish-worker.js 通信，
 * 发送 UCI 协议命令并解析返回结果。
 *
 * 注意：实际 Stockfish WASM 文件需用户手动下载放到 public/stockfish/ 目录。
 */

import {
  MoveEvaluation,
  EngineTimeoutError,
  EngineNotReadyError,
} from './types';

/** 默认命令超时 30 秒 */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Worker 脚本默认路径（相对于 public 目录） */
const DEFAULT_WORKER_PATH = '/stockfish/stockfish-worker.js';

/**
 * 封装与 Stockfish WASM Web Worker 的通信。
 * 所有方法都返回 Promise，内部通过消息队列匹配请求/响应。
 */
export class StockfishWorker {
  private worker: Worker | null = null;
  private messageBuffer: string[] = [];
  private listeners: Array<(line: string) => void> = [];
  private workerPath: string;
  private timeoutMs: number;

  constructor(workerPath?: string, timeoutMs?: number) {
    this.workerPath = workerPath ?? DEFAULT_WORKER_PATH;
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  // ---------------------------------------------------------------------------
  // 生命周期
  // ---------------------------------------------------------------------------

  /** 加载 Worker 并等待 Stockfish 初始化完成 */
  async init(): Promise<void> {
    if (this.worker) {
      return; // 已初始化
    }

    this.worker = new Worker(this.workerPath);

    // 统一监听 Worker 消息
    this.worker.onmessage = (event: MessageEvent) => {
      const line: string =
        typeof event.data === 'string' ? event.data : String(event.data);
      this.messageBuffer.push(line);
      // 通知所有等待中的监听器
      for (const listener of this.listeners) {
        listener(line);
      }
    };

    this.worker.onerror = (err) => {
      console.error('[StockfishWorker] Worker error:', err);
    };

    // 发送 UCI 初始化命令并等待 uciok
    await this.sendAndWait('uci', (line) => line === 'uciok');
  }

  /** 检查引擎是否就绪（UCI isready/readyok） */
  async isReady(): Promise<boolean> {
    this.assertWorker();
    try {
      await this.sendAndWait('isready', (line) => line === 'readyok');
      return true;
    } catch {
      return false;
    }
  }

  /** 终止 Worker，释放资源 */
  destroy(): void {
    if (this.worker) {
      this.send('quit');
      this.worker.terminate();
      this.worker = null;
    }
    this.listeners = [];
    this.messageBuffer = [];
  }

  // ---------------------------------------------------------------------------
  // UCI 命令
  // ---------------------------------------------------------------------------

  /** 设置当前局面（UCI position 命令） */
  async setPosition(fen: string): Promise<void> {
    this.assertWorker();
    this.send(`position fen ${fen}`);
    // position 命令没有回复，发 isready 确保已处理
    await this.sendAndWait('isready', (line) => line === 'readyok');
  }

  /**
   * 获取最佳着法
   * @param depth 搜索深度
   * @param timeMs 可选的时间限制（毫秒）
   * @returns UCI 格式着法，例如 "e2e4"
   */
  async getBestMove(depth: number, timeMs?: number): Promise<string> {
    this.assertWorker();

    let goCommand = `go depth ${depth}`;
    if (timeMs !== undefined) {
      goCommand += ` movetime ${timeMs}`;
    }

    const lines = await this.collectUntilBestMove(goCommand);
    const bestMoveLine = lines.find((l) => l.startsWith('bestmove'));
    if (!bestMoveLine) {
      throw new Error('Failed to get bestmove from engine');
    }

    const parts = bestMoveLine.split(/\s+/);
    return parts[1]; // "bestmove e2e4 ponder ..."
  }

  /**
   * 获取前 N 个最佳着法（MultiPV）
   * @param n 返回的着法数量
   * @param depth 搜索深度
   */
  async getTopMoves(n: number, depth: number): Promise<MoveEvaluation[]> {
    this.assertWorker();

    // 设置 MultiPV
    this.send(`setoption name MultiPV value ${n}`);
    await this.sendAndWait('isready', (line) => line === 'readyok');

    const lines = await this.collectUntilBestMove(`go depth ${depth}`);

    // 解析最终深度的 info 行
    const evaluations = this.parseMultiPV(lines, depth);

    // 恢复 MultiPV = 1
    this.send('setoption name MultiPV value 1');
    await this.sendAndWait('isready', (line) => line === 'readyok');

    return evaluations;
  }

  /**
   * 评估指定局面
   * @param fen FEN 字符串
   * @param depth 搜索深度
   * @returns 评估分数（centipawns），正值白方优势
   */
  async evaluate(fen: string, depth: number): Promise<number> {
    await this.setPosition(fen);
    const lines = await this.collectUntilBestMove(`go depth ${depth}`);

    // 取最后一条包含 score 的 info 行
    const infoLines = lines.filter(
      (l) => l.startsWith('info') && l.includes(' score ')
    );
    if (infoLines.length === 0) {
      throw new Error('No evaluation info received from engine');
    }

    const lastInfo = infoLines[infoLines.length - 1];
    return this.parseScore(lastInfo);
  }

  // ---------------------------------------------------------------------------
  // 内部工具方法
  // ---------------------------------------------------------------------------

  /** 向 Worker 发送原始命令 */
  private send(command: string): void {
    this.worker!.postMessage(command);
  }

  /** 确保 Worker 已初始化 */
  private assertWorker(): void {
    if (!this.worker) {
      throw new EngineNotReadyError();
    }
  }

  /**
   * 发送命令并等待满足条件的回复行
   * @param command UCI 命令
   * @param predicate 匹配回复行的判断函数
   */
  private sendAndWait(
    command: string,
    predicate: (line: string) => boolean
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener(listener);
        reject(new EngineTimeoutError(command, this.timeoutMs));
      }, this.timeoutMs);

      const listener = (line: string) => {
        if (predicate(line)) {
          clearTimeout(timer);
          this.removeListener(listener);
          resolve(line);
        }
      };

      this.listeners.push(listener);
      this.send(command);
    });
  }

  /**
   * 发送 go 命令，收集所有输出直到收到 bestmove
   */
  private collectUntilBestMove(goCommand: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      const collected: string[] = [];

      const timer = setTimeout(() => {
        this.removeListener(listener);
        reject(new EngineTimeoutError(goCommand, this.timeoutMs));
      }, this.timeoutMs);

      const listener = (line: string) => {
        collected.push(line);
        if (line.startsWith('bestmove')) {
          clearTimeout(timer);
          this.removeListener(listener);
          resolve(collected);
        }
      };

      this.listeners.push(listener);
      this.send(goCommand);
    });
  }

  /** 移除消息监听器 */
  private removeListener(listener: (line: string) => void): void {
    const idx = this.listeners.indexOf(listener);
    if (idx !== -1) {
      this.listeners.splice(idx, 1);
    }
  }

  /**
   * 解析 MultiPV 输出，提取指定深度的评估结果
   */
  private parseMultiPV(lines: string[], depth: number): MoveEvaluation[] {
    const evaluations: MoveEvaluation[] = [];

    // 从后往前找最终深度的各条 multipv 行
    const infoLines = lines.filter(
      (l) => l.startsWith('info') && l.includes(' multipv ') && l.includes(' pv ')
    );

    // 按 multipv 编号去重，保留最后出现的（最深的）
    const byPV = new Map<number, string>();
    for (const line of infoLines) {
      const pvNum = this.extractInt(line, 'multipv');
      if (pvNum !== null) {
        byPV.set(pvNum, line);
      }
    }

    // 按 multipv 编号排序
    const sortedEntries = [...byPV.entries()].sort((a, b) => a[0] - b[0]);

    for (const [, line] of sortedEntries) {
      const score = this.parseScore(line);
      const lineDepth = this.extractInt(line, 'depth') ?? depth;
      const pvMoves = this.extractPV(line);

      if (pvMoves.length > 0) {
        evaluations.push({
          move: pvMoves[0],
          score,
          depth: lineDepth,
          pv: pvMoves,
        });
      }
    }

    return evaluations;
  }

  /** 从 info 行中解析分数（centipawns），将 mate 转换为大数值 */
  private parseScore(infoLine: string): number {
    const cpMatch = infoLine.match(/score cp (-?\d+)/);
    if (cpMatch) {
      return parseInt(cpMatch[1], 10);
    }

    const mateMatch = infoLine.match(/score mate (-?\d+)/);
    if (mateMatch) {
      const mateIn = parseInt(mateMatch[1], 10);
      // 用 +/-100000 表示将杀，符号表示方向
      return mateIn > 0 ? 100000 - mateIn : -100000 - mateIn;
    }

    return 0;
  }

  /** 从 info 行提取 pv（着法序列） */
  private extractPV(infoLine: string): string[] {
    const pvIndex = infoLine.indexOf(' pv ');
    if (pvIndex === -1) return [];
    const pvPart = infoLine.substring(pvIndex + 4).trim();
    return pvPart.split(/\s+/).filter((s) => s.length > 0);
  }

  /** 从 info 行提取指定关键字后的整数值 */
  private extractInt(infoLine: string, key: string): number | null {
    const regex = new RegExp(`\\b${key}\\s+(\\d+)`);
    const match = infoLine.match(regex);
    return match ? parseInt(match[1], 10) : null;
  }
}
