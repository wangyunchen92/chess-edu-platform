import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '@/components/common/Button'
import Card from '@/components/common/Card'
import Chessboard from '@/components/chess/Chessboard'
import { assessmentApi } from '@/api/assessment'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExperienceLevel {
  id: string
  emoji: string
  title: string
  description: string
}

interface LocalQuestion {
  id: string
  fen: string
  prompt: string
  options: { label: string; value: string }[]
  correctAnswer: string
}

interface AssessmentResult {
  initial_rating: number
  rank_title: string
  message: string
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const EXPERIENCE_LEVELS: ExperienceLevel[] = [
  {
    id: 'none',
    emoji: '\uD83C\uDF31',
    title: '完全没有',
    description: '我还不知道棋子怎么走',
  },
  {
    id: 'rules',
    emoji: '\uD83C\uDFB2',
    title: '知道规则',
    description: '我知道基本规则但很少下棋',
  },
  {
    id: 'experienced',
    emoji: '\u265E',
    title: '有经验',
    description: '我经常下棋，了解基本战术',
  },
  {
    id: 'advanced',
    emoji: '\uD83C\uDFC6',
    title: '高手',
    description: '我有系统的学习经历或比赛经验',
  },
]

// Fallback questions when API is not available
const FALLBACK_QUESTIONS: Record<string, LocalQuestion[]> = {
  none: [
    { id: 'q1', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', prompt: '白棋先走，以下哪个是合法的第一步？', options: [{ label: 'e2-e4', value: 'e4' }, { label: 'e2-e5', value: 'e5' }, { label: 'e1-e3', value: 'e3x' }], correctAnswer: 'e4' },
    { id: 'q2', fen: '8/8/8/8/8/8/8/4K2R w K - 0 1', prompt: '白王可以进行王车易位吗？', options: [{ label: '可以', value: 'yes' }, { label: '不可以', value: 'no' }], correctAnswer: 'yes' },
    { id: 'q3', fen: '8/8/8/3k4/8/8/8/4K3 w - - 0 1', prompt: '这个局面是什么结果？', options: [{ label: '白赢', value: 'white' }, { label: '和棋', value: 'draw' }, { label: '继续', value: 'continue' }], correctAnswer: 'draw' },
    { id: 'q4', fen: '8/P7/8/8/8/8/8/4K3 w - - 0 1', prompt: '白兵到达第8行会怎样？', options: [{ label: '消失', value: 'gone' }, { label: '升变', value: 'promote' }, { label: '不动', value: 'stay' }], correctAnswer: 'promote' },
    { id: 'q5', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', prompt: '黑方可以走哪个棋子？', options: [{ label: '黑王', value: 'king' }, { label: '黑马', value: 'knight' }, { label: '两者都可以', value: 'both' }], correctAnswer: 'both' },
  ],
  rules: [
    { id: 'q1', fen: 'r1bqkb1r/pppppppp/2n2n2/8/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', prompt: '白方的最佳发展棋步是什么？', options: [{ label: 'Bb5', value: 'Bb5' }, { label: 'Nc3', value: 'Nc3' }, { label: 'd3', value: 'd3' }], correctAnswer: 'Bb5' },
    { id: 'q2', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', prompt: '黑方如何防守e5兵？', options: [{ label: 'd6', value: 'd6' }, { label: 'Nf6', value: 'Nf6' }, { label: 'a6', value: 'a6' }], correctAnswer: 'Nf6' },
    { id: 'q3', fen: 'rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', prompt: '白方此时应该？', options: [{ label: '王车易位', value: 'castle' }, { label: 'd3', value: 'd3' }, { label: 'Nc3', value: 'Nc3' }], correctAnswer: 'castle' },
    { id: 'q4', fen: 'r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2', prompt: '开局原则中，以下哪个最重要？', options: [{ label: '出动棋子', value: 'develop' }, { label: '吃兵', value: 'capture' }, { label: '走王', value: 'king' }], correctAnswer: 'develop' },
    { id: 'q5', fen: '4k3/8/8/8/8/8/4R3/4K3 w - - 0 1', prompt: '这个残局白方能赢吗？', options: [{ label: '能', value: 'yes' }, { label: '不能', value: 'no' }, { label: '和棋', value: 'draw' }], correctAnswer: 'yes' },
  ],
  experienced: [
    { id: 'q1', fen: 'r2qkb1r/ppp2ppp/2np1n2/4p1B1/2B1P3/5N2/PPPP1PPP/RN1QK2R w KQkq - 0 5', prompt: '白方的最强着法是？', options: [{ label: 'Bxf6', value: 'Bxf6' }, { label: 'O-O', value: 'OO' }, { label: 'd3', value: 'd3' }], correctAnswer: 'Bxf6' },
    { id: 'q2', fen: 'r1b1k2r/ppppqppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 5 6', prompt: '白方应该如何继续？', options: [{ label: 'O-O', value: 'OO' }, { label: 'Bg5', value: 'Bg5' }, { label: 'a3', value: 'a3' }], correctAnswer: 'Bg5' },
    { id: 'q3', fen: 'r4rk1/pp2ppbp/2np1np1/q7/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 0 10', prompt: '白方的战略目标是？', options: [{ label: '中心扩张', value: 'center' }, { label: '王翼进攻', value: 'kingside' }, { label: '后翼扩展', value: 'queenside' }], correctAnswer: 'center' },
    { id: 'q4', fen: 'r1bq1rk1/ppp2ppp/2n5/3np3/8/5NP1/PPPPPPBP/RNBQ1RK1 w - - 0 7', prompt: '白方的最佳计划是？', options: [{ label: 'c4赶马', value: 'c4' }, { label: 'd3', value: 'd3' }, { label: 'Re1', value: 'Re1' }], correctAnswer: 'c4' },
    { id: 'q5', fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', prompt: '白方怎样赢得这个残局？', options: [{ label: '车占开放线', value: 'rook' }, { label: '推兵', value: 'pawn' }, { label: '王前进', value: 'king' }], correctAnswer: 'rook' },
  ],
  advanced: [
    { id: 'q1', fen: 'r1bqr1k1/pp1n1pbp/2pp1np1/4p3/2P1P3/2N1BN1P/PP2BPP1/R2Q1RK1 w - - 0 11', prompt: '此局面中白方最精确的计划？', options: [{ label: 'd4突破', value: 'd4' }, { label: 'Nd5占位', value: 'Nd5' }, { label: 'b4扩张', value: 'b4' }], correctAnswer: 'Nd5' },
    { id: 'q2', fen: 'r4rk1/1b2bppp/ppnqpn2/8/2pPP3/P1N2NB1/1PQ1BPPP/R4RK1 w - - 0 14', prompt: '白方应该？', options: [{ label: 'e5突破', value: 'e5' }, { label: 'a4', value: 'a4' }, { label: 'Rad1', value: 'Rad1' }], correctAnswer: 'e5' },
    { id: 'q3', fen: '2r2rk1/pp3ppp/2n1bn2/3pp3/8/2NPBNP1/PP2PPBP/R4RK1 w - - 0 12', prompt: '白方的长期战略优势在于？', options: [{ label: '双象优势', value: 'bishops' }, { label: '兵型优势', value: 'pawns' }, { label: '空间优势', value: 'space' }], correctAnswer: 'bishops' },
    { id: 'q4', fen: '8/pp3pkp/2p3p1/8/3Pp3/2P1P1P1/PP4KP/8 w - - 0 30', prompt: '这个兵残局的结果？', options: [{ label: '白赢', value: 'white' }, { label: '黑赢', value: 'black' }, { label: '和棋', value: 'draw' }], correctAnswer: 'white' },
    { id: 'q5', fen: 'r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 5 9', prompt: '白方的经典计划是？', options: [{ label: 'g4-g5进攻', value: 'g4' }, { label: 'O-O-O然后h4', value: 'OOO' }, { label: 'Bc4', value: 'Bc4' }], correctAnswer: 'OOO' },
  ],
}

const RATING_MAP: Record<string, { base: number; perCorrect: number; rank: string }> = {
  none: { base: 200, perCorrect: 40, rank: '铜星' },
  rules: { base: 500, perCorrect: 60, rank: '铜月' },
  experienced: { base: 900, perCorrect: 60, rank: '银星' },
  advanced: { base: 1300, perCorrect: 80, rank: '金星' },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AssessmentPage: React.FC = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState<'level' | 'questions' | 'result'>('level')
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)
  const [questions, setQuestions] = useState<LocalQuestion[]>([])
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSelectLevel = useCallback(async (levelId: string) => {
    setSelectedLevel(levelId)

    // Try fetching questions from API, fallback to local
    try {
      const res = await assessmentApi.getQuestions(levelId)
      const payload = res.data?.data
      if (payload?.questions?.length) {
        // Map backend AssessmentQuestion format to LocalQuestion
        const mapped: LocalQuestion[] = payload.questions.map((q) => ({
          id: q.id,
          fen: q.image_url ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          prompt: q.question,
          options: q.options.map((o) => ({ label: o.label, value: o.key })),
          correctAnswer: q.options.find((o) => o.is_correct)?.key ?? '',
        }))
        setQuestions(mapped)
      } else {
        setQuestions(FALLBACK_QUESTIONS[levelId] ?? FALLBACK_QUESTIONS.none)
      }
    } catch {
      setQuestions(FALLBACK_QUESTIONS[levelId] ?? FALLBACK_QUESTIONS.none)
    }

    setAnswers({})
    setCurrentQ(0)
    setStep('questions')
  }, [])

  const handleAnswer = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }, [])

  const handleNext = useCallback(() => {
    if (currentQ < questions.length - 1) {
      setCurrentQ((prev) => prev + 1)
    }
  }, [currentQ, questions.length])

  const handlePrev = useCallback(() => {
    if (currentQ > 0) {
      setCurrentQ((prev) => prev - 1)
    }
  }, [currentQ])

  const handleSubmit = useCallback(async () => {
    if (!selectedLevel) return
    setSubmitting(true)

    try {
      const payload = {
        experience_level: selectedLevel,
        answers: Object.entries(answers).map(([qid, ans]) => ({
          question_id: qid,
          selected_key: ans,
        })),
      }

      const res = await assessmentApi.submit(payload)
      const resData = (res.data as any)?.data ?? res.data
      if (resData) {
        setResult({
          initial_rating: resData.initial_rating,
          rank_title: resData.rank_title,
          message: resData.message ?? '',
        })
      } else {
        throw new Error('No data')
      }
    } catch {
      // Calculate locally
      const config = RATING_MAP[selectedLevel] ?? RATING_MAP.none
      let correct = 0
      questions.forEach((q) => {
        if (answers[q.id] === q.correctAnswer) correct++
      })
      const initial_rating = config.base + correct * config.perCorrect
      const rank_title = config.rank
      const message =
        correct >= 4
          ? '你的基础很扎实！建议从战术训练开始提升。'
          : correct >= 2
            ? '你有不错的基础，建议多练习实战和谜题。'
            : '建议从基础课程开始学习，循序渐进地提升棋力。'

      setResult({ initial_rating, rank_title, message })
    } finally {
      setSubmitting(false)
      setStep('result')
    }
  }, [selectedLevel, answers, questions])

  const handleFinish = useCallback(() => {
    // Assessment result is saved on backend; navigate home and let
    // dashboard / profile fetch the updated user data from /user/me.
    navigate('/')
  }, [navigate])

  const currentQuestion = questions[currentQ]
  const allAnswered = questions.every((q) => answers[q.id])

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-full max-w-2xl">
        {/* ── Step 1: Select Experience Level ── */}
        {step === 'level' && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-[var(--text-3xl)] font-bold text-[var(--text)]">
                水平评估
              </h1>
              <p className="mt-2 text-[var(--text-sm)] text-[var(--text-sub)]">
                选择你的国际象棋经验等级，我们为你量身定制学习计划
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {EXPERIENCE_LEVELS.map((level) => (
                <Card
                  key={level.id}
                  hoverable
                  padding="lg"
                  onClick={() => handleSelectLevel(level.id)}
                  className="cursor-pointer text-center"
                >
                  <div className="text-4xl mb-3">{level.emoji}</div>
                  <h3 className="text-[var(--text-lg)] font-semibold text-[var(--text)]">
                    {level.title}
                  </h3>
                  <p className="mt-1 text-[var(--text-xs)] text-[var(--text-sub)]">
                    {level.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Questions ── */}
        {step === 'questions' && currentQuestion && (
          <div className="space-y-6">
            {/* Progress */}
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-sm)] text-[var(--text-sub)]">
                第 {currentQ + 1} / {questions.length} 题
              </span>
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={[
                      'w-2 h-2 rounded-full transition-colors',
                      i === currentQ
                        ? 'bg-[var(--accent)]'
                        : answers[questions[i].id]
                          ? 'bg-[var(--success)]'
                          : 'bg-[var(--border)]',
                    ].join(' ')}
                  />
                ))}
              </div>
            </div>

            {/* Question */}
            <Card padding="lg">
              <h3 className="text-[var(--text-lg)] font-semibold text-[var(--text)] mb-4">
                {currentQuestion.prompt}
              </h3>

              {/* Board */}
              <div className="flex justify-center mb-4">
                <Chessboard
                  fen={currentQuestion.fen}
                  interactive={false}
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                {currentQuestion.options.map((opt) => (
                  <button
                    key={opt.value}
                    className={[
                      'w-full text-left px-4 py-3 rounded-[var(--radius-sm)]',
                      'border transition-all duration-150 text-[var(--text-sm)]',
                      answers[currentQuestion.id] === opt.value
                        ? 'border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)] font-medium'
                        : 'border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]',
                    ].join(' ')}
                    onClick={() => handleAnswer(currentQuestion.id, opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Card>

            {/* Navigation */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={handlePrev}
                disabled={currentQ === 0}
              >
                上一题
              </Button>
              <div className="flex-1" />
              {currentQ < questions.length - 1 ? (
                <Button
                  variant="primary"
                  onClick={handleNext}
                  disabled={!answers[currentQuestion.id]}
                >
                  下一题
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  loading={submitting}
                  disabled={!allAnswered}
                >
                  提交
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Result ── */}
        {step === 'result' && result && (
          <div className="text-center space-y-6">
            <div className="text-5xl">\uD83C\uDFC5</div>
            <h1 className="text-[var(--text-3xl)] font-bold text-[var(--text)]">
              评估完成！
            </h1>

            <Card padding="lg" className="inline-block mx-auto">
              <div className="space-y-4 min-w-[280px]">
                <div>
                  <div className="text-[var(--text-xs)] text-[var(--text-muted)] mb-1">初始评分</div>
                  <div className="text-[var(--text-4xl)] font-extrabold text-[var(--accent)]">
                    {result.initial_rating}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--text-xs)] text-[var(--text-muted)] mb-1">段位</div>
                  <div className="text-[var(--text-xl)] font-bold text-[var(--text)]">
                    {result.rank_title}
                  </div>
                </div>
                <div className="pt-2 border-t border-[var(--border)]">
                  <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
                    {result.message}
                  </p>
                </div>
              </div>
            </Card>

            <Button variant="primary" size="lg" onClick={handleFinish}>
              开始学棋之旅
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AssessmentPage
