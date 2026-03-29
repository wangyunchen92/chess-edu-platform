import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { puzzlesApi } from '@/api/puzzles'
import { usePuzzleStore } from '@/stores/puzzleStore'
import Chessboard from '@/components/chess/Chessboard'
import Button from '@/components/common/Button'
import Card from '@/components/common/Card'
import { usePaywall } from '@/hooks/usePaywall'
import PaywallModal from '@/components/common/PaywallModal'
import { Chess } from 'chess.js'

/** Check if a move string looks like UCI format (e.g. "e2e4", "h7h8q") */
function looksLikeUci(move: string): boolean {
  return /^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(move)
}

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

interface PuzzleData {
  id: string
  fen: string
  solution: string[]
  theme: string
  difficulty: string
  hint?: string
  explanation?: string
}

const PuzzleSolvePage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const puzzleStore = usePuzzleStore()
  const { message, checkAndBlock } = usePaywall('puzzle')
  const [showPaywall, setShowPaywall] = useState(false)

  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentFen, setCurrentFen] = useState('')
  const [solutionStep, setSolutionStep] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [solved, setSolved] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const [startTime] = useState(Date.now())

  useEffect(() => {
    if (!id) return
    if (checkAndBlock()) {
      setShowPaywall(true)
      setLoading(false)
      return
    }

    setLoading(true)
    puzzlesApi.getPuzzle(id)
      .then((res) => {
        // Unwrap {code, data: {...}} wrapper
        const raw: any = (res.data as any)?.data ?? res.data
        const fen = raw.fen ?? ''
        // Parse solution_moves: could be comma-separated string or array, in SAN or UCI
        let rawMoves: string[] = raw.solution ?? (
          raw.solution_moves
            ? (Array.isArray(raw.solution_moves) ? raw.solution_moves : raw.solution_moves.split(','))
            : []
        )
        rawMoves = rawMoves.map((m: string) => m.trim()).filter(Boolean)
        // Convert SAN to UCI if needed
        const solution = rawMoves.length > 0 && !looksLikeUci(rawMoves[0])
          ? solutionSanToUci(fen, rawMoves)
          : rawMoves
        const puzzleData: PuzzleData = {
          id: raw.id ?? raw.puzzle_code ?? id,
          fen,
          solution,
          theme: raw.theme ?? raw.themes ?? '',
          difficulty: raw.difficulty ?? (raw.difficulty_level ? `Level ${raw.difficulty_level}` : ''),
          hint: raw.hint ?? raw.hint_text ?? undefined,
          explanation: raw.explanation ?? undefined,
        }
        setPuzzle(puzzleData)
        setCurrentFen(puzzleData.fen)
        puzzleStore.setPuzzle(puzzleData.id, puzzleData.fen, puzzleData.solution)
      })
      .catch((err) => {
        console.error('[PuzzleSolvePage] Failed to load puzzle:', err)
        const mock: PuzzleData = {
          id: id,
          fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
          solution: ['h5f7'],
          theme: '将杀',
          difficulty: '入门',
          hint: '白方走，1步杀。找到国王的弱点！',
          explanation: '这是经典的学者将杀（Scholar\'s Mate）。白后移到f7格，同时受到c4主教的保护，黑王无处可逃！',
        }
        setPuzzle(mock)
        setCurrentFen(mock.fen)
        puzzleStore.setPuzzle(mock.id, mock.fen, mock.solution)
      })
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Determine whose turn it is from FEN
  const playerColor = useMemo(() => {
    if (!currentFen) return 'white'
    const parts = currentFen.split(' ')
    return parts[1] === 'w' ? 'white' : 'black'
  }, [currentFen])

  const handleMove = useCallback(
    (from: string, to: string) => {
      if (!puzzle || solved) return

      const userMove = `${from}${to}`
      const expectedMove = puzzle.solution[solutionStep]

      if (userMove === expectedMove) {
        // Correct
        try {
          const chess = new Chess(currentFen)
          chess.move({ from, to })
          const newFen = chess.fen()
          setCurrentFen(newFen)

          if (solutionStep + 1 >= puzzle.solution.length) {
            // Puzzle complete!
            setFeedback('correct')
            setSolved(true)
            puzzleStore.setStatus('solved')
            puzzleStore.incrementStreak()

            puzzlesApi.submitAttempt(puzzle.id, {
              user_moves: puzzle.solution.join(','),
              is_correct: true,
              time_spent_ms: Date.now() - startTime,
              source: 'challenge',
            }).catch((err) => console.error('[PuzzleSolvePage] API error:', err))
          } else {
            // Play opponent response
            setSolutionStep((s) => s + 1)
            setFeedback('correct')
            setTimeout(() => {
              setFeedback(null)
              const opMove = puzzle.solution[solutionStep + 1]
              if (opMove) {
                try {
                  const chess2 = new Chess(newFen)
                  chess2.move({ from: opMove.slice(0, 2), to: opMove.slice(2, 4) })
                  setCurrentFen(chess2.fen())
                  setSolutionStep((s) => s + 1)
                } catch { /* skip */ }
              }
            }, 600)
          }
        } catch {
          setFeedback('wrong')
          setTimeout(() => setFeedback(null), 1200)
        }
      } else {
        // Wrong
        setFeedback('wrong')
        setAttempts((a) => a + 1)
        puzzleStore.resetStreak()
        setTimeout(() => setFeedback(null), 1200)
      }
    },
    [puzzle, currentFen, solutionStep, solved, puzzleStore, startTime],
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-4xl animate-bounce">{'\uD83E\uDDE9'}</div>
      </div>
    )
  }

  if (showPaywall && !puzzle) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PaywallModal open={showPaywall} onClose={() => { setShowPaywall(false); navigate('/puzzles') }} message={message} />
      </div>
    )
  }

  if (!puzzle) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-[var(--text-sub)]">未找到谜题</p>
          <Button variant="secondary" className="mt-4" onClick={() => navigate('/puzzles')}>返回</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} message={message} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
            {'\uD83E\uDDE9'} 解题
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[var(--text-xs)] px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">
              {puzzle.theme}
            </span>
            <span className="text-[var(--text-xs)] px-2 py-0.5 rounded-full bg-[rgba(245,158,11,0.1)] text-[var(--warning)]">
              {puzzle.difficulty}
            </span>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
          返回
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Board - full width on mobile */}
        <div className="flex flex-col items-center gap-3 w-full lg:w-auto">
          <div
            className="w-full max-w-[min(100vw-32px,480px)] lg:w-auto lg:max-w-none"
            style={{
              animation: feedback === 'correct' && solved
                ? 'puzzle-correct 0.6s ease'
                : feedback === 'wrong'
                  ? 'puzzle-wrong 0.4s ease'
                  : 'none',
            }}
          >
            <Chessboard
              fen={currentFen}
              onMove={handleMove}
              getValidMoves={getValidMoves}
              orientation={playerColor === 'black' ? 'black' : 'white'}
              interactive={!solved}
            />
          </div>

          {/* Status line */}
          <div className="text-[var(--text-sm)] text-[var(--text-sub)]">
            {solved ? (
              <span className="text-[var(--success)] font-semibold">{'\u2705'} 正确！</span>
            ) : (
              <span>{playerColor === 'white' ? '白方' : '黑方'}走，请走出正确的一步</span>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* Hint */}
          {puzzle.hint && (
            <Card padding="md">
              <div className="flex items-start gap-2">
                <span className="text-lg shrink-0">{'\uD83D\uDCA1'}</span>
                <div>
                  <button
                    className="text-[var(--text-sm)] font-semibold text-[var(--accent)] hover:underline"
                    onClick={() => setShowHint(!showHint)}
                  >
                    {showHint ? '隐藏提示' : '查看提示'}
                  </button>
                  {showHint && (
                    <p className="text-[var(--text-sm)] text-[var(--text-sub)] mt-1">
                      {puzzle.hint}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Wrong attempts counter */}
          {attempts > 0 && !solved && (
            <div className="text-[var(--text-xs)] text-[var(--text-muted)]">
              已尝试 {attempts} 次，不要放弃！
            </div>
          )}

          {/* Solved panel */}
          {solved && (
            <Card padding="lg">
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl mb-2">{'\uD83C\uDF89'}</div>
                  <h3 className="text-[var(--text-lg)] font-bold text-[var(--success)]">
                    太棒了！
                  </h3>
                  <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">
                    {attempts === 0 ? '一次通过，你是天才！' : `经过 ${attempts} 次尝试，你成功了！`}
                  </p>
                </div>

                {/* AI Explanation */}
                {puzzle.explanation && (
                  <div>
                    <button
                      className="text-[var(--text-sm)] font-semibold text-[var(--accent)] hover:underline"
                      onClick={() => setShowExplanation(!showExplanation)}
                    >
                      {'\uD83E\uDD16'} {showExplanation ? '收起讲解' : 'AI讲解'}
                    </button>
                    {showExplanation && (
                      <p className="text-[var(--text-sm)] text-[var(--text-sub)] mt-2 leading-relaxed p-3 rounded-[var(--radius-sm)] bg-[var(--accent-light)]">
                        {puzzle.explanation}
                      </p>
                    )}
                  </div>
                )}

                <Button variant="primary" className="w-full" onClick={() => navigate(-1)}>
                  下一题
                </Button>
              </div>
            </Card>
          )}

          {/* Feedback flash */}
          {feedback === 'wrong' && (
            <div
              className="p-3 rounded-[var(--radius-sm)] text-center"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <span className="text-[var(--text-sm)] text-[var(--danger)]">
                {'\u274C'} 不对哦，再想想！
              </span>
            </div>
          )}
          {feedback === 'correct' && !solved && (
            <div
              className="p-3 rounded-[var(--radius-sm)] text-center"
              style={{
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.2)',
              }}
            >
              <span className="text-[var(--text-sm)] text-[var(--success)]">
                {'\u2705'} 正确！继续...
              </span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes puzzle-correct {
          0%, 100% { transform: scale(1); }
          30% { transform: scale(1.03); }
          60% { transform: scale(0.98); }
        }
        @keyframes puzzle-wrong {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  )
}

export default PuzzleSolvePage
