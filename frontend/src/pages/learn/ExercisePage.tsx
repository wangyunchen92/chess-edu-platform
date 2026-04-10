import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { learnApi } from '@/api/learn'
import Chessboard from '@/components/chess/Chessboard'
import Button from '@/components/common/Button'
import Card from '@/components/common/Card'
import ProgressBar from '@/components/common/ProgressBar'
import { Chess } from 'chess.js'

interface Exercise {
  id: string
  type: 'quiz' | 'board'
  // quiz
  question?: string
  options?: string[]
  correctIndex?: number
  // board
  fen?: string
  instruction?: string
  expectedMove?: string
  explanation?: string
}

interface ExerciseSet {
  id: string
  lessonId: string
  title: string
  exercises: Exercise[]
  nextLessonId?: string
}

const ExercisePage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [exerciseSet, setExerciseSet] = useState<ExerciseSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [score, setScore] = useState<number | null>(null)

  // Per-exercise state
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [boardFen, setBoardFen] = useState('')
  const [boardSuccess, setBoardSuccess] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    learnApi.getExercises(id)
      .then((res) => {
        const payload = (res.data as any)?.data ?? res.data
        // API returns array directly; wrap into ExerciseSet format
        if (Array.isArray(payload)) {
          const exercises: Exercise[] = payload.map((e: any) => ({
            id: e.id,
            type: e.exercise_type === 'board' ? 'board' : 'quiz',
            question: e.question_text,
            options: e.options,
            correctIndex: e.correct_answer != null ? parseInt(e.correct_answer, 10) : undefined,
            fen: e.fen,
            instruction: e.question_text,
            expectedMove: e.correct_answer,
            explanation: e.explanation,
          }))
          setExerciseSet({
            id: id,
            lessonId: id,
            title: `课后练习`,
            exercises,
          })
        } else if (payload?.exercises) {
          setExerciseSet(payload)
        } else if (payload) {
          setExerciseSet(payload)
        }
      })
      .catch((err) => { console.error('[ExercisePage] Failed to load exercises:', err); setExerciseSet(null) })
      .finally(() => setLoading(false))
  }, [id])

  const exercises = exerciseSet?.exercises ?? []
  const current = exercises[currentIdx]
  const totalExercises = exercises.length

  // Reset per-exercise state when idx changes
  useEffect(() => {
    setSelectedAnswer(null)
    setQuizSubmitted(false)
    setBoardSuccess(false)
    if (current?.type === 'board' && current.fen) {
      setBoardFen(current.fen)
    }
  }, [currentIdx, current])

  const handleBoardMove = useCallback(
    (from: string, to: string) => {
      if (!current || boardSuccess) return
      const move = `${from}${to}`
      if (move === current.expectedMove) {
        try {
          const chess = new Chess(boardFen)
          chess.move({ from, to })
          setBoardFen(chess.fen())
        } catch { /* */ }
        setBoardSuccess(true)
        setAnswers((prev) => ({ ...prev, [current.id]: move }))
        // Submit immediately
        learnApi.submitExercise(current.id, { user_answer: move })
          .catch((err) => console.error('[ExercisePage] submit error:', err))
      }
    },
    [current, boardFen, boardSuccess],
  )

  const getBoardValidMoves = useCallback(
    (square: string): string[] => {
      try {
        const chess = new Chess(boardFen)
        return chess.moves({ square: square as any, verbose: true }).map((m) => m.to)
      } catch {
        return []
      }
    },
    [boardFen],
  )

  const handleQuizSubmit = useCallback(() => {
    if (selectedAnswer === null || !current) return
    setQuizSubmitted(true)
    const answerStr = String(selectedAnswer)
    setAnswers((prev) => ({ ...prev, [current.id]: answerStr }))
    // Submit immediately
    learnApi.submitExercise(current.id, { user_answer: answerStr })
      .catch((err) => console.error('[ExercisePage] submit error:', err))
  }, [selectedAnswer, current])

  const canProceed = current?.type === 'quiz' ? quizSubmitted : boardSuccess

  const goNext = useCallback(() => {
    if (currentIdx + 1 < totalExercises) {
      setCurrentIdx((i) => i + 1)
    } else {
      // Calculate score
      const correct = exercises.filter((ex) => {
        const ans = answers[ex.id]
        if (ans == null) return false
        if (ex.type === 'quiz') {
          return parseInt(ans, 10) === ex.correctIndex
        }
        // board type: answer is the move string, matches expectedMove
        return ans === ex.expectedMove
      }).length
      setScore(correct)
    }
  }, [currentIdx, totalExercises, exercises, answers])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-4xl animate-bounce">{'\u270D\uFE0F'}</div>
      </div>
    )
  }

  if (!exerciseSet) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[var(--text-sub)]">练习加载失败，请返回重试</p>
      </div>
    )
  }

  // Score screen
  if (score !== null) {
    const percent = Math.round((score / totalExercises) * 100)
    return (
      <div className="max-w-md mx-auto space-y-5 py-12">
        <Card padding="lg" hoverable={false}>
          <div className="text-center space-y-4">
            <div className="text-5xl">
              {percent >= 80 ? '\uD83C\uDF89' : percent >= 50 ? '\uD83D\uDCAA' : '\uD83D\uDCA1'}
            </div>
            <h2 className="text-[var(--text-xl)] font-bold text-[var(--text)]">
              练习完成！
            </h2>
            <div className="text-[var(--text-3xl)] font-extrabold" style={{ color: percent >= 80 ? 'var(--success)' : percent >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
              {score} / {totalExercises}
            </div>
            <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
              {percent >= 80 ? '太棒了！你已经掌握了这一课的内容！' : percent >= 50 ? '不错！可以复习一下再试试。' : '加油！回去再看看课程内容吧。'}
            </p>
            <div className="flex gap-3 pt-2">
              {exerciseSet.nextLessonId ? (
                <Button variant="primary" className="flex-1" onClick={() => navigate(`/learn/lesson/${exerciseSet.nextLessonId}`)}>
                  下一课
                </Button>
              ) : (
                <Button variant="primary" className="flex-1" onClick={() => navigate('/learn')}>
                  返回课程
                </Button>
              )}
              <Button variant="secondary" className="flex-1" onClick={() => { setScore(null); setCurrentIdx(0); setAnswers({}) }}>
                重做
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
            {'\u270D\uFE0F'} {exerciseSet.title}
          </h1>
          <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">
            {currentIdx + 1} / {totalExercises}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/learn')}>
          返回
        </Button>
      </div>

      <ProgressBar value={currentIdx + 1} max={totalExercises} height={4} />

      <Card padding="lg" hoverable={false}>
        {/* Quiz type */}
        {current?.type === 'quiz' && (
          <div className="space-y-4">
            <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">
              {current.question}
            </h3>
            <div className="space-y-2">
              {current.options?.map((opt, i) => {
                const isCorrect = i === current.correctIndex
                const isSelected = selectedAnswer === i
                let bg = 'var(--bg)'
                let border = 'var(--border)'

                if (quizSubmitted) {
                  if (isCorrect) { bg = 'rgba(16,185,129,0.1)'; border = 'var(--success)' }
                  else if (isSelected) { bg = 'rgba(239,68,68,0.1)'; border = 'var(--danger)' }
                } else if (isSelected) {
                  bg = 'var(--accent-light)'; border = 'var(--accent)'
                }

                return (
                  <button
                    key={i}
                    onClick={() => !quizSubmitted && setSelectedAnswer(i)}
                    className="w-full text-left px-4 py-3 rounded-[var(--radius-sm)] transition-colors"
                    style={{ background: bg, border: `1px solid ${border}` }}
                    disabled={quizSubmitted}
                  >
                    <span className="text-[var(--text-sm)]">{String.fromCharCode(65 + i)}. {opt}</span>
                  </button>
                )
              })}
            </div>
            {!quizSubmitted && (
              <Button variant="primary" size="sm" onClick={handleQuizSubmit} disabled={selectedAnswer === null}>
                确认
              </Button>
            )}
            {quizSubmitted && (
              <p className={`text-[var(--text-sm)] font-medium ${selectedAnswer === current.correctIndex ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                {selectedAnswer === current.correctIndex ? '\u2705 正确！' : `\u274C 正确答案是 ${String.fromCharCode(65 + (current.correctIndex ?? 0))}`}
              </p>
            )}
          </div>
        )}

        {/* Board type */}
        {current?.type === 'board' && (
          <div className="space-y-4">
            <div
              className="p-3 rounded-[var(--radius-sm)] text-center"
              style={{
                background: boardSuccess ? 'rgba(16,185,129,0.08)' : 'var(--accent-light)',
              }}
            >
              <p className="text-[var(--text-sm)] font-medium" style={{ color: boardSuccess ? 'var(--success)' : 'var(--accent)' }}>
                {boardSuccess ? (current.explanation ?? '\u2705 正确！') : current.instruction}
              </p>
            </div>
            <div className="flex justify-center">
              <Chessboard
                fen={boardFen}
                onMove={handleBoardMove}
                getValidMoves={getBoardValidMoves}
                orientation="white"
                interactive={!boardSuccess}
              />
            </div>
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={goNext} disabled={!canProceed}>
          {currentIdx + 1 < totalExercises ? '下一题 \u25B6' : '查看结果 \u2705'}
        </Button>
      </div>
    </div>
  )
}

export default ExercisePage
