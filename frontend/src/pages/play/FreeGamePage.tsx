import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Chessboard from '@/components/chess/Chessboard'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import CapturedPieces from '@/components/chess/CapturedPieces'
import { Chess } from 'chess.js'
import { freePlayApi } from '@/api/freePlay'
import { useAiOpponent } from '@/hooks/useAiOpponent'
import { playApi } from '@/api/play'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const darkCardStyle: React.CSSProperties = {
  background: 'rgba(30,41,59,0.6)',
  border: '1px solid rgba(255,255,255,0.08)',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MoveRecord {
  san: string
  fen: string
  from: string
  to: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const FreeGamePage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Game state
  const [chess] = useState(() => new Chess())
  const [fen, setFen] = useState(INITIAL_FEN)
  const [moves, setMoves] = useState<MoveRecord[]>([])
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | undefined>()
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [gameOver, setGameOver] = useState(false)
  const [gameResult, setGameResult] = useState<string | null>(null)
  const [gameReason, setGameReason] = useState<string | null>(null)

  // Modals
  const [showResignModal, setShowResignModal] = useState(false)
  const [showDrawModal, setShowDrawModal] = useState(false)
  const [showResultModal, setShowResultModal] = useState(false)
  const [resultSubmitted, setResultSubmitted] = useState(false)

  // vs_ai_editor mode state
  const [isAiEditor, setIsAiEditor] = useState(false)
  const [initialFen, setInitialFen] = useState<string>(INITIAL_FEN)
  const [userColor, setUserColor] = useState<'w' | 'b'>('w')
  const [opponentLabel, setOpponentLabel] = useState<string>('对手')

  // Load game detail to detect vs_ai_editor mode
  useEffect(() => {
    if (!id) return
    playApi.getGameDetail(id)
      .then((res) => {
        const data = (res.data as any)?.data ?? res.data
        if (!data) return
        if (data.game_type === 'vs_ai_editor') {
          setIsAiEditor(true)
          const fen = data.final_fen ?? INITIAL_FEN
          setInitialFen(fen)
          chess.load(fen)
          setFen(fen)
          const uc = data.user_color === 'black' ? 'b' : 'w'
          setUserColor(uc)
          setOrientation(uc === 'b' ? 'black' : 'white')
          setOpponentLabel(data.opponent_name || 'Stockfish · 大师级')
        }
      })
      .catch((err) => {
        console.error('[FreeGamePage] load detail failed:', err)
      })
  }, [id])

  // ---------------------------------------------------------------------------
  // Current turn display
  // ---------------------------------------------------------------------------

  const currentTurn = useMemo(() => {
    return fen.split(' ')[1] === 'w' ? '白方' : '黑方'
  }, [fen])

  // ---------------------------------------------------------------------------
  // Check highlights
  // ---------------------------------------------------------------------------

  const checkHighlights = useMemo(() => {
    if (!chess.isCheck()) return []
    const turn = chess.turn()
    const board = chess.board()
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = board[r][c]
        if (sq && ((sq.type === 'k' && sq.color === turn))) {
          return [`${files[c]}${8 - r}`]
        }
      }
    }
    return []
  }, [fen])

  // ---------------------------------------------------------------------------
  // Captured pieces
  // ---------------------------------------------------------------------------

  const capturedPieces = useMemo(() => {
    const history = chess.history({ verbose: true })
    const captured = { white: [] as string[], black: [] as string[] }
    for (const move of history) {
      if (move.captured) {
        if (move.color === 'w') {
          captured.black.push(move.captured)
        } else {
          captured.white.push(move.captured)
        }
      }
    }
    return captured
  }, [fen])

  // ---------------------------------------------------------------------------
  // Valid moves
  // ---------------------------------------------------------------------------

  const getValidMovesForSquare = useCallback(
    (square: string): string[] => {
      if (gameOver) return []
      try {
        const m = chess.moves({ square: square as any, verbose: true })
        return [...new Set(m.map((mv) => mv.to))]
      } catch {
        return []
      }
    },
    [fen, gameOver],
  )

  // ---------------------------------------------------------------------------
  // Finish game (shared terminal detector)
  // ---------------------------------------------------------------------------

  const maybeFinishGame = useCallback(() => {
    if (!chess.isGameOver()) return
    setGameOver(true)
    if (chess.isCheckmate()) {
      const loserColor = chess.turn()  // 'w' or 'b'
      const userIsWinner = loserColor !== userColor
      setGameResult(userIsWinner ? 'win' : 'loss')
      setGameReason(`将杀! ${loserColor === 'w' ? '黑方' : '白方'}获胜`)
    } else if (chess.isStalemate()) {
      setGameResult('draw')
      setGameReason('逼和 - 无子可动')
    } else if (chess.isThreefoldRepetition()) {
      setGameResult('draw')
      setGameReason('和棋 - 三次重复')
    } else if (chess.isInsufficientMaterial()) {
      setGameResult('draw')
      setGameReason('和棋 - 子力不足')
    } else {
      setGameResult('draw')
      setGameReason('和棋')
    }
    setTimeout(() => setShowResultModal(true), 500)
  }, [chess, userColor])

  // ---------------------------------------------------------------------------
  // Make move
  // ---------------------------------------------------------------------------

  const handleMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      if (gameOver) return

      try {
        const result = chess.move({
          from: from as any,
          to: to as any,
          promotion: (promotion ?? undefined) as any,
        })
        if (!result) return

        const newFen = chess.fen()
        setFen(newFen)
        setLastMove({ from, to })
        setMoves((prev) => [
          ...prev,
          { san: result.san, fen: newFen, from, to },
        ])

        maybeFinishGame()
      } catch {
        // Invalid move
      }
    },
    [chess, gameOver, maybeFinishGame],
  )

  // ---------------------------------------------------------------------------
  // AI opponent (vs_ai_editor only)
  // ---------------------------------------------------------------------------

  const aiShouldMove = useMemo(() => {
    if (!isAiEditor || gameOver) return false
    return chess.turn() !== userColor
  }, [fen, isAiEditor, gameOver, userColor])

  const handleAiMove = useCallback((uci: string) => {
    const from = uci.slice(0, 2)
    const to = uci.slice(2, 4)
    const promotion = uci.length > 4 ? uci[4] : undefined
    try {
      const move = chess.move({ from, to, promotion: promotion as any })
      if (!move) return
      const newFen = chess.fen()
      setFen(newFen)
      setLastMove({ from, to })
      setMoves((prev) => [...prev, {
        san: move.san,
        fen: newFen,
        from,
        to,
      }])
      maybeFinishGame()
    } catch (e) {
      console.warn('[FreeGamePage] AI move invalid:', uci, e)
    }
  }, [chess, maybeFinishGame])

  const { thinking: aiThinking, error: aiError } = useAiOpponent(
    fen,
    aiShouldMove,
    handleAiMove,
    18,
  )
  // Keep refs to avoid unused-var lint (thinking/error intentionally unused for now)
  void aiThinking
  void aiError

  // ---------------------------------------------------------------------------
  // Resign
  // ---------------------------------------------------------------------------

  const handleResign = useCallback(() => {
    setShowResignModal(false)
    setGameOver(true)
    const userSideLabel = userColor === 'w' ? '白方' : '黑方'
    if (isAiEditor) {
      setGameResult('loss')
      setGameReason(`${userSideLabel}认输`)
    } else {
      const loser = chess.turn() === 'w' ? '白方' : '黑方'
      setGameResult(chess.turn() === userColor ? 'loss' : 'win')
      setGameReason(`${loser}认输`)
    }
    setTimeout(() => setShowResultModal(true), 300)
  }, [chess, userColor, isAiEditor])

  // ---------------------------------------------------------------------------
  // Draw
  // ---------------------------------------------------------------------------

  const handleDraw = useCallback(() => {
    setShowDrawModal(false)
    setGameOver(true)
    setGameResult('draw')
    setGameReason('双方同意和棋')
    setTimeout(() => setShowResultModal(true), 300)
  }, [])

  // ---------------------------------------------------------------------------
  // Submit result to server
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!gameOver || !id || resultSubmitted || !gameResult) return
    setResultSubmitted(true)

    const pgnMoves = moves
      .map((m, i) => {
        const moveNum = Math.floor(i / 2) + 1
        return i % 2 === 0 ? `${moveNum}. ${m.san}` : m.san
      })
      .join(' ')

    freePlayApi
      .completeFreeGame(id, {
        result: gameResult,
        pgn: pgnMoves,
        moves_count: moves.length,
        user_color: userColor === 'w' ? 'white' : 'black',
        final_fen: chess.fen(),
      })
      .catch((err) => console.error('[FreeGamePage] Failed to submit result:', err))
  }, [gameOver, id, resultSubmitted, gameResult, moves, chess, userColor])

  // ---------------------------------------------------------------------------
  // Flip board
  // ---------------------------------------------------------------------------

  const handleFlip = useCallback(() => {
    setOrientation((prev) => (prev === 'white' ? 'black' : 'white'))
  }, [])

  // ---------------------------------------------------------------------------
  // Move list data for MoveList component
  // ---------------------------------------------------------------------------

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
        {/* Left: back */}
        <button
          onClick={() => navigate('/play/free')}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <span className="text-lg">{'\u2190'}</span>
          <span className="hidden sm:inline">返回</span>
        </button>

        {/* Center */}
        <div className="text-center">
          <span className="text-sm font-medium text-slate-200">
            {isAiEditor ? opponentLabel : '自由对弈'}
          </span>
          {!gameOver && (
            <span className="text-xs text-slate-500 ml-2">
              {currentTurn}走棋
            </span>
          )}
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleFlip}
            className="px-3 py-1.5 rounded text-xs text-slate-300 hover:text-white transition-colors"
            style={darkCardStyle}
            title="翻转棋盘"
          >
            {'\u{1F503}'}
          </button>
        </div>
      </header>

      {/* Main body */}
      <div className="flex-1 overflow-auto">
        <div className="flex flex-col lg:flex-row h-full">
          {/* Left: Board */}
          <div className="w-full lg:w-[60%] flex flex-col items-center justify-center p-4 gap-3">
            {/* Black side info */}
            <div className="w-full max-w-[560px] flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm">
                  {orientation === 'white' ? '\u265A' : '\u2654'}
                </div>
                <span className="text-sm text-slate-300">
                  {orientation === 'white' ? '黑方' : '白方'}
                </span>
              </div>
              <CapturedPieces
                pieces={orientation === 'white' ? capturedPieces.white : capturedPieces.black}
                color={orientation === 'white' ? 'white' : 'black'}
              />
            </div>

            {/* Chessboard */}
            <Chessboard
              fen={fen}
              onMove={handleMove}
              lastMove={lastMove}
              getValidMoves={getValidMovesForSquare}
              orientation={orientation}
              highlights={checkHighlights}
              interactive={!gameOver}
            />

            {/* White side info */}
            <div className="w-full max-w-[560px] flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm">
                  {orientation === 'white' ? '\u2654' : '\u265A'}
                </div>
                <span className="text-sm text-slate-300">
                  {orientation === 'white' ? '白方' : '黑方'}
                </span>
              </div>
              <CapturedPieces
                pieces={orientation === 'white' ? capturedPieces.black : capturedPieces.white}
                color={orientation === 'white' ? 'black' : 'white'}
              />
            </div>

            {/* Game controls */}
            {!gameOver && (
              <div className="flex items-center gap-3 mt-2">
                <Button
                  variant="game"
                  size="sm"
                  onClick={() => setShowResignModal(true)}
                >
                  {'\u{1F3F3}'} 认输
                </Button>
                <Button
                  variant="game"
                  size="sm"
                  onClick={() => setShowDrawModal(true)}
                >
                  {'\u{1F91D}'} 和棋
                </Button>
              </div>
            )}

            {gameOver && (
              <div className="flex items-center gap-3 mt-2">
                <Button
                  variant="game"
                  size="sm"
                  onClick={() => navigate(`/play/review/${id}`)}
                >
                  {'\u{1F50D}'} 查看分析
                </Button>
                <Button
                  variant="game"
                  size="sm"
                  onClick={() => navigate('/play/free')}
                >
                  再来一局
                </Button>
              </div>
            )}
          </div>

          {/* Right: Move list */}
          <div className="w-full lg:w-[40%] flex flex-col p-4 gap-3 lg:border-l lg:border-white/[0.06]">
            {/* Move list panel */}
            <div
              className="flex-1 rounded-xl p-4 overflow-auto"
              style={darkCardStyle}
            >
              <h3 className="text-sm font-medium text-slate-300 mb-3">
                走法记录
              </h3>
              {moves.length === 0 ? (
                <p className="text-xs text-slate-500">等待第一步走子...</p>
              ) : (
                <div className="space-y-1">
                  {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, i) => {
                    const whiteMove = moves[i * 2]
                    const blackMove = moves[i * 2 + 1]
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="w-8 text-right text-slate-500 text-xs">
                          {i + 1}.
                        </span>
                        <span className="w-20 text-slate-200 font-mono">
                          {whiteMove?.san ?? ''}
                        </span>
                        <span className="w-20 text-slate-200 font-mono">
                          {blackMove?.san ?? ''}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Game status */}
            {gameOver && gameReason && (
              <div
                className="rounded-xl p-4 text-center"
                style={darkCardStyle}
              >
                <p className="text-sm font-medium text-slate-200">
                  {gameReason}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resign confirm modal */}
      <Modal
        open={showResignModal}
        onClose={() => setShowResignModal(false)}
        title="确认认输"
      >
        <div className="space-y-4">
          <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
            {currentTurn}确定要认输吗？
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowResignModal(false)}>
              继续下棋
            </Button>
            <Button variant="danger" onClick={handleResign}>
              确认认输
            </Button>
          </div>
        </div>
      </Modal>

      {/* Draw confirm modal */}
      <Modal
        open={showDrawModal}
        onClose={() => setShowDrawModal(false)}
        title="提议和棋"
      >
        <div className="space-y-4">
          <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
            双方同意和棋吗？
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowDrawModal(false)}>
              继续下棋
            </Button>
            <Button onClick={handleDraw}>
              同意和棋
            </Button>
          </div>
        </div>
      </Modal>

      {/* Result modal */}
      <Modal
        open={showResultModal}
        onClose={() => setShowResultModal(false)}
        title="对局结束"
      >
        <div className="space-y-4 text-center">
          <div className="text-4xl">
            {gameResult === 'win' ? '\u{1F3C6}' : gameResult === 'loss' ? '\u{1F614}' : '\u{1F91D}'}
          </div>
          <p className="text-[var(--text-lg)] font-semibold text-[var(--text)]">
            {gameReason}
          </p>
          <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
            共走了 {moves.length} 步
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button variant="secondary" onClick={() => navigate('/play/free')}>
              返回
            </Button>
            <Button onClick={() => {
              setShowResultModal(false)
              navigate(`/play/review/${id}`)
            }}>
              查看分析
            </Button>
            {isAiEditor && (
              <>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const res = await freePlayApi.createFreeGame({
                        game_type: 'vs_ai_editor',
                        initial_fen: initialFen,
                        user_color: userColor === 'w' ? 'white' : 'black',
                      })
                      const data = (res.data as any)?.data ?? res.data
                      const gid = data?.game_id ?? data?.id
                      if (gid) {
                        window.location.href = `/chess/play/free/game/${gid}`
                      }
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  再来一局
                </Button>
                <Button variant="secondary" onClick={() => navigate('/play/editor')}>
                  返回编辑器
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default FreeGamePage
