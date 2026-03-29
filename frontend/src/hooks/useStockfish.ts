/**
 * useStockfish -- React Hook
 *
 * 在组件中方便地使用 Stockfish 引擎进行局面评估和着法计算。
 * 内部使用 EngineManager 单例，多个组件共享同一个引擎实例。
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { EngineManager } from '../engine/EngineManager';
import type { MoveEvaluation, EngineStatus } from '../engine/types';

export interface UseStockfishReturn {
  /** 引擎是否已就绪 */
  isReady: boolean;
  /** 引擎是否正在计算 */
  isThinking: boolean;
  /** 引擎当前状态 */
  status: EngineStatus;
  /** 初始化失败的错误信息 */
  error: string | null;
  /** 获取最佳着法 */
  getBestMove: (fen: string, depth?: number) => Promise<string>;
  /** 获取前 N 个最佳着法 */
  getTopMoves: (fen: string, n: number, depth?: number) => Promise<MoveEvaluation[]>;
  /** 评估局面（centipawns） */
  evaluate: (fen: string, depth?: number) => Promise<number>;
}

/** 默认搜索深度 */
const DEFAULT_DEPTH = 18;

export function useStockfish(): UseStockfishReturn {
  const [isReady, setIsReady] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [status, setStatus] = useState<EngineStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<EngineManager | null>(null);

  // 初始化引擎
  useEffect(() => {
    let cancelled = false;

    async function initEngine() {
      try {
        const manager = EngineManager.getInstance();
        engineRef.current = manager;
        setStatus('loading');

        await manager.initialize();

        if (!cancelled) {
          setIsReady(true);
          setStatus('ready');
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Unknown engine error';
          console.error('[useStockfish] Initialization failed:', message);
          setIsReady(false);
          setStatus('error');
          setError(message);
        }
      }
    }

    initEngine();

    // 清理：组件卸载时不销毁单例，只清除本地引用
    return () => {
      cancelled = true;
    };
  }, []);

  /** 获取最佳着法 */
  const getBestMove = useCallback(
    async (fen: string, depth: number = DEFAULT_DEPTH): Promise<string> => {
      if (!engineRef.current) {
        throw new Error('Engine not initialized');
      }
      setIsThinking(true);
      setStatus('busy');
      try {
        const move = await engineRef.current.getBestMove(fen, depth);
        return move;
      } finally {
        setIsThinking(false);
        setStatus(engineRef.current?.getStatus() ?? 'ready');
      }
    },
    []
  );

  /** 获取前 N 个最佳着法 */
  const getTopMoves = useCallback(
    async (
      fen: string,
      n: number,
      depth: number = DEFAULT_DEPTH
    ): Promise<MoveEvaluation[]> => {
      if (!engineRef.current) {
        throw new Error('Engine not initialized');
      }
      setIsThinking(true);
      setStatus('busy');
      try {
        const moves = await engineRef.current.getTopMoves(fen, n, depth);
        return moves;
      } finally {
        setIsThinking(false);
        setStatus(engineRef.current?.getStatus() ?? 'ready');
      }
    },
    []
  );

  /** 评估局面 */
  const evaluate = useCallback(
    async (fen: string, depth: number = DEFAULT_DEPTH): Promise<number> => {
      if (!engineRef.current) {
        throw new Error('Engine not initialized');
      }
      setIsThinking(true);
      setStatus('busy');
      try {
        const score = await engineRef.current.evaluatePosition(fen, depth);
        return score;
      } finally {
        setIsThinking(false);
        setStatus(engineRef.current?.getStatus() ?? 'ready');
      }
    },
    []
  );

  return {
    isReady,
    isThinking,
    status,
    error,
    getBestMove,
    getTopMoves,
    evaluate,
  };
}
