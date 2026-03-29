import React from 'react'
import type { LessonBlock } from '@/types/lesson'
import DialogueBlockComp from './DialogueBlock'
import BoardDemoBlock from './BoardDemoBlock'
import InteractiveBlock from './InteractiveBlock'
import QuizBlock from './QuizBlock'
import StoryBlock from './StoryBlock'

interface BlockRendererProps {
  block: LessonBlock
  /** Unique key to trigger transition when block changes */
  blockKey: string | number
  accentColor?: string
  onComplete?: () => void
  onReward?: () => void
}

const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  blockKey,
  accentColor = '#6366f1',
  onComplete,
  onReward,
}) => {
  return (
    <div key={blockKey} className="animate-fade-slide-in">
      {block.type === 'dialogue' && (
        <DialogueBlockComp
          block={block}
          accentColor={accentColor}
          onComplete={onComplete}
        />
      )}
      {block.type === 'board_demo' && (
        <BoardDemoBlock
          block={block}
          accentColor={accentColor}
          onComplete={onComplete}
        />
      )}
      {block.type === 'interactive' && (
        <InteractiveBlock
          block={block}
          accentColor={accentColor}
          onComplete={onComplete}
          onReward={onReward}
        />
      )}
      {block.type === 'quiz' && (
        <QuizBlock
          block={block}
          accentColor={accentColor}
          onComplete={onComplete}
          onReward={onReward}
        />
      )}
      {block.type === 'story' && (
        <StoryBlock
          block={block}
          accentColor={accentColor}
          onComplete={onComplete}
        />
      )}
      {/* celebration is handled by LessonPage directly */}
    </div>
  )
}

export default BlockRenderer
