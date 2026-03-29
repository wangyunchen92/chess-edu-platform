import React from 'react'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
}

const sizeMap = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
}

const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  text,
  fullScreen = false,
}) => {
  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <svg
        className={`${sizeMap[size]} animate-spin`}
        viewBox="0 0 50 50"
        fill="none"
      >
        <circle
          cx="25"
          cy="25"
          r="20"
          stroke="var(--border)"
          strokeWidth="4"
          fill="none"
        />
        <circle
          cx="25"
          cy="25"
          r="20"
          stroke="url(#spinner-gradient)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="80 50"
          fill="none"
        />
        <defs>
          <linearGradient id="spinner-gradient" x1="0" y1="0" x2="50" y2="50">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
      </svg>
      {text && (
        <span className="text-[var(--text-sm)] text-[var(--text-muted)]">{text}</span>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[999] flex items-center justify-center bg-[var(--bg)]/80 backdrop-blur-sm">
        {spinner}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center p-[var(--space-6)]">
      {spinner}
    </div>
  )
}

export default Loading
