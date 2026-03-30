import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { puzzlesApi } from '@/api/puzzles'
import { translateTheme } from '@/utils/puzzleTheme'
import { gamificationApi } from '@/api/gamification'
import { usePuzzleStore } from '@/stores/puzzleStore'
import Chessboard from '@/components/chess/Chessboard'
import Button from '@/components/common/Button'
import Card from '@/components/common/Card'
import { usePaywall } from '@/hooks/usePaywall'
import PaywallModal from '@/components/common/PaywallModal'
import { Chess } from 'chess.js'

/** Convert an array of SAN moves to UCI format, sequentially applying each move */
function solutionSanToUci(fen: string, sanMoves: string[]): string[] {
  const uciMoves: string[] = []
  const chess = new Chess(fen)
  for (const san of sanMoves) {
    try {
      const move = chess.move(san)
      if (!move) break
      uciMoves.push(move.from + move.to + (move.promotion ?? ''))
    } catch {
      break
    }
  }
  return uciMoves
}

/** Check if a move string looks like UCI format (e.g. "e2e4", "h7h8q") */
function looksLikeUci(move: string): boolean {
  return /^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(move)
}

interface DailyPuzzle {
  id: string
  fen: string
  solution: string[] // UCI moves: ["e2e4", "d7d5", ...]
  theme: string
  difficulty: string
  hint?: string
}

const MOCK_DAILY: DailyPuzzle[] = [
  {
    id: 'daily-1',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    solution: ['h5f7'],
    theme: '将杀',
    difficulty: '入门',
    hint: '1步杀，找到将杀的走法',
  },
  {
    id: 'daily-2',
    fen: 'r2qkb1r/ppp2ppp/2n1bn2/3pp3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5',
    solution: ['c4b5', 'c6d4', 'f3d4'],
    theme: '战术',
    difficulty: '初级',
    hint: '利用钉子战术',
  },
  {
    id: 'daily-3',
    fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
    solution: ['e1e8'],
    theme: '残局',
    difficulty: '入门',
    hint: '底线杀！找到将杀的走法',
  },
]

const DailyPuzzlePage: React.FC = () => {
  const navigate = useNavigate()
  const { message } = usePaywall('puzzle')
  const [showPaywall, setShowPaywall] = useState(false)
  const [puzzles, setPuzzles] = useState<DailyPuzzle[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentFen, setCurrentFen] = useState('')
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white')
  const [solutionStep, setSolutionStep] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [puzzleStatus, setPuzzleStatus] = useState<('pending' | 'solved' | 'failed')[]>([])
  const [allDone, setAllDone] = useState(false)
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set())
  const puzzleStore = usePuzzleStore()

  useEffect(() => {
    setLoading(true)
    puzzlesApi.getDailyPuzzles()
      .then((res) => {
        // Handle nested {code, data: {...}} format
        let payload = res.data?.data ?? res.data
        // API may return { puzzles: [...] } or array directly
        // Keep raw wrappers to read attempted/is_correct status
        const rawWrappers: any[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.puzzles)
            ? payload.puzzles
            : []
        // Unwrap to get puzzle data
        const puzzleList = rawWrappers.map((p: any) => p.puzzle ?? p)
        if (puzzleList.length > 0) {
          // Normalize field names from API to match our DailyPuzzle interface
          const normalized = puzzleList.map((p: any) => {
            const fen = p.fen ?? ''
            // Parse solution_moves: could be comma-separated string or array, in SAN or UCI
            let rawMoves: string[] = p.solution ?? (
              p.solution_moves
                ? (Array.isArray(p.solution_moves) ? p.solution_moves : p.solution_moves.split(','))
                : []
            )
            rawMoves = rawMoves.map((m: string) => m.trim()).filter(Boolean)
            // Convert SAN to UCI if needed
            const solution = rawMoves.length > 0 && !looksLikeUci(rawMoves[0])
              ? solutionSanToUci(fen, rawMoves)
              : rawMoves
            return {
              id: p.id ?? p.puzzle_code ?? '',
              fen,
              solution,
              theme: translateTheme(p.theme ?? p.themes ?? ''),
              difficulty: p.difficulty ?? (p.difficulty_level ? `Level ${p.difficulty_level}` : ''),
              hint: p.hint ?? p.hint_text ?? undefined,
            }
          })
          setPuzzles(normalized)
          // Check attempted status from raw API wrapper data (not unwrapped puzzles)
          const statuses = rawWrappers.map((p: any) => {
            if (p.attempted && p.is_correct) return 'solved' as const
            if (p.attempted && p.is_correct === false) return 'failed' as const
            return 'pending' as const
          })
          setPuzzleStatus(statuses)
          // Jump to first unsolved puzzle
          const firstPending = statuses.findIndex(s => s === 'pending')
          if (firstPending >= 0) {
            setCurrentIdx(firstPending)
          } else {
            // All done
            setCurrentIdx(0)
            setAllDone(true)
          }
        } else {
          setPuzzles(MOCK_DAILY)
          setPuzzleStatus(MOCK_DAILY.map(() => 'pending' as const))
        }
      })
      .catch((err) => {
        console.error('[DailyPuzzlePage] Failed to load daily puzzles:', err)
        setPuzzles(MOCK_DAILY)
        setPuzzleStatus(MOCK_DAILY.map(() => 'pending' as const))
      })
      .finally(() => setLoading(false))
  }, [])

  // Set up current puzzle
  useEffect(() => {
    if (puzzles.length > 0 && currentIdx < puzzles.length) {
      const p = puzzles[currentIdx]
      setCurrentFen(p.fen)
      setBoardOrientation(p.fen.split(' ')[1] === 'b' ? 'black' : 'white')
      setSolutionStep(0)
      setFeedback(null)
      puzzleStore.setPuzzle(p.id, p.fen, p.solution)
    }
  }, [currentIdx, puzzles]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentPuzzle = puzzles[currentIdx]

  const handleMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      if (!currentPuzzle || feedback === 'correct') return

      const userMove = `${from}${to}${promotion ?? ''}`
      const expectedBase = currentPuzzle.solution[solutionStep]
      // Match with or without promotion suffix (e7f8q matches e7f8 if user picks queen)
      const isMatch = userMove === expectedBase ||
        (promotion && userMove === expectedBase) ||
        (`${from}${to}` === expectedBase.slice(0, 4) && expectedBase.length > 4)

      if (isMatch) {
        // Correct move
        try {
          const chess = new Chess(currentFen)
          chess.move({ from, to, promotion: (promotion ?? expectedBase[4]) as any })
          setCurrentFen(chess.fen())
        } catch {
          setCurrentFen(currentFen)
        }

        if (solutionStep + 1 >= currentPuzzle.solution.length) {
          // Puzzle solved!
          setFeedback('correct')
          setPuzzleStatus((prev) => {
            const next = [...prev]
            next[currentIdx] = 'solved'
            return next
          })
          puzzleStore.setStatus('solved')
          puzzleStore.incrementStreak()

          // Submit attempt (only once per puzzle)
          if (!submittedIds.has(currentPuzzle.id)) {
            setSubmittedIds(prev => new Set(prev).add(currentPuzzle.id))
            puzzlesApi.submitAttempt(currentPuzzle.id, {
              user_moves: currentPuzzle.solution.slice(0, solutionStep + 1).join(','),
              is_correct: true,
              time_spent_ms: 0,
              source: 'daily',
            })
              .then(() => { gamificationApi.checkAchievements().catch(() => {}) })
              .catch((err) => console.error('[DailyPuzzlePage] API error:', err))
          }
        } else {
          // More steps - play opponent response after delay
          setSolutionStep((s) => s + 1)
          // Auto-play opponent move if there is one
          setTimeout(() => {
            const opMove = currentPuzzle.solution[solutionStep + 1]
            if (opMove) {
              try {
                const chess2 = new Chess(currentFen)
                const ourPromo = (promotion ?? expectedBase[4]) as any
                chess2.move({ from, to, promotion: ourPromo || undefined }) // our move
                const opFrom = opMove.slice(0, 2), opTo = opMove.slice(2, 4)
                const opPromo = opMove.length > 4 ? opMove[4] : undefined
                chess2.move({ from: opFrom, to: opTo, promotion: opPromo as any }) // opponent
                setCurrentFen(chess2.fen())
                setSolutionStep((s) => s + 1)
              } catch {
                // If parsing fails, skip
              }
            }
          }, 600)
        }
      } else {
        // Wrong move
        setFeedback('wrong')
        puzzleStore.resetStreak()
        setTimeout(() => setFeedback(null), 1500)
      }
    },
    [currentPuzzle, currentFen, solutionStep, feedback, currentIdx, puzzleStore],
  )

  const getValidMoves = useCallback(
    (square: string): string[] => {
      try {
        const chess = new Chess(currentFen)
        const moves = chess.moves({ square: square as any, verbose: true })
        return moves.map((m) => m.to)
      } catch {
        return []
      }
    },
    [currentFen],
  )

  const goNext = useCallback(() => {
    if (currentIdx + 1 < puzzles.length) {
      setCurrentIdx((i) => i + 1)
    } else {
      setAllDone(true)
    }
  }, [currentIdx, puzzles.length])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-bounce">{'\uD83E\uDDE9'}</div>
          <p className="text-[var(--text-sub)]">加载谜题...</p>
        </div>
      </div>
    )
  }

  if (allDone) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card padding="lg" hoverable={false}>
          <div className="text-center space-y-4 py-4">
            <div className="text-5xl">{'\uD83C\uDF89\uD83C\uDFC6\uD83C\uDF89'}</div>
            <h2 className="text-[var(--text-xl)] font-bold text-[var(--text)]">
              今日谜题全部完成！
            </h2>
            <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
              完成 {puzzleStatus.filter((s) => s === 'solved').length}/{puzzles.length} 道谜题，太棒了！
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => navigate('/puzzles')}>
                返回谜题中心
              </Button>
              <Button variant="primary" onClick={() => navigate('/puzzles/challenge')}>
                继续闯关
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} message={message} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
            {'\u2600\uFE0F'} 每日谜题
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--text-sub)] mt-1">
            第 {currentIdx + 1}/{puzzles.length} 题
          </p>
        </div>
        {/* Progress dots */}
        <div className="flex gap-2">
          {puzzleStatus.map((s, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full transition-colors"
              style={{
                background: s === 'solved'
                  ? 'var(--success)'
                  : s === 'failed'
                    ? 'var(--danger)'
                    : i === currentIdx
                      ? 'var(--accent)'
                      : 'var(--border)',
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Board */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="relative"
            style={{
              animation: feedback === 'correct'
                ? 'puzzle-correct 0.5s ease'
                : feedback === 'wrong'
                  ? 'puzzle-wrong 0.4s ease'
                  : 'none',
            }}
          >
            <Chessboard
              fen={currentFen}
              onMove={handleMove}
              getValidMoves={getValidMoves}
              orientation={boardOrientation}
              interactive={feedback !== 'correct'}
            />
            {/* Feedback overlay */}
            {feedback && (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{
                  background: feedback === 'correct'
                    ? 'rgba(16,185,129,0.15)'
                    : 'rgba(239,68,68,0.15)',
                  borderRadius: 8,
                }}
              >
                <span className="text-6xl">
                  {feedback === 'correct' ? '\uD83C\uDF89' : '\u274C'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Info panel */}
        <div className="flex-1 space-y-4 min-w-0">
          <Card padding="md">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[var(--text-xs)] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: boardOrientation === 'white' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)',
                    color: boardOrientation === 'white' ? '#333' : '#fff',
                    border: '1px solid var(--border)',
                  }}
                >
                  {boardOrientation === 'white' ? '⬜ 白方走' : '⬛ 黑方走'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">{'\uD83D\uDCA1'}</span>
                <span className="text-[var(--text-sm)] font-semibold text-[var(--text)]">
                  {currentPuzzle?.hint ?? '找到最佳走法'}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-[var(--text-xs)] px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">
                  {currentPuzzle?.theme}
                </span>
                <span className="text-[var(--text-xs)] px-2 py-0.5 rounded-full bg-[rgba(245,158,11,0.1)] text-[var(--warning)]">
                  {currentPuzzle?.difficulty}
                </span>
              </div>
            </div>
          </Card>

          {feedback === 'correct' && (
            <Card padding="md">
              <div className="text-center space-y-3">
                <div className="text-2xl">{'\uD83C\uDF1F'}</div>
                <p className="text-[var(--text-md)] font-bold text-[var(--success)]">
                  回答正确！太厉害了！
                </p>
                <Button variant="primary" className="w-full" onClick={goNext}>
                  {currentIdx + 1 < puzzles.length ? '下一题' : '查看结果'}
                </Button>
              </div>
            </Card>
          )}

          {feedback === 'wrong' && (
            <Card padding="md">
              <div className="text-center space-y-2">
                <p className="text-[var(--text-sm)] text-[var(--danger)]">
                  不对哦，再想想看！
                </p>
                <p className="text-[var(--text-xs)] text-[var(--text-muted)]">
                  提示：{currentPuzzle?.hint}
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      <style>{`
        @keyframes puzzle-correct {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        @keyframes puzzle-wrong {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  )
}

export default DailyPuzzlePage
