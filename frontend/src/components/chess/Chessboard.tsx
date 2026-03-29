import React, { useState, useMemo, useCallback, useEffect } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChessboardProps {
  fen: string
  onMove?: (from: string, to: string) => void
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
const PIECE_SVG: Record<string, string> = {
  K: '/assets/pieces/wK.svg', Q: '/assets/pieces/wQ.svg', R: '/assets/pieces/wR.svg',
  B: '/assets/pieces/wB.svg', N: '/assets/pieces/wN.svg', P: '/assets/pieces/wP.svg',
  k: '/assets/pieces/bK.svg', q: '/assets/pieces/bQ.svg', r: '/assets/pieces/bR.svg',
  b: '/assets/pieces/bB.svg', n: '/assets/pieces/bN.svg', p: '/assets/pieces/bP.svg',
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
  lastMove,
  validMoves: externalValidMoves,
  getValidMoves,
  orientation = 'white',
  highlights = [],
  interactive = true,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [computedValidMoves, setComputedValidMoves] = useState<string[]>([])

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

      if (selectedSquare) {
        if (selectedSquare === square) {
          // Deselect
          setSelectedSquare(null)
          setComputedValidMoves([])
          return
        }

        if (validMoveSet.has(square)) {
          // Make move
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
    [interactive, onMove, selectedSquare, validMoveSet, board, getValidMoves],
  )

  return (
    <div className="inline-flex flex-col select-none">
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
    </div>
  )
}

export default Chessboard
