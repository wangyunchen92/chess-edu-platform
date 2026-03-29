import React from 'react'

interface XPBarProps {
  current: number
  target: number
  level?: number
  className?: string
}

const XPBar: React.FC<XPBarProps> = ({ current, target, level, className = '' }) => {
  const percent = Math.min(100, Math.max(0, (current / target) * 100))

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {level !== undefined && (
            <span
              className="text-[var(--text-xs)] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: 'linear-gradient(135deg, var(--xp-gold), #fbbf24)',
                color: '#fff',
              }}
            >
              Lv.{level}
            </span>
          )}
          <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
            {current} / {target} XP
          </span>
        </div>
        <span className="text-[var(--text-xs)] font-medium" style={{ color: 'var(--xp-gold)' }}>
          {Math.round(percent)}%
        </span>
      </div>
      <div
        className="w-full overflow-hidden"
        style={{
          height: 10,
          borderRadius: 5,
          background: 'var(--border)',
        }}
      >
        <div
          className="h-full transition-[width] duration-500 ease-out"
          style={{
            width: `${percent}%`,
            borderRadius: 5,
            background: 'linear-gradient(90deg, var(--xp-gold), #fbbf24, #f59e0b)',
            boxShadow: percent > 0 ? '0 0 8px rgba(245,158,11,0.4)' : 'none',
          }}
        />
      </div>
    </div>
  )
}

export default XPBar
