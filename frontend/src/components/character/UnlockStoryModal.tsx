import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import CharacterAvatar from '@/components/character/CharacterAvatar'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UnlockStoryLine {
  speaker: string
  text: string
  emotion?: string
}

export interface UnlockStoryModalProps {
  open: boolean
  onClose: () => void
  characterId: string
  characterName: string
  characterEmoji: string
  /** The unlock story lines from API (unlock_story field on CharacterDetail) */
  storyLines: UnlockStoryLine[]
  /** Optional: raw text fallback if storyLines is empty */
  storyText?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const UnlockStoryModal: React.FC<UnlockStoryModalProps> = ({
  open,
  onClose,
  characterId,
  characterName,
  characterEmoji,
  storyLines,
  storyText,
}) => {
  const navigate = useNavigate()
  const [showContent, setShowContent] = useState(false)
  const [currentLine, setCurrentLine] = useState(0)

  // Trigger entrance animation after mount
  useEffect(() => {
    if (open) {
      setCurrentLine(0)
      const timer = setTimeout(() => setShowContent(true), 100)
      return () => clearTimeout(timer)
    } else {
      setShowContent(false)
      setCurrentLine(0)
    }
  }, [open])

  // Auto-advance story lines
  useEffect(() => {
    if (!open || !showContent) return
    if (storyLines.length <= 1) return
    if (currentLine >= storyLines.length - 1) return

    const timer = setTimeout(() => {
      setCurrentLine((prev) => Math.min(prev + 1, storyLines.length - 1))
    }, 2500)
    return () => clearTimeout(timer)
  }, [open, showContent, currentLine, storyLines.length])

  const handleStartGame = () => {
    onClose()
    navigate(`/play?autoSelect=${characterId}`)
  }

  const handleAdvanceLine = () => {
    if (currentLine < storyLines.length - 1) {
      setCurrentLine((prev) => prev + 1)
    }
  }

  // Determine what text to display
  const displayLines = storyLines.length > 0
    ? storyLines
    : storyText
      ? [{ speaker: characterName, text: storyText }]
      : [{ speaker: characterName, text: `${characterName} 已解锁！准备好迎接新的挑战了吗？` }]

  return (
    <Modal open={open} onClose={onClose} width="420px">
      <div className="space-y-5 text-center">
        {/* Unlock animation: avatar with glow + scale effect */}
        <div className="relative flex justify-center pt-2">
          {/* Glow ring */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              opacity: showContent ? 1 : 0,
              transition: 'opacity 0.6s ease-out',
            }}
          >
            <div
              className="rounded-full"
              style={{
                width: 120,
                height: 120,
                background: 'radial-gradient(circle, rgba(251,191,36,0.3) 0%, rgba(251,191,36,0) 70%)',
                animation: showContent ? 'unlock-glow-pulse 2s ease-in-out infinite' : 'none',
              }}
            />
          </div>

          {/* Avatar with scale-in animation */}
          <div
            style={{
              transform: showContent ? 'scale(1)' : 'scale(0.3)',
              opacity: showContent ? 1 : 0,
              transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease-out',
            }}
          >
            <CharacterAvatar emoji={characterEmoji} size="lg" mood="happy" />
          </div>

          {/* Sparkle particles */}
          {showContent && (
            <>
              <span
                className="absolute text-lg"
                style={{
                  top: 8, left: '30%',
                  animation: 'unlock-sparkle 1.5s ease-out infinite',
                  animationDelay: '0s',
                }}
              >*</span>
              <span
                className="absolute text-sm"
                style={{
                  top: 16, right: '28%',
                  animation: 'unlock-sparkle 1.5s ease-out infinite',
                  animationDelay: '0.5s',
                }}
              >*</span>
              <span
                className="absolute text-base"
                style={{
                  bottom: 4, left: '35%',
                  animation: 'unlock-sparkle 1.5s ease-out infinite',
                  animationDelay: '1s',
                }}
              >*</span>
            </>
          )}
        </div>

        {/* Title */}
        <div
          style={{
            opacity: showContent ? 1 : 0,
            transform: showContent ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 0.4s ease-out 0.3s, transform 0.4s ease-out 0.3s',
          }}
        >
          <h3 className="text-[var(--text-xl)] font-bold text-[var(--text)]">
            {characterName} 解锁!
          </h3>
          <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">
            新的伙伴加入了你的冒险之旅
          </p>
        </div>

        {/* Story dialogue area */}
        <div
          className="min-h-[80px] flex flex-col items-center justify-center cursor-pointer"
          onClick={handleAdvanceLine}
          style={{
            opacity: showContent ? 1 : 0,
            transition: 'opacity 0.4s ease-out 0.5s',
          }}
        >
          {displayLines.slice(0, currentLine + 1).map((line, idx) => (
            <div
              key={idx}
              className="px-4 py-3 rounded-xl mb-2 w-full text-left"
              style={{
                background: 'rgba(var(--accent-rgb, 99, 102, 241), 0.06)',
                border: '1px solid rgba(var(--accent-rgb, 99, 102, 241), 0.12)',
                opacity: idx === currentLine ? 1 : 0.5,
                transition: 'opacity 0.3s ease',
              }}
            >
              {line.speaker && (
                <span className="text-[var(--text-xs)] font-semibold text-[var(--accent)] block mb-0.5">
                  {line.speaker}
                </span>
              )}
              <p className="text-[var(--text-sm)] text-[var(--text-sub)] leading-relaxed">
                {line.text}
              </p>
            </div>
          ))}

          {currentLine < displayLines.length - 1 && (
            <span className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1 animate-pulse">
              点击继续...
            </span>
          )}
        </div>

        {/* Actions */}
        <div
          className="flex gap-3 pt-1"
          style={{
            opacity: showContent ? 1 : 0,
            transition: 'opacity 0.4s ease-out 0.7s',
          }}
        >
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onClose}
          >
            稍后再说
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleStartGame}
          >
            开始对弈
          </Button>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes unlock-glow-pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes unlock-sparkle {
          0% { opacity: 0; transform: scale(0.5) translateY(0); }
          30% { opacity: 1; transform: scale(1) translateY(-8px); }
          100% { opacity: 0; transform: scale(0.3) translateY(-20px); }
        }
      `}</style>
    </Modal>
  )
}

export default UnlockStoryModal
