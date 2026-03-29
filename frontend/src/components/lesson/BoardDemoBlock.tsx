import React from 'react'
import Chessboard from '@/components/chess/Chessboard'
import TeacherAvatar from './TeacherAvatar'
import LessonBubble from './LessonBubble'
import type { BoardDemoBlock as BoardDemoBlockType } from '@/types/lesson'

interface BoardDemoBlockProps {
  block: BoardDemoBlockType
  accentColor?: string
  onComplete?: () => void
}

const BoardDemoBlock: React.FC<BoardDemoBlockProps> = ({
  block,
  accentColor = '#6366f1',
  onComplete,
}) => {
  return (
    <div className="animate-fade-slide-in space-y-4">
      {/* Teacher description bubble */}
      {block.description && (
        <div className="flex items-start gap-3">
          <TeacherAvatar
            expression={block.expression ?? 'happy'}
            accentColor={accentColor}
            size={48}
          />
          <div className="flex-1 min-w-0">
            <LessonBubble
              content={block.description}
              typingSpeed={20}
              onComplete={onComplete}
            />
          </div>
        </div>
      )}
      {/* Chessboard — constrained for lesson layout */}
      <div className="flex justify-center" style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
        <Chessboard
          fen={block.fen}
          orientation="white"
          interactive={false}
          highlights={block.highlights}
        />
      </div>
    </div>
  )
}

export default BoardDemoBlock
