import React, { useEffect, useState } from 'react'

interface RewardOverlayProps {
  visible: boolean
  onDismiss?: () => void
  message?: string
  duration?: number
}

const RewardOverlay: React.FC<RewardOverlayProps> = ({
  visible,
  onDismiss,
  message = '太棒了！',
  duration = 1500,
}) => {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (visible) {
      setShow(true)
      const timer = setTimeout(() => {
        setShow(false)
        onDismiss?.()
      }, duration)
      return () => clearTimeout(timer)
    } else {
      setShow(false)
    }
  }, [visible, duration, onDismiss])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Semi-transparent backdrop */}
      <div className="absolute inset-0 bg-black/20" />
      {/* Content */}
      <div className="relative flex flex-col items-center gap-4 animate-reward-pop">
        {/* Star burst effect */}
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="absolute text-2xl animate-star-burst"
            style={{
              transform: `rotate(${i * 45}deg) translateY(-60px)`,
              animationDelay: `${i * 0.05}s`,
            }}
          >
            &#11088;
          </span>
        ))}
        {/* Main text */}
        <span className="text-5xl font-extrabold text-white drop-shadow-lg">
          {message}
        </span>
      </div>
    </div>
  )
}

export default RewardOverlay
