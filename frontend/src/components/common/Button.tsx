import React from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'game'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
  children: React.ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)]',
    'text-white border-none',
    'hover:-translate-y-[1px] hover:shadow-[var(--shadow-accent)]',
  ].join(' '),
  secondary: [
    'bg-transparent text-[var(--text-sub)]',
    'border border-[var(--border)]',
    'hover:border-[var(--accent)] hover:text-[var(--accent)]',
  ].join(' '),
  danger: [
    'bg-[var(--danger)] text-white border-none',
    'hover:brightness-110',
  ].join(' '),
  game: [
    'bg-white/[0.08] text-[var(--game-text)]',
    'border border-white/[0.12]',
    'hover:bg-white/[0.15]',
  ].join(' '),
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-[var(--text-xs)] rounded-[var(--radius-xs)] min-h-[44px]',
  md: 'px-[18px] py-2 text-[var(--text-sm)] rounded-[var(--radius-sm)] min-h-[44px]',
  lg: 'px-6 py-3 text-[var(--text-md)] rounded-[var(--radius-sm)] min-h-[44px]',
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...props
}) => {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2',
        'font-semibold cursor-pointer',
        'transition-all duration-[var(--duration-normal)] ease-[var(--ease-standard)]',
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
        className,
      ].join(' ')}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : icon ? (
        <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
      ) : null}
      {children}
    </button>
  )
}

export default Button
