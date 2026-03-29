import React, { useState } from 'react'
import type { QuizBlock } from '@/types/lesson'

interface ChatQuizCardProps {
  block: QuizBlock
  accentColor?: string
  onComplete?: () => void
  onReward?: () => void
}

const OPTION_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899']

const ChatQuizCard: React.FC<ChatQuizCardProps> = ({
  block,
  accentColor = '#6366f1',
  onComplete,
  onReward,
}) => {
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSelect = (index: number) => {
    if (submitted) return
    setSelected(index)
  }

  const handleSubmit = () => {
    if (selected === null) return
    setSubmitted(true)
    const isCorrect = selected === block.correctIndex
    if (isCorrect) {
      onReward?.()
    }
    onComplete?.()
  }

  const isCorrectAnswer = submitted && selected === block.correctIndex

  return (
    <div className="animate-chat-slide-in max-w-[85%]">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Question header */}
        <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">&#10068;</span>
            <span className="text-xs font-medium text-indigo-500">问答时间</span>
          </div>
          <p className="text-sm font-medium text-gray-700">{block.question}</p>
        </div>

        {/* Options */}
        <div className="p-3 space-y-2">
          {block.options.map((option, i) => {
            const isCorrect = i === block.correctIndex
            const isSelected = selected === i
            const color = OPTION_COLORS[i % OPTION_COLORS.length]

            let bg = 'bg-gray-50 hover:bg-gray-100'
            let border = 'border-transparent'
            let textCls = 'text-gray-600'

            if (submitted) {
              if (isCorrect) {
                bg = 'bg-emerald-50'
                border = 'border-emerald-400'
                textCls = 'text-emerald-700'
              } else if (isSelected && !isCorrect) {
                bg = 'bg-red-50'
                border = 'border-red-300'
                textCls = 'text-red-600'
              }
            } else if (isSelected) {
              bg = 'bg-white'
              border = 'border-indigo-400'
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={submitted}
                className={[
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all duration-150 text-left',
                  bg, border, textCls,
                  !submitted && 'active:scale-[0.98]',
                  submitted && 'cursor-default',
                ].filter(Boolean).join(' ')}
              >
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                  style={{
                    backgroundColor:
                      submitted && isCorrect ? '#10b981'
                      : submitted && isSelected && !isCorrect ? '#ef4444'
                      : color,
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm font-medium">{option}</span>
              </button>
            )
          })}
        </div>

        {/* Submit / Result */}
        <div className="px-4 py-3 border-t border-gray-100">
          {!submitted ? (
            <button
              onClick={handleSubmit}
              disabled={selected === null}
              className={[
                'w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all duration-200',
                selected !== null
                  ? 'hover:shadow-md hover:scale-[1.01] active:scale-[0.99]'
                  : 'opacity-40 cursor-not-allowed',
              ].join(' ')}
              style={{ backgroundColor: accentColor }}
            >
              &#10004; 提交答案
            </button>
          ) : (
            <div className={[
              'text-center text-sm font-medium py-1',
              isCorrectAnswer ? 'text-emerald-600' : 'text-gray-500',
            ].join(' ')}>
              {isCorrectAnswer
                ? '&#127881; 回答正确！你真棒！'
                : `正确答案是 ${String.fromCharCode(65 + block.correctIndex)}。没关系，记住就好！`}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChatQuizCard
