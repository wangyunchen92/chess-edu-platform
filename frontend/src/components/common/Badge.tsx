import React from 'react'

type BadgeColor = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral'

interface BadgeProps {
  children: React.ReactNode
  color?: BadgeColor
  dot?: boolean
  className?: string
}

const colorStyles: Record<BadgeColor, string> = {
  primary: 'bg-[var(--accent-light)] text-[var(--accent)]',
  success: 'bg-emerald-50 text-[var(--success)]',
  warning: 'bg-amber-50 text-[var(--warning)]',
  danger: 'bg-red-50 text-[var(--danger)]',
  info: 'bg-blue-50 text-[var(--info)]',
  purple: 'bg-purple-50 text-[var(--accent-2)]',
  neutral: 'bg-slate-100 text-[var(--text-sub)]',
}

const dotColorStyles: Record<BadgeColor, string> = {
  primary: 'bg-[var(--accent)]',
  success: 'bg-[var(--success)]',
  warning: 'bg-[var(--warning)]',
  danger: 'bg-[var(--danger)]',
  info: 'bg-[var(--info)]',
  purple: 'bg-[var(--accent-2)]',
  neutral: 'bg-[var(--text-muted)]',
}

const Badge: React.FC<BadgeProps> = ({
  children,
  color = 'primary',
  dot = false,
  className = '',
}) => {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5',
        'text-[var(--text-xs)] font-semibold',
        'px-2.5 py-0.5 rounded-full',
        colorStyles[color],
        className,
      ].join(' ')}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColorStyles[color]}`} />
      )}
      {children}
    </span>
  )
}

export default Badge
