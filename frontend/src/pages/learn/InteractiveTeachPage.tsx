import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { learnApi } from '@/api/learn'
import { usePaywall } from '@/hooks/usePaywall'
import PaywallModal from '@/components/common/PaywallModal'
import Button from '@/components/common/Button'
import Card from '@/components/common/Card'
import Chessboard from '@/components/chess/Chessboard'

interface ChatMessage {
  role: 'user' | 'ai'
  content: string
  fen?: string
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const AI_RESPONSES: Record<string, string[]> = {
  default: [
    '这是一个很好的问题！让我用棋盘来给你演示一下。',
    '没错！你的理解很正确。再想想还有什么其他的走法？',
    '加油！这个概念掌握了以后你的棋力会大幅提升。',
    '让我换一个角度来解释。看看棋盘上的这个局面...',
  ],
  开局: [
    '开局最重要的三个原则是：控制中心、发展棋子、保护国王。',
    '在开局阶段，尽量不要重复移动同一个棋子，要快速发展。',
    '国王安全很重要！尽早进行王车易位来保护国王。',
  ],
  战术: [
    '战术是短期的计算，通常涉及强制性的走法序列。',
    '最常见的战术主题包括：叉子、钉子、串击、引离和引入。',
    '做战术题是提升计算能力最好的方法，坚持每天做几道！',
  ],
  残局: [
    '残局中国王变成了一个强大的棋子，要积极使用它。',
    '兵的价值在残局中大幅提升，因为它们可以升变。',
    '记住一个重要原则：在残局中，活跃度比子力更重要。',
  ],
}

const InteractiveTeachPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { message, checkAndBlock } = usePaywall('ai_teach')
  const [showPaywall, setShowPaywall] = useState(false)

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'ai',
      content: '你好！我是你的AI象棋老师。你可以问我任何关于国际象棋的问题，我会用棋盘来帮你理解！',
      fen: INITIAL_FEN,
    },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [currentFen, setCurrentFen] = useState(INITIAL_FEN)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text) return

    if (checkAndBlock()) {
      setShowPaywall(true)
      return
    }

    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setIsTyping(true)

    try {
      const res = await learnApi.aiTeach(id!, text)
      const payload = (res.data as any)?.data ?? res.data
      const aiMsg: ChatMessage = {
        role: 'ai',
        content: payload.reply ?? payload.content ?? payload.message ?? '',
        fen: payload.board_fen ?? payload.fen,
      }
      if (aiMsg.fen) setCurrentFen(aiMsg.fen)
      setMessages((prev) => [...prev, aiMsg])
    } catch {
      // Fallback: keyword-based mock response
      let category = 'default'
      if (/开局|opening/i.test(text)) category = '开局'
      else if (/战术|tactic/i.test(text)) category = '战术'
      else if (/残局|endgame/i.test(text)) category = '残局'

      const pool = AI_RESPONSES[category]
      const reply = pool[Math.floor(Math.random() * pool.length)]

      setTimeout(() => {
        setMessages((prev) => [...prev, { role: 'ai', content: reply }])
        setIsTyping(false)
      }, 800 + Math.random() * 1000)
      return
    }

    setIsTyping(false)
  }, [input, id, checkAndBlock])

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} message={message} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
            {'\uD83E\uDD16'} AI教学
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--text-sub)] mt-1">
            和AI老师对话，随时提问学习
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/learn')}>
          返回
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Chat panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <Card padding="none" hoverable={false} className="flex-1 flex flex-col" >
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]" style={{ scrollbarWidth: 'thin' }}>
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[85%] px-4 py-3 text-[var(--text-sm)] leading-relaxed"
                    style={{
                      background: msg.role === 'user' ? 'var(--accent-light)' : 'var(--bg)',
                      border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,0.2)' : 'var(--border)'}`,
                      borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      color: 'var(--text)',
                    }}
                  >
                    {msg.role === 'ai' && (
                      <span className="text-xs font-semibold text-[var(--accent)] block mb-1">{'\uD83E\uDD16'} AI老师</span>
                    )}
                    {msg.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl bg-[var(--bg)] border border-[var(--border)]">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-[var(--border)]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="输入你的问题...（如：什么是开局三原则？）"
                  className="flex-1 px-4 py-2.5 rounded-full text-[var(--text-sm)] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                />
                <Button variant="primary" size="sm" onClick={sendMessage} disabled={!input.trim() || isTyping}>
                  发送
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-[var(--text-xs)] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  {'\uD83D\uDCB0'} 每次提问消耗 10 积分
                </span>
              </div>
              {/* Quick prompts */}
              <div className="flex flex-wrap gap-2 mt-2">
                {['什么是开局三原则？', '教我叉子战术', '残局怎么下？'].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); }}
                    className="text-[var(--text-xs)] px-3 py-1 rounded-full bg-[var(--accent-light)] text-[var(--accent)] hover:bg-[rgba(99,102,241,0.15)] transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Board panel */}
        <div className="flex flex-col items-center gap-2">
          <Chessboard
            fen={currentFen}
            orientation="white"
            interactive={false}
          />
          <p className="text-[var(--text-xs)] text-[var(--text-muted)]">
            AI老师会在这里展示局面
          </p>
        </div>
      </div>
    </div>
  )
}

export default InteractiveTeachPage
