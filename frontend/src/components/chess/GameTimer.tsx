import React from 'react'

interface GameTimerProps {
  seconds: number
  active: boolean
  className?: string
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const GameTimer: React.FC<GameTimerProps> = ({ seconds, active, className = '' }) => {
  const isDanger = seconds <= 30
  const isUrgent = seconds <= 10

  return (
    <div
      className={[
        'inline-flex items-center justify-center',
        'px-2.5 py-1 rounded-[var(--radius-sm)]',
        'font-mono text-[var(--text-sm)] font-bold tabular-nums',
        'transition-all duration-200',
        active
          ? isDanger
            ? 'bg-[var(--timer-danger)] text-white'
            : 'bg-[var(--timer-active)] text-white'
          : 'bg-[var(--timer-inactive)] text-[var(--game-text)] opacity-70',
        isUrgent && active ? 'animate-pulse' : '',
        className,
      ].join(' ')}
    >
      {formatTime(seconds)}
    </div>
  )
}

export default GameTimer
