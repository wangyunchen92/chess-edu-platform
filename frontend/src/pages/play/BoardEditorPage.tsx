import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Chessboard from '@/components/chess/Chessboard'
import { Chess } from 'chess.js'
import { EngineManager } from '@/engine'
import { freePlayApi } from '@/api/freePlay'
import { uciToSan, createGame } from '@/utils/chess'
import { validateEditorFen } from '@/utils/editorFen'
import InsufficientCreditsModal from '@/components/common/InsufficientCreditsModal'
import { useCreditStore } from '@/stores/creditStore'
import type { MoveEvaluation } from '@/engine/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const ANALYSIS_DEPTH = 12

const darkCardStyle: React.CSSProperties = {
  background: 'rgba(30,41,59,0.6)',
  border: '1px solid rgba(255,255,255,0.08)',
}

// ---------------------------------------------------------------------------
// Piece palette data
// ---------------------------------------------------------------------------

interface PalettePiece {
  fen: string      // FEN character: K, Q, R, B, N, P, k, q, r, b, n, p
  label: string
  color: 'w' | 'b'
}

const WHITE_PIECES: PalettePiece[] = [
  { fen: 'K', label: 'King', color: 'w' },
  { fen: 'Q', label: 'Queen', color: 'w' },
  { fen: 'R', label: 'Rook', color: 'w' },
  { fen: 'B', label: 'Bishop', color: 'w' },
  { fen: 'N', label: 'Knight', color: 'w' },
  { fen: 'P', label: 'Pawn', color: 'w' },
]

const BLACK_PIECES: PalettePiece[] = [
  { fen: 'k', label: 'King', color: 'b' },
  { fen: 'q', label: 'Queen', color: 'b' },
  { fen: 'r', label: 'Rook', color: 'b' },
  { fen: 'b', label: 'Bishop', color: 'b' },
  { fen: 'n', label: 'Knight', color: 'b' },
  { fen: 'p', label: 'Pawn', color: 'b' },
]

const BASE = import.meta.env.BASE_URL || '/'
const pieceSvg = (path: string) => `${BASE}assets/pieces/${path}.svg`
const PIECE_IMAGES: Record<string, string> = {
  K: pieceSvg('wK'), Q: pieceSvg('wQ'), R: pieceSvg('wR'), B: pieceSvg('wB'), N: pieceSvg('wN'), P: pieceSvg('wP'),
  k: pieceSvg('bK'), q: pieceSvg('bQ'), r: pieceSvg('bR'), b: pieceSvg('bB'), n: pieceSvg('bN'), p: pieceSvg('bP'),
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build FEN from a board map.
 * boardMap: { "a1": "R", "b1": "N", ... }
 */
function boardMapToFen(
  boardMap: Record<string, string>,
  turn: 'w' | 'b',
): string {
  const rows: string[] = []
  for (let rank = 8; rank >= 1; rank--) {
    let row = ''
    let empty = 0
    for (const file of FILES) {
      const sq = `${file}${rank}`
      const piece = boardMap[sq]
      if (piece) {
        if (empty > 0) { row += empty; empty = 0 }
        row += piece
      } else {
        empty++
      }
    }
    if (empty > 0) row += empty
    rows.push(row)
  }
  return `${rows.join('/')} ${turn} ${computeCastlingRights(boardMap)} - 0 1`
}

/**
 * Compute FEN castling rights from a board map.
 * A side's castling right is retained only if:
 * - White K is on e1 and white R is on the corresponding corner (h1→K, a1→Q)
 * - Black K is on e8 and black R is on the corresponding corner (h8→k, a8→q)
 * Returns '-' when no castling is possible (typical for editor-crafted endgames).
 */
function computeCastlingRights(boardMap: Record<string, string>): string {
  let rights = ''
  if (boardMap['e1'] === 'K') {
    if (boardMap['h1'] === 'R') rights += 'K'
    if (boardMap['a1'] === 'R') rights += 'Q'
  }
  if (boardMap['e8'] === 'k') {
    if (boardMap['h8'] === 'r') rights += 'k'
    if (boardMap['a8'] === 'r') rights += 'q'
  }
  return rights || '-'
}

/**
 * Parse FEN placement to board map.
 */
function fenToBoardMap(fen: string): Record<string, string> {
  const board: Record<string, string> = {}
  const placement = fen.split(' ')[0]
  const rankStrs = placement.split('/')

  rankStrs.forEach((row, ri) => {
    const rank = 8 - ri
    let fi = 0
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') {
        fi += parseInt(ch, 10)
      } else {
        board[`${FILES[fi]}${rank}`] = ch
        fi++
      }
    }
  })

  return board
}

function evalToFriendlyText(cp: number): string {
  const abs = Math.abs(cp)
  const side = cp > 0 ? '白棋' : '黑棋'

  if (abs >= 10000) return cp > 0 ? '白棋要将杀了!' : '黑棋要将杀了!'
  if (abs < 25) return '双方势均力敌'
  if (abs < 75) return `${side}稍稍领先`
  if (abs < 150) return `${side}有半个兵的优势`
  if (abs < 300) return `${side}领先约一个兵`
  if (abs < 500) return `${side}优势很大`
  if (abs < 900) return `${side}优势非常大`
  return `${side}胜券在握!`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ENGINE_ANALYSIS_CREDIT_COST = 20

const BoardEditorPage: React.FC = () => {
  const navigate = useNavigate()
  const { balance, fetchBalance, deduct } = useCreditStore()
  const [showCreditsModal, setShowCreditsModal] = useState(false)

  // Fetch credit balance on mount
  useEffect(() => { fetchBalance() }, [fetchBalance])

  // Board state
  const [boardMap, setBoardMap] = useState<Record<string, string>>(() => fenToBoardMap(INITIAL_FEN))
  const [turn, setTurn] = useState<'w' | 'b'>('w')
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null) // FEN char of piece to place
  const [fenInput, setFenInput] = useState('')
  const [fenError, setFenError] = useState('')

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false)
  const [evalScore, setEvalScore] = useState<number | null>(null)
  const [topMoves, setTopMoves] = useState<MoveEvaluation[]>([])
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Start vs AI state
  const [startingVsAi, setStartingVsAi] = useState(false)
  const [startVsAiError, setStartVsAiError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Computed FEN
  // ---------------------------------------------------------------------------

  const currentFen = useMemo(() => {
    return boardMapToFen(boardMap, turn)
  }, [boardMap, turn])

  // FEN legality error (derived)
  const fenLegalityError = useMemo(
    () => validateEditorFen(currentFen),
    [currentFen],
  )

  // ---------------------------------------------------------------------------
  // Handle square click: place or remove a piece
  // ---------------------------------------------------------------------------

  const handleSquareClick = useCallback(
    (square: string) => {
      if (selectedPiece) {
        // Place piece
        setBoardMap((prev) => ({ ...prev, [square]: selectedPiece }))
        // Reset analysis when board changes
        setEvalScore(null)
        setTopMoves([])
      } else {
        // Remove piece if exists
        setBoardMap((prev) => {
          if (!prev[square]) return prev
          const next = { ...prev }
          delete next[square]
          return next
        })
        setEvalScore(null)
        setTopMoves([])
      }
    },
    [selectedPiece],
  )

  // ---------------------------------------------------------------------------
  // Clear board / standard position
  // ---------------------------------------------------------------------------

  const handleClearBoard = useCallback(() => {
    setBoardMap({})
    setEvalScore(null)
    setTopMoves([])
    setSelectedPiece(null)
  }, [])

  const handleStandardPosition = useCallback(() => {
    setBoardMap(fenToBoardMap(INITIAL_FEN))
    setTurn('w')
    setEvalScore(null)
    setTopMoves([])
    setSelectedPiece(null)
  }, [])

  // ---------------------------------------------------------------------------
  // FEN input
  // ---------------------------------------------------------------------------

  const handleLoadFen = useCallback(() => {
    const trimmed = fenInput.trim()
    if (!trimmed) {
      setFenError('请输入 FEN')
      return
    }
    try {
      // Validate with chess.js
      new Chess(trimmed)
      setBoardMap(fenToBoardMap(trimmed))
      const turnChar = trimmed.split(' ')[1]
      setTurn(turnChar === 'b' ? 'b' : 'w')
      setFenError('')
      setEvalScore(null)
      setTopMoves([])
      setSelectedPiece(null)
    } catch {
      setFenError('FEN 格式不正确')
    }
  }, [fenInput])

  // ---------------------------------------------------------------------------
  // Analysis
  // ---------------------------------------------------------------------------

  const handleAnalyze = useCallback(async () => {
    // Credit check
    if (balance < ENGINE_ANALYSIS_CREDIT_COST) {
      setShowCreditsModal(true)
      return
    }

    setAnalyzing(true)
    setAnalysisError(null)

    // Deduct credits
    deduct(ENGINE_ANALYSIS_CREDIT_COST)

    try {
      // Validate the position first
      try {
        new Chess(currentFen)
      } catch {
        setAnalysisError('当前局面不合法，无法分析')
        setAnalyzing(false)
        return
      }

      const engine = EngineManager.getInstance()
      await engine.ensureReady()

      const [score, moves] = await Promise.all([
        engine.evaluatePosition(currentFen, ANALYSIS_DEPTH, 3000),
        engine.getTopMoves(currentFen, 3, ANALYSIS_DEPTH),
      ])

      setEvalScore(score)
      setTopMoves(moves)
    } catch (err: any) {
      console.error('[BoardEditor] Analysis failed:', err)
      setAnalysisError(err?.message || '分析失败')
    } finally {
      setAnalyzing(false)
    }
  }, [currentFen, balance, deduct])

  // ---------------------------------------------------------------------------
  // Save position
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveSuccess(false)
    try {
      await freePlayApi.savePosition({
        fen: currentFen,
        title: saveTitle.trim() || undefined,
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('[BoardEditor] Save failed:', err)
    } finally {
      setSaving(false)
    }
  }, [currentFen, saveTitle])

  // ---------------------------------------------------------------------------
  // Start vs AI from current position
  // ---------------------------------------------------------------------------

  const handleStartVsAi = useCallback(async () => {
    setStartVsAiError(null)
    if (fenLegalityError) return
    setStartingVsAi(true)
    try {
      const res = await freePlayApi.createFreeGame({
        game_type: 'vs_ai_editor',
        initial_fen: currentFen,
        user_color: turn === 'w' ? 'white' : 'black',
      })
      const data = (res.data as any)?.data ?? res.data
      const gameId = data?.game_id ?? data?.id
      if (gameId) {
        navigate(`/play/free/game/${gameId}`)
      } else {
        setStartVsAiError('创建对局失败，请稍后重试')
      }
    } catch (err) {
      console.error('[BoardEditor] start vs AI failed:', err)
      setStartVsAiError('创建对局失败，请稍后重试')
    } finally {
      setStartingVsAi(false)
    }
  }, [currentFen, turn, fenLegalityError, navigate])

  // ---------------------------------------------------------------------------
  // Convert UCI top moves to SAN for display
  // ---------------------------------------------------------------------------

  const topMovesDisplay = useMemo(() => {
    return topMoves.map((m) => {
      let san = m.move
      try {
        const chess = createGame(currentFen)
        san = uciToSan(chess, m.move)
      } catch { /* keep UCI */ }
      return { ...m, san }
    })
  }, [topMoves, currentFen])

  // Cleanup engine on unmount
  useEffect(() => {
    return () => {
      // Don't dispose the singleton, just stop any pending analysis
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#0b1120' }}>
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{
          background: 'rgba(11,17,32,0.9)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <button
          onClick={() => navigate('/play/free')}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <span className="text-lg">{'\u2190'}</span>
          <span className="hidden sm:inline">返回</span>
        </button>

        <span className="text-sm font-medium text-slate-200">
          棋盘编辑器
        </span>

        <div className="w-16" />
      </header>

      {/* Main body */}
      <div className="flex-1 overflow-auto">
        <div className="flex flex-col lg:flex-row h-full">
          {/* Left: Board + piece palette */}
          <div className="w-full lg:w-[55%] flex flex-col items-center justify-start p-4 gap-4">
            {/* Mode hint */}
            <div className="w-full max-w-[600px] text-center">
              <p className="text-xs text-slate-500">
                {selectedPiece
                  ? `已选中棋子，点击棋盘放置。再次点击已选棋子取消选择。`
                  : `点击棋盘上的棋子移除它，或先从下方选择一个棋子再点击棋盘放置。`}
              </p>
            </div>

            {/* Chessboard */}
            <Chessboard
              fen={currentFen}
              onSquareClick={handleSquareClick}
              interactive={true}
              orientation="white"
            />

            {/* Piece palette */}
            <div className="w-full max-w-[600px] space-y-3">
              {/* White pieces */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-10 shrink-0">白</span>
                <div className="flex gap-1.5">
                  {WHITE_PIECES.map((p) => (
                    <button
                      key={p.fen}
                      data-palette-piece={p.fen}
                      className={[
                        'w-11 h-11 rounded-lg flex items-center justify-center transition-all',
                        selectedPiece === p.fen
                          ? 'bg-blue-600/40 ring-2 ring-blue-400'
                          : 'bg-white/[0.06] hover:bg-white/[0.12]',
                      ].join(' ')}
                      onClick={() =>
                        setSelectedPiece((prev) => (prev === p.fen ? null : p.fen))
                      }
                      title={p.label}
                    >
                      <img
                        src={PIECE_IMAGES[p.fen]}
                        alt={p.label}
                        className="w-8 h-8"
                        draggable={false}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Black pieces */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-10 shrink-0">黑</span>
                <div className="flex gap-1.5">
                  {BLACK_PIECES.map((p) => (
                    <button
                      key={p.fen}
                      data-palette-piece={p.fen}
                      className={[
                        'w-11 h-11 rounded-lg flex items-center justify-center transition-all',
                        selectedPiece === p.fen
                          ? 'bg-blue-600/40 ring-2 ring-blue-400'
                          : 'bg-white/[0.06] hover:bg-white/[0.12]',
                      ].join(' ')}
                      onClick={() =>
                        setSelectedPiece((prev) => (prev === p.fen ? null : p.fen))
                      }
                      title={p.label}
                    >
                      <img
                        src={PIECE_IMAGES[p.fen]}
                        alt={p.label}
                        className="w-8 h-8"
                        draggable={false}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Board actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearBoard}
                  className="px-3 py-1.5 rounded text-xs text-slate-300 hover:text-white transition-colors"
                  style={darkCardStyle}
                >
                  清空棋盘
                </button>
                <button
                  onClick={handleStandardPosition}
                  className="px-3 py-1.5 rounded text-xs text-slate-300 hover:text-white transition-colors"
                  style={darkCardStyle}
                >
                  标准开局
                </button>
                <button
                  onClick={() => setSelectedPiece(null)}
                  className="px-3 py-1.5 rounded text-xs text-slate-300 hover:text-white transition-colors"
                  style={darkCardStyle}
                >
                  取消选择
                </button>
              </div>
            </div>
          </div>

          {/* Right: FEN + Analysis + Save */}
          <div className="w-full lg:w-[45%] flex flex-col p-4 gap-4 lg:border-l lg:border-white/[0.06]">
            {/* FEN section */}
            <div className="rounded-xl p-4" style={darkCardStyle}>
              <h3 className="text-sm font-medium text-slate-300 mb-3">
                FEN 局面
              </h3>

              {/* FEN output (current) */}
              <div className="mb-3">
                <label className="text-xs text-slate-500 mb-1 block">当前 FEN</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={currentFen}
                    className="flex-1 px-2.5 py-1.5 rounded text-xs font-mono text-slate-200 bg-black/30 border border-white/10 focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      if (navigator.clipboard && window.isSecureContext) {
                        navigator.clipboard.writeText(currentFen).catch(() => {})
                      } else {
                        const ta = document.createElement('textarea')
                        ta.value = currentFen
                        ta.style.position = 'fixed'
                        ta.style.opacity = '0'
                        document.body.appendChild(ta)
                        ta.select()
                        document.execCommand('copy')
                        document.body.removeChild(ta)
                      }
                    }}
                    className="px-2.5 py-1.5 rounded text-xs text-slate-400 hover:text-white transition-colors"
                    style={darkCardStyle}
                    title="复制 FEN"
                  >
                    复制
                  </button>
                </div>
              </div>

              {/* FEN input */}
              <div className="mb-3">
                <label className="text-xs text-slate-500 mb-1 block">加载 FEN</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={fenInput}
                    onChange={(e) => {
                      setFenInput(e.target.value)
                      setFenError('')
                    }}
                    placeholder="粘贴 FEN 字符串..."
                    className="flex-1 px-2.5 py-1.5 rounded text-xs font-mono text-slate-200 bg-black/30 border border-white/10 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
                  />
                  <button
                    onClick={handleLoadFen}
                    className="px-2.5 py-1.5 rounded text-xs text-white bg-blue-600 hover:bg-blue-500 transition-colors"
                  >
                    加载
                  </button>
                </div>
                {fenError && (
                  <p className="text-xs text-red-400 mt-1">{fenError}</p>
                )}
              </div>

              {/* Turn selector */}
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">走棋方</label>
                <div className="flex gap-2">
                  <button
                    className={[
                      'flex-1 py-1.5 rounded text-xs font-medium transition-colors',
                      turn === 'w'
                        ? 'bg-white/20 text-white'
                        : 'bg-white/[0.04] text-slate-400 hover:text-white',
                    ].join(' ')}
                    onClick={() => setTurn('w')}
                  >
                    白先
                  </button>
                  <button
                    className={[
                      'flex-1 py-1.5 rounded text-xs font-medium transition-colors',
                      turn === 'b'
                        ? 'bg-white/20 text-white'
                        : 'bg-white/[0.04] text-slate-400 hover:text-white',
                    ].join(' ')}
                    onClick={() => setTurn('b')}
                  >
                    黑先
                  </button>
                </div>
              </div>
            </div>

            {/* Analysis section */}
            <div className="rounded-xl p-4" style={darkCardStyle}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-300">
                  引擎分析
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className={[
                      'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                      analyzing
                        ? 'bg-blue-600/50 text-white/60 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-500',
                    ].join(' ')}
                  >
                    {analyzing ? '分析中...' : '分析局面'}
                  </button>
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    {'\uD83D\uDCB0'} 消耗 {ENGINE_ANALYSIS_CREDIT_COST} 积分
                  </span>
                </div>
              </div>

              {analysisError && (
                <p className="text-xs text-red-400 mb-2">{analysisError}</p>
              )}

              {evalScore !== null && (
                <div className="space-y-3">
                  {/* Evaluation */}
                  <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">评估</span>
                      <span className="text-sm font-mono font-semibold text-slate-200">
                        {evalScore > 0 ? '+' : ''}{(evalScore / 100).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {evalToFriendlyText(evalScore)}
                    </p>
                  </div>

                  {/* Top moves */}
                  {topMovesDisplay.length > 0 && (
                    <div>
                      <h4 className="text-xs text-slate-500 mb-2">候选走法</h4>
                      <div className="space-y-1.5">
                        {topMovesDisplay.map((m, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 rounded-lg px-3 py-2"
                            style={{ background: i === 0 ? 'rgba(34,197,94,0.1)' : 'rgba(0,0,0,0.15)' }}
                          >
                            <span className={[
                              'text-xs font-bold w-5 text-center',
                              i === 0 ? 'text-green-400' : 'text-slate-500',
                            ].join(' ')}>
                              {i + 1}
                            </span>
                            <span className="text-sm font-mono font-semibold text-slate-200">
                              {m.san}
                            </span>
                            <span className="text-xs font-mono text-slate-400 ml-auto">
                              {m.score > 0 ? '+' : ''}{(m.score / 100).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {evalScore === null && !analyzing && !analysisError && (
                <p className="text-xs text-slate-500">
                  摆好棋子后，点击"分析局面"获取引擎评估。
                </p>
              )}
            </div>

            {/* Save section */}
            <div className="rounded-xl p-4" style={darkCardStyle}>
              <h3 className="text-sm font-medium text-slate-300 mb-3">
                保存局面
              </h3>
              <div className="space-y-2">
                <input
                  type="text"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder="局面标题（可选）"
                  maxLength={200}
                  className="w-full px-2.5 py-1.5 rounded text-xs text-slate-200 bg-black/30 border border-white/10 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
                />
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={[
                    'w-full py-2 rounded text-xs font-medium transition-colors',
                    saving
                      ? 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
                      : 'bg-white/[0.08] text-slate-300 hover:bg-white/[0.15] hover:text-white',
                  ].join(' ')}
                >
                  {saving ? '保存中...' : saveSuccess ? '已保存' : '保存到云端'}
                </button>
              </div>
            </div>

            {/* Play vs AI section */}
            <div className="rounded-xl p-4" style={darkCardStyle}>
              <h3 className="text-sm font-medium text-slate-300 mb-3">
                和 AI 对弈
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                摆好残局或练习题，与满血 Stockfish（大师级）直接开局。不计评分。
              </p>
              <button
                onClick={handleStartVsAi}
                disabled={!!fenLegalityError || startingVsAi}
                className={[
                  'w-full py-2.5 rounded text-sm font-medium transition-colors',
                  fenLegalityError || startingVsAi
                    ? 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-500',
                ].join(' ')}
              >
                {startingVsAi ? '创建中...' : '开始对弈'}
              </button>
              {fenLegalityError && (
                <p className="text-xs text-red-400 mt-2">{fenLegalityError}</p>
              )}
              {startVsAiError && (
                <p className="text-xs text-red-400 mt-2">{startVsAiError}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Insufficient Credits Modal */}
      <InsufficientCreditsModal
        open={showCreditsModal}
        onClose={() => setShowCreditsModal(false)}
        required={ENGINE_ANALYSIS_CREDIT_COST}
        balance={balance}
      />
    </div>
  )
}

export default BoardEditorPage
