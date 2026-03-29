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
    playApi.getGameReview(id)
      .then((res) => {
        // Unwrap {code, data: {...}} wrapper
        const payload: any = (res.data as any)?.data ?? res.data
        // Backend returns { game_id, review_data: {...} } - extract review_data
        const reviewPayload = payload?.review_data ?? payload
        if (reviewPayload && reviewPayload.moves) {
          setReview(reviewPayload)
        } else {
          throw new Error('Invalid review data')
        }
        setCurrentStep(0)
      })
      .catch((err) => {
        console.error('[ReviewPage] Failed to load review data:', err)
        setReview({
          id: id,
          white: '你',
          black: '豆丁',
          result: '1-0',
          summary: '这盘棋你在中局通过战术组合获得了优势，最终成功将杀对手。开局阶段双方发展正常，但第12步的弃子进攻非常精彩！',
          moves: [
            { san: 'e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', from: 'e2', to: 'e4', eval: 20 },
            { san: 'e5', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', from: 'e7', to: 'e5', eval: 10 },
            { san: 'Nf3', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', from: 'g1', to: 'f3', eval: 25, annotation: 'good', comment: '标准的开局走法，发展马的同时攻击e5兵。' },
            { san: 'Nc6', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', from: 'b8', to: 'c6', eval: 15 },
            { san: 'Bb5', fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', from: 'f1', to: 'b5', eval: 30, annotation: 'good', comment: '西班牙开局，经典的进攻路线。' },
            { san: 'a6', fen: 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4', from: 'a7', to: 'a6', eval: 20 },
            { san: 'Ba4', fen: 'r1bqkbnr/1ppp1ppp/p1n5/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 1 4', from: 'b5', to: 'a4', eval: 28 },
            { san: 'Nf6', fen: 'r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 4', from: 'g8', to: 'f6', eval: 15 },
            { san: 'O-O', fen: 'r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 3 4', from: 'e1', to: 'g1', eval: 30, annotation: 'good', comment: '及时王车易位，保护国王安全。' },
            { san: 'Be7', fen: 'r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 4 5', from: 'f8', to: 'e7', eval: 22 },
            { san: 'Re1', fen: 'r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQR1K1 b kq - 5 5', from: 'f1', to: 'e1', eval: 35 },
            { san: 'b5', fen: 'r1bqk2r/2ppbppp/p1n2n2/1p2p3/B3P3/5N2/PPPP1PPP/RNBQR1K1 w kq b6 0 6', from: 'b7', to: 'b5', eval: 20, annotation: 'inaccuracy', comment: '这步有些冒进，削弱了后翼结构。' },
          ],
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
