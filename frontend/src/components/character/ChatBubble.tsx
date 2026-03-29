import React, { useEffect, useState } from 'react'

interface ChatBubbleProps {
  message: string | null
  className?: string
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, className = '' }) => {
  const [visible, setVisible] = useState(false)
  const [displayMsg, setDisplayMsg] = useState<string | null>(null)

  useEffect(() => {
    if (message) {
      setDisplayMsg(message)
      setVisible(true)
    } else {
      setVisible(false)
      const timer = setTimeout(() => setDisplayMsg(null), 300)
      return () => clearTimeout(timer)
    }
  }, [message])

  if (!displayMsg) return null

  return (
    <div
      className={[
        'relative px-4 py-3 rounded-[var(--radius-md)] max-w-[240px]',
        'text-[var(--text-sm)] leading-relaxed',
        // Glassmorphism background
        'bg-white/10 backdrop-blur-md border border-white/20',
        'text-[var(--game-text)]',
        // Animation
        'transition-all duration-300 ease-[var(--ease-spring)]',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
        className,
      ].join(' ')}
    >
      {displayMsg}
      {/* Tail */}
      <div
        className="absolute -bottom-1.5 left-6 w-3 h-3 rotate-45 bg-white/10 backdrop-blur-md border-r border-b border-white/20"
      />
    </div>
  )
}

export default ChatBubble
