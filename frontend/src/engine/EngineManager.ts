/**
 * 引擎管理器 -- 单例模式
 *
 * 管理 StockfishWorker 的生命周期，对外提供简洁的评估接口。
 * 整个应用共享一个引擎实例，避免重复加载 WASM。
 */

import { StockfishWorker } from './StockfishWorker';
import {
  MoveEvaluation,
  EngineStatus,
  EngineConfig,
  EngineNotReadyError,
} from './types';

/** 默认搜索深度 */
const DEFAULT_DEPTH = 18;

export class EngineManager {
  // 单例
  private static instance: EngineManager | null = null;

  private engine: StockfishWorker | null = null;
  private status: EngineStatus = 'idle';
  private config: Required<EngineConfig>;

  private constructor(config?: EngineConfig) {
    this.config = {
      workerPath: config?.workerPath ?? '/stockfish/stockfish-worker.js',
      defaultDepth: config?.defaultDepth ?? DEFAULT_DEPTH,
      timeoutMs: config?.timeoutMs ?? 30_000,
    };
  }

  /** 获取单例实例 */
  static getInstance(config?: EngineConfig): EngineManager {
    if (!EngineManager.instance) {
      EngineManager.instance = new EngineManager(config);
    }
    return EngineManager.instance;
  }

  /** 重置单例（仅用于测试） */
  static resetInstance(): void {
    if (EngineManager.instance) {
      EngineManager.instance.dispose();
      EngineManager.instance = null;
    }
  }

  // ---------------------------------------------------------------------------
  // 生命周期
  // ---------------------------------------------------------------------------

  /** 创建并初始化 Worker */
  async initialize(): Promise<void> {
    if (this.status === 'ready') {
      return; // 已就绪
    }
    if (this.status === 'loading') {
      // 正在加载中，等待就绪
      await this.waitForReady();
      return;
    }

    this.status = 'loading';

    try {
      this.engine = new StockfishWorker(
        this.config.workerPath,
        this.config.timeoutMs
      );
      await this.engine.init();

      const ready = await this.engine.isReady();
      if (!ready) {
        throw new Error('Engine failed isready check after init');
      }

      this.status = 'ready';
    } catch (err) {
      this.status = 'error';
      this.engine?.destroy();
      this.engine = null;
      throw err;
    }
  }

  /** 确保引擎就绪，如果尚未初始化则自动初始化 */
  async ensureReady(): Promise<void> {
    if (this.status === 'ready' || this.status === 'busy') {
      return;
    }
    if (this.status === 'loading') {
      await this.waitForReady();
      return;
    }
    // idle 或 error 状态，尝试（重新）初始化
    await this.initialize();
  }

  /** 获取当前引擎状态 */
  getStatus(): EngineStatus {
    return this.status;
  }

  /** 清理资源，销毁 Worker */
  dispose(): void {
    this.engine?.destroy();
    this.engine = null;
    this.status = 'idle';
  }

  // ---------------------------------------------------------------------------
  // 评估接口
  // ---------------------------------------------------------------------------

  /**
   * 获取指定局面的最佳着法
   * @param fen 局面 FEN
   * @param depth 搜索深度，默认使用配置值
   */
  async getBestMove(fen: string, depth?: number): Promise<string> {
    await this.ensureReady();
    this.assertEngine();

    const d = depth ?? this.config.defaultDepth;
    this.status = 'busy';

    try {
      await this.engine!.setPosition(fen);
      const move = await this.engine!.getBestMove(d);
      return move;
    } catch (err) {
      throw err;
    } finally {
      if (this.engine) {
        this.status = 'ready';
      }
    }
  }

  /**
   * 获取指定局面的前 N 个最佳着法
   * @param fen 局面 FEN
   * @param n 返回的着法数量
   * @param depth 搜索深度
   */
  async getTopMoves(
    fen: string,
    n: number,
    depth?: number
  ): Promise<MoveEvaluation[]> {
    await this.ensureReady();
    this.assertEngine();

    const d = depth ?? this.config.defaultDepth;
    this.status = 'busy';

    try {
      await this.engine!.setPosition(fen);
      const moves = await this.engine!.getTopMoves(n, d);
      return moves;
    } catch (err) {
      throw err;
    } finally {
      if (this.engine) {
        this.status = 'ready';
      }
    }
  }

  /**
   * 评估指定局面
   * @param fen 局面 FEN
   * @param depth 搜索深度
   * @returns centipawns 评估值，正值白方优势
   */
  async evaluatePosition(fen: string, depth?: number): Promise<number> {
    await this.ensureReady();
    this.assertEngine();

    const d = depth ?? this.config.defaultDepth;
    this.status = 'busy';

    try {
      const score = await this.engine!.evaluate(fen, d);
      return score;
    } catch (err) {
      throw err;
    } finally {
      if (this.engine) {
        this.status = 'ready';
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 内部方法
  // ---------------------------------------------------------------------------

  private assertEngine(): void {
    if (!this.engine) {
      throw new EngineNotReadyError();
    }
  }

  /** 轮询等待引擎就绪（用于并发初始化场景） */
  private waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const maxWait = this.config.timeoutMs;
      const interval = 100;
      let waited = 0;

      const check = () => {
        if (this.status === 'ready' || this.status === 'busy') {
          resolve();
        } else if (this.status === 'error') {
          reject(new Error('Engine initialization failed'));
        } else if (waited >= maxWait) {
          reject(new Error('Timed out waiting for engine to be ready'));
        } else {
          waited += interval;
          setTimeout(check, interval);
        }
      };

      check();
    });
  }
}
