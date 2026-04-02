import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  hoverable?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  onClick?: () => void
  style?: React.CSSProperties
}

const paddingMap = {
  none: '',
  sm: 'p-[var(--space-3)]',
  md: 'p-[var(--space-5)]',
  lg: 'p-[var(--space-8)]',
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hoverable = true,
  padding = 'md',
  onClick,
  style,
}) => {
  return (
    <div
      className={[
        'bg-[var(--bg-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-sm)]',
        'transition-shadow duration-[var(--duration-normal)] ease-[var(--ease-standard)]',
        hoverable ? 'hover:shadow-[var(--shadow-md)]' : '',
        onClick ? 'cursor-pointer' : '',
        paddingMap[padding],
        className,
      ].join(' ')}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  )
}

export default Card
