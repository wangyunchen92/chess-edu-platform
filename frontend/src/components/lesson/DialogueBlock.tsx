import React from 'react'
import TeacherAvatar from './TeacherAvatar'
import LessonBubble from './LessonBubble'
import type { DialogueBlock as DialogueBlockType } from '@/types/lesson'
import { getCharacter } from '@/types/lesson'

interface DialogueBlockProps {
  block: DialogueBlockType
  accentColor?: string
  onComplete?: () => void
}

const DialogueBlock: React.FC<DialogueBlockProps> = ({
  block,
  accentColor,
  onComplete,
}) => {
  const charDef = getCharacter(block.character)
  const isStudent = charDef.role === 'student'
  const color = accentColor ?? charDef.color

  // Bubble triangle direction: teacher = left pointer, student = right pointer
  const bubbleTriangleCls = isStudent
    ? 'before:content-[""] before:absolute before:right-[-8px] before:top-5 before:w-0 before:h-0 before:border-t-[8px] before:border-t-transparent before:border-l-[10px] before:border-l-white before:border-b-[8px] before:border-b-transparent'
    : ''  // LessonBubble already has left triangle by default

  const animCls = isStudent ? 'animate-fade-slide-in' : 'animate-slide-in-left'

  return (
    <div className={animCls}>
      {/* Character name label */}
      <div
        className={`text-xs font-bold mb-1 ${isStudent ? 'text-right mr-16' : 'ml-16'}`}
        style={{ color }}
      >
        {charDef.name}
      </div>

      {/* Desktop: horizontal layout */}
      <div className={`hidden sm:flex items-start gap-3 ${isStudent ? 'flex-row-reverse' : ''}`}>
        <TeacherAvatar
          character={block.character}
          expression={block.expression}
          accentColor={color}
          size={56}
        />
        <div className="flex-1 min-w-0">
          <LessonBubble
            content={block.content}
            onComplete={onComplete}
            className={isStudent ? `before:hidden ${bubbleTriangleCls}` : ''}
          />
        </div>
      </div>

      {/* Mobile: vertical layout */}
      <div className={`flex sm:hidden flex-col items-center gap-2`}>
        <TeacherAvatar
          character={block.character}
          expression={block.expression}
          accentColor={color}
          size={48}
        />
        <div className="w-full">
          <LessonBubble
            content={block.content}
            onComplete={onComplete}
            className="before:hidden"
          />
        </div>
      </div>
    </div>
  )
}

export default DialogueBlock
