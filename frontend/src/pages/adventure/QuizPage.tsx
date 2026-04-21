import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adventureApi } from '@/api/adventure'
import type { QuizBank, ChallengeRecord } from '@/types/api'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'

interface Feedback {
  correct: boolean
  answer: string
  explanation: string
}

interface QuizResult {
  score: number
  passed: boolean
  total: number
  passThreshold: number
}

const QuizPage: React.FC = () => {
  const { challengeId } = useParams<{ challengeId: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [recordId, setRecordId] = useState<string>('')
  const [bank, setBank] = useState<QuizBank | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<QuizResult | null>(null)

  useEffect(() => {
    if (!challengeId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErrorMsg(null)
      try {
        const [startRes, quizRes] = await Promise.all([
          adventureApi.startChallenge(challengeId),
          adventureApi.getQuiz(challengeId),
        ])
        if (cancelled) return
        const record = (startRes.data as any)?.data ?? startRes.data
        const quiz = (quizRes.data as any)?.data ?? quizRes.data
        if (!record?.id || !quiz?.questions?.length) {
          setErrorMsg('题库加载失败')
          setLoading(false)
          return
        }
        setRecordId(record.id)
        setBank(quiz)

        const saved = sessionStorage.getItem(`quiz_${record.id}`)
        if (saved) {
          try {
            setAnswers(JSON.parse(saved))
          } catch { /* ignore corrupt */ }
        }
      } catch (err: any) {
        console.error('[QuizPage] init failed', err)
        setErrorMsg('加载失败，请返回重试')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [challengeId])

  const currentQuestion = bank?.questions[currentIdx]

  const handleSelect = useCallback((key: string) => {
    if (!currentQuestion || feedback) return
    const correct = key === currentQuestion.answer
    const newAnswers = { ...answers, [currentQuestion.id]: key }
    setAnswers(newAnswers)
    if (recordId) sessionStorage.setItem(`quiz_${recordId}`, JSON.stringify(newAnswers))
    setFeedback({
      correct,
      answer: currentQuestion.answer,
      explanation: currentQuestion.explanation,
    })
  }, [currentQuestion, feedback, answers, recordId])

  const handleNext = useCallback(async () => {
    if (!bank) return
    setFeedback(null)
    const isLast = currentIdx >= bank.questions.length - 1
    if (!isLast) {
      setCurrentIdx(currentIdx + 1)
      return
    }
    setSubmitting(true)
    try {
      const res = await adventureApi.completeChallenge(challengeId!, {
        result: 'pass',
        quiz_answers: answers,
      })
      const record: ChallengeRecord = (res.data as any)?.data ?? res.data
      const passed = record.status === 'passed'
      const score = record.quiz_score ?? 0
      setResult({
        score,
        passed,
        total: bank.total_questions,
        passThreshold: bank.pass_threshold,
      })
      sessionStorage.removeItem(`quiz_${recordId}`)
    } catch (err) {
      console.error('[QuizPage] submit failed', err)
      setErrorMsg('提交失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }, [bank, currentIdx, answers, challengeId, recordId])

  const handleRetry = useCallback(() => {
    window.location.reload()
  }, [])

  const handleReturn = useCallback(() => {
    navigate('/adventure')
  }, [navigate])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <div className="text-2xl animate-bounce mb-3">{'\u265E'}</div>
        <p className="text-[var(--text-muted)]">加载中...</p>
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-4">
        <p className="text-[var(--text-sub)]">{errorMsg}</p>
        <Button variant="secondary" onClick={handleReturn}>返回</Button>
      </div>
    )
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <Card padding="lg" hoverable={false}>
          <div className="text-center space-y-4">
            <div className="text-5xl">{result.passed ? '\uD83C\uDF89' : '\uD83D\uDE05'}</div>
            <h2 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
              {result.passed ? '启蒙草原毕业！' : '再接再厉！'}
            </h2>
            <p className="text-[var(--text-md)] text-[var(--text-sub)]">
              答对 {result.score} / {result.total} 题
              {result.passed ? '' : `（需要 ${result.passThreshold} 题才能通过）`}
            </p>
            {result.passed && (
              <div className="flex flex-col items-center gap-1 text-[var(--text-sm)] text-[var(--text-muted)]">
                <span>奖励获得：</span>
                <span>+{bank?.reward_xp ?? 0} XP · +50 金币 · {'\uD83C\uDF3F'} 启蒙草原毕业徽章</span>
              </div>
            )}
          </div>
        </Card>
        <div className="flex gap-3">
          {!result.passed && (
            <Button variant="primary" className="flex-1" onClick={handleRetry}>
              重新挑战
            </Button>
          )}
          <Button variant={result.passed ? 'primary' : 'secondary'} className="flex-1" onClick={handleReturn}>
            返回冒险地图
          </Button>
        </div>
      </div>
    )
  }

  if (!bank || !currentQuestion) return null

  const isLast = currentIdx >= bank.questions.length - 1

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between text-[var(--text-xs)] text-[var(--text-muted)]">
        <span>第 {currentIdx + 1} / {bank.total_questions} 题</span>
        <span>及格线：{bank.pass_threshold} 题</span>
      </div>

      <Card padding="lg" hoverable={false}>
        <h3 className="text-[var(--text-lg)] font-semibold text-[var(--text)] mb-5 leading-relaxed">
          {currentQuestion.text}
        </h3>

        <div className="space-y-2">
          {currentQuestion.options.map((opt) => {
            const selected = answers[currentQuestion.id] === opt.key
            const isCorrectOpt = feedback && opt.key === feedback.answer
            const isWrongSelected = feedback && selected && !feedback.correct
            let bg = 'var(--bg)'
            let border = 'var(--border)'
            if (feedback) {
              if (isCorrectOpt) {
                bg = 'rgba(16,185,129,0.12)'
                border = 'var(--success)'
              } else if (isWrongSelected) {
                bg = 'rgba(239,68,68,0.12)'
                border = 'var(--danger)'
              }
            } else if (selected) {
              bg = 'var(--accent-light)'
              border = 'var(--accent)'
            }
            return (
              <button
                key={opt.key}
                disabled={!!feedback}
                onClick={() => handleSelect(opt.key)}
                className="w-full text-left px-4 py-3 rounded-lg transition-colors disabled:cursor-default"
                style={{
                  background: bg,
                  border: `1.5px solid ${border}`,
                }}
              >
                <span className="font-bold mr-2">{opt.key}.</span>
                {opt.text}
              </button>
            )
          })}
        </div>
      </Card>

      {feedback && (
        <Card
          padding="md"
          hoverable={false}
          style={{
            background: feedback.correct ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
          }}
        >
          <div className="space-y-2">
            <div className="font-semibold text-[var(--text)]">
              {feedback.correct ? '\u2705 答对了！' : `\u274C 答错了，正确答案是 ${feedback.answer}`}
            </div>
            <p className="text-[var(--text-sm)] text-[var(--text-sub)] leading-relaxed">
              {feedback.explanation}
            </p>
          </div>
        </Card>
      )}

      {feedback && (
        <Button
          variant="primary"
          className="w-full"
          loading={submitting}
          onClick={handleNext}
        >
          {isLast ? '提交' : '下一题'}
        </Button>
      )}
    </div>
  )
}

export default QuizPage
