import React from 'react'

interface RatingDisplayProps {
  rating: number
  className?: string
}

/**
 * Rank tiers aligned with product design and backend rank_title.
 * Rating ranges: apprentice(0-399), player(400-799), warrior(800-1199),
 * knight(1200-1599), master(1600-1999), grandmaster(2000-2399), legend(2400+)
 */
function getRankInfo(rating: number): { title: string; emoji: string; color: string; bg: string } {
  if (rating < 400) {
    const tier = rating < 133 ? 'I' : rating < 266 ? 'II' : 'III'
    return { title: `学徒 ${tier}`, emoji: '\uD83E\uDEE1', color: '#92734a', bg: 'rgba(146,115,74,0.12)' }
  }
  if (rating < 800) {
    const tier = rating < 533 ? 'I' : rating < 666 ? 'II' : 'III'
    return { title: `棋手 ${tier}`, emoji: '\uD83E\uDD49', color: '#b87333', bg: 'rgba(184,115,51,0.12)' }
  }
  if (rating < 1200) {
    const tier = rating < 933 ? 'I' : rating < 1066 ? 'II' : 'III'
    return { title: `战士 ${tier}`, emoji: '\uD83E\uDD48', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }
  }
  if (rating < 1600) {
    const tier = rating < 1333 ? 'I' : rating < 1466 ? 'II' : 'III'
    return { title: `骑士 ${tier}`, emoji: '\uD83E\uDD47', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' }
  }
  if (rating < 2000) {
    const tier = rating < 1733 ? 'I' : rating < 1866 ? 'II' : 'III'
    return { title: `大师 ${tier}`, emoji: '\uD83D\uDC8E', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' }
  }
  if (rating < 2400) {
    const tier = rating < 2133 ? 'I' : rating < 2266 ? 'II' : 'III'
    return { title: `宗师 ${tier}`, emoji: '\uD83D\uDC51', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' }
  }
  return { title: '传奇', emoji: '\uD83C\uDF1F', color: '#ec4899', bg: 'rgba(236,72,153,0.12)' }
}

const RatingDisplay: React.FC<RatingDisplayProps> = ({ rating, className = '' }) => {
  const rank = getRankInfo(rating)

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="text-[var(--text-xs)] font-semibold px-2 py-0.5 rounded-full"
        style={{ color: rank.color, background: rank.bg }}
      >
        {rank.emoji} {rank.title}
      </span>
      <span
        className="text-[var(--text-2xl)] font-extrabold tabular-nums"
        style={{ color: rank.color }}
      >
        {rating}
      </span>
    </div>
  )
}

export { getRankInfo }
export default RatingDisplay
