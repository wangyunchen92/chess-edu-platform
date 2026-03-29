import React, { useEffect, useState } from 'react'

const CONFETTI_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6']
const CONFETTI_COUNT = 30

interface ConfettiPiece {
  id: number
  color: string
  left: number
  delay: number
  duration: number
  size: number
  shape: 'square' | 'circle'
}

function generatePieces(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }).map((_, i) => ({
    id: i,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    left: Math.random() * 100,
    delay: Math.random() * 1,
    duration: 2 + Math.random() * 2,
    size: 6 + Math.random() * 6,
    shape: Math.random() > 0.5 ? 'square' : 'circle',
  }))
}

const ConfettiEffect: React.FC = () => {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    setPieces(generatePieces())
    const timer = setTimeout(() => setVisible(false), 3500)
    return () => clearTimeout(timer)
  }, [])

  if (!visible || pieces.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-40">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute animate-confetti"
          style={{
            left: `${p.left}%`,
            top: '-20px',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  )
}

export default ConfettiEffect
