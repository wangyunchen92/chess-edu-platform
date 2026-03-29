import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { learnApi } from '@/api/learn'
import { useCourseStore } from '@/stores/courseStore'
import Chessboard from '@/components/chess/Chessboard'
import Button from '@/components/common/Button'
import Card from '@/components/common/Card'
import ProgressBar from '@/components/common/ProgressBar'
import { Chess } from 'chess.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentBlock {
  type: 'text' | 'board_demo' | 'interactive' | 'quiz'
  // text
  content?: string
  // board_demo
  fen?: string
  description?: string
  highlights?: string[]
  // interactive
  instruction?: string
  expectedMove?: string // UCI format
  successMessage?: string
  // quiz
  question?: string
  options?: string[]
  correctIndex?: number
}

interface LessonData {
  id: string
  title: string
  courseId: string
  blocks: ContentBlock[]
  nextLessonId?: string
  exerciseId?: string
}

const MOCK_LESSON: LessonData = {
  id: 'l1',
  title: '认识棋盘',
  courseId: 'c1',
  nextLessonId: 'l2',
  exerciseId: 'ex-l1',
  blocks: [
    {
      type: 'text',
      content: '国际象棋的棋盘由8x8=64个格子组成，交替排列黑色和白色。每一列用字母a-h表示（从左到右），每一行用数字1-8表示（从下到上）。',
    },
    {
      type: 'board_demo',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      description: '这是国际象棋的初始局面。白棋在下方，黑棋在上方。',
      highlights: ['e1', 'e8'],
    },
    {
      type: 'text',
      content: '棋盘上最重要的棋子是国王（King），用 K 表示。如果你的国王被将死，你就输了！下面用高亮标记了双方国王的位置。',
    },
    {
      type: 'interactive',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      instruction: '试试看：把白方的兵从e2移动到e4！',
      expectedMove: 'e2e4',
      successMessage: '太棒了！这就是最常见的开局第一步 - 国王前兵推两格！',
    },
    {
      type: 'quiz',
      question: '国际象棋的棋盘有多少个格子？',
      options: ['32', '48', '64', '81'],
      correctIndex: 2,
    },
    {
      type: 'text',
      content: '恭喜你完成了第一课！你已经认识了棋盘的基本结构。接下来我们将学习每个棋子的走法。',
    },
  ],
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const LessonPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const courseStore = useCourseStore()

  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentBlockIdx, setCurrentBlockIdx] = useState(0)

  // Interactive block state
  const [interactiveFen, setInteractiveFen] = useState('')
  const [interactiveSuccess, setInteractiveSuccess] = useState(false)

  // Quiz state
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [quizSubmitted, setQuizSubmitted] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    courseStore.setLesson(id)
    learnApi.getLessonContent(id)
      .then((res) => {
        // Unwrap {code, data: {...}} wrapper
        const raw: any = (res.data as any)?.data ?? res.data
        if (!raw || !raw.id) {
          setLesson(MOCK_LESSON)
          return
        }
        // Map backend format to our LessonData interface
        const blocks: ContentBlock[] = raw.blocks
          ?? (raw.content_data?.steps ?? raw.steps ?? []).map((step: any) => {
            const block: ContentBlock = { type: step.type }
            // text block
            if (step.content) block.content = step.content
            // board_demo block
            if (step.fen) block.fen = step.fen
            if (step.description) block.description = step.description
            if (step.highlights) block.highlights = step.highlights
            // interactive block
            if (step.instruction) block.instruction = step.instruction
            if (step.expectedMove) {
              block.expectedMove = step.expectedMove
            } else if (step.correct_squares && Array.isArray(step.correct_squares) && step.correct_squares.length > 0) {
              // Backend uses correct_squares; use the first square as a click target
              // For interactive blocks that need a move, we store it differently
              block.expectedMove = step.correct_squares.join(',')
            }
            if (step.hint) block.successMessage = step.hint
            if (step.successMessage) block.successMessage = step.successMessage
            // quiz block
            if (step.question) block.question = step.question
            if (step.options) block.options = step.options
            if (step.correctIndex !== undefined) block.correctIndex = step.correctIndex
            if (step.correct_answer !== undefined) block.correctIndex = step.correct_answer
            return block
          })
        setLesson({
          id: raw.id,
          title: raw.title ?? '',
          courseId: raw.courseId ?? raw.course_id ?? '',
          blocks,
          nextLessonId: raw.nextLessonId ?? raw.next_lesson_id ?? undefined,
          exerciseId: raw.exerciseId ?? raw.exercise_id ?? undefined,
        })
      })
      .catch((err) => { console.error('[LessonPage] Failed to load lesson:', err); setLesson(MOCK_LESSON) })
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset block-level state when navigating blocks
  useEffect(() => {
    setInteractiveSuccess(false)
    setSelectedAnswer(null)
    setQuizSubmitted(false)
    const block = lesson?.blocks[currentBlockIdx]
    if (block?.type === 'interactive' && block.fen) {
      setInteractiveFen(block.fen)
    }
  }, [currentBlockIdx, lesson])

  const totalBlocks = lesson?.blocks.length ?? 0
  const currentBlock = lesson?.blocks[currentBlockIdx] ?? null
  const progress = totalBlocks > 0 ? Math.round(((currentBlockIdx + 1) / totalBlocks) * 100) : 0

  const canGoNext = useMemo(() => {
    if (!currentBlock) return false
    if (currentBlock.type === 'interactive' && !interactiveSuccess) return false
    if (currentBlock.type === 'quiz' && !quizSubmitted) return false
    return true
  }, [currentBlock, interactiveSuccess, quizSubmitted])

  const goNext = useCallback(() => {
    if (currentBlockIdx < totalBlocks - 1) {
      setCurrentBlockIdx((i) => i + 1)
      learnApi.updateProgress(id!, { progress_pct: Math.round(((currentBlockIdx + 1) / totalBlocks) * 100) }).catch((err) => console.error('[LessonPage] API error:', err))
    }
  }, [currentBlockIdx, totalBlocks, id])

  const goPrev = useCallback(() => {
    if (currentBlockIdx > 0) setCurrentBlockIdx((i) => i - 1)
  }, [currentBlockIdx])

  const handleInteractiveMove = useCallback(
    (from: string, to: string) => {
      if (!currentBlock || interactiveSuccess) return
      const move = `${from}${to}`
      if (move === currentBlock.expectedMove) {
        try {
          const chess = new Chess(interactiveFen)
          chess.move({ from, to })
          setInteractiveFen(chess.fen())
        } catch { /* ignore */ }
        setInteractiveSuccess(true)
      }
    },
    [currentBlock, interactiveFen, interactiveSuccess],
  )

  const getInteractiveValidMoves = useCallback(
    (square: string): string[] => {
      try {
        const chess = new Chess(interactiveFen)
        return chess.moves({ square: square as any, verbose: true }).map((m) => m.to)
      } catch {
        return []
      }
    },
    [interactiveFen],
  )

  const handleQuizSubmit = useCallback(() => {
    if (selectedAnswer === null) return
    setQuizSubmitted(true)
  }, [selectedAnswer])

  const handleFinishLesson = useCallback(() => {
    if (id) {
      courseStore.completeLesson(id)
      learnApi.updateProgress(id, { progress_pct: 100 }).catch((err) => console.error('[LessonPage] API error:', err))
    }
    if (lesson?.exerciseId) {
      navigate(`/learn/exercise/${lesson.exerciseId}`)
    } else if (lesson?.nextLessonId) {
      navigate(`/learn/lesson/${lesson.nextLessonId}`)
    } else {
      navigate('/learn')
    }
  }, [id, lesson, navigate, courseStore, totalBlocks])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-4xl animate-bounce">{'\uD83D\uDCDA'}</div>
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[var(--text-sub)]">未找到课程</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
            {lesson.title}
          </h1>
          <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">
            {currentBlockIdx + 1} / {totalBlocks}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/learn')}>
          返回课程
        </Button>
      </div>

      {/* Progress */}
      <ProgressBar value={progress} max={100} height={4} />

      {/* Content block */}
      <Card padding="lg" hoverable={false}>
        {/* Text block */}
        {currentBlock?.type === 'text' && (
          <div className="prose prose-sm max-w-none">
            <p className="text-[var(--text-md)] text-[var(--text)] leading-relaxed whitespace-pre-line">
              {currentBlock.content}
            </p>
          </div>
        )}

        {/* Board demo */}
        {currentBlock?.type === 'board_demo' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <Chessboard
                fen={currentBlock.fen!}
                orientation="white"
                interactive={false}
                highlights={currentBlock.highlights}
              />
            </div>
            {currentBlock.description && (
              <p className="text-[var(--text-sm)] text-[var(--text-sub)] text-center leading-relaxed">
                {currentBlock.description}
              </p>
            )}
          </div>
        )}

        {/* Interactive */}
        {currentBlock?.type === 'interactive' && (
          <div className="space-y-4">
            <div
              className="p-3 rounded-[var(--radius-sm)] text-center"
              style={{
                background: interactiveSuccess ? 'rgba(16,185,129,0.08)' : 'var(--accent-light)',
                border: `1px solid ${interactiveSuccess ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.15)'}`,
              }}
            >
              <p className="text-[var(--text-sm)] font-medium" style={{ color: interactiveSuccess ? 'var(--success)' : 'var(--accent)' }}>
                {interactiveSuccess ? currentBlock.successMessage : currentBlock.instruction}
              </p>
            </div>
            <div className="flex justify-center">
              <Chessboard
                fen={interactiveFen}
                onMove={handleInteractiveMove}
                getValidMoves={getInteractiveValidMoves}
                orientation="white"
                interactive={!interactiveSuccess}
              />
            </div>
            {interactiveSuccess && (
              <div className="text-center text-2xl">{'\uD83C\uDF89'}</div>
            )}
          </div>
        )}

        {/* Quiz */}
        {currentBlock?.type === 'quiz' && (
          <div className="space-y-4">
            <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">
              {'\u2753'} {currentBlock.question}
            </h3>
            <div className="space-y-2">
              {currentBlock.options?.map((option, i) => {
                const isCorrect = i === currentBlock.correctIndex
                const isSelected = selectedAnswer === i
                let bg = 'var(--bg)'
                let border = 'var(--border)'
                let textColor = 'var(--text)'

                if (quizSubmitted) {
                  if (isCorrect) {
                    bg = 'rgba(16,185,129,0.1)'
                    border = 'var(--success)'
                    textColor = 'var(--success)'
                  } else if (isSelected && !isCorrect) {
                    bg = 'rgba(239,68,68,0.1)'
                    border = 'var(--danger)'
                    textColor = 'var(--danger)'
                  }
                } else if (isSelected) {
                  bg = 'var(--accent-light)'
                  border = 'var(--accent)'
                  textColor = 'var(--accent)'
                }

                return (
                  <button
                    key={i}
                    onClick={() => !quizSubmitted && setSelectedAnswer(i)}
                    className="w-full text-left px-4 py-3 rounded-[var(--radius-sm)] transition-colors flex items-center gap-3"
                    style={{ background: bg, border: `1px solid ${border}`, color: textColor }}
                    disabled={quizSubmitted}
                  >
                    <span className="w-6 h-6 rounded-full border flex items-center justify-center text-[var(--text-xs)] font-bold shrink-0"
                      style={{ borderColor: border }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-[var(--text-sm)]">{option}</span>
                  </button>
                )
              })}
            </div>
            {!quizSubmitted && (
              <Button variant="primary" size="sm" onClick={handleQuizSubmit} disabled={selectedAnswer === null}>
                提交答案
              </Button>
            )}
            {quizSubmitted && (
              <div className="text-center">
                {selectedAnswer === currentBlock.correctIndex ? (
                  <p className="text-[var(--success)] font-semibold">{'\u2705'} 回答正确！</p>
                ) : (
                  <p className="text-[var(--danger)]">{'\u274C'} 正确答案是 {String.fromCharCode(65 + (currentBlock.correctIndex ?? 0))}</p>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={goPrev} disabled={currentBlockIdx === 0}>
          {'\u25C0'} 上一步
        </Button>
        {currentBlockIdx < totalBlocks - 1 ? (
          <Button variant="primary" size="sm" onClick={goNext} disabled={!canGoNext}>
            下一步 {'\u25B6'}
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={handleFinishLesson} disabled={!canGoNext}>
            {lesson.exerciseId ? '进入练习' : lesson.nextLessonId ? '下一课' : '完成课程'} {'\u2705'}
          </Button>
        )}
      </div>
    </div>
  )
}

export default LessonPage
