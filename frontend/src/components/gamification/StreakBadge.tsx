import React from 'react'

interface StreakBadgeProps {
  days: number
  className?: string
}

const StreakBadge: React.FC<StreakBadgeProps> = ({ days, className = '' }) => {
  const isActive = days > 0

  return (
    <>
    <style>{`
      @keyframes flame-flicker {
        0%, 100% { transform: scale(1) rotate(0deg); }
        25% { transform: scale(1.1) rotate(-3deg); }
        50% { transform: scale(1.05) rotate(2deg); }
        75% { transform: scale(1.12) rotate(-2deg); }
      }
    `}</style>
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-[var(--text-sm)] ${className}`}
      style={{
        background: isActive
          ? 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(245,158,11,0.12))'
          : 'var(--border)',
        color: isActive ? '#ef4444' : 'var(--text-muted)',
        border: isActive ? '1px solid rgba(239,68,68,0.2)' : '1px solid var(--border)',
      }}
    >
      <span
        className="text-lg"
        style={{
          filter: isActive ? 'none' : 'grayscale(1)',
          animation: isActive ? 'flame-flicker 1.2s ease-in-out infinite' : 'none',
          display: 'inline-block',
        }}
      >
        {'\uD83D\uDD25'}
      </span>
      <span className="tabular-nums">{days}</span>
      <span className="text-[var(--text-xs)]">天</span>
    </div>
    </>
  )
}

export default StreakBadge
