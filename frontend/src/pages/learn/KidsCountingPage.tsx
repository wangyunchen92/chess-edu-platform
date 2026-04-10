import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { learnApi } from '@/api/learn'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CountingLevel {
  level: number
  gridSize: number
  pieces: { type: string; color: 'w' | 'b'; pos: [number, number] }[]
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

type GamePhase = 'select' | 'play' | 'result'

// ---------------------------------------------------------------------------
// Level data (10 levels)
// ---------------------------------------------------------------------------

const COUNTING_LEVELS: CountingLevel[] = [
  // L1-3: Single piece counting
  {
    level: 1,
    gridSize: 6,
    pieces: [{ type: 'R', color: 'w', pos: [3, 3] }],
    question: '\u8FD9\u4E2A\u8F66\u80FD\u653B\u51FB\u51E0\u4E2A\u683C\u5B50\uFF1F',
    options: ['6', '8', '10', '12'],
    correctIndex: 2,
    explanation: '\u8F66\u80FD\u6C34\u5E73\u548C\u7AD6\u76F4\u653B\u51FB\uFF0C\u5728\u8FD9\u4E2A\u4F4D\u7F6E\u5171\u80FD\u653B\u51FB10\u4E2A\u683C\u5B50\uFF01',
  },
  {
    level: 2,
    gridSize: 6,
    pieces: [{ type: 'B', color: 'w', pos: [3, 3] }],
    question: '\u8FD9\u4E2A\u8C61\u80FD\u653B\u51FB\u51E0\u4E2A\u683C\u5B50\uFF1F',
    options: ['5', '7', '9', '11'],
    correctIndex: 2,
    explanation: '\u8C61\u6CBF\u5BF9\u89D2\u7EBF\u653B\u51FB\uFF0C\u5728\u8FD9\u4E2A\u4F4D\u7F6E\u5171\u80FD\u653B\u51FB9\u4E2A\u683C\u5B50\uFF01',
  },
  {
    level: 3,
    gridSize: 6,
    pieces: [{ type: 'N', color: 'w', pos: [3, 3] }],
    question: '\u8FD9\u4E2A\u9A6C\u80FD\u653B\u51FB\u51E0\u4E2A\u683C\u5B50\uFF1F',
    options: ['4', '6', '8', '10'],
    correctIndex: 2,
    explanation: '\u9A6C\u8D70\u201CL\u201D\u5F62\uFF0C\u5728\u4E2D\u5FC3\u4F4D\u7F6E\u5171\u67098\u4E2A\u8DF3\u7684\u65B9\u5411\uFF01',
  },
  // L4-6: Find which piece can capture
  {
    level: 4,
    gridSize: 6,
    pieces: [
      { type: 'R', color: 'w', pos: [5, 0] },
      { type: 'B', color: 'w', pos: [5, 5] },
      { type: 'p', color: 'b', pos: [5, 3] },
    ],
    question: '\u54EA\u4E2A\u767D\u68CB\u5B50\u80FD\u5403\u6389\u9ED1\u5175\uFF1F',
    options: ['\u8F66', '\u8C61', '\u90FD\u53EF\u4EE5', '\u90FD\u4E0D\u53EF\u4EE5'],
    correctIndex: 0,
    explanation: '\u8F66\u53EF\u4EE5\u6C34\u5E73\u79FB\u52A8\u5230\u9ED1\u5175\u7684\u4F4D\u7F6E\uFF0C\u800C\u8C61\u53EA\u80FD\u8D70\u659C\u7EBF\uFF01',
  },
  {
    level: 5,
    gridSize: 6,
    pieces: [
      { type: 'N', color: 'w', pos: [4, 2] },
      { type: 'R', color: 'w', pos: [0, 0] },
      { type: 'p', color: 'b', pos: [2, 3] },
    ],
    question: '\u54EA\u4E2A\u767D\u68CB\u5B50\u80FD\u5403\u6389\u9ED1\u5175\uFF1F',
    options: ['\u8F66', '\u9A6C', '\u90FD\u53EF\u4EE5', '\u90FD\u4E0D\u53EF\u4EE5'],
    correctIndex: 1,
    explanation: '\u9A6C\u4ECE(4,2)\u8DF3\u201CL\u201D\u5F62\u5230(2,3)\u53EF\u4EE5\u5403\u6389\u9ED1\u5175\uFF01',
  },
  {
    level: 6,
    gridSize: 6,
    pieces: [
      { type: 'Q', color: 'w', pos: [5, 0] },
      { type: 'N', color: 'w', pos: [0, 5] },
      { type: 'p', color: 'b', pos: [3, 2] },
    ],
    question: '\u54EA\u4E2A\u767D\u68CB\u5B50\u80FD\u5403\u6389\u9ED1\u5175\uFF1F',
    options: ['\u540E', '\u9A6C', '\u90FD\u53EF\u4EE5', '\u90FD\u4E0D\u53EF\u4EE5'],
    correctIndex: 0,
    explanation: '\u540E\u80FD\u8D70\u659C\u7EBF\uFF0C\u4ECE(5,0)\u659C\u8D70\u5230(3,2)\u53EF\u4EE5\u5403\u6389\u9ED1\u5175\uFF01',
  },
  // L7-10: Comprehensive
  {
    level: 7,
    gridSize: 6,
    pieces: [
      { type: 'R', color: 'w', pos: [0, 0] },
      { type: 'R', color: 'b', pos: [0, 5] },
    ],
    question: '\u8C01\u66F4\u5371\u9669\uFF1F\uFF08\u8C01\u80FD\u5403\u6389\u5BF9\u65B9\uFF09',
    options: ['\u767D\u8F66', '\u9ED1\u8F66', '\u4E00\u6837\u5371\u9669', '\u90FD\u5B89\u5168'],
    correctIndex: 2,
    explanation: '\u4E24\u4E2A\u8F66\u5728\u540C\u4E00\u884C\uFF0C\u4E92\u76F8\u90FD\u80FD\u653B\u51FB\u5230\u5BF9\u65B9\uFF01',
  },
  {
    level: 8,
    gridSize: 6,
    pieces: [
      { type: 'Q', color: 'w', pos: [3, 3] },
      { type: 'p', color: 'b', pos: [1, 1] },
      { type: 'p', color: 'b', pos: [3, 0] },
      { type: 'p', color: 'b', pos: [5, 5] },
    ],
    question: '\u767D\u540E\u80FD\u5403\u6389\u51E0\u4E2A\u9ED1\u5175\uFF1F',
    options: ['1', '2', '3', '\u5168\u90E8'],
    correctIndex: 3,
    explanation: '\u540E\u80FD\u8D70\u76F4\u7EBF\u548C\u659C\u7EBF\uFF0C(1,1)\u659C\u7EBF\u3001(3,0)\u76F4\u7EBF\u3001(5,5)\u659C\u7EBF\u90FD\u80FD\u653B\u51FB\u5230\uFF01',
  },
  {
    level: 9,
    gridSize: 6,
    pieces: [
      { type: 'N', color: 'w', pos: [3, 3] },
      { type: 'p', color: 'b', pos: [1, 2] },
      { type: 'p', color: 'b', pos: [1, 4] },
      { type: 'p', color: 'b', pos: [2, 1] },
      { type: 'p', color: 'b', pos: [5, 2] },
    ],
    question: '\u767D\u9A6C\u80FD\u5403\u6389\u51E0\u4E2A\u9ED1\u5175\uFF1F',
    options: ['1', '2', '3', '4'],
    correctIndex: 2,
    explanation: '\u9A6C\u4ECE(3,3)\u80FD\u8DF3\u5230(1,2)\u3001(1,4)\u3001(2,1)\u3001(4,1)\u3001(4,5)\u3001(5,2)\u3001(5,4)\u3001(2,5)\uFF0C\u5176\u4E2D(1,2)\u3001(1,4)\u3001(5,2)\u6709\u9ED1\u5175\uFF0C\u5171\u53EF\u54033\u4E2A\uFF01',
  },
  {
    level: 10,
    gridSize: 6,
    pieces: [
      { type: 'B', color: 'w', pos: [0, 0] },
      { type: 'R', color: 'w', pos: [5, 5] },
      { type: 'p', color: 'b', pos: [2, 2] },
      { type: 'p', color: 'b', pos: [5, 0] },
      { type: 'p', color: 'b', pos: [0, 5] },
    ],
    question: '\u767D\u65B9\u603B\u5171\u80FD\u5403\u6389\u51E0\u4E2A\u9ED1\u5175\uFF1F',
    options: ['1', '2', '3', '\u5168\u90E8'],
    correctIndex: 3,
    explanation: '\u8C61\u80FD\u659C\u7EBF\u5403(2,2)\uFF0C\u8F66\u80FD\u6A2A\u7EBF\u5403(5,0)\u548C\u7AD6\u7EBF\u5403(0,5)\uFF0C\u5168\u90E8\u90FD\u80FD\u5403\u6389\uFF01',
  },
]

const PIECE_IMAGES: Record<string, string> = {
  K: 'wK', Q: 'wQ', R: 'wR', B: 'wB', N: 'wN', P: 'wP',
  k: 'bK', q: 'bQ', r: 'bR', b: 'bB', n: 'bN', p: 'bP',
}

function getPieceImageKey(type: string, color: 'w' | 'b'): string {
  return color === 'w' ? PIECE_IMAGES[type] : PIECE_IMAGES[type.toLowerCase()]
}

const BASE = import.meta.env.BASE_URL || '/'
const pieceSvg = (key: string) => `${BASE}assets/pieces/${key}.svg`

// ---------------------------------------------------------------------------
// CSS animations
// ---------------------------------------------------------------------------

const AnimationStyles: React.FC = () => (
  <style>{`
    @keyframes kids-bounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }
    @keyframes kids-shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-6px); }
      40% { transform: translateX(6px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }
    @keyframes kids-star-pop {
      0% { transform: scale(0) rotate(-30deg); opacity: 0; }
      60% { transform: scale(1.3) rotate(10deg); opacity: 1; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    @keyframes kids-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    .kids-bounce { animation: kids-bounce 0.5s ease; }
    .kids-shake { animation: kids-shake 0.4s ease; }
    .kids-star-pop { animation: kids-star-pop 0.5s ease forwards; }
    .kids-float { animation: kids-float 2s ease-in-out infinite; }
  `}</style>
)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const KidsCountingPage: React.FC = () => {
  const navigate = useNavigate()

  // Progress
  const [completedLevels, setCompletedLevels] = useState<number[]>([])
  const [starsMap, setStarsMap] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  // Game state
  const [phase, setPhase] = useState<GamePhase>('select')
  const [currentLevel, setCurrentLevel] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [wrongAttempts, setWrongAttempts] = useState(0)
  const [levelStars, setLevelStars] = useState(0)
  const [showExplanation, setShowExplanation] = useState(false)

  // Load progress
  useEffect(() => {
    learnApi.getKidsProgress()
      .then((res) => {
        const raw = res?.data as any
        const data = raw?.data ?? raw
        if (Array.isArray(data)) {
          const items = data.filter((p: any) => p.game_type === 'counting' && p.completed)
          setCompletedLevels(items.map((p: any) => p.level - 1))
          const stars: Record<number, number> = {}
          items.forEach((p: any) => { stars[p.level - 1] = p.stars })
          setStarsMap(stars)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const levelConfig = COUNTING_LEVELS[currentLevel]

  // Build piece map for display
  const pieceMap = useMemo(() => {
    if (!levelConfig) return new Map<string, { type: string; color: 'w' | 'b' }>()
    const map = new Map<string, { type: string; color: 'w' | 'b' }>()
    levelConfig.pieces.forEach((p) => {
      map.set(`${p.pos[0]},${p.pos[1]}`, { type: p.type, color: p.color })
    })
    return map
  }, [levelConfig])

  const startLevel = useCallback((index: number) => {
    setCurrentLevel(index)
    setSelectedOption(null)
    setFeedback(null)
    setWrongAttempts(0)
    setShowExplanation(false)
    setPhase('play')
  }, [])

  const handleOptionClick = useCallback((optionIndex: number) => {
    if (!levelConfig || feedback === 'correct') return

    setSelectedOption(optionIndex)

    if (optionIndex === levelConfig.correctIndex) {
      setFeedback('correct')
      setShowExplanation(true)

      const stars = wrongAttempts === 0 ? 3 : wrongAttempts === 1 ? 2 : 1
      setLevelStars(stars)

      const newCompleted = [...new Set([...completedLevels, currentLevel])]
      const newStars = { ...starsMap, [currentLevel]: Math.max(starsMap[currentLevel] ?? 0, stars) }
      setCompletedLevels(newCompleted)
      setStarsMap(newStars)

      learnApi.updateKidsProgress({
        game_type: 'counting',
        level: currentLevel + 1,
        stars,
      }).catch(() => {})

      setTimeout(() => setPhase('result'), 2000)
    } else {
      setFeedback('wrong')
      setWrongAttempts((prev) => prev + 1)
      setTimeout(() => {
        setFeedback(null)
        setSelectedOption(null)
      }, 800)
    }
  }, [levelConfig, feedback, wrongAttempts, currentLevel, completedLevels, starsMap])

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-[60vh] bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-2xl flex items-center justify-center">
        <AnimationStyles />
        <div className="text-center">
          <div className="text-5xl kids-float mb-3">{'\uD83D\uDD22'}</div>
          <p className="text-gray-500 text-lg">{'\u52A0\u8F7D\u4E2D...'}</p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Level select
  // ---------------------------------------------------------------------------

  if (phase === 'select') {
    return (
      <div className="min-h-[60vh] bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-2xl p-4 md:p-6">
        <AnimationStyles />

        <button
          onClick={() => navigate('/learn?tab=kids')}
          className="mb-4 flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="text-sm">{'\u8FD4\u56DE\u513F\u7AE5\u4E50\u56ED'}</span>
        </button>

        <div className="text-center mb-6">
          <div className="text-4xl mb-2">{'\uD83D\uDD22'}</div>
          <h1 className="text-2xl font-bold text-gray-800">{'\u6570\u4E00\u6570'}</h1>
          <p className="text-gray-500 mt-1">{'\u89C2\u5BDF\u68CB\u76D8\uFF0C\u56DE\u7B54\u95EE\u9898'}</p>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-5 gap-3 max-w-lg mx-auto">
          {COUNTING_LEVELS.map((level, index) => {
            const isCompleted = completedLevels.includes(index)
            return (
              <button
                key={index}
                onClick={() => startLevel(index)}
                className={`relative rounded-2xl p-4 flex flex-col items-center gap-1.5 transition-all duration-200 border-2 ${
                  isCompleted
                    ? 'bg-white/80 border-yellow-300 shadow-md hover:scale-105 cursor-pointer'
                    : 'bg-white/80 border-orange-200 shadow-md hover:scale-105 hover:shadow-lg cursor-pointer'
                }`}
              >
                <span className="text-2xl font-bold text-gray-700">{level.level}</span>
                {isCompleted && (
                  <div className="flex gap-0.5">
                    {[1, 2, 3].map((s) => (
                      <span key={s} className={`text-sm ${s <= (starsMap[index] ?? 0) ? 'text-yellow-400' : 'text-gray-300'}`}>
                        {'\u2B50'}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Result
  // ---------------------------------------------------------------------------

  if (phase === 'result') {
    return (
      <div className="min-h-[60vh] bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center">
        <AnimationStyles />
        <div className="text-center space-y-6">
          <div className="text-6xl kids-float">{'\uD83C\uDF89'}</div>
          <h2 className="text-2xl font-bold text-gray-800">{'\u56DE\u7B54\u6B63\u786E\uFF01'}</h2>
          <p className="text-gray-600 text-lg">
            {wrongAttempts === 0 ? '\u4E00\u6B21\u5C31\u7B54\u5BF9\u4E86\uFF01' : `\u7B2C ${wrongAttempts + 1} \u6B21\u7B54\u5BF9`}
          </p>

          <div className="flex justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className="text-4xl kids-star-pop"
                style={{ animationDelay: `${(s - 1) * 0.2}s`, opacity: 0, color: s <= levelStars ? '#FACC15' : '#D1D5DB' }}
              >
                {'\u2B50'}
              </span>
            ))}
          </div>

          <div className="flex gap-3 justify-center pt-4">
            <button
              onClick={() => setPhase('select')}
              className="px-6 py-3 rounded-full bg-white border-2 border-orange-200 text-orange-600 font-bold text-lg shadow-md hover:shadow-lg transition-all hover:scale-105"
            >
              {'\u8FD4\u56DE\u5173\u5361'}
            </button>
            {currentLevel < COUNTING_LEVELS.length - 1 && (
              <button
                onClick={() => startLevel(currentLevel + 1)}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 text-white font-bold text-lg shadow-md hover:shadow-lg transition-all hover:scale-105"
              >
                {'\u4E0B\u4E00\u5173'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Play
  // ---------------------------------------------------------------------------

  if (!levelConfig) return null

  const gridSize = levelConfig.gridSize

  return (
    <div className="min-h-[60vh] bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-2xl p-4 md:p-6">
      <AnimationStyles />

      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setPhase('select')}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="text-sm">{'\u8FD4\u56DE'}</span>
        </button>
        <div className="text-sm text-gray-600">
          {'\u7B2C'} {levelConfig.level} {'\u5173'}
        </div>
      </div>

      {/* Board (read-only) */}
      <div className="flex justify-center mb-4">
        <div
          className="grid gap-0.5"
          style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
        >
          {Array.from({ length: gridSize }, (_, row) =>
            Array.from({ length: gridSize }, (_, col) => {
              const key = `${row},${col}`
              const piece = pieceMap.get(key)
              const isLight = (row + col) % 2 === 0

              return (
                <div
                  key={key}
                  className={`relative flex items-center justify-center rounded-lg ${
                    isLight ? 'bg-amber-100/60' : 'bg-amber-200/40'
                  }`}
                  style={{
                    width: 'clamp(44px, calc((100vw - 64px) / 6), 64px)',
                    height: 'clamp(44px, calc((100vw - 64px) / 6), 64px)',
                  }}
                >
                  {piece && (
                    <img
                      src={pieceSvg(getPieceImageKey(piece.type, piece.color))}
                      alt={piece.type}
                      className="w-3/4 h-3/4 drop-shadow-md"
                      draggable={false}
                    />
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Question */}
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur rounded-2xl px-5 py-3 shadow-lg border border-white/50">
          <span className="text-lg">{'\uD83E\uDD14'}</span>
          <span className="text-base font-bold text-gray-700">
            {levelConfig.question}
          </span>
        </div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto mb-4">
        {levelConfig.options.map((option, index) => {
          const isSelected = selectedOption === index
          const isCorrectOption = index === levelConfig.correctIndex
          const showCorrect = feedback === 'correct' && isCorrectOption
          const showWrong = feedback === 'wrong' && isSelected

          return (
            <button
              key={index}
              onClick={() => handleOptionClick(index)}
              disabled={feedback === 'correct'}
              className={`py-4 px-3 rounded-2xl text-lg font-bold transition-all duration-200 border-2 ${
                showCorrect
                  ? 'bg-green-100 border-green-400 text-green-700 kids-bounce'
                  : showWrong
                    ? 'bg-red-50 border-red-300 text-red-500 kids-shake'
                    : 'bg-white/80 border-orange-100 text-gray-700 hover:border-orange-300 hover:bg-orange-50 hover:scale-105 shadow-md'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>

      {/* Explanation */}
      {showExplanation && (
        <div className="max-w-sm mx-auto bg-green-50 border-2 border-green-200 rounded-2xl p-4 text-center">
          <p className="text-green-700 text-sm font-medium">
            {levelConfig.explanation}
          </p>
        </div>
      )}

      {/* Feedback */}
      <div className="text-center h-8 mt-2">
        {feedback === 'wrong' && (
          <span className="text-red-400 font-bold text-lg kids-shake inline-block">
            {'\u518D\u60F3\u60F3\u770B\uFF01'}
          </span>
        )}
      </div>
    </div>
  )
}

export default KidsCountingPage
