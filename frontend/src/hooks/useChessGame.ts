/**
 * 对弈 Hook
 *
 * 管理完整的人机对弈流程：初始化、用户走子、AI 走子、计时器、
 * 提示、认输、悔棋等。整合 CharacterEngine 实现个性化 AI 对手。
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import { playMoveSound, playCaptureSound, playCheckSound, playCastleSound } from '@/utils/sounds';
import {
  CharacterEngine,
  CharacterConfig,
  CharacterMove,
  DialogueEvent,
} from '../engine/CharacterEngine';
import { EngineManager } from '../engine/EngineManager';
import {
  createGame,
  getFen,
  getPgn,
  makeMove,
  isGameOver,
  isValidMove,
  uciToSan,
  getCapturedPieces,
  getMaterialBalance,
} from '../utils/chess';
import type {
  PieceColor,
  GameState,
  GameResult,
  MoveInfo,
} from '../types/chess';

// ---------------------------------------------------------------------------
// 初始状态
// ---------------------------------------------------------------------------

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function createInitialGameState(): GameState {
  return {
    fen: INITIAL_FEN,
    pgn: '',
    turn: 'white',
    moveNumber: 1,
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    isDraw: false,
    isGameOver: false,
    capturedPieces: { white: [], black: [] },
    materialBalance: 0,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChessGame() {
  // 棋局状态
  const [gameState, setGameState] = useState<GameState>(createInitialGameState());
  const [characterEngine, setCharacterEngine] = useState<CharacterEngine | null>(null);
  const [dialogueEvent, setDialogueEvent] = useState<DialogueEvent | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [moveHistory, setMoveHistory] = useState<MoveInfo[]>([]);
  const [timer, setTimer] = useState<{ white: number; black: number }>({
    white: 600,
    black: 600,
  });

  // 内部 refs（不触发重渲染）
  const gameRef = useRef<Chess>(createGame());
  const userColorRef = useRef<PieceColor>('white');
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameActiveRef = useRef(false);
  const userRatingRef = useRef(1200);

  // ---------------------------------------------------------------------------
  // 同步 GameState
  // ---------------------------------------------------------------------------

  const syncGameState = useCallback(() => {
    const game = gameRef.current;
    const fen = getFen(game);
    const history = game.history({ verbose: true });
    const lastMoveData = history.length > 0 ? history[history.length - 1] : null;

    const captured = getCapturedPieces(game);
    const balance = getMaterialBalance(game);

    setGameState({
      fen,
      pgn: getPgn(game),
      turn: game.turn() === 'w' ? 'white' : 'black',
      moveNumber: Math.floor(history.length / 2) + 1,
      isCheck: game.inCheck(),
      isCheckmate: game.isCheckmate(),
      isStalemate: game.isStalemate(),
      isDraw: game.isDraw(),
      isGameOver: game.isGameOver(),
      lastMove: lastMoveData
        ? { from: lastMoveData.from, to: lastMoveData.to, san: lastMoveData.san }
        : undefined,
      capturedPieces: captured,
      materialBalance: balance,
    });
  }, []);

  // ---------------------------------------------------------------------------
  // 检测游戏结束
  // ---------------------------------------------------------------------------

  const checkGameEnd = useCallback((): boolean => {
    const result = isGameOver(gameRef.current);
    if (!result.over) return false;

    gameActiveRef.current = false;
    stopTimer();

    let gameResultValue: GameResult;

    if (result.reason === 'checkmate') {
      gameResultValue = {
        winner: result.winner as PieceColor,
        reason: 'checkmate',
      };
    } else if (result.reason === 'stalemate') {
      gameResultValue = { winner: 'draw', reason: 'stalemate' };
    } else if (result.reason === 'repetition') {
      gameResultValue = { winner: 'draw', reason: 'repetition' };
    } else if (result.reason === 'insufficient_material') {
      gameResultValue = { winner: 'draw', reason: 'insufficient' };
    } else {
      gameResultValue = { winner: 'draw', reason: 'fifty_moves' };
    }

    setGameResult(gameResultValue);
    return true;
  }, []);

  // ---------------------------------------------------------------------------
  // 计时器
  // ---------------------------------------------------------------------------

  const startTimer = useCallback(() => {
    stopTimer();
    timerIntervalRef.current = setInterval(() => {
      if (!gameActiveRef.current) return;

      setTimer((prev) => {
        const currentTurn = gameRef.current.turn() === 'w' ? 'white' : 'black';
        const newTimer = { ...prev };
        newTimer[currentTurn] = Math.max(0, newTimer[currentTurn] - 1);

        // 超时判定
        if (newTimer[currentTurn] <= 0) {
          gameActiveRef.current = false;
          const winner: PieceColor = currentTurn === 'white' ? 'black' : 'white';
          setGameResult({ winner, reason: 'timeout' });
          stopTimer();
        }

        return newTimer;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  // 组件卸载时清理计时器
  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, [stopTimer]);

  // ---------------------------------------------------------------------------
  // AI 走子
  // ---------------------------------------------------------------------------

  const makeAiMove = useCallback(async () => {
    if (!characterEngine || !gameActiveRef.current) return;
    if (gameRef.current.isGameOver()) return;

    setIsAiThinking(true);
    setDialogueEvent(null);

    try {
      const prevFen = getFen(gameRef.current);
      const aiMove: CharacterMove = await characterEngine.getMove(
        prevFen,
        userRatingRef.current,
      );

      // 模拟思考时间
      await new Promise((resolve) => setTimeout(resolve, aiMove.thinkTimeMs));

      if (!gameActiveRef.current) return;

      // 执行 AI 走法
      const from = aiMove.uci.substring(0, 2);
      const to = aiMove.uci.substring(2, 4);
      const promotion = aiMove.uci.length > 4 ? aiMove.uci[4] : undefined;

      const success = makeMove(gameRef.current, from, to, promotion);
      if (!success) {
        console.error('[useChessGame] AI move failed:', aiMove.uci);
        return;
      }

      const currentFen = getFen(gameRef.current);

      // 记录走法历史
      const history = gameRef.current.history({ verbose: true });
      const lastMove = history[history.length - 1];
      if (lastMove) {
        const moveInfo: MoveInfo = {
          from: lastMove.from,
          to: lastMove.to,
          san: lastMove.san,
          uci: aiMove.uci,
          captured: lastMove.captured as any,
          isCheck: lastMove.san.includes('+') || lastMove.san.includes('#'),
          isCheckmate: lastMove.san.includes('#'),
        };
        setMoveHistory((prev) => [...prev, moveInfo]);

        // Play sound for AI move
        if (lastMove.san.includes('O-O')) {
          playCastleSound();
        } else if (moveInfo.isCheck) {
          playCheckSound();
        } else if (lastMove.captured) {
          playCaptureSound();
        } else {
          playMoveSound();
        }
      }

      // 同步状态
      syncGameState();

      // 检测对话事件
      const event = characterEngine.getDialogueEvent(
        prevFen,
        currentFen,
        aiMove.uci,
      );
      if (event) {
        setDialogueEvent(event);
      }

      // 检测游戏结束
      checkGameEnd();
    } catch (err) {
      console.error('[useChessGame] AI move error:', err);
    } finally {
      setIsAiThinking(false);
    }
  }, [characterEngine, syncGameState, checkGameEnd]);

  // ---------------------------------------------------------------------------
  // 公开方法
  // ---------------------------------------------------------------------------

  /**
   * 初始化对局
   */
  const startGame = useCallback(
    (characterConfig: CharacterConfig, userColor: PieceColor, timeControl: number) => {
      // 重置棋局
      gameRef.current = createGame();
      userColorRef.current = userColor;
      gameActiveRef.current = true;

      // 初始化引擎
      const engine = new CharacterEngine(characterConfig);
      setCharacterEngine(engine);

      // 重置状态
      setGameResult(null);
      setDialogueEvent(null);
      setMoveHistory([]);
      setIsAiThinking(false);
      setTimer({ white: timeControl, black: timeControl });

      syncGameState();
      startTimer();

      // 如果用户执黑，AI 先走
      if (userColor === 'black') {
        // 延迟触发以确保状态已更新
        setTimeout(() => {
          // makeAiMove 依赖 characterEngine state，但此处直接用 engine 实例
          // 使用 ref 方式在下一个 effect 中触发
        }, 100);
      }
    },
    [syncGameState, startTimer],
  );

  // 当用户执黑时，AI 需要先走 — 通过 effect 监听 characterEngine 变化
  useEffect(() => {
    if (
      characterEngine &&
      userColorRef.current === 'black' &&
      gameActiveRef.current &&
      moveHistory.length === 0
    ) {
      makeAiMove();
    }
  }, [characterEngine, makeAiMove, moveHistory.length]);

  /**
   * 用户走子
   */
  const makeUserMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      if (!gameActiveRef.current) return false;
      if (gameRef.current.isGameOver()) return false;

      // 检查是否轮到用户
      const currentTurn = gameRef.current.turn() === 'w' ? 'white' : 'black';
      if (currentTurn !== userColorRef.current) return false;

      // 验证走法合法性
      if (!isValidMove(gameRef.current, from, to)) return false;

      const prevFen = getFen(gameRef.current);

      // 执行走法
      const success = makeMove(gameRef.current, from, to, promotion);
      if (!success) return false;

      // 记录走法历史
      const history = gameRef.current.history({ verbose: true });
      const lastMove = history[history.length - 1];
      if (lastMove) {
        const uci = `${from}${to}${promotion ?? ''}`;
        const moveInfo: MoveInfo = {
          from: lastMove.from,
          to: lastMove.to,
          san: lastMove.san,
          uci,
          captured: lastMove.captured as any,
          isCheck: lastMove.san.includes('+') || lastMove.san.includes('#'),
          isCheckmate: lastMove.san.includes('#'),
        };
        setMoveHistory((prev) => [...prev, moveInfo]);

        // Play sound for user move
        if (lastMove.san.includes('O-O')) {
          playCastleSound();
        } else if (moveInfo.isCheck) {
          playCheckSound();
        } else if (lastMove.captured) {
          playCaptureSound();
        } else {
          playMoveSound();
        }
      }

      // 同步状态
      syncGameState();

      // 检测对话事件（用户走法可能触发 AI 角色的反应）
      if (characterEngine) {
        const currentFen = getFen(gameRef.current);
        const event = characterEngine.getDialogueEvent(
          prevFen,
          currentFen,
          `${from}${to}${promotion ?? ''}`,
        );
        if (event) {
          // 从 AI 视角转换事件
          const aiEvent = flipDialogueEvent(event);
          if (aiEvent) {
            setDialogueEvent(aiEvent);
          }
        }
      }

      // 检测游戏结束
      if (checkGameEnd()) return true;

      // 触发 AI 走子
      makeAiMove();

      return true;
    },
    [syncGameState, checkGameEnd, makeAiMove, characterEngine],
  );

  /**
   * 获取提示（调用引擎获取当前局面的最佳走法）
   */
  const getHint = useCallback(async (): Promise<{
    from: string;
    to: string;
    san: string;
  }> => {
    const engine = EngineManager.getInstance();
    await engine.ensureReady();

    const fen = getFen(gameRef.current);
    const bestMoveUci = await engine.getBestMove(fen, 12);

    const from = bestMoveUci.substring(0, 2);
    const to = bestMoveUci.substring(2, 4);

    let san: string;
    try {
      san = uciToSan(gameRef.current, bestMoveUci);
    } catch {
      san = bestMoveUci;
    }

    return { from, to, san };
  }, []);

  /**
   * 认输
   */
  const resign = useCallback(() => {
    if (!gameActiveRef.current) return;

    gameActiveRef.current = false;
    stopTimer();

    const winner: PieceColor =
      userColorRef.current === 'white' ? 'black' : 'white';
    setGameResult({ winner, reason: 'resignation' });
  }, [stopTimer]);

  /**
   * 请求悔棋
   * 简化实现：如果 AI 角色的 errorRate 较高（>0.3），则允许悔棋
   */
  const requestTakeback = useCallback((): boolean => {
    if (!gameActiveRef.current) return false;
    if (!characterEngine) return false;

    const config = characterEngine.getConfig();

    // 低难度 AI 允许悔棋
    if (config.errorRate < 0.3) {
      return false;
    }

    // 撤销两步（AI 的一步 + 用户的一步）
    const game = gameRef.current;
    const undone1 = game.undo(); // 撤销 AI 的走法
    const undone2 = game.undo(); // 撤销用户的走法

    if (!undone1 || !undone2) {
      // 恢复
      if (undone1) {
        // 只撤销了一步，需要恢复
        // chess.js 没有 redo，重新走一步
        // 简化处理：如果无法撤销两步则拒绝
        game.move(undone2?.san ?? undone1.san);
      }
      return false;
    }

    // 从历史中移除最后两步
    setMoveHistory((prev) => prev.slice(0, -2));
    syncGameState();

    return true;
  }, [characterEngine, syncGameState]);

  // ---------------------------------------------------------------------------
  // 返回
  // ---------------------------------------------------------------------------

  return {
    gameState,
    isAiThinking,
    dialogueEvent,
    gameResult,
    moveHistory,
    timer,
    startGame,
    makeUserMove,
    getHint,
    resign,
    requestTakeback,
  };
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 从 AI 视角翻转对话事件
 * 用户给将军 → AI 收到将军（check_received）
 */
function flipDialogueEvent(event: DialogueEvent): DialogueEvent | null {
  switch (event) {
    case 'check_given':
      return 'check_received';
    case 'check_received':
      return 'check_given';
    case 'capture_given':
      return 'capture_received';
    case 'capture_received':
      return 'capture_given';
    case 'good_move':
      return 'good_move'; // 用户的好棋
    case 'blunder':
      return 'blunder';
    default:
      return event;
  }
}
