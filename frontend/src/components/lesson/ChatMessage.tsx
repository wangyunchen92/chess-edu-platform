import React from 'react'
import TeacherAvatar from './TeacherAvatar'
import type { CharacterExpression } from '@/types/lesson'
import { getCharacter } from '@/types/lesson'

interface ChatMessageProps {
  character: string
  content: string
  expression?: CharacterExpression
  isStudent?: boolean
  onPlayVoice?: (text: string, character: string) => void
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  character,
  content,
  expression = 'idle',
  isStudent = false,
  onPlayVoice,
}) => {
  const charDef = getCharacter(character)

  return (
    <div
      className={[
        'flex gap-2.5 animate-chat-slide-in',
        isStudent ? 'flex-row-reverse' : 'flex-row',
      ].join(' ')}
    >
      {/* Avatar */}
      <div className="shrink-0 pt-1">
        <TeacherAvatar
          character={character}
          expression={expression}
          accentColor={charDef.color}
          size={40}
        />
      </div>

      {/* Bubble area */}
      <div
        className={[
          'flex flex-col max-w-[75%] min-w-0',
          isStudent ? 'items-end' : 'items-start',
        ].join(' ')}
      >
        {/* Character name */}
        <span className="text-xs text-gray-400 mb-1 px-1">{charDef.name}</span>

        {/* Bubble */}
        <div className="relative group">
          <div
            className={[
              'rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
              'transition-colors duration-200',
              isStudent
                ? 'bg-amber-50 text-gray-700 rounded-tr-sm'
                : 'bg-white text-gray-700 rounded-tl-sm',
            ].join(' ')}
          >
            {content}
          </div>

          {/* Voice button */}
          {onPlayVoice && (
            <button
              onClick={() => onPlayVoice(content, character)}
              className={[
                'absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity',
                'w-6 h-6 flex items-center justify-center rounded-full',
                'bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs',
                isStudent ? 'left-[-28px]' : 'right-[-28px]',
              ].join(' ')}
              title="朗读"
            >
              &#128266;
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChatMessage
