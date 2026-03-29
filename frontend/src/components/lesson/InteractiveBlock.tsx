import React, { useState, useCallback, useEffect } from 'react'
import { Chess } from 'chess.js'
import Chessboard from '@/components/chess/Chessboard'
import TeacherAvatar from './TeacherAvatar'
import LessonBubble from './LessonBubble'
import type { InteractiveBlock as InteractiveBlockType, CharacterExpression } from '@/types/lesson'

interface InteractiveBlockProps {
  block: InteractiveBlockType
  accentColor?: string
  onComplete?: () => void
  onReward?: () => void
}

const ENCOURAGE_MESSAGES = [
  '没关系，再试一次！',
  '加油，你可以的！',
  '仔细想想，答案就在眼前！',
  '别灰心，试试其他走法！',
]

const InteractiveBlock: React.FC<InteractiveBlockProps> = ({
  block,
  accentColor = '#6366f1',
  onComplete,
  onReward,
}) => {
  const [fen, setFen] = useState(block.fen)
  const [success, setSuccess] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [expression, setExpression] = useState<CharacterExpression>(block.expression ?? 'thinking')
  const [bubbleText, setBubbleText] = useState(block.instruction)

  // Determine interaction mode:
  // - click mode: expectedMove is comma-separated square names like "e1" or "d3,d4"
  // - move mode: expectedMove is a UCI move like "e2e4"
  const correctSquares = block.expectedMove
    ? block.expectedMove.split(',').map(s => s.trim()).filter(Boolean)
    : []
  const isClickMode = correctSquares.length > 0 && correctSquares.every(s => s.length <= 2)
  const isMultiClick = isClickMode && correctSquares.length > 1

  // Track which correct squares the user has found (multi-click mode)
  const [foundSquares, setFoundSquares] = useState<string[]>([])

  // Reset when block changes
  useEffect(() => {
    setFen(block.fen)
    setSuccess(false)
    setShaking(false)
    setFoundSquares([])
    setExpression(block.expression ?? 'thinking')
    setBubbleText(block.instruction)
  }, [block])

  const handleSuccess = useCallback(() => {
    setSuccess(true)
    setExpression('celebrate')
    setBubbleText(block.successMessage ?? '太棒了！你做对了！')
    onComplete?.()
    onReward?.()
  }, [block.successMessage, onComplete, onReward])

  const handleWrong = useCallback(() => {
    setShaking(true)
    setExpression('encourage')
    const msg = ENCOURAGE_MESSAGES[Math.floor(Math.random() * ENCOURAGE_MESSAGES.length)]
    setBubbleText(msg)
    setTimeout(() => setShaking(false), 400)
  }, [])

  // Click-square mode: user clicks specific squares
  const handleSquareClick = useCallback(
    (square: string) => {
      if (success || !isClickMode) return
      if (correctSquares.includes(square)) {
        if (isMultiClick) {
          // Multi-click: track found squares, complete when all found
          setFoundSquares(prev => {
            if (prev.includes(square)) return prev // already found
            const updated = [...prev, square]
            const remaining = correctSquares.length - updated.length
            if (remaining === 0) {
              // All found!
              handleSuccess()
            } else {
              setExpression('happy')
              setBubbleText(`对了！还有${remaining}个格子，继续找！`)
            }
            return updated
          })
        } else {
          // Single click: immediate success
          handleSuccess()
        }
      } else if (!foundSquares.includes(square)) {
        handleWrong()
      }
    },
    [success, isClickMode, isMultiClick, correctSquares, foundSquares, handleSuccess, handleWrong],
  )

  // Move mode: user drags/clicks from→to
  const handleMove = useCallback(
    (from: string, to: string) => {
      if (success || isClickMode) return
      const move = `${from}${to}`
      if (move === block.expectedMove) {
        try {
          const chess = new Chess(fen)
          chess.move({ from, to })
          setFen(chess.fen())
        } catch { /* ignore */ }
        handleSuccess()
      } else {
        handleWrong()
      }
    },
    [block.expectedMove, fen, success, isClickMode, handleSuccess, handleWrong],
  )

  const getValidMoves = useCallback(
    (square: string): string[] => {
      if (isClickMode) return [] // No move hints in click mode
      try {
        const chess = new Chess(fen)
        return chess.moves({ square: square as any, verbose: true }).map((m) => m.to)
      } catch {
        return []
      }
    },
    [fen, isClickMode],
  )

  // Highlights: show found squares in green during multi-click, all correct on success
  const activeHighlights = success
    ? correctSquares
    : isMultiClick
      ? foundSquares
      : undefined

  return (
    <div className="animate-fade-slide-in space-y-4">
      {/* Teacher instruction */}
      <div className="flex items-start gap-3">
        <TeacherAvatar
          expression={expression}
          accentColor={accentColor}
          size={48}
        />
        <div className="flex-1 min-w-0">
          <LessonBubble
            content={bubbleText}
            typingSpeed={20}
          />
        </div>
      </div>
      {/* Chessboard — constrained for lesson layout */}
      <div className={`flex justify-center ${shaking ? 'animate-shake' : ''}`} style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
        <Chessboard
          fen={fen}
          onMove={handleMove}
          onSquareClick={isClickMode ? handleSquareClick : undefined}
          getValidMoves={getValidMoves}
          orientation="white"
          interactive={!success}
          highlights={activeHighlights}
        />
      </div>
      {/* Multi-click progress */}
      {isMultiClick && !success && foundSquares.length > 0 && (
        <div className="text-center text-sm font-medium" style={{ color: accentColor }}>
          已找到 {foundSquares.length}/{correctSquares.length} 个格子
        </div>
      )}
      {/* Success feedback */}
      {success && (
        <div className="text-center animate-reward-pop">
          <span className="text-3xl">&#127881;</span>
        </div>
      )}
    </div>
  )
}

export default InteractiveBlock
