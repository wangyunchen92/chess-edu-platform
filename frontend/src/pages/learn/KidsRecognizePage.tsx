import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { learnApi } from '@/api/learn'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const PIECES = [
  { id: 'king', name: '\u56FD\u738B', symbol: '\u2654', image: 'wK' },
  { id: 'queen', name: '\u7687\u540E', symbol: '\u2655', image: 'wQ' },
  { id: 'rook', name: '\u57CE\u5821', symbol: '\u2656', image: 'wR' },
  { id: 'bishop', name: '\u4E3B\u6559', symbol: '\u2657', image: 'wB' },
  { id: 'knight', name: '\u9A91\u58EB', symbol: '\u2658', image: 'wN' },
  { id: 'pawn', name: '\u5C0F\u5175', symbol: '\u2659', image: 'wP' },
]

const ALL_PIECE_IDS = PIECES.map((p) => p.id)

const BASE = import.meta.env.BASE_URL || '/'
const pieceSvg = (key: string) => `${BASE}assets/pieces/${key}.svg`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Generate a grid of random pieces including the target */
function generateGrid(targetId: string, gridSize: number, count: number) {
  const others = ALL_PIECE_IDS.filter((id) => id !== targetId)
  const shuffledOthers = shuffle(others)
  const selected = [targetId, ...shuffledOthers.slice(0, count - 1)]
  const cells: (string | null)[] = Array(gridSize * gridSize).fill(null)
  const positions = shuffle(Array.from({ length: gridSize * gridSize }, (_, i) => i)).slice(0, count)
  positions.forEach((pos, i) => {
    cells[pos] = selected[i]
  })
  return cells
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LevelStatus = 'locked' | 'available' | 'completed'

interface LevelInfo {
  index: number
  piece: typeof PIECES[number]
  status: LevelStatus
  stars: number
}

type GamePhase = 'select' | 'play' | 'result'

// ---------------------------------------------------------------------------
// CSS animations as inline style tag
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

const KidsRecognizePage: React.FC = () => {
  const navigate = useNavigate()

  // Progress from server
  const [completedLevels, setCompletedLevels] = useState<number[]>([])
  const [starsMap, setStarsMap] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  // Game state
  const [phase, setPhase] = useState<GamePhase>('select')
  const [currentLevel, setCurrentLevel] = useState<number>(0)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [errors, setErrors] = useState(0)
  const [grid, setGrid] = useState<(string | null)[]>([])
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [feedbackCell, setFeedbackCell] = useState<number | null>(null)
  const [levelStars, setLevelStars] = useState(0)

  const GRID_SIZE = 3
  const PIECE_COUNT = 5
  const QUESTIONS_PER_LEVEL = 3

  // Load progress
  useEffect(() => {
    learnApi.getKidsProgress()
      .then((res) => {
        const raw = res?.data as any
        const data = raw?.data ?? raw
        if (Array.isArray(data)) {
          // API returns flat array [{game_type, level, completed, stars}]
          const items = data.filter((p: any) => p.game_type === 'recognize' && p.completed)
          // Convert 1-indexed API levels to 0-indexed frontend
          setCompletedLevels(items.map((p: any) => p.level - 1))
          const stars: Record<number, number> = {}
          items.forEach((p: any) => { stars[p.level - 1] = p.stars })
          setStarsMap(stars)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Build level info
  const levels: LevelInfo[] = useMemo(() => {
    return PIECES.map((piece, i) => {
      const isCompleted = completedLevels.includes(i)
      const isAvailable = i === 0 || completedLevels.includes(i - 1)
      return {
        index: i,
        piece,
        status: isCompleted ? 'completed' : isAvailable ? 'available' : 'locked',
        stars: starsMap[i] ?? 0,
      }
    })
  }, [completedLevels, starsMap])

  const currentPiece = PIECES[currentLevel]

  // Generate new question grid
  const newQuestion = useCallback(() => {
    const cells = generateGrid(currentPiece.id, GRID_SIZE, PIECE_COUNT)
    setGrid(cells)
    setFeedback(null)
    setFeedbackCell(null)
  }, [currentPiece])

  // Start a level
  const startLevel = useCallback((levelIndex: number) => {
    setCurrentLevel(levelIndex)
    setQuestionIndex(0)
    setErrors(0)
    setPhase('play')
  }, [])

  // Generate grid when entering play phase or advancing question
  useEffect(() => {
    if (phase === 'play') {
      newQuestion()
    }
  }, [phase, questionIndex, newQuestion])

  // Handle cell click
  const handleCellClick = useCallback((cellIndex: number) => {
    if (feedback) return // ignore during feedback animation
    const cellPiece = grid[cellIndex]
    if (!cellPiece) return

    if (cellPiece === currentPiece.id) {
      // Correct
      setFeedback('correct')
      setFeedbackCell(cellIndex)
      setTimeout(() => {
        const nextQ = questionIndex + 1
        if (nextQ >= QUESTIONS_PER_LEVEL) {
          // Level complete
          const stars = errors === 0 ? 3 : errors === 1 ? 2 : 1
          setLevelStars(stars)
          setPhase('result')

          // Save progress
          const newCompleted = [...new Set([...completedLevels, currentLevel])]
          const newStars = { ...starsMap, [currentLevel]: Math.max(starsMap[currentLevel] ?? 0, stars) }
          setCompletedLevels(newCompleted)
          setStarsMap(newStars)
          learnApi.updateKidsProgress({
            game_type: 'recognize',
            level: currentLevel + 1,  // API expects 1-indexed
            stars,
          }).catch(() => {})
        } else {
          setQuestionIndex(nextQ)
        }
      }, 800)
    } else {
      // Wrong
      setFeedback('wrong')
      setFeedbackCell(cellIndex)
      setErrors((e) => e + 1)
      setTimeout(() => {
        setFeedback(null)
        setFeedbackCell(null)
      }, 600)
    }
  }, [feedback, grid, currentPiece, questionIndex, errors, completedLevels, currentLevel, starsMap])

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <AnimationStyles />
        <div className="text-center">
          <div className="text-5xl kids-float mb-3">{'\uD83C\uDFAF'}</div>
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
      <div className="min-h-[60vh] bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 rounded-2xl p-4 md:p-6">
        <AnimationStyles />

        {/* Back button */}
        <button
          onClick={() => navigate('/learn?tab=kids')}
          className="mb-4 flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="text-sm">{'\u8FD4\u56DE\u513F\u7AE5\u4E50\u56ED'}</span>
        </button>

        {/* Title */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">{'\uD83C\uDFAF'}</div>
          <h1 className="text-2xl font-bold text-gray-800">{'\u627E\u670B\u53CB'}</h1>
          <p className="text-gray-500 mt-1">{'\u8BA4\u8BC6\u6BCF\u4E00\u4E2A\u68CB\u5B50\u670B\u53CB'}</p>
        </div>

        {/* Level cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-lg mx-auto">
          {levels.map((level) => {
            const isLocked = level.status === 'locked'
            const isCompleted = level.status === 'completed'

            return (
              <button
                key={level.index}
                disabled={isLocked}
                onClick={() => startLevel(level.index)}
                className={`relative rounded-2xl p-5 flex flex-col items-center gap-2 transition-all duration-200 border-2 ${
                  isLocked
                    ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'
                    : isCompleted
                      ? 'bg-white/80 border-yellow-300 shadow-lg hover:scale-105 cursor-pointer'
                      : 'bg-white/80 border-pink-200 shadow-lg hover:scale-105 hover:shadow-xl cursor-pointer'
                }`}
              >
                {/* Piece image */}
                <div className="w-16 h-16 flex items-center justify-center">
                  {isLocked ? (
                    <span className="text-4xl">{'\uD83D\uDD12'}</span>
                  ) : (
                    <img
                      src={pieceSvg(level.piece.image)}
                      alt={level.piece.name}
                      className="w-14 h-14 drop-shadow-md"
                    />
                  )}
                </div>

                {/* Name */}
                <span className={`text-base font-bold ${isLocked ? 'text-gray-400' : 'text-gray-700'}`}>
                  {level.piece.name}
                </span>

                {/* Stars */}
                {isCompleted && (
                  <div className="flex gap-0.5">
                    {[1, 2, 3].map((s) => (
                      <span
                        key={s}
                        className={`text-xl ${s <= level.stars ? 'text-yellow-400' : 'text-gray-300'}`}
                      >
                        {'\u2B50'}
                      </span>
                    ))}
                  </div>
                )}

                {/* Level number badge */}
                <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isLocked ? 'bg-gray-200 text-gray-400' : 'bg-pink-100 text-pink-600'
                }`}>
                  {level.index + 1}
                </div>
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
      <div className="min-h-[60vh] bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center">
        <AnimationStyles />

        <div className="text-center space-y-6">
          <div className="text-6xl kids-float">{'\uD83C\uDF89'}</div>
          <h2 className="text-2xl font-bold text-gray-800">
            {'\u592A\u68D2\u4E86\uFF01'}
          </h2>
          <p className="text-gray-600 text-lg">
            {'\u4F60\u8BA4\u8BC6\u4E86'} <strong>{currentPiece.name}</strong> {currentPiece.symbol}
          </p>

          {/* Stars */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className="text-4xl kids-star-pop"
                style={{
                  animationDelay: `${(s - 1) * 0.2}s`,
                  opacity: 0,
                  color: s <= levelStars ? '#FACC15' : '#D1D5DB',
                }}
              >
                {'\u2B50'}
              </span>
            ))}
          </div>

          <div className="flex gap-3 justify-center pt-4">
            <button
              onClick={() => {
                setPhase('select')
              }}
              className="px-6 py-3 rounded-full bg-white border-2 border-pink-200 text-pink-600 font-bold text-lg shadow-md hover:shadow-lg transition-all hover:scale-105"
            >
              {'\u8FD4\u56DE\u5173\u5361'}
            </button>
            {currentLevel < PIECES.length - 1 && levels[currentLevel + 1]?.status !== 'locked' && (
              <button
                onClick={() => startLevel(currentLevel + 1)}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 text-white font-bold text-lg shadow-md hover:shadow-lg transition-all hover:scale-105"
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

  return (
    <div className="min-h-[60vh] bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 rounded-2xl p-4 md:p-6">
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
        <div className="text-sm text-gray-500 font-medium">
          {questionIndex + 1} / {QUESTIONS_PER_LEVEL}
        </div>
      </div>

      {/* Target piece bubble */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur rounded-2xl px-6 py-4 shadow-lg border border-white/50">
          <img
            src={pieceSvg(currentPiece.image)}
            alt={currentPiece.name}
            className="w-14 h-14 drop-shadow-md kids-float"
          />
          <div className="text-left">
            <div className="text-lg font-bold text-gray-800">
              {'\u627E\u5230'} {currentPiece.name} {currentPiece.symbol}
            </div>
            <div className="text-sm text-gray-500">
              {'\u70B9\u51FB\u6B63\u786E\u7684\u68CB\u5B50'}
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex justify-center mb-6">
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          }}
        >
          {grid.map((cellPiece, i) => {
            const piece = cellPiece ? PIECES.find((p) => p.id === cellPiece) : null
            const isCorrectFeedback = feedback === 'correct' && feedbackCell === i
            const isWrongFeedback = feedback === 'wrong' && feedbackCell === i

            return (
              <button
                key={i}
                onClick={() => handleCellClick(i)}
                disabled={!piece || !!feedback}
                className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center transition-all duration-200 border-2 ${
                  isCorrectFeedback
                    ? 'bg-green-100 border-green-400 kids-bounce'
                    : isWrongFeedback
                      ? 'bg-red-50 border-red-300 kids-shake'
                      : piece
                        ? 'bg-white/80 border-purple-100 shadow-md hover:scale-110 hover:shadow-lg hover:border-purple-300 cursor-pointer'
                        : 'bg-white/30 border-transparent'
                }`}
              >
                {piece && (
                  <img
                    src={pieceSvg(piece.image)}
                    alt={piece.name}
                    className="w-12 h-12 md:w-16 md:h-16 drop-shadow-sm"
                    draggable={false}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Feedback text */}
      <div className="text-center h-8">
        {feedback === 'correct' && (
          <span className="text-green-600 font-bold text-xl kids-bounce inline-block">
            {'\u592A\u68D2\u4E86\uFF01'}
          </span>
        )}
        {feedback === 'wrong' && (
          <span className="text-red-400 font-bold text-xl kids-shake inline-block">
            {'\u518D\u8BD5\u8BD5'}
          </span>
        )}
      </div>
    </div>
  )
}

export default KidsRecognizePage
