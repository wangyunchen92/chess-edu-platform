import React from 'react'
import type { CharacterExpression } from '@/types/lesson'
import { getCharacter } from '@/types/lesson'

interface TeacherAvatarProps {
  character?: string
  expression?: CharacterExpression
  accentColor?: string
  size?: number
  className?: string
}

const TeacherAvatar: React.FC<TeacherAvatarProps> = ({
  character = 'douding',
  expression = 'idle',
  accentColor,
  size = 64,
  className = '',
}) => {
  const charDef = getCharacter(character)
  const color = accentColor ?? charDef.color
  const emoji = charDef.expressions[expression] ?? charDef.expressions.idle

  return (
    <div
      className={`rounded-full flex flex-col items-center justify-center shrink-0 select-none animate-avatar-glow ${className}`}
      style={{
        width: size,
        height: size,
        border: `3px solid ${color}`,
        background: `linear-gradient(135deg, ${color}15, ${color}08)`,
        boxShadow: `0 0 12px ${color}30`,
        fontSize: size * 0.45,
      }}
    >
      <span role="img" aria-label={expression}>{emoji}</span>
    </div>
  )
}

export default TeacherAvatar
