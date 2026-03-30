import React, { useState, useMemo, useCallback, useEffect } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChessboardProps {
  fen: string
  onMove?: (from: string, to: string, promotion?: string) => void
  /** Called when any square is clicked (before move logic). */
  onSquareClick?: (square: string) => void
  lastMove?: { from: string; to: string }
  /** External valid-moves override (if not provided, uses getValidMoves) */
  validMoves?: string[]
  /** Callback to compute valid moves for a selected square */
  getValidMoves?: (square: string) => string[]
  orientation?: 'white' | 'black'
  highlights?: string[]
  interactive?: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

/** FEN char -> SVG image path */
const BASE = import.meta.env.BASE_URL || '/'
const p = (path: string) => `${BASE}assets/pieces/${path}.svg`
const PIECE_SVG: Record<string, string> = {
  K: p('wK'), Q: p('wQ'), R: p('wR'), B: p('wB'), N: p('wN'), P: p('wP'),
  k: p('bK'), q: p('bQ'), r: p('bR'), b: p('bB'), n: p('bN'), p: p('bP'),
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseFen(fen: string): Record<string, string> {
  const board: Record<string, string> = {}
  const placement = fen.split(' ')[0]
  const rows = placement.split('/')

  rows.forEach((row, ri) => {
    const rank = RANKS[ri]
    let fi = 0
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') {
        fi += parseInt(ch, 10)
      } else {
        const file = FILES[fi]
        board[`${file}${rank}`] = ch
        fi++
      }
    }
  })

  return board
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Chessboard: React.FC<ChessboardProps> = ({
  fen,
  onMove,
  onSquareClick,
  lastMove,
  validMoves: externalValidMoves,
  getValidMoves,
  orientation = 'white',
  highlights = [],
  interactive = true,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [computedValidMoves, setComputedValidMoves] = useState<string[]>([])
  const [promotionState, setPromotionState] = useState<{ from: string; to: string } | null>(null)

  const board = useMemo(() => parseFen(fen), [fen])

  // Reset selection when fen changes (after a move)
  useEffect(() => {
    setSelectedSquare(null)
    setComputedValidMoves([])
  }, [fen])

  const files = orientation === 'white' ? FILES : [...FILES].reverse()
  const ranks = orientation === 'white' ? RANKS : [...RANKS].reverse()

  const lastMoveSquares = useMemo(() => {
    if (!lastMove) return new Set<string>()
    return new Set([lastMove.from, lastMove.to])
  }, [lastMove])

  // Use external validMoves if provided, otherwise use internally computed ones
  const activeValidMoves = externalValidMoves ?? computedValidMoves
  const validMoveSet = useMemo(() => new Set(activeValidMoves), [activeValidMoves])
  const highlightSet = useMemo(() => new Set(highlights), [highlights])

  const handleSquareClick = useCallback(
    (square: string) => {
      if (!interactive) return

      // Fire square click callback (for click-to-select interactions)
      onSquareClick?.(square)

      if (selectedSquare) {
        if (selectedSquare === square) {
          // Deselect
          setSelectedSquare(null)
          setComputedValidMoves([])
          return
        }

        if (validMoveSet.has(square)) {
          // Check if this is a pawn promotion
          const piece = board[selectedSquare]
          const isPromotion =
            (piece === 'P' && square[1] === '8') ||
            (piece === 'p' && square[1] === '1')
          if (isPromotion) {
            // Show promotion picker
            setPromotionState({ from: selectedSquare, to: square })
            setSelectedSquare(null)
            setComputedValidMoves([])
            return
          }
          onMove?.(selectedSquare, square)
          setSelectedSquare(null)
          setComputedValidMoves([])
          return
        }

        // Check if clicking on another piece to reselect
        const piece = board[square]
        if (piece) {
          setSelectedSquare(square)
          if (getValidMoves) {
            setComputedValidMoves(getValidMoves(square))
          }
          return
        }

        setSelectedSquare(null)
        setComputedValidMoves([])
        return
      }

      // Select a piece
      const piece = board[square]
      if (piece) {
        setSelectedSquare(square)
        if (getValidMoves) {
          setComputedValidMoves(getValidMoves(square))
        }
      }
    },
    [interactive, onMove, onSquareClick, selectedSquare, validMoveSet, board, getValidMoves],
  )

  return (
    <div className="inline-flex flex-col select-none relative">
      {/* Board */}
      <div
        className="grid relative"
        style={{
          gridTemplateColumns: `24px repeat(8, 1fr)`,
          gridTemplateRows: `repeat(8, 1fr) 24px`,
        }}
      >
        {/* Rank labels + squares */}
        {ranks.map((rank, ri) => (
          <React.Fragment key={rank}>
            {/* Rank label */}
            <div className="flex items-center justify-center text-[10px] font-medium text-[var(--text-muted)] select-none w-6">
              {rank}
            </div>

            {files.map((file, fi) => {
              const square = `${file}${rank}`
              const piece = board[square]
              const isLight = (fi + ri) % 2 === 0
              const isSelected = selectedSquare === square
              const isLastMove = lastMoveSquares.has(square)
              const isValidTarget = validMoveSet.has(square)
              const isHighlighted = highlightSet.has(square)
              const hasPiece = !!piece

              return (
                <div
                  key={square}
                  className="relative flex items-center justify-center cursor-pointer"
                  style={{
                    width: 'clamp(52px, calc((100vh - 80px) / 8), 80px)',
                    height: 'clamp(52px, calc((100vh - 80px) / 8), 80px)',
                    backgroundColor: isHighlighted
                      ? 'var(--board-check)'
                      : isSelected
                        ? 'var(--board-highlight)'
                        : isLastMove
                          ? 'var(--board-last-move)'
                          : isLight
                            ? 'var(--board-light)'
                            : 'var(--board-dark)',
                    transition: 'background-color 0.15s',
                  }}
                  onClick={() => handleSquareClick(square)}
                >
                  {/* Piece — with CSS transition for smooth movement appearance */}
                  {piece && (
                    <img
                      src={PIECE_SVG[piece]}
                      alt={piece}
                      draggable={false}
                      className="pointer-events-none select-none"
                      style={{
                        width: '88%',
                        height: '88%',
                        filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.35))',
                        transition: 'transform 0.15s ease-out, opacity 0.15s ease-out',
                      }}
                    />
                  )}

                  {/* Valid move indicator */}
                  {isValidTarget && (
                    hasPiece ? (
                      <div
                        className="absolute inset-0 border-[3px] rounded-sm pointer-events-none"
                        style={{ borderColor: 'rgba(0,0,0,0.25)' }}
                      />
                    ) : (
                      <div
                        className="absolute w-[28%] h-[28%] rounded-full pointer-events-none"
                        style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
                      />
                    )
                  )}
                </div>
              )
            })}
          </React.Fragment>
        ))}

        {/* Empty corner for file labels row */}
        <div className="w-6" />

        {/* File labels */}
        {files.map((file) => (
          <div
            key={`label-${file}`}
            className="flex items-center justify-center text-[10px] font-medium text-[var(--text-muted)] select-none h-6"
            style={{ width: 'clamp(52px, calc((100vh - 80px) / 8), 80px)' }}
          >
            {file}
          </div>
        ))}
      </div>

      {/* Promotion picker overlay */}
      {promotionState && (
        <div className="absolute inset-0 flex items-center justify-center z-20" style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 8 }}>
          <div className="bg-white rounded-xl shadow-xl p-3 flex gap-2">
            {(['q', 'r', 'b', 'n'] as const).map((p) => {
              const color = fen.split(' ')[1] === 'b' ? 'b' : 'w'
              const pieceKey = color === 'w' ? p.toUpperCase() : p
              return (
                <button
                  key={p}
                  className="w-14 h-14 rounded-lg hover:bg-blue-50 active:bg-blue-100 transition-colors flex items-center justify-center"
                  onClick={() => {
                    onMove?.(promotionState.from, promotionState.to, p)
                    setPromotionState(null)
                  }}
                >
                  <img
                    src={PIECE_SVG[pieceKey]}
                    alt={p}
                    draggable={false}
                    className="w-10 h-10"
                    style={{ filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.3))' }}
                  />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default Chessboard
