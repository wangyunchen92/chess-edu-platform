import React from 'react'
import TeacherAvatar from './TeacherAvatar'
import ConfettiEffect from './ConfettiEffect'

interface CelebrationBlockProps {
  xpEarned: number
  message?: string
  accentColor?: string
  onNext?: () => void
  onBackToCourse?: () => void
  nextLabel?: string
}

const CelebrationBlock: React.FC<CelebrationBlockProps> = ({
  xpEarned,
  message = '太棒了！课程完成！',
  accentColor = '#6366f1',
  onNext,
  onBackToCourse,
  nextLabel = '下一课',
}) => {
  return (
    <div className="relative flex flex-col items-center justify-center py-8 space-y-6 animate-fade-slide-in">
      <ConfettiEffect />

      {/* Teacher celebrate */}
      <TeacherAvatar
        expression="celebrate"
        accentColor={accentColor}
        size={80}
      />

      {/* Big message */}
      <h2
        className="text-3xl font-extrabold text-center animate-reward-pop"
        style={{ color: accentColor }}
      >
        {message}
      </h2>

      {/* XP earned */}
      <div className="flex items-center gap-2 animate-reward-pop" style={{ animationDelay: '0.2s' }}>
        <span className="text-5xl font-extrabold" style={{ color: '#f59e0b' }}>
          +{xpEarned}
        </span>
        <span className="text-2xl font-bold text-amber-500">XP</span>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-4 pt-4">
        {onBackToCourse && (
          <button
            onClick={onBackToCourse}
            className="px-6 py-3 rounded-full border-2 border-gray-300 text-gray-600 font-bold text-base hover:bg-gray-50 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            返回课程
          </button>
        )}
        {onNext && (
          <button
            onClick={onNext}
            className="px-8 py-3 rounded-full text-white font-bold text-base shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-xl"
            style={{ backgroundColor: accentColor }}
          >
            {nextLabel} &#9654;
          </button>
        )}
      </div>
    </div>
  )
}

export default CelebrationBlock
