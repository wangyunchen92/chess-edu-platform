import React from 'react'
import TeacherAvatar from './TeacherAvatar'
import LessonBubble from './LessonBubble'
import type { StoryBlock as StoryBlockType } from '@/types/lesson'

interface StoryBlockProps {
  block: StoryBlockType
  accentColor?: string
  onComplete?: () => void
}

/** Map imageHint keywords to relevant large emoji */
function getHintEmoji(hint?: string): string {
  if (!hint) return ''
  const lower = hint.toLowerCase()
  if (lower.includes('king') || lower.includes('国王')) return '\u265A'
  if (lower.includes('queen') || lower.includes('皇后')) return '\u265B'
  if (lower.includes('rook') || lower.includes('车')) return '\u265C'
  if (lower.includes('bishop') || lower.includes('象')) return '\u265D'
  if (lower.includes('knight') || lower.includes('马')) return '\u265E'
  if (lower.includes('pawn') || lower.includes('兵')) return '\u265F'
  if (lower.includes('castle') || lower.includes('城堡')) return '\uD83C\uDFF0'
  if (lower.includes('sword') || lower.includes('战斗')) return '\u2694\uFE0F'
  if (lower.includes('star') || lower.includes('星')) return '\u2B50'
  if (lower.includes('trophy') || lower.includes('奖杯')) return '\uD83C\uDFC6'
  if (lower.includes('book') || lower.includes('书')) return '\uD83D\uDCDA'
  if (lower.includes('heart') || lower.includes('爱心')) return '\u2764\uFE0F'
  return '\uD83D\uDCA1' // 💡 default
}

const StoryBlock: React.FC<StoryBlockProps> = ({
  block,
  accentColor = '#6366f1',
  onComplete,
}) => {
  const hintEmoji = getHintEmoji(block.imageHint)

  return (
    <div className="animate-slide-in-left">
      <div className="flex items-start gap-4">
        <TeacherAvatar
          expression={block.expression ?? 'happy'}
          accentColor={accentColor}
          size={56}
        />
        <div className="flex-1 min-w-0 flex items-start gap-3">
          <div className="flex-1">
            <LessonBubble
              content={block.content}
              typingSpeed={25}
              onComplete={onComplete}
            />
          </div>
          {hintEmoji && (
            <div
              className="shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-4xl animate-bubble"
              style={{ background: `${accentColor}10` }}
            >
              {hintEmoji}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StoryBlock
