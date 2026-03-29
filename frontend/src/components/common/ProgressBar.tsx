import React from 'react'

interface ProgressBarProps {
  value: number // 0-100
  max?: number
  height?: number
  gradient?: boolean
  color?: string
  showLabel?: boolean
  className?: string
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  height = 6,
  gradient = true,
  color,
  showLabel = false,
  className = '',
}) => {
  const percent = Math.min(100, Math.max(0, (value / max) * 100))

  const barBackground = gradient
    ? 'linear-gradient(90deg, var(--accent), var(--accent-2))'
    : color || 'var(--accent)'

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
            {value}/{max}
          </span>
          <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
            {Math.round(percent)}%
          </span>
        </div>
      )}
      <div
        className="w-full bg-[var(--border)] overflow-hidden"
        style={{ height, borderRadius: height / 2 }}
      >
        <div
          className="h-full transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-standard)]"
          style={{
            width: `${percent}%`,
            background: barBackground,
            borderRadius: height / 2,
          }}
        />
      </div>
    </div>
  )
}

export default ProgressBar
