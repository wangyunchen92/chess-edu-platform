import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Chess } from 'chess.js'
import { learnApi } from '@/api/learn'
import { useCourseStore } from '@/stores/courseStore'
import {
  StarProgress,
  CelebrationBlock,
  RewardOverlay,
  TeacherAvatar,
} from '@/components/lesson'
import ChatPanel from '@/components/lesson/ChatPanel'
import type { DisplayedMessage } from '@/components/lesson/ChatPanel'
import Chessboard from '@/components/chess/Chessboard'
import { playVoice, stopVoice } from '@/components/lesson/VoicePlayer'
import type { LessonBlock, LessonData } from '@/types/lesson'
import { mapLegacyBlock, getLessonTheme } from '@/types/lesson'
import { playMoveSound, playCaptureSound, playCheckSound, playErrorSound } from '@/utils/sounds'

// ---------------------------------------------------------------------------
// Default FEN
// ---------------------------------------------------------------------------

const DEFAULT_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

// ---------------------------------------------------------------------------
// Mock data (fallback when API unavailable)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let msgIdCounter = 0
function toDisplayMessage(block: LessonBlock, blockIdx: number): DisplayedMessage {
  return { id: ++msgIdCounter, block, blockIdx }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const LessonPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const courseStore = useCourseStore()

  // Lesson data
  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [loading, setLoading] = useState(true)

  // Chat state
  const [currentStepIdx, setCurrentStepIdx] = useState(-1)
  const [displayedMessages, setDisplayedMessages] = useState<DisplayedMessage[]>([])

  // Board state
  const [currentFen, setCurrentFen] = useState(DEFAULT_FEN)
  const [currentHighlights, setCurrentHighlights] = useState<string[]>([])
  const [boardInteractive, setBoardInteractive] = useState(false)

  // Interaction state
  const [activeInteraction, setActiveInteraction] = useState<LessonBlock | null>(null)
  const [interactionComplete, setInteractionComplete] = useState(false)

  // UI state
  const [showCelebration, setShowCelebration] = useState(false)
  const [showReward, setShowReward] = useState(false)

  // ---------------------------------------------------------------------------
  // Load lesson data
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setCurrentStepIdx(-1)
    setDisplayedMessages([])
    setCurrentFen(DEFAULT_FEN)
    setCurrentHighlights([])
    setBoardInteractive(false)
    setActiveInteraction(null)
    setInteractionComplete(false)
    setShowCelebration(false)
    setShowReward(false)
    msgIdCounter = 0

    courseStore.setLesson(id)

    learnApi
      .getLessonContent(id)
      .then((res) => {
        const raw: any = (res.data as any)?.data ?? res.data
        if (!raw || !raw.id) {
          setLesson(null)
          return
        }
        const rawSteps: any[] =
          raw.blocks ?? raw.content_data?.steps ?? raw.steps ?? []
        const blocks: LessonBlock[] = rawSteps.map((step: any) => mapLegacyBlock(step))

        setLesson({
          id: raw.id,
          title: raw.title ?? '',
          courseId: raw.courseId ?? raw.course_id ?? '',
          lessonOrder: raw.lesson_order ?? 0,
          xpReward: raw.xp_reward ?? 30,
          blocks,
          nextLessonId: raw.nextLessonId ?? raw.next_lesson_id ?? undefined,
          exerciseId: raw.exerciseId ?? raw.exercise_id ?? undefined,
        })
      })
      .catch((err) => {
        console.error('[LessonPage] Failed to load lesson:', err)
        setLesson(null)
      })
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-show first block when lesson loads
  useEffect(() => {
    if (lesson && currentStepIdx === -1 && lesson.blocks.length > 0) {
      showBlock(0)
    }
  }, [lesson]) // eslint-disable-line react-hooks/exhaustive-deps

  const theme = useMemo(
    () => getLessonTheme(lesson?.lessonOrder ?? 0),
    [lesson?.lessonOrder],
  )

  const totalBlocks = lesson?.blocks.length ?? 0

  // ---------------------------------------------------------------------------
  // Core: show a block
  // ---------------------------------------------------------------------------

  const showBlock = useCallback(
    (idx: number) => {
      if (!lesson || idx < 0 || idx >= lesson.blocks.length) return
      const block = lesson.blocks[idx]

      // Add to chat messages
      setDisplayedMessages((prev) => [...prev, toDisplayMessage(block, idx)])

      // Update board for board_demo / interactive
      if (block.type === 'board_demo') {
        setCurrentFen(block.fen)
        setCurrentHighlights(block.highlights ?? [])
        setBoardInteractive(false)
        setActiveInteraction(null)
        setInteractionComplete(false)
      } else if (block.type === 'interactive') {
        setCurrentFen(block.fen)
        setCurrentHighlights([])
        setBoardInteractive(true)
        setActiveInteraction(block)
        setInteractionComplete(false)
      } else if (block.type === 'quiz') {
        setBoardInteractive(false)
        setActiveInteraction(block)
        setInteractionComplete(false)
      } else {
        setBoardInteractive(false)
        setActiveInteraction(null)
        setInteractionComplete(false)
      }

      setCurrentStepIdx(idx)
    },
    [lesson],
  )

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const canGoNext = useMemo(() => {
    if (!lesson) return false
    // If there is an active interactive/quiz that is not complete, block
    if (activeInteraction && !interactionComplete) return false
    // If we are at the last block already
    if (currentStepIdx >= totalBlocks - 1) return false
    return true
  }, [lesson, activeInteraction, interactionComplete, currentStepIdx, totalBlocks])

  const isLastBlock = currentStepIdx >= totalBlocks - 1

  const handleNext = useCallback(() => {
    if (!canGoNext) return
    const nextIdx = currentStepIdx + 1
    showBlock(nextIdx)

    // Update progress
    if (id) {
      learnApi
        .updateProgress(id, {
          progress_pct: Math.round(((nextIdx + 1) / totalBlocks) * 100),
        })
        .catch((err) => console.error('[LessonPage] API error:', err))
    }
  }, [canGoNext, currentStepIdx, showBlock, id, totalBlocks])

  const handlePrev = useCallback(() => {
    // In chat mode, "prev" is less meaningful; we just scroll up.
    // But we keep a reduced version: go back one step in index for board sync.
    if (currentStepIdx <= 0 || !lesson) return

    const prevIdx = currentStepIdx - 1
    const block = lesson.blocks[prevIdx]

    // Sync board to previous block's state
    if (block.type === 'board_demo') {
      setCurrentFen(block.fen)
      setCurrentHighlights(block.highlights ?? [])
      setBoardInteractive(false)
    } else if (block.type === 'interactive') {
      setCurrentFen(block.fen)
      setCurrentHighlights([])
      setBoardInteractive(false) // Don't re-activate past interactions
    }

    // We don't remove messages -- chat history stays
    setCurrentStepIdx(prevIdx)
    setActiveInteraction(null)
    setInteractionComplete(false)
  }, [currentStepIdx, lesson])

  // ---------------------------------------------------------------------------
  // Interactive block: handle move on board
  // ---------------------------------------------------------------------------

  const handleBoardMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      if (!activeInteraction || activeInteraction.type !== 'interactive') return
      if (interactionComplete) return

      const move = `${from}${to}`
      const expectedBase = activeInteraction.expectedMove.slice(0, 4)
      if (move === expectedBase) {
        // Apply the move to the board
        try {
          const chess = new Chess(currentFen)
          const result = chess.move({ from, to, promotion: promotion as any })
          setCurrentFen(chess.fen())
          // Play appropriate sound
          if (chess.inCheck()) {
            playCheckSound()
          } else if (result?.captured) {
            playCaptureSound()
          } else {
            playMoveSound()
          }
        } catch {
          /* ignore */
        }
        setInteractionComplete(true)
        setBoardInteractive(false)
        setShowReward(true)
      } else {
        playErrorSound()
      }
    },
    [activeInteraction, interactionComplete, currentFen],
  )

  const handleSquareClick = useCallback(
    (square: string) => {
      if (!activeInteraction || activeInteraction.type !== 'interactive') return
      if (interactionComplete) return

      // Click mode: expectedMove is comma-separated squares
      const correctSquares = activeInteraction.expectedMove
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const isClickMode = correctSquares.every((s) => s.length <= 2)

      if (isClickMode && correctSquares.includes(square)) {
        playMoveSound()
        setInteractionComplete(true)
        setBoardInteractive(false)
        setShowReward(true)
      } else {
        playErrorSound()
      }
    },
    [activeInteraction, interactionComplete],
  )

  const getValidMoves = useCallback(
    (square: string): string[] => {
      if (!boardInteractive) return []
      try {
        const chess = new Chess(currentFen)
        const moves = chess.moves({ square: square as any, verbose: true })
        return [...new Set(moves.map((m) => m.to))]
      } catch {
        return []
      }
    },
    [currentFen, boardInteractive],
  )

  // ---------------------------------------------------------------------------
  // Quiz complete handler
  // ---------------------------------------------------------------------------

  const handleQuizComplete = useCallback(() => {
    setInteractionComplete(true)
  }, [])

  const handleQuizReward = useCallback(() => {
    setShowReward(true)
  }, [])

  // ---------------------------------------------------------------------------
  // Voice
  // ---------------------------------------------------------------------------

  const handlePlayVoice = useCallback((text: string, character: string) => {
    playVoice(text, character)
  }, [])

  // Cleanup voice on unmount
  useEffect(() => {
    return () => stopVoice()
  }, [])

  // ---------------------------------------------------------------------------
  // Finish lesson
  // ---------------------------------------------------------------------------

  const handleFinishLesson = useCallback(() => {
    setShowCelebration(true)
    if (id) {
      courseStore.completeLesson(id)
      learnApi
        .updateProgress(id, { progress_pct: 100 })
        .catch((err) => console.error('[LessonPage] API error:', err))
    }
  }, [id, courseStore])

  const handleCelebrationNext = useCallback(() => {
    if (lesson?.exerciseId) {
      navigate(`/learn/exercise/${lesson.exerciseId}`)
    } else if (lesson?.nextLessonId) {
      navigate(`/learn/lesson/${lesson.nextLessonId}`)
    } else {
      navigate('/learn')
    }
  }, [lesson, navigate])

  const handleBackToCourse = useCallback(() => {
    navigate('/learn')
  }, [navigate])

  const handleRewardDismiss = useCallback(() => {
    setShowReward(false)
  }, [])

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <TeacherAvatar expression="happy" accentColor="#6366f1" size={72} />
          <p className="text-lg text-gray-500 font-medium animate-pulse">
            豆丁老师正在准备课程...
          </p>
        </div>
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <TeacherAvatar expression="surprised" accentColor="#6366f1" size={64} />
          <p className="text-gray-500 text-lg">课程加载失败</p>
          <button
            onClick={() => navigate('/learn')}
            className="px-6 py-2 rounded-full bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors"
          >
            返回课程列表
          </button>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Celebration
  // ---------------------------------------------------------------------------

  if (showCelebration) {
    const nextLabel = lesson.exerciseId
      ? '进入练习'
      : lesson.nextLessonId
        ? '下一课'
        : '返回课程'

    return (
      <div
        className={`min-h-screen bg-gradient-to-br ${theme.bg} flex items-center justify-center p-4`}
      >
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg max-w-lg w-full p-8">
          <CelebrationBlock
            xpEarned={lesson.xpReward}
            message="太棒了！课程完成！"
            accentColor={theme.accent}
            onNext={handleCelebrationNext}
            onBackToCourse={
              lesson.nextLessonId || lesson.exerciseId ? handleBackToCourse : undefined
            }
            nextLabel={nextLabel}
          />
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Main — Left/Right split layout
  // ---------------------------------------------------------------------------

  return (
    <div className={`overflow-hidden bg-gradient-to-br ${theme.bg} flex flex-col fixed inset-0 z-30`}>
      {/* Reward overlay */}
      <RewardOverlay visible={showReward} onDismiss={handleRewardDismiss} message="太棒了！" />

      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-white/70 backdrop-blur-sm border-b border-white/40 z-10">
        <button
          onClick={() => navigate('/learn')}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-white hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700 text-sm font-bold shrink-0 shadow-sm"
          aria-label="返回"
        >
          &#10005;
        </button>
        <h1
          className="text-sm font-bold truncate flex-1"
          style={{ color: theme.accent }}
        >
          {lesson.title}
        </h1>
        <div className="shrink-0">
          <StarProgress total={totalBlocks} current={currentStepIdx + 1} />
        </div>
      </div>

      {/* Main content: left board + right chat */}
      {/* Desktop: side by side. Mobile: stacked */}
      <div className="flex-1 flex flex-col sm:flex-row min-h-0">
        {/* Left: Chessboard */}
        <div className="shrink-0 flex items-center justify-center p-2 sm:w-[45%] sm:p-4" style={{ background: 'rgba(0,0,0,0.02)' }}>
          <Chessboard
            fen={currentFen}
            orientation="white"
            interactive={boardInteractive}
            highlights={currentHighlights}
            onMove={handleBoardMove}
            onSquareClick={handleSquareClick}
            getValidMoves={getValidMoves}
          />
        </div>

        {/* Right: Chat */}
        <div className="sm:w-[55%] flex-1 sm:flex-initial flex flex-col min-h-0 bg-gray-50/60 border-l border-white/40">
          <ChatPanel
            messages={displayedMessages}
            activeInteraction={activeInteraction}
            interactionComplete={interactionComplete}
            accentColor={theme.accent}
            onPlayVoice={handlePlayVoice}
            onQuizComplete={handleQuizComplete}
            onQuizReward={handleQuizReward}
          />
        </div>
      </div>

      {/* Footer: navigation buttons */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-white/60 backdrop-blur-sm border-t border-white/40">
        <button
          onClick={handlePrev}
          disabled={currentStepIdx <= 0}
          className={[
            'flex items-center gap-1.5 px-5 py-2.5 rounded-full font-bold text-sm transition-all duration-200',
            currentStepIdx <= 0
              ? 'bg-white/40 text-gray-400 cursor-not-allowed'
              : 'bg-white/80 text-gray-600 hover:bg-white hover:scale-105 active:scale-95 shadow-sm',
          ].join(' ')}
        >
          &#9664; 上一步
        </button>

        {!isLastBlock ? (
          <button
            onClick={handleNext}
            disabled={!canGoNext}
            className={[
              'flex items-center gap-1.5 px-6 py-2.5 rounded-full font-bold text-sm text-white transition-all duration-200 shadow-lg',
              canGoNext
                ? 'hover:scale-105 active:scale-95 hover:shadow-xl'
                : 'opacity-50 cursor-not-allowed',
            ].join(' ')}
            style={{ backgroundColor: theme.accent }}
          >
            下一步 &#9654;
          </button>
        ) : (
          <button
            onClick={handleFinishLesson}
            disabled={activeInteraction !== null && !interactionComplete}
            className={[
              'flex items-center gap-1.5 px-6 py-2.5 rounded-full font-bold text-sm text-white transition-all duration-200 shadow-lg',
              !(activeInteraction !== null && !interactionComplete)
                ? 'hover:scale-105 active:scale-95 hover:shadow-xl'
                : 'opacity-50 cursor-not-allowed',
            ].join(' ')}
            style={{
              background:
                !(activeInteraction !== null && !interactionComplete)
                  ? `linear-gradient(135deg, ${theme.accent}, #8b5cf6)`
                  : undefined,
              backgroundColor:
                activeInteraction !== null && !interactionComplete
                  ? theme.accent
                  : undefined,
            }}
          >
            {lesson.exerciseId
              ? '进入练习'
              : lesson.nextLessonId
                ? '下一课'
                : '完成课程'}{' '}
            &#9989;
          </button>
        )}
      </div>
    </div>
  )
}

export default LessonPage
