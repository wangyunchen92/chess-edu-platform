import React, { useState, useEffect } from 'react'
import TeacherAvatar from './TeacherAvatar'
import LessonBubble from './LessonBubble'
import type { QuizBlock as QuizBlockType, CharacterExpression } from '@/types/lesson'

interface QuizBlockProps {
  block: QuizBlockType
  accentColor?: string
  onComplete?: () => void
  onReward?: () => void
}

const OPTION_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899']

const QuizBlock: React.FC<QuizBlockProps> = ({
  block,
  accentColor = '#6366f1',
  onComplete,
  onReward,
}) => {
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [expression, setExpression] = useState<CharacterExpression>(block.expression ?? 'thinking')
  const [feedbackText, setFeedbackText] = useState('')

  useEffect(() => {
    setSelected(null)
    setSubmitted(false)
    setExpression(block.expression ?? 'thinking')
    setFeedbackText('')
  }, [block])

  const handleSelect = (index: number) => {
    if (submitted) return
    setSelected(index)
  }

  const handleSubmit = () => {
    if (selected === null) return
    setSubmitted(true)
    const isCorrect = selected === block.correctIndex
    if (isCorrect) {
      setExpression('celebrate')
      setFeedbackText('回答正确！你真棒！')
      onComplete?.()
      onReward?.()
    } else {
      setExpression('encourage')
      const correctLetter = String.fromCharCode(65 + block.correctIndex)
      setFeedbackText(`正确答案是 ${correctLetter}。没关系，记住就好！`)
      onComplete?.()
    }
  }

  return (
    <div className="animate-fade-slide-in space-y-5">
      {/* Teacher question */}
      <div className="flex items-start gap-3">
        <TeacherAvatar
          expression={expression}
          accentColor={accentColor}
          size={48}
        />
        <div className="flex-1 min-w-0">
          <LessonBubble
            content={block.question}
            typingSpeed={20}
          />
        </div>
      </div>

      {/* Options */}
      <div className="grid gap-3">
        {block.options.map((option, i) => {
          const isCorrect = i === block.correctIndex
          const isSelected = selected === i
          const color = OPTION_COLORS[i % OPTION_COLORS.length]

          let cardBg = 'bg-white'
          let borderColor = 'border-gray-200'
          let textColor = 'text-gray-700'
          let ringStyle = {}

          if (submitted) {
            if (isCorrect) {
              cardBg = 'bg-emerald-50'
              borderColor = 'border-emerald-400'
              textColor = 'text-emerald-700'
            } else if (isSelected && !isCorrect) {
              cardBg = 'bg-red-50'
              borderColor = 'border-red-400'
              textColor = 'text-red-600'
            }
          } else if (isSelected) {
            cardBg = 'bg-white'
            borderColor = 'border-transparent'
            ringStyle = { boxShadow: `0 0 0 2px ${color}` }
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={submitted}
              className={[
                'w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 transition-all duration-200',
                cardBg,
                borderColor,
                textColor,
                !submitted && 'hover:scale-[1.02] hover:shadow-md active:scale-[0.98]',
                submitted && 'cursor-default',
              ].filter(Boolean).join(' ')}
              style={ringStyle}
            >
              {/* Letter circle */}
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ backgroundColor: submitted && isCorrect ? '#10b981' : submitted && isSelected && !isCorrect ? '#ef4444' : color }}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-base font-medium text-left">{option}</span>
            </button>
          )
        })}
      </div>

      {/* Submit button */}
      {!submitted && (
        <div className="flex justify-center">
          <button
            onClick={handleSubmit}
            disabled={selected === null}
            className={[
              'px-8 py-3 rounded-full font-bold text-white text-base transition-all duration-200',
              selected !== null
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg hover:scale-105 active:scale-95'
                : 'bg-gray-300 cursor-not-allowed',
            ].join(' ')}
            style={selected !== null ? { backgroundColor: accentColor } : undefined}
          >
            {'\u2714'} 提交答案
          </button>
        </div>
      )}

      {/* Feedback */}
      {submitted && feedbackText && (
        <div className="flex items-start gap-3 animate-fade-slide-in">
          <TeacherAvatar
            expression={expression}
            accentColor={accentColor}
            size={40}
          />
          <div className="flex-1 min-w-0">
            <LessonBubble content={feedbackText} typingSpeed={25} />
          </div>
        </div>
      )}
    </div>
  )
}

export default QuizBlock
