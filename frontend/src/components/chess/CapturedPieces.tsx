import React from 'react'

interface CapturedPiecesProps {
  pieces: string[]
  color: 'white' | 'black'
  className?: string
}

/** Map piece type letter to Unicode for the specified color */
const PIECE_UNICODE: Record<string, Record<'white' | 'black', string>> = {
  p: { white: '\u2659', black: '\u265F' },
  n: { white: '\u2658', black: '\u265E' },
  b: { white: '\u2657', black: '\u265D' },
  r: { white: '\u2656', black: '\u265C' },
  q: { white: '\u2655', black: '\u265B' },
}

/** Piece value for sorting */
const PIECE_ORDER: Record<string, number> = { q: 0, r: 1, b: 2, n: 3, p: 4 }

const CapturedPieces: React.FC<CapturedPiecesProps> = ({ pieces, color, className = '' }) => {
  const sorted = [...pieces].sort((a, b) => (PIECE_ORDER[a] ?? 9) - (PIECE_ORDER[b] ?? 9))

  return (
    <div className={`flex items-center gap-0.5 min-h-[24px] flex-wrap ${className}`}>
      {sorted.map((p, i) => (
        <span
          key={`${p}-${i}`}
          className="text-[16px] leading-none opacity-80"
        >
          {PIECE_UNICODE[p]?.[color] ?? p}
        </span>
      ))}
    </div>
  )
}

export default CapturedPieces
