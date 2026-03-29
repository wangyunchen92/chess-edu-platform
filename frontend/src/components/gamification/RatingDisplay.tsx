import React from 'react'

interface RatingDisplayProps {
  rating: number
  className?: string
}

function getRankInfo(rating: number): { title: string; color: string; bg: string } {
  if (rating < 600) return { title: '铜星', color: 'var(--rank-copper)', bg: 'rgba(184,115,51,0.12)' }
  if (rating < 900) return { title: '银星', color: 'var(--rank-silver)', bg: 'rgba(148,163,184,0.12)' }
  if (rating < 1200) return { title: '金星', color: 'var(--rank-gold)', bg: 'rgba(245,158,11,0.12)' }
  if (rating < 1500) return { title: '钻石', color: 'var(--rank-diamond)', bg: 'rgba(59,130,246,0.12)' }
  return { title: '大师', color: 'var(--rank-purple)', bg: 'rgba(139,92,246,0.12)' }
}

const RatingDisplay: React.FC<RatingDisplayProps> = ({ rating, className = '' }) => {
  const rank = getRankInfo(rating)

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="text-[var(--text-2xl)] font-extrabold tabular-nums"
        style={{ color: rank.color }}
      >
        {rating}
      </span>
      <span
        className="text-[var(--text-xs)] font-semibold px-2 py-0.5 rounded-full"
        style={{ color: rank.color, background: rank.bg }}
      >
        {rank.title}
      </span>
    </div>
  )
}

export { getRankInfo }
export default RatingDisplay
