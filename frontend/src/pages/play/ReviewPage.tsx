import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { playApi } from '@/api/play'
import Chessboard from '@/components/chess/Chessboard'
import Button from '@/components/common/Button'
import Card from '@/components/common/Card'
import ProgressBar from '@/components/common/ProgressBar'
import { EngineManager } from '@/engine'
import { createGame, uciToSan } from '@/utils/chess'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewMove {
  san: string
  fen: string
  from: string
  to: string
  eval?: number        // centipawn evaluation (from white's perspective)
  annotation?: 'brilliant' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'
  comment?: string     // AI review comment
  bestMove?: string    // SAN format best move
  bestMoveUci?: string // UCI format best move (for arrow)
}

interface ReviewData {
  id: string
  white: string
  black: string
  result: string
  moves: ReviewMove[]
  summary?: string
}

/** Annotation display styles */
const ANNOTATION_STYLES: Record<string, { label: string; color: string; emoji: string; icon: string }> = {
  brilliant:   { label: '精妙', color: '#06b6d4', emoji: '!!', icon: '\uD83D\uDC8E' },
  good:        { label: '好棋', color: '#22c55e', emoji: '\u2713', icon: '\u2713' },
  inaccuracy:  { label: '不精确', color: '#eab308', emoji: '?!', icon: '?!' },
  mistake:     { label: '失误', color: '#f97316', emoji: '?', icon: '?' },
  blunder:     { label: '漏着', color: '#ef4444', emoji: '??', icon: '??' },
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** Thresholds in centipawns for move classification */
const INACCURACY_THRESHOLD = 50
const MISTAKE_THRESHOLD = 100
const BLUNDER_THRESHOLD = 200
const BRILLIANT_THRESHOLD = 50

/** Default analysis depth (纯JS引擎建议8，WASM引擎可用12+) */
const DEFAULT_ANALYSIS_DEPTH = 8

// ---------------------------------------------------------------------------
// Helpers: child-friendly evaluation text
// ---------------------------------------------------------------------------

function evalToFriendlyText(cp: number): string {
  const abs = Math.abs(cp)
  const side = cp > 0 ? '白棋' : '黑棋'

  if (abs >= 10000) {
    return cp > 0 ? '白棋要将杀了!' : '黑棋要将杀了!'
  }
  if (abs < 25) return '双方势均力敌，不分上下'
  if (abs < 75) return `${side}稍稍领先一点点`
  if (abs < 150) return `${side}有大约半个兵的优势`
  if (abs < 300) return `${side}领先了差不多一个兵`
  if (abs < 500) return `${side}领先了不少，优势很大`
  if (abs < 900) return `${side}优势非常大，快要赢了`
  return `${side}已经胜券在握!`
}

function classifyMove(
  evalDrop: number,
  actualSan: string,
  bestSan: string,
): 'brilliant' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' {
  if (actualSan === bestSan) return 'good'

  const drop = -evalDrop // positive = loss
  if (drop >= BLUNDER_THRESHOLD) return 'blunder'
  if (drop >= MISTAKE_THRESHOLD) return 'mistake'
  if (drop >= INACCURACY_THRESHOLD) return 'inaccuracy'
  if (evalDrop > BRILLIANT_THRESHOLD) return 'brilliant'
  return 'good'
}

function generateComment(
  quality: string,
  san: string,
  bestMove?: string,
): string {
  switch (quality) {
    case 'brilliant':
      return `${san} 是一步很棒的走法! 连电脑都很欣赏这步棋呢!`
    case 'inaccuracy':
      return bestMove
        ? `${san} 还可以更好哦，试试 ${bestMove} 会更棒!`
        : `${san} 不算最好的选择，还能更好。`
    case 'mistake':
      return bestMove
        ? `${san} 走错啦! 更好的走法是 ${bestMove}。`
        : `${san} 是一步失误。`
    case 'blunder':
      return bestMove
        ? `哎呀! ${san} 丢了很多分! 最好的选择是 ${bestMove}。`
        : `${san} 是一个很大的失误!`
    default:
      return ''
  }
}

function getOverallComment(accuracy: number): string {
  if (accuracy >= 95) return '太厉害了! 你下得几乎完美!'
  if (accuracy >= 85) return '你下得很棒! 继续保持!'
  if (accuracy >= 70) return '下得不错! 有几步可以更好哦。'
  if (accuracy >= 50) return '还需要多练习，加油!'
  return '别灰心! 每次对局都是学习的机会!'
}

function getOverallEmoji(accuracy: number): string {
  if (accuracy >= 95) return '\uD83C\uDF1F'
  if (accuracy >= 85) return '\uD83D\uDE04'
  if (accuracy >= 70) return '\uD83D\uDE0A'
  if (accuracy >= 50) return '\uD83D\uDE10'
  return '\uD83D\uDCAA'
}

// ---------------------------------------------------------------------------
// Analysis statistics
// ---------------------------------------------------------------------------

interface AnalysisStats {
  brilliant: number
  good: number
  inaccuracy: number
  mistake: number
  blunder: number
  accuracy: number
}

function computeStats(moves: ReviewMove[]): AnalysisStats {
  const counts = { brilliant: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }
  let analyzed = 0

  for (const m of moves) {
    if (m.annotation && m.annotation in counts) {
      counts[m.annotation]++
      analyzed++
    }
  }

  // Accuracy: weighted metric — good/brilliant = 1, inaccuracy = 0.5, mistake/blunder = 0
  const score = analyzed > 0
    ? ((counts.brilliant + counts.good) * 1 + counts.inaccuracy * 0.5) / analyzed * 100
    : 100

  return { ...counts, accuracy: Math.round(score) }
}

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

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysisDone, setAnalysisDone] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [selectedDepth, setSelectedDepth] = useState(DEFAULT_ANALYSIS_DEPTH)
  const depthRef = useRef(DEFAULT_ANALYSIS_DEPTH)
  const analysisCancelledRef = useRef(false)

  // ---------------------------------------------------------------------------
  // Fetch review data
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!id) return
    setLoading(true)
    playApi.getGameReview(id)
      .then(async (res) => {
        const payload: any = (res.data as any)?.data ?? res.data
        const reviewPayload = payload?.review_data ?? payload
        if (reviewPayload && reviewPayload.moves && reviewPayload.moves.length > 0) {
          setReview(reviewPayload)
          // If already has annotations, mark as done
          if (reviewPayload.moves.some((m: ReviewMove) => m.annotation)) {
            setAnalysisDone(true)
          }
          setCurrentStep(0)
          return
        }

        // No review_data — try to rebuild from game PGN
        const gameRes = await playApi.getGameDetail(id)
        const gameData: any = (gameRes.data as any)?.data ?? gameRes.data
        const pgn = gameData?.pgn ?? ''
        const charName = gameData?.character_name ?? gameData?.character_id ?? '对手'

        if (pgn) {
          const { Chess } = await import('chess.js')
          const chess = new Chess()
          chess.loadPgn(pgn)
          const history = chess.history({ verbose: true })

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
            summary: `共${moves.length}步，${gameData?.result === 'win' ? '你赢了!' : gameData?.result === 'loss' ? '对手获胜' : '和棋'}`,
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

  // ---------------------------------------------------------------------------
  // Analysis logic
  // ---------------------------------------------------------------------------

  const startAnalysis = useCallback(async () => {
    if (!review || review.moves.length === 0) return

    setIsAnalyzing(true)
    setAnalysisProgress(0)
    setAnalysisError(null)
    analysisCancelledRef.current = false

    try {
      const engine = EngineManager.getInstance()
      await engine.ensureReady()

      const totalMoves = review.moves.length
      const analyzedMoves: ReviewMove[] = [...review.moves]

      // Use movetime for speed: 快速500ms, 标准1000ms, 精确2000ms
      const timeLimitMs = depthRef.current <= 6 ? 500 : depthRef.current <= 8 ? 1000 : 2000

      // Evaluate the initial position
      let prevEval = 0
      try {
        prevEval = await engine.evaluatePosition(INITIAL_FEN, depthRef.current, timeLimitMs)
      } catch { prevEval = 0 }

      for (let i = 0; i < totalMoves; i++) {
        if (analysisCancelledRef.current) break

        const move = analyzedMoves[i]

        // Evaluate position after this move (movetime限时，不会超时)
        let evalAfter = prevEval
        try {
          evalAfter = await engine.evaluatePosition(move.fen, depthRef.current, timeLimitMs)
        } catch { evalAfter = prevEval }

        // Get best move for the position BEFORE this move
        const fenBefore = i === 0 ? INITIAL_FEN : analyzedMoves[i - 1].fen
        let bestMoveUci = ''
        try {
          bestMoveUci = await engine.getBestMove(fenBefore, depthRef.current, timeLimitMs)
        } catch { /* skip */ }

        // Convert best move UCI to SAN
        let bestMoveSan: string | undefined
        try {
          const tempGame = createGame(fenBefore)
          bestMoveSan = uciToSan(tempGame, bestMoveUci)
        } catch {
          bestMoveSan = bestMoveUci
        }

        // Determine which side moved (from FEN: the side to move in fenBefore)
        const turn = fenBefore.split(' ')[1] // 'w' or 'b'

        // Eval from the mover's perspective
        // prevEval = eval of position before move (from white's perspective)
        // evalAfter = eval of position after move (from white's perspective)
        // For white: good move means evalAfter > prevEval
        // For black: good move means evalAfter < prevEval (black wants negative evals)
        const evalDropWhitePerspective = evalAfter - prevEval
        const evalDrop = turn === 'w' ? evalDropWhitePerspective : -evalDropWhitePerspective

        const annotation = classifyMove(evalDrop, move.san, bestMoveSan ?? '')
        const comment = annotation !== 'good'
          ? generateComment(annotation, move.san, bestMoveSan)
          : ''

        analyzedMoves[i] = {
          ...move,
          eval: evalAfter,
          annotation,
          comment,
          bestMove: bestMoveSan,
          bestMoveUci: bestMoveUci,
        }

        prevEval = evalAfter
        setAnalysisProgress(i + 1)
      }

      if (!analysisCancelledRef.current) {
        setReview((prev) =>
          prev ? { ...prev, moves: analyzedMoves } : prev
        )
        setAnalysisDone(true)
      }
    } catch (err: any) {
      console.error('[ReviewPage] Analysis error:', err)
      setAnalysisError(err?.message || '分析失败，请刷新重试')
    } finally {
      setIsAnalyzing(false)
    }
  }, [review])

  const cancelAnalysis = useCallback(() => {
    analysisCancelledRef.current = true
  }, [])

  // Cleanup engine on unmount
  useEffect(() => {
    return () => {
      analysisCancelledRef.current = true
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

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
    if (!currentMove?.eval && currentMove?.eval !== 0) return 50
    // Convert centipawn to percent (clamp -500 to +500 range)
    const clamped = Math.max(-500, Math.min(500, currentMove.eval))
    return 50 + (clamped / 500) * 50
  }, [currentMove])

  // Analysis statistics
  const stats = useMemo<AnalysisStats | null>(() => {
    if (!analysisDone || !review) return null
    return computeStats(review.moves)
  }, [analysisDone, review])

  // Best move arrow data (from/to squares from UCI)
  const bestMoveArrow = useMemo(() => {
    if (!currentMove?.bestMoveUci || !analysisDone) return null
    if (currentMove.annotation === 'good' || currentMove.annotation === 'brilliant') return null
    const uci = currentMove.bestMoveUci
    if (uci.length < 4) return null
    return { from: uci.substring(0, 2), to: uci.substring(2, 4) }
  }, [currentMove, analysisDone])

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

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  /** Scroll the active move into view */
  const moveListRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!moveListRef.current) return
    const active = moveListRef.current.querySelector('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentStep])

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
        <div className="flex items-center gap-2">
          {/* Analysis button */}
          {!analysisDone && !isAnalyzing && review.moves.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={selectedDepth}
                onChange={(e) => { const v = Number(e.target.value); setSelectedDepth(v); depthRef.current = v }}
                className="px-2 py-1 rounded-[var(--radius-sm)] text-[var(--text-xs)] text-[var(--text)] bg-[var(--card-bg)] border border-[var(--border)]"
              >
                <option value={6}>快速(深度6)</option>
                <option value={8}>标准(深度8)</option>
                <option value={12}>精确(深度12)</option>
              </select>
              <Button
                variant="primary"
                size="sm"
                onClick={startAnalysis}
              >
                {'\uD83D\uDD2C'} 分析对局
              </Button>
            </div>
          )}
          {isAnalyzing && (
            <Button
              variant="secondary"
              size="sm"
              onClick={cancelAnalysis}
            >
              取消分析
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => navigate('/play/history')}>
            返回列表
          </Button>
        </div>
      </div>

      {/* Analysis progress */}
      {isAnalyzing && (
        <Card padding="md">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-sm)] text-[var(--text)]">
                {'\u2699\uFE0F'} 正在分析... 第 {analysisProgress}/{totalMoves} 步
              </span>
              <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
                {Math.round((analysisProgress / totalMoves) * 100)}%
              </span>
            </div>
            <ProgressBar
              value={analysisProgress}
              max={totalMoves}
              height={8}
              gradient
            />
          </div>
        </Card>
      )}

      {/* Analysis error */}
      {analysisError && (
        <Card padding="md">
          <div className="flex items-center gap-2 text-[var(--danger)]">
            <span>{'\u26A0\uFE0F'}</span>
            <span className="text-[var(--text-sm)]">{analysisError}</span>
            <Button variant="secondary" size="sm" onClick={startAnalysis} className="ml-auto">
              重试
            </Button>
          </div>
        </Card>
      )}

      {/* Statistics card (shown after analysis) */}
      {stats && analysisDone && (
        <Card padding="md">
          <div className="flex flex-wrap items-center gap-4">
            {/* Overall rating */}
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getOverallEmoji(stats.accuracy)}</span>
              <div>
                <p className="text-[var(--text-sm)] font-semibold text-[var(--text)]">
                  准确度 {stats.accuracy}%
                </p>
                <p className="text-[var(--text-xs)] text-[var(--text-sub)]">
                  {getOverallComment(stats.accuracy)}
                </p>
              </div>
            </div>

            <div className="h-8 w-px bg-[var(--border)] hidden sm:block" />

            {/* Move counts */}
            <div className="flex items-center gap-3 flex-wrap">
              {stats.brilliant > 0 && (
                <span className="inline-flex items-center gap-1 text-[var(--text-xs)]" style={{ color: ANNOTATION_STYLES.brilliant.color }}>
                  <span>{'\uD83D\uDC8E'}</span> {stats.brilliant} 精妙
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[var(--text-xs)]" style={{ color: ANNOTATION_STYLES.good.color }}>
                <span>{'\u2713'}</span> {stats.good} 好棋
              </span>
              {stats.inaccuracy > 0 && (
                <span className="inline-flex items-center gap-1 text-[var(--text-xs)]" style={{ color: ANNOTATION_STYLES.inaccuracy.color }}>
                  <span>?!</span> {stats.inaccuracy} 不精确
                </span>
              )}
              {stats.mistake > 0 && (
                <span className="inline-flex items-center gap-1 text-[var(--text-xs)]" style={{ color: ANNOTATION_STYLES.mistake.color }}>
                  <span>?</span> {stats.mistake} 失误
                </span>
              )}
              {stats.blunder > 0 && (
                <span className="inline-flex items-center gap-1 text-[var(--text-xs)]" style={{ color: ANNOTATION_STYLES.blunder.color }}>
                  <span>??</span> {stats.blunder} 漏着
                </span>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Left: Board + Controls */}
        <div className="flex flex-col items-center gap-3">
          {/* Evaluation bar */}
          <div className="w-full relative" style={{ height: 14, borderRadius: 7, overflow: 'hidden' }}>
            <div className="absolute inset-0 flex" style={{ background: '#1e293b' }}>
              <div
                className="h-full transition-[width] duration-300"
                style={{
                  width: `${evalPercent}%`,
                  background: '#f1f5f9',
                  borderRadius: '7px 0 0 7px',
                }}
              />
              <div
                className="h-full transition-[width] duration-300"
                style={{
                  width: `${100 - evalPercent}%`,
                  background: '#1e293b',
                  borderRadius: '0 7px 7px 0',
                }}
              />
            </div>
            {/* Eval text overlay */}
            {analysisDone && currentMove?.eval !== undefined && (
              <div
                className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
                style={{
                  color: currentMove.eval >= 0 ? '#1e293b' : '#f1f5f9',
                  mixBlendMode: 'difference',
                }}
              >
                {currentMove.eval >= 0 ? '+' : ''}{(currentMove.eval / 100).toFixed(1)}
              </div>
            )}
          </div>

          {/* Chessboard with optional best-move arrow overlay */}
          <div className="relative inline-flex">
            <Chessboard
              fen={currentFen}
              orientation="white"
              interactive={false}
              lastMove={lastMoveHighlight}
            />
            {/* Best move arrow overlay (SVG) */}
            {bestMoveArrow && (
              <BestMoveArrow from={bestMoveArrow.from} to={bestMoveArrow.to} orientation="white" />
            )}
          </div>

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

        {/* Right: Move list + tips panel */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* AI Summary */}
          {review.summary && !analysisDone && (
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
            <div ref={moveListRef} className="max-h-80 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 px-2 pb-2">
                {review.moves.map((move, i) => {
                  const moveNum = Math.floor(i / 2) + 1
                  const isWhite = i % 2 === 0
                  const isActive = currentStep === i + 1
                  const ann = move.annotation ? ANNOTATION_STYLES[move.annotation] : null
                  // Don't show annotation badge for 'good' — keep move list clean
                  const showAnn = ann && move.annotation !== 'good'

                  return (
                    <button
                      key={i}
                      data-active={isActive}
                      onClick={() => setCurrentStep(i + 1)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-left text-[var(--text-sm)] transition-colors"
                      style={{
                        background: isActive
                          ? (showAnn ? `${ann!.color}18` : 'var(--accent-light)')
                          : 'transparent',
                        color: isActive
                          ? (showAnn ? ann!.color : 'var(--accent)')
                          : 'var(--text)',
                        fontWeight: isActive ? 600 : 400,
                        borderLeft: showAnn ? `3px solid ${ann!.color}` : '3px solid transparent',
                      }}
                    >
                      {isWhite && (
                        <span className="text-[var(--text-xs)] text-[var(--text-muted)] w-5 shrink-0">
                          {moveNum}.
                        </span>
                      )}
                      <span className="font-mono">{move.san}</span>
                      {showAnn && (
                        <span
                          className="text-[10px] font-bold ml-0.5"
                          style={{ color: ann!.color }}
                          title={ann!.label}
                        >
                          {ann!.emoji}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>

          {/* Position tips panel */}
          {analysisDone && currentStep > 0 && currentMove && (
            <Card padding="md">
              <div className="space-y-3">
                {/* Friendly eval description */}
                {currentMove.eval !== undefined && (
                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0">{'\uD83D\uDCA1'}</span>
                    <p className="text-[var(--text-sm)] text-[var(--text-sub)] leading-relaxed">
                      {evalToFriendlyText(currentMove.eval)}
                    </p>
                  </div>
                )}

                {/* Move annotation + comment */}
                {currentMove.annotation && currentMove.annotation !== 'good' && (
                  <div className="flex items-start gap-2">
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{
                        color: ANNOTATION_STYLES[currentMove.annotation]?.color,
                        background: `${ANNOTATION_STYLES[currentMove.annotation]?.color}15`,
                      }}
                    >
                      {ANNOTATION_STYLES[currentMove.annotation]?.label}
                    </span>
                    <p className="text-[var(--text-sm)] text-[var(--text-sub)] leading-relaxed">
                      {currentMove.comment}
                    </p>
                  </div>
                )}

                {/* Best move recommendation */}
                {currentMove.bestMove &&
                  currentMove.annotation !== 'good' &&
                  currentMove.annotation !== 'brilliant' && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50">
                    <span className="text-sm">{'\u2728'}</span>
                    <span className="text-[var(--text-sm)] text-emerald-700">
                      最佳走法: <strong className="font-mono">{currentMove.bestMove}</strong>
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Fallback for initial position or no analysis */}
          {analysisDone && currentStep === 0 && (
            <Card padding="md">
              <div className="flex items-start gap-2">
                <span className="text-base shrink-0">{'\uD83D\uDCA1'}</span>
                <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
                  点击走法列表中的任意一步，查看局面分析。用方向键也可以切换步数哦!
                </p>
              </div>
            </Card>
          )}

          {/* Before analysis hint */}
          {!analysisDone && !isAnalyzing && review.moves.length > 0 && (
            <Card padding="md">
              <div className="flex items-start gap-2">
                <span className="text-base shrink-0">{'\uD83D\uDD2C'}</span>
                <div>
                  <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
                    点击上方的"分析对局"按钮，AI会帮你分析每一步棋的好坏，找出可以进步的地方!
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Best Move Arrow SVG overlay
// ---------------------------------------------------------------------------

interface BestMoveArrowProps {
  from: string
  to: string
  orientation: 'white' | 'black'
}

const FILES_ARR = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

/**
 * Renders a semi-transparent green arrow on top of the chessboard
 * to indicate the engine's recommended best move.
 */
const BestMoveArrow: React.FC<BestMoveArrowProps> = ({ from, to, orientation }) => {
  // Convert square notation to grid coordinates
  const squareToCoords = (sq: string): { x: number; y: number } => {
    const file = FILES_ARR.indexOf(sq[0])
    const rank = parseInt(sq[1], 10) - 1

    if (orientation === 'white') {
      return { x: file, y: 7 - rank }
    }
    return { x: 7 - file, y: rank }
  }

  const fromCoords = squareToCoords(from)
  const toCoords = squareToCoords(to)

  // Calculate arrow positions as percentages
  // Each square is 1/8 of the board; center of square = (idx + 0.5) / 8
  // The board has a 24px left margin for rank labels — we offset accordingly
  const pct = (idx: number) => ((idx + 0.5) / 8) * 100

  const x1 = pct(fromCoords.x)
  const y1 = pct(fromCoords.y)
  const x2 = pct(toCoords.x)
  const y2 = pct(toCoords.y)

  return (
    <svg
      className="absolute pointer-events-none"
      style={{
        // The chessboard grid starts after the 24px rank label column
        left: 24,
        top: 0,
        width: 'calc(100% - 24px)',
        height: 'calc(100% - 24px)',
        zIndex: 10,
      }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <marker
          id="arrowhead-best"
          markerWidth="3"
          markerHeight="3"
          refX="2.5"
          refY="1.5"
          orient="auto"
        >
          <polygon points="0 0, 3 1.5, 0 3" fill="rgba(34, 197, 94, 0.7)" />
        </marker>
      </defs>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="rgba(34, 197, 94, 0.55)"
        strokeWidth="2.2"
        strokeLinecap="round"
        markerEnd="url(#arrowhead-best)"
      />
    </svg>
  )
}

export default ReviewPage
