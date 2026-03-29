import React from 'react'

interface StarProgressProps {
  total: number
  current: number
  className?: string
}

const StarProgress: React.FC<StarProgressProps> = ({
  total,
  current,
  className = '',
}) => {
  // Compact mode for many blocks
  if (total > 8) {
    const completed = Math.min(current, total)
    const goldStars = Math.min(completed, 3)
    const grayStars = Math.min(total - completed, 3)

    return (
      <div className={`flex items-center gap-1.5 text-sm font-medium ${className}`}>
        {Array.from({ length: goldStars }).map((_, i) => (
          <span key={`g-${i}`} className="text-lg">&#11088;</span>
        ))}
        <span className="text-gray-500 mx-1">{completed}/{total}</span>
        {Array.from({ length: grayStars }).map((_, i) => (
          <span key={`e-${i}`} className="text-lg opacity-30">&#9734;</span>
        ))}
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {Array.from({ length: total }).map((_, i) => {
        const isCompleted = i < current
        const isCurrent = i === current

        return (
          <span
            key={i}
            className={[
              'text-xl transition-all duration-300',
              isCompleted ? '' : 'opacity-30',
              isCurrent ? 'animate-pulse-star' : '',
            ].join(' ')}
          >
            {isCompleted ? '\u2B50' : '\u2606'}
          </span>
        )
      })}
    </div>
  )
}

export default StarProgress
