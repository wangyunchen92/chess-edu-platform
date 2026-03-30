import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { playApi } from '@/api/play'
import Chessboard from '@/components/chess/Chessboard'
import Button from '@/components/common/Button'
import Card from '@/components/common/Card'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewMove {
  san: string
  fen: string
  from: string
  to: string
  eval?: number        // centipawn evaluation
  annotation?: 'brilliant' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'
  comment?: string     // AI review comment
}

interface ReviewData {
  id: string
  white: string
  black: string
  result: string
  moves: ReviewMove[]
  summary?: string
}

const ANNOTATION_STYLES: Record<string, { label: string; color: string; emoji: string }> = {
  brilliant:   { label: '精妙', color: '#10b981', emoji: '!!' },
  good:        { label: '好棋', color: '#3b82f6', emoji: '!' },
  inaccuracy:  { label: '不精确', color: '#f59e0b', emoji: '?!' },
  mistake:     { label: '失误', color: '#f97316', emoji: '?' },
  blunder:     { label: '严重失误', color: '#ef4444', emoji: '??' },
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [review, setReview] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(0) // 0 = initial position
  const [isPlaying, setIsPlaying] = useState(false)

  // Fetch review data
  useEffect(() => {
    if (!id) return
    setLoading(true)
    // Try review data first, then fall back to game detail for PGN replay
    playApi.getGameReview(id)
      .then(async (res) => {
        const payload: any = (res.data as any)?.data ?? res.data
        const reviewPayload = payload?.review_data ?? payload
        if (reviewPayload && reviewPayload.moves && reviewPayload.moves.length > 0) {
          setReview(reviewPayload)
          setCurrentStep(0)
          return
        }

        // No review_data — try to rebuild from game PGN
        const gameRes = await playApi.getGameDetail(id)
        const gameData: any = (gameRes.data as any)?.data ?? gameRes.data
        const pgn = gameData?.pgn ?? ''
        const charName = gameData?.character_name ?? gameData?.character_id ?? '对手'

        if (pgn) {
          // Parse PGN into moves with chess.js
          const { Chess } = await import('chess.js')
          const chess = new Chess()
          chess.loadPgn(pgn)
          const history = chess.history({ verbose: true })

          // Rebuild FEN at each step
          const replayChess = new Chess()
          const moves: ReviewMove[] = history.map((h) => {
            replayChess.move(h.san)
            return {
              san: h.san,
              fen: replayChess.fen(),
              from: h.from,
              to: h.to,
            }
          })

          setReview({
            id: id,
            white: '你',
            black: charName,
            result: gameData?.result === 'win' ? '1-0' : gameData?.result === 'loss' ? '0-1' : '1/2',
            moves,
            summary: `共${moves.length}步，${gameData?.result === 'win' ? '你赢了！' : gameData?.result === 'loss' ? '对手获胜' : '和棋'}`,
          })
        } else {
          throw new Error('No PGN data')
        }
        setCurrentStep(0)
      })
      .catch((err) => {
        console.error('[ReviewPage] Failed to load review:', err)
        setReview({
          id: id ?? 'unknown',
          white: '你',
          black: '对手',
          result: '?',
          summary: '暂无复盘数据。请下一盘新棋后再来复盘。',
          moves: [],
        })
      })
      .finally(() => setLoading(false))
  }, [id])

  const currentFen = useMemo(() => {
    if (!review || currentStep === 0) return INITIAL_FEN
    return review.moves[currentStep - 1]?.fen ?? INITIAL_FEN
  }, [review, currentStep])

  const currentMove = useMemo(() => {
    if (!review || currentStep === 0) return null
    return review.moves[currentStep - 1] ?? null
  }, [review, currentStep])

  const lastMoveHighlight = useMemo(() => {
    if (!currentMove) return undefined
    return { from: currentMove.from, to: currentMove.to }
  }, [currentMove])

  const totalMoves = review?.moves.length ?? 0

  // Evaluation bar
  const evalPercent = useMemo(() => {
    if (!currentMove?.eval) return 50
    // Convert centipawn to percent (clamp -500 to +500 range)
    const clamped = Math.max(-500, Math.min(500, currentMove.eval))
    return 50 + (clamped / 500) * 50
  }, [currentMove])

  // Auto-play
  useEffect(() => {
    if (!isPlaying || currentStep >= totalMoves) {
      setIsPlaying(false)
      return
    }
    const timer = setTimeout(() => setCurrentStep((s) => s + 1), 1200)
    return () => clearTimeout(timer)
  }, [isPlaying, currentStep, totalMoves])

  const goBack = useCallback(() => setCurrentStep((s) => Math.max(0, s - 1)), [])
  const goForward = useCallback(() => setCurrentStep((s) => Math.min(totalMoves, s + 1)), [totalMoves])
  const goStart = useCallback(() => setCurrentStep(0), [])
  const goEnd = useCallback(() => setCurrentStep(totalMoves), [totalMoves])

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goBack()
      else if (e.key === 'ArrowRight') goForward()
      else if (e.key === 'Home') goStart()
      else if (e.key === 'End') goEnd()
      else if (e.key === ' ') {
        e.preventDefault()
        setIsPlaying((p) => !p)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goBack, goForward, goStart, goEnd])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-bounce">{'\u265E'}</div>
          <p className="text-[var(--text-sub)]">加载复盘数据...</p>
        </div>
      </div>
    )
  }

  if (!review) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-[var(--text-sub)]">未找到对局数据</p>
          <Button variant="secondary" className="mt-4" onClick={() => navigate('/play/history')}>
            返回对局列表
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
            {'\uD83D\uDD0D'} 对局复盘
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--text-sub)] mt-1">
            {review.white} vs {review.black} &middot; {review.result}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/play/history')}>
          返回列表
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Left: Board + Controls */}
        <div className="flex flex-col items-center gap-3">
          {/* Evaluation bar */}
          <div
            className="w-full flex overflow-hidden"
            style={{ height: 10, borderRadius: 5, background: '#1e293b' }}
          >
            <div
              className="h-full transition-[width] duration-300"
              style={{
                width: `${evalPercent}%`,
                background: '#f1f5f9',
                borderRadius: '5px 0 0 5px',
              }}
            />
            <div
              className="h-full transition-[width] duration-300"
              style={{
                width: `${100 - evalPercent}%`,
                background: '#1e293b',
                borderRadius: '0 5px 5px 0',
              }}
            />
          </div>

          <Chessboard
            fen={currentFen}
            orientation="white"
            interactive={false}
            lastMove={lastMoveHighlight}
          />

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={goStart}
              className="w-9 h-9 rounded-[var(--radius-xs)] flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-sub)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm"
              title="起始"
            >
              {'\u23EE'}
            </button>
            <button
              onClick={goBack}
              className="w-9 h-9 rounded-[var(--radius-xs)] flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-sub)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm"
              title="上一步"
            >
              {'\u25C0'}
            </button>
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="w-9 h-9 rounded-[var(--radius-xs)] flex items-center justify-center bg-[var(--accent)] text-white transition-colors text-sm"
              style={{ borderRadius: 'var(--radius-xs)' }}
              title={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? '\u23F8' : '\u25B6'}
            </button>
            <button
              onClick={goForward}
              className="w-9 h-9 rounded-[var(--radius-xs)] flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-sub)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm"
              title="下一步"
            >
              {'\u25B6'}
            </button>
            <button
              onClick={goEnd}
              className="w-9 h-9 rounded-[var(--radius-xs)] flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-sub)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm"
              title="终局"
            >
              {'\u23ED'}
            </button>
            <span className="ml-2 text-[var(--text-xs)] text-[var(--text-muted)] tabular-nums">
              {currentStep} / {totalMoves}
            </span>
          </div>
        </div>

        {/* Right: Move list + AI review */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* AI Summary */}
          {review.summary && (
            <Card padding="md">
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0">{'\uD83E\uDD16'}</span>
                <div>
                  <h3 className="text-[var(--text-sm)] font-semibold text-[var(--text)] mb-1">AI 复盘总结</h3>
                  <p className="text-[var(--text-sm)] text-[var(--text-sub)] leading-relaxed">
                    {review.summary}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Move list with annotations */}
          <Card padding="sm">
            <h3 className="text-[var(--text-sm)] font-semibold text-[var(--text)] px-2 py-2">
              走法列表
            </h3>
            <div className="max-h-80 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 px-2 pb-2">
                {review.moves.map((move, i) => {
                  const moveNum = Math.floor(i / 2) + 1
                  const isWhite = i % 2 === 0
                  const isActive = currentStep === i + 1
                  const ann = move.annotation ? ANNOTATION_STYLES[move.annotation] : null

                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentStep(i + 1)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-left text-[var(--text-sm)] transition-colors"
                      style={{
                        background: isActive ? 'var(--accent-light)' : 'transparent',
                        color: isActive ? 'var(--accent)' : 'var(--text)',
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      {isWhite && (
                        <span className="text-[var(--text-xs)] text-[var(--text-muted)] w-5 shrink-0">
                          {moveNum}.
                        </span>
                      )}
                      <span className="font-mono">{move.san}</span>
                      {ann && (
                        <span
                          className="text-[10px] font-bold ml-0.5"
                          style={{ color: ann.color }}
                          title={ann.label}
                        >
                          {ann.emoji}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>

          {/* Current move comment */}
          {currentMove?.comment && (
            <Card padding="md">
              <div className="flex items-start gap-2">
                {currentMove.annotation && (
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      color: ANNOTATION_STYLES[currentMove.annotation]?.color,
                      background: `${ANNOTATION_STYLES[currentMove.annotation]?.color}15`,
                    }}
                  >
                    {ANNOTATION_STYLES[currentMove.annotation]?.label}
                  </span>
                )}
                <p className="text-[var(--text-sm)] text-[var(--text-sub)] leading-relaxed">
                  {currentMove.comment}
                </p>
              </div>
            </Card>
          )}

          {/* Evaluation display */}
          {currentMove?.eval !== undefined && (
            <div className="text-[var(--text-xs)] text-[var(--text-muted)]">
              评估: {currentMove.eval > 0 ? '+' : ''}{(currentMove.eval / 100).toFixed(2)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReviewPage
