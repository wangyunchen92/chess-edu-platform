import React, { useEffect, useRef } from 'react'
import type { MoveInfo } from '@/types/chess'

interface MoveListProps {
  moves: MoveInfo[]
  currentMoveIndex?: number
  onMoveClick?: (index: number) => void
  className?: string
}

const MoveList: React.FC<MoveListProps> = ({
  moves,
  currentMoveIndex,
  onMoveClick,
  className = '',
}) => {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [moves.length])

  // Group moves into pairs (white, black)
  const pairs: { number: number; white?: MoveInfo; black?: MoveInfo; whiteIdx: number; blackIdx: number }[] = []

  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
      whiteIdx: i,
      blackIdx: i + 1,
    })
  }

  return (
    <div className={`flex flex-col overflow-y-auto ${className}`}>
      <div className="text-[var(--text-xs)] font-semibold text-white mb-2 px-2 opacity-70">
        走法记录
      </div>

      <div className="flex-1 overflow-y-auto space-y-0.5 px-1">
        {pairs.length === 0 && (
          <div className="text-[var(--text-xs)] text-white opacity-40 text-center py-4">
            对局尚未开始
          </div>
        )}

        {pairs.map((pair) => (
          <div key={pair.number} className="flex items-center text-[var(--text-sm)] font-[var(--font-mono)]">
            {/* Move number */}
            <span className="w-8 text-right text-white opacity-40 shrink-0 pr-2 text-[var(--text-xs)]">
              {pair.number}.
            </span>

            {/* White move */}
            <button
              className={[
                'flex-1 px-2 py-0.5 rounded text-left transition-colors',
                'font-mono text-[var(--text-sm)]',
                currentMoveIndex === pair.whiteIdx
                  ? 'bg-white/15 text-white font-semibold'
                  : 'text-white hover:bg-white/8',
              ].join(' ')}
              onClick={() => onMoveClick?.(pair.whiteIdx)}
            >
              {pair.white?.san ?? ''}
            </button>

            {/* Black move */}
            <button
              className={[
                'flex-1 px-2 py-0.5 rounded text-left transition-colors',
                'font-mono text-[var(--text-sm)]',
                currentMoveIndex === pair.blackIdx
                  ? 'bg-white/15 text-white font-semibold'
                  : 'text-white hover:bg-white/8',
              ].join(' ')}
              onClick={() => pair.black && onMoveClick?.(pair.blackIdx)}
            >
              {pair.black?.san ?? ''}
            </button>
          </div>
        ))}

        <div ref={endRef} />
      </div>
    </div>
  )
}

export default MoveList
