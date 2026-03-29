import React, { useEffect, useRef } from 'react'
import ChatMessage from './ChatMessage'
import ChatQuizCard from './ChatQuizCard'
import type { LessonBlock } from '@/types/lesson'
import { getCharacter } from '@/types/lesson'

// ── Displayed message type ──────────────────────────────────────────

export interface DisplayedMessage {
  id: number
  block: LessonBlock
  blockIdx: number
}

// ── Props ───────────────────────────────────────────────────────────

interface ChatPanelProps {
  messages: DisplayedMessage[]
  activeInteraction: LessonBlock | null
  interactionComplete: boolean
  accentColor?: string
  onPlayVoice?: (text: string, character: string) => void
  onQuizComplete?: () => void
  onQuizReward?: () => void
}

// ── System message (centered card) ──────────────────────────────────

const SystemMessage: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <div className="flex justify-center animate-chat-slide-in">
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  </div>
)

// ── Celebration message ─────────────────────────────────────────────

const CelebrationMessage: React.FC<{ message: string; xp: number }> = ({ message, xp }) => (
  <div className="flex justify-center animate-chat-slide-in">
    <div className="text-center space-y-2 py-4">
      <div className="text-4xl animate-reward-pop">&#127881;</div>
      <p className="text-base font-bold text-gray-700">{message}</p>
      <p className="text-amber-500 font-bold text-lg">+{xp} XP</p>
    </div>
  </div>
)

// ── Main Component ──────────────────────────────────────────────────

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  activeInteraction,
  interactionComplete,
  accentColor = '#6366f1',
  onPlayVoice,
  onQuizComplete,
  onQuizReward,
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeInteraction, interactionComplete])

  const renderMessage = (msg: DisplayedMessage) => {
    const { block } = msg

    switch (block.type) {
      case 'dialogue': {
        const charDef = getCharacter(block.character)
        return (
          <ChatMessage
            key={msg.id}
            character={block.character}
            content={block.content}
            expression={block.expression}
            isStudent={charDef.role === 'student'}
            onPlayVoice={onPlayVoice}
          />
        )
      }

      case 'story': {
        const char = block.character ?? 'douding'
        const charDef = getCharacter(char)
        return (
          <ChatMessage
            key={msg.id}
            character={char}
            content={`\uD83D\uDCD6 ${block.content}`}
            expression={block.expression ?? 'idle'}
            isStudent={charDef.role === 'student'}
            onPlayVoice={onPlayVoice}
          />
        )
      }

      case 'board_demo': {
        // If there's a description, show teacher message + system notice
        const desc = block.description
        return (
          <div key={msg.id} className="space-y-3">
            {desc && (
              <ChatMessage
                character={block.character ?? 'douding'}
                content={desc}
                expression={block.expression ?? 'happy'}
                onPlayVoice={onPlayVoice}
              />
            )}
            <SystemMessage icon="&#128260;" text="棋盘已更新" />
          </div>
        )
      }

      case 'interactive': {
        return (
          <div key={msg.id} className="space-y-3">
            <ChatMessage
              character={block.character ?? 'douding'}
              content={block.instruction}
              expression={block.expression ?? 'thinking'}
              onPlayVoice={onPlayVoice}
            />
            <SystemMessage icon="&#9757;" text="请在左侧棋盘上操作" />
          </div>
        )
      }

      case 'quiz': {
        return (
          <div key={msg.id} className="space-y-3">
            <ChatMessage
              character={block.character ?? 'douding'}
              content="来考考你！"
              expression={block.expression ?? 'thinking'}
              onPlayVoice={onPlayVoice}
            />
            <ChatQuizCard
              block={block}
              accentColor={accentColor}
              onComplete={onQuizComplete}
              onReward={onQuizReward}
            />
          </div>
        )
      }

      case 'celebration': {
        return (
          <CelebrationMessage
            key={msg.id}
            message={block.message}
            xp={block.xpEarned}
          />
        )
      }

      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable message area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map(renderMessage)}

        {/* Interactive success feedback inline */}
        {activeInteraction?.type === 'interactive' && interactionComplete && (
          <ChatMessage
            character={activeInteraction.character ?? 'douding'}
            content={activeInteraction.successMessage ?? '太棒了！你做对了！'}
            expression="celebrate"
            onPlayVoice={onPlayVoice}
          />
        )}

        {/* Scroll anchor */}
        <div ref={chatEndRef} />
      </div>
    </div>
  )
}

export default ChatPanel
