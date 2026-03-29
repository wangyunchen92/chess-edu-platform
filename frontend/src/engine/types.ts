/**
 * 引擎相关类型定义
 */

/** 引擎对单步着法的评估 */
export interface MoveEvaluation {
  /** UCI 格式着法，例如 "e2e4" */
  move: string;
  /** 评估分数，单位 centipawn（厘兵），正值白方优势 */
  score: number;
  /** 搜索深度 */
  depth: number;
  /** 主要变化线（principal variation），UCI 格式着法序列 */
  pv: string[];
}

/** 引擎运行状态 */
export type EngineStatus = 'idle' | 'loading' | 'ready' | 'busy' | 'error';

/** 引擎配置 */
export interface EngineConfig {
  /** Worker 脚本路径 */
  workerPath?: string;
  /** 默认搜索深度 */
  defaultDepth?: number;
  /** 命令超时时间（毫秒） */
  timeoutMs?: number;
}

/** 引擎命令超时错误 */
export class EngineTimeoutError extends Error {
  constructor(command: string, timeoutMs: number) {
    super(`Engine command "${command}" timed out after ${timeoutMs}ms`);
    this.name = 'EngineTimeoutError';
  }
}

/** 引擎未就绪错误 */
export class EngineNotReadyError extends Error {
  constructor() {
    super('Engine is not ready. Call init() or ensureReady() first.');
    this.name = 'EngineNotReadyError';
  }
}
