import React, { useState, useEffect, useRef } from 'react'

interface LessonBubbleProps {
  content: string
  /** Typing speed in ms per character */
  typingSpeed?: number
  onComplete?: () => void
  className?: string
}

const LessonBubble: React.FC<LessonBubbleProps> = ({
  content,
  typingSpeed = 30,
  onComplete,
  className = '',
}) => {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    setDisplayedText('')
    setIsComplete(false)

    if (!content) {
      setIsComplete(true)
      return
    }

    let index = 0
    const timer = setInterval(() => {
      index++
      if (index >= content.length) {
        setDisplayedText(content)
        setIsComplete(true)
        clearInterval(timer)
        onCompleteRef.current?.()
      } else {
        setDisplayedText(content.slice(0, index))
      }
    }, typingSpeed)

    return () => clearInterval(timer)
  }, [content, typingSpeed])

  // Allow click to skip typing
  const handleClick = () => {
    if (!isComplete) {
      setDisplayedText(content)
      setIsComplete(true)
      onCompleteRef.current?.()
    }
  }

  return (
    <div
      onClick={handleClick}
      className={[
        'relative bg-white rounded-2xl px-5 py-4 shadow-md',
        'text-base leading-relaxed text-gray-700',
        'animate-bubble cursor-pointer',
        // Left triangle pointer
        'before:content-[""] before:absolute before:left-[-8px] before:top-5',
        'before:w-0 before:h-0',
        'before:border-t-[8px] before:border-t-transparent',
        'before:border-r-[10px] before:border-r-white',
        'before:border-b-[8px] before:border-b-transparent',
        className,
      ].join(' ')}
      style={{ fontSize: '16px', lineHeight: '1.75' }}
    >
      {displayedText}
      {!isComplete && (
        <span className="inline-block w-0.5 h-4 bg-gray-400 ml-0.5 animate-pulse align-text-bottom" />
      )}
    </div>
  )
}

export default LessonBubble
