import { useEffect, useRef, useState } from 'react'
import { EngineManager } from '@/engine'

const TIMEOUT_MS = 8000
const MAX_ATTEMPTS = 2

/**
 * Hook that triggers the Stockfish engine to pick a move whenever
 * `enabled` becomes true and `fen` is the current board state. Calls
 * `onMove(uci)` once per AI turn.
 *
 * Behavior:
 * - If fen or enabled changes, any in-flight call is cancelled (its
 *   result is discarded).
 * - Retries once on failure; after two failures, surfaces an error.
 * - 8s per-attempt timeout.
 */
export function useAiOpponent(
  fen: string,
  enabled: boolean,
  onMove: (uci: string) => void,
  depth = 18,
): { thinking: boolean; error: string | null } {
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tokenRef = useRef(0)
  const onMoveRef = useRef(onMove)

  // Keep the callback reference fresh without causing the effect to re-run
  onMoveRef.current = onMove

  useEffect(() => {
    if (!enabled) {
      setThinking(false)
      return
    }

    const token = ++tokenRef.current
    setThinking(true)
    setError(null)

    const run = async () => {
      try {
        const engine = EngineManager.getInstance()
        await engine.ensureReady()

        let lastErr: unknown = null
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          try {
            const move = await Promise.race<string>([
              engine.getBestMove(fen, depth),
              new Promise<string>((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS),
              ),
            ])
            if (tokenRef.current !== token) return // stale
            onMoveRef.current(move)
            setThinking(false)
            return
          } catch (e) {
            lastErr = e
          }
        }
        throw lastErr ?? new Error('AI 走子失败')
      } catch (e) {
        if (tokenRef.current !== token) return
        const msg = e instanceof Error ? e.message : 'AI 走子失败'
        setError(msg === 'timeout' ? 'AI 超时' : 'AI 走子失败')
        setThinking(false)
      }
    }

    void run()

    return () => {
      // Bumping the token on cleanup invalidates the in-flight promise
      tokenRef.current++
    }
  }, [fen, enabled, depth])

  return { thinking, error }
}
