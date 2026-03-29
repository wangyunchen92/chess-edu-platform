import React, { useEffect, useState } from 'react'

interface AchievementPopupProps {
  icon: string
  name: string
  description: string
  onDone?: () => void
}

const AchievementPopup: React.FC<AchievementPopupProps> = ({
  icon,
  name,
  description,
  onDone,
}) => {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDone?.(), 400)
    }, 3000)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <>
      <div
        className="fixed top-6 left-1/2 z-[1200] flex items-center gap-3 px-5 py-3"
        style={{
          transform: `translateX(-50%) translateY(${visible ? '0' : '-120%'})`,
          opacity: visible ? 1 : 0,
          transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
          background: 'linear-gradient(135deg, #1e293b, #334155)',
          border: '2px solid var(--xp-gold)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 32px rgba(245,158,11,0.3), 0 0 0 1px rgba(245,158,11,0.1)',
          minWidth: 280,
          animation: visible ? 'achievement-pop 0.5s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
        }}
      >
        <div
          className="w-12 h-12 flex items-center justify-center text-2xl rounded-full shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(251,191,36,0.2))',
            border: '1px solid rgba(245,158,11,0.3)',
            animation: visible ? 'achievement-icon-shine 1.5s ease-in-out infinite' : 'none',
          }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--xp-gold)' }}>
            成就达成!
          </div>
          <div className="text-sm font-bold text-white truncate">{name}</div>
          <div className="text-[11px] text-white/60 truncate">{description}</div>
        </div>
      </div>
      <style>{`
        @keyframes achievement-pop {
          0% { transform: translateX(-50%) translateY(-120%) scale(0.8); opacity: 0; }
          60% { transform: translateX(-50%) translateY(5%) scale(1.05); opacity: 1; }
          100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
        }
        @keyframes achievement-icon-shine {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.3); }
        }
      `}</style>
    </>
  )
}

export default AchievementPopup
