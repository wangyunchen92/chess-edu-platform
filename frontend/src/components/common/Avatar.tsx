import React, { useState } from 'react'

interface AvatarProps {
  src?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  onClick?: () => void
}

const sizeMap = {
  sm: 'w-7 h-7 text-[11px]',
  md: 'w-9 h-9 text-[13px]',
  lg: 'w-12 h-12 text-[16px]',
  xl: 'w-20 h-20 text-[24px]',
}

/** Generate a stable color from a name string */
function nameToColor(name: string): string {
  const colors = [
    '#6366f1', '#8b5cf6', '#3b82f6', '#10b981',
    '#f59e0b', '#ef4444', '#06b6d4', '#ec4899',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  className = '',
  onClick,
}) => {
  const [imgError, setImgError] = useState(false)
  const showFallback = !src || imgError

  return (
    <div
      className={[
        'rounded-full overflow-hidden flex items-center justify-center shrink-0',
        'font-semibold text-white select-none',
        onClick ? 'cursor-pointer' : '',
        sizeMap[size],
        className,
      ].join(' ')}
      style={showFallback ? { backgroundColor: nameToColor(name) } : undefined}
      onClick={onClick}
    >
      {showFallback ? (
        <span>{getInitials(name)}</span>
      ) : (
        <img
          src={src!}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      )}
    </div>
  )
}

export default Avatar
