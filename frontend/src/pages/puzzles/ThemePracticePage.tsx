import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { puzzlesApi } from '@/api/puzzles'
import type { PuzzleItem } from '@/types/api'
import Chessboard from '@/components/chess/Chessboard'
import Button from '@/components/common/Button'
import Card from '@/components/common/Card'
import Modal from '@/components/common/Modal'
import Loading from '@/components/common/Loading'
import ProgressBar from '@/components/common/ProgressBar'
import InsufficientCreditsModal from '@/components/common/InsufficientCreditsModal'
import { useCreditStore } from '@/stores/creditStore'
import { Chess } from 'chess.js'

const THEME_PUZZLE_COST = 20

// Theme name mapping
const THEME_NAMES: Record<string, string> = {
  fork: '双攻',
  pin: '牵制',
  skewer: '串击',
  discoveredAttack: '闪击',
  doubleCheck: '双将',
  hangingPiece: '悬子',
  trappedPiece: '困子',
  mateIn1: '一步杀',
  mateIn2: '两步杀',
  mateIn3: '三步杀',
  backRankMate: '底线杀',
  smotheredMate: '闷杀',
  hookMate: '钩杀',
  mate: '将杀',
  sacrifice: '弃子',
  deflection: '引离',
  decoy: '引入',
  intermezzo: '中间着',
  quietMove: '安静着',
  xRayAttack: 'X光攻击',
  capturingDefender: '吃掉防守者',
  pawnEndgame: '兵残局',
  rookEndgame: '车残局',
  queenEndgame: '后残局',
  bishopEndgame: '象残局',
  knightEndgame: '马残局',
  endgame: '残局',
}

/** Check if a move string looks like UCI format */
function looksLikeUci(move: string): boolean {
  return /^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(move)
}

/** Convert an array of SAN moves to UCI format */
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

interface ParsedPuzzle {
  id: string
  fen: string
  solution: string[]
}

function parsePuzzleData(raw: PuzzleItem): ParsedPuzzle {
  const fen = raw.fen ?? ''
  let rawMoves: string[] = []
  if (raw.solution_moves) {
    rawMoves = Array.isArray(raw.solution_moves)
      ? raw.solution_moves
      : (raw.solution_moves as string).split(',')
  }
  rawMoves = rawMoves.map((m: string) => m.trim()).filter(Boolean)
  const solution = rawMoves.length > 0 && !looksLikeUci(rawMoves[0])
    ? solutionSanToUci(fen, rawMoves)
    : rawMoves
  return {
    id: raw.id ?? raw.puzzle_code ?? '',
    fen,
    solution,
  }
}

const ThemePracticePage: React.FC = () => {
  const { theme } = useParams<{ theme: string }>()
  const navigate = useNavigate()

  const [puzzles, setPuzzles] = useState<ParsedPuzzle[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Puzzle solving state
  const [currentFen, setCurrentFen] = useState('')
  const [solutionStep, setSolutionStep] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [puzzleSolved, setPuzzleSolved] = useState(false)
  const [puzzleFailed, setPuzzleFailed] = useState(false)
  const startTimeRef = useRef(Date.now())

  // Session stats
  const [totalAttempted, setTotalAttempted] = useState(0)
  const [totalCorrect, setTotalCorrect] = useState(0)
  const [showExitModal, setShowExitModal] = useState(false)

  // Credits
  const creditBalance = useCreditStore((s) => s.balance)
  const fetchBalance = useCreditStore((s) => s.fetchBalance)
  const deductCredits = useCreditStore((s) => s.deduct)
  const [showCreditsModal, setShowCreditsModal] = useState(false)

  const themeName = theme ? (THEME_NAMES[theme] || theme) : '未知主题'

  // Fetch credit balance on mount
  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  // Load puzzles
  const loadPuzzles = useCallback(async (isInitial: boolean) => {
    if (!theme) return
    if (isInitial) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }
    setError(null)
    try {
      const res = await puzzlesApi.getThemePuzzles(theme, 10)
      const payload: any = (res.data as any)?.data ?? res.data
      const list: PuzzleItem[] = Array.isArray(payload) ? payload : (payload?.items ?? payload?.puzzles ?? [])
      if (list.length === 0) {
        if (isInitial) {
          setError('该主题暂无题目')
        }
        return
      }
      const parsed = list.map(parsePuzzleData).filter((p) => p.solution.length > 0)
      if (parsed.length === 0) {
        if (isInitial) {
          setError('该主题暂无可用题目')
        }
        return
      }
      if (isInitial) {
        setPuzzles(parsed)
        setCurrentIndex(0)
      } else {
        setPuzzles((prev) => [...prev, ...parsed])
      }
    } catch (err) {
      console.error('[ThemePracticePage] Failed to load puzzles:', err)
      if (isInitial) {
        setError('加载题目失败，请稍后重试')
      }
    } finally {
      if (isInitial) {
        setLoading(false)
      } else {
        setLoadingMore(false)
      }
    }
  }, [theme])

  useEffect(() => {
    loadPuzzles(true)
  }, [loadPuzzles])

  // Initialize current puzzle
  const currentPuzzle = puzzles[currentIndex] ?? null

  useEffect(() => {
    if (!currentPuzzle) return
    setCurrentFen(currentPuzzle.fen)
    setSolutionStep(0)
    setFeedback(null)
    setPuzzleSolved(false)
    setPuzzleFailed(false)
    startTimeRef.current = Date.now()
  }, [currentPuzzle])

  // Player color from initial FEN
  const playerColor = useMemo(() => {
    if (!currentPuzzle?.fen) return 'white'
    const parts = currentPuzzle.fen.split(' ')
    return parts[1] === 'w' ? 'white' : 'black'
  }, [currentPuzzle?.fen])

  const handleMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      if (!currentPuzzle || puzzleSolved || puzzleFailed) return

      // Check credits on first move of this puzzle
      if (solutionStep === 0) {
        const currentBalance = useCreditStore.getState().balance
        if (currentBalance < THEME_PUZZLE_COST) {
          setShowCreditsModal(true)
          return
        }
      }

      const userMove = `${from}${to}${promotion ?? ''}`
      const expectedMove = currentPuzzle.solution[solutionStep]
      if (!expectedMove) return

      const isMatch = userMove === expectedMove ||
        (`${from}${to}` === expectedMove.slice(0, 4) && expectedMove.length > 4)

      if (isMatch) {
        // Correct move
        try {
          const chess = new Chess(currentFen)
          chess.move({ from, to, promotion: (promotion ?? expectedMove[4]) as any })
          const newFen = chess.fen()
          setCurrentFen(newFen)

          if (solutionStep + 1 >= currentPuzzle.solution.length) {
            // Puzzle complete!
            setFeedback('correct')
            setPuzzleSolved(true)
            setTotalAttempted((a) => a + 1)
            setTotalCorrect((c) => c + 1)

            deductCredits(THEME_PUZZLE_COST)
            puzzlesApi.submitAttempt(currentPuzzle.id, {
              user_moves: currentPuzzle.solution.join(','),
              is_correct: true,
              time_spent_ms: Date.now() - startTimeRef.current,
              source: 'theme',
            }).catch((err) => console.error('[ThemePracticePage] API error:', err))
          } else {
            // Play opponent response
            setSolutionStep((s) => s + 1)
            setFeedback('correct')
            setTimeout(() => {
              setFeedback(null)
              const opMove = currentPuzzle.solution[solutionStep + 1]
              if (opMove) {
                try {
                  const chess2 = new Chess(newFen)
                  const opPromo = opMove.length > 4 ? opMove[4] : undefined
                  chess2.move({ from: opMove.slice(0, 2), to: opMove.slice(2, 4), promotion: opPromo as any })
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
        // Wrong move
        setFeedback('wrong')
        setPuzzleFailed(true)
        setTotalAttempted((a) => a + 1)

        deductCredits(THEME_PUZZLE_COST)
        puzzlesApi.submitAttempt(currentPuzzle.id, {
          user_moves: userMove,
          is_correct: false,
          time_spent_ms: Date.now() - startTimeRef.current,
          source: 'theme',
        }).catch((err) => console.error('[ThemePracticePage] API error:', err))

        setTimeout(() => setFeedback(null), 1200)
      }
    },
    [currentPuzzle, currentFen, solutionStep, puzzleSolved, puzzleFailed],
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

  const goToNextPuzzle = useCallback(() => {
    const nextIndex = currentIndex + 1
    // If we're near the end, load more
    if (nextIndex >= puzzles.length - 2) {
      loadPuzzles(false)
    }
    if (nextIndex < puzzles.length) {
      setCurrentIndex(nextIndex)
    } else {
      // Wait for more to load
      loadPuzzles(false).then(() => {
        setCurrentIndex(nextIndex)
      })
    }
  }, [currentIndex, puzzles.length, loadPuzzles])

  const handleExit = () => {
    setShowExitModal(true)
  }

  const confirmExit = () => {
    setShowExitModal(false)
    navigate('/puzzles/themes')
  }

  const accuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0

  if (loading) {
    return <Loading size="lg" text={`加载${themeName}题目...`} />
  }

  if (error) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
            {themeName}
          </h1>
          <Button variant="secondary" size="sm" onClick={() => navigate('/puzzles/themes')}>
            返回
          </Button>
        </div>
        <Card padding="lg" hoverable={false}>
          <div className="text-center space-y-3">
            <div className="text-4xl">{'\uD83D\uDE1E'}</div>
            <p className="text-[var(--text-sub)]">{error}</p>
            <Button variant="primary" size="sm" onClick={() => loadPuzzles(true)}>
              重新加载
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-[var(--text-lg)] font-bold text-[var(--text)]">
              {themeName}
            </h1>
            <span className="inline-flex items-center gap-1 text-[var(--text-xs)] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
              {'\uD83D\uDCB0'} 每题消耗 {THEME_PUZZLE_COST} 积分
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
              第 {totalAttempted + 1} 题
            </span>
            {totalAttempted > 0 && (
              <span className="text-[var(--text-xs)] font-semibold" style={{
                color: accuracy >= 80 ? 'var(--success)' : accuracy >= 50 ? 'var(--warning)' : 'var(--danger)'
              }}>
                正确率 {accuracy}%
              </span>
            )}
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExit}>
          退出
        </Button>
      </div>

      {/* Session progress bar */}
      {totalAttempted > 0 && (
        <ProgressBar value={totalCorrect} max={totalAttempted} height={4} />
      )}

      {/* Board + controls */}
      {currentPuzzle && (
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Board */}
          <div className="flex flex-col items-center gap-3 w-full lg:w-auto">
            <div
              className="w-full max-w-[min(100vw-32px,480px)] lg:w-auto lg:max-w-none"
              style={{
                animation: feedback === 'wrong'
                  ? 'theme-wrong 0.4s ease'
                  : 'none',
              }}
            >
              <Chessboard
                fen={currentFen}
                onMove={handleMove}
                getValidMoves={getValidMoves}
                orientation={playerColor === 'black' ? 'black' : 'white'}
                interactive={!puzzleSolved && !puzzleFailed}
              />
            </div>

            {/* Status line */}
            <div className="text-[var(--text-sm)] text-[var(--text-sub)]">
              {puzzleSolved ? (
                <span className="text-[var(--success)] font-semibold">{'\u2705'} 正确！</span>
              ) : puzzleFailed ? (
                <span className="text-[var(--danger)] font-semibold">{'\u274C'} 答错了</span>
              ) : (
                <span>{playerColor === 'white' ? '白方' : '黑方'}走，找到最佳走法</span>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="flex-1 space-y-4 min-w-0 w-full lg:w-auto">
            {/* Stats card */}
            <Card padding="md" hoverable={false}>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-[var(--text-lg)] font-bold text-[var(--text)]">
                    {totalAttempted}
                  </div>
                  <div className="text-[var(--text-xs)] text-[var(--text-muted)]">已做</div>
                </div>
                <div>
                  <div className="text-[var(--text-lg)] font-bold text-[var(--success)]">
                    {totalCorrect}
                  </div>
                  <div className="text-[var(--text-xs)] text-[var(--text-muted)]">正确</div>
                </div>
                <div>
                  <div className="text-[var(--text-lg)] font-bold" style={{
                    color: accuracy >= 80 ? 'var(--success)' : accuracy >= 50 ? 'var(--warning)' : totalAttempted > 0 ? 'var(--danger)' : 'var(--text)'
                  }}>
                    {totalAttempted > 0 ? `${accuracy}%` : '-'}
                  </div>
                  <div className="text-[var(--text-xs)] text-[var(--text-muted)]">正确率</div>
                </div>
              </div>
            </Card>

            {/* Feedback + Next button */}
            {feedback === 'correct' && !puzzleSolved && (
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

            {puzzleSolved && (
              <Card padding="lg" hoverable={false}>
                <div className="text-center space-y-3">
                  <div className="text-3xl">{'\uD83C\uDF89'}</div>
                  <p className="text-[var(--text-md)] font-bold text-[var(--success)]">
                    太棒了！
                  </p>
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={goToNextPuzzle}
                    disabled={loadingMore}
                  >
                    {loadingMore ? '加载中...' : '下一题'}
                  </Button>
                </div>
              </Card>
            )}

            {puzzleFailed && (
              <Card padding="lg" hoverable={false}>
                <div className="text-center space-y-3">
                  <div className="text-3xl">{'\uD83D\uDE14'}</div>
                  <p className="text-[var(--text-md)] font-bold text-[var(--danger)]">
                    没关系，继续加油！
                  </p>
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={goToNextPuzzle}
                    disabled={loadingMore}
                  >
                    {loadingMore ? '加载中...' : '下一题'}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Loading more indicator */}
      {loadingMore && !puzzleSolved && !puzzleFailed && (
        <div className="text-center py-4">
          <p className="text-[var(--text-muted)] text-sm">加载更多题目...</p>
        </div>
      )}

      {/* Exit statistics modal */}
      <Modal
        open={showExitModal}
        onClose={() => setShowExitModal(false)}
        title="训练统计"
      >
        <div className="space-y-5">
          <div className="text-center">
            <div className="text-4xl mb-3">
              {accuracy >= 80 ? '\uD83C\uDF1F' : accuracy >= 50 ? '\uD83D\uDC4D' : '\uD83D\uDCAA'}
            </div>
            <h3 className="text-[var(--text-lg)] font-bold text-[var(--text)]">
              {themeName} 训练完成
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
                {totalAttempted}
              </div>
              <div className="text-[var(--text-xs)] text-[var(--text-muted)]">做题数</div>
            </div>
            <div>
              <div className="text-[var(--text-2xl)] font-bold text-[var(--success)]">
                {totalCorrect}
              </div>
              <div className="text-[var(--text-xs)] text-[var(--text-muted)]">正确数</div>
            </div>
            <div>
              <div className="text-[var(--text-2xl)] font-bold" style={{
                color: accuracy >= 80 ? 'var(--success)' : accuracy >= 50 ? 'var(--warning)' : totalAttempted > 0 ? 'var(--danger)' : 'var(--text)'
              }}>
                {totalAttempted > 0 ? `${accuracy}%` : '-'}
              </div>
              <div className="text-[var(--text-xs)] text-[var(--text-muted)]">正确率</div>
            </div>
          </div>

          {totalAttempted > 0 && (
            <ProgressBar value={totalCorrect} max={totalAttempted} height={8} />
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowExitModal(false)}
            >
              继续训练
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={confirmExit}
            >
              返回主题列表
            </Button>
          </div>
        </div>
      </Modal>

      {/* Insufficient credits modal */}
      <InsufficientCreditsModal
        open={showCreditsModal}
        onClose={() => setShowCreditsModal(false)}
        required={THEME_PUZZLE_COST}
        balance={creditBalance}
      />

      <style>{`
        @keyframes theme-wrong {
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

export default ThemePracticePage
