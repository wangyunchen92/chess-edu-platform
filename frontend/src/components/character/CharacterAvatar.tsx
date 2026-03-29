import React from 'react'

type AvatarSize = 'sm' | 'lg'
type AvatarMood = 'neutral' | 'happy' | 'thinking' | 'sad'

interface CharacterAvatarProps {
  emoji: string
  size?: AvatarSize
  mood?: AvatarMood
  className?: string
}

const sizeMap: Record<AvatarSize, { container: string; text: string }> = {
  sm: { container: 'w-10 h-10', text: 'text-xl' },
  lg: { container: 'w-20 h-20', text: 'text-4xl' },
}

const moodFilter: Record<AvatarMood, string> = {
  neutral: '',
  happy: 'brightness-110',
  thinking: 'grayscale-[30%]',
  sad: 'brightness-90 saturate-75',
}

const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  emoji,
  size = 'sm',
  mood = 'neutral',
  className = '',
}) => {
  const s = sizeMap[size]

  return (
    <div
      className={[
        s.container,
        'rounded-full flex items-center justify-center',
        'bg-gradient-to-br from-[var(--accent-light)] to-[rgba(139,92,246,0.1)]',
        'border-2 border-[var(--border)]',
        'select-none shrink-0',
        moodFilter[mood] ? `filter ${moodFilter[mood]}` : '',
        className,
      ].join(' ')}
    >
      <span className={s.text}>{emoji}</span>
    </div>
  )
}

export default CharacterAvatar
