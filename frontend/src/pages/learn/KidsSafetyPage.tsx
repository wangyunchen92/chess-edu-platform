import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { learnApi } from '@/api/learn'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SafetyLevel {
  level: number
  gridSize: number
  enemies: { piece: 'rook' | 'bishop' | 'queen' | 'knight'; pos: [number, number] }[]
  safeSquares: [number, number][]
}

type GamePhase = 'select' | 'play' | 'result'

// ---------------------------------------------------------------------------
// Attack range calculation (no chess.js)
// ---------------------------------------------------------------------------

function isInBounds(r: number, c: number, size: number): boolean {
  return r >= 0 && r < size && c >= 0 && c < size
}

function getAttackSquares(
  piece: string,
  row: number,
  col: number,
  gridSize: number,
): [number, number][] {
  const attacks: [number, number][] = []

  const addSliding = (dirs: [number, number][]) => {
    for (const [dr, dc] of dirs) {
      let r = row + dr
      let c = col + dc
      while (isInBounds(r, c, gridSize)) {
        attacks.push([r, c])
        r += dr
        c += dc
      }
    }
  }

  switch (piece) {
    case 'rook':
      addSliding([[0, 1], [0, -1], [1, 0], [-1, 0]])
      break
    case 'bishop':
      addSliding([[1, 1], [1, -1], [-1, 1], [-1, -1]])
      break
    case 'queen':
      addSliding([[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]])
      break
    case 'knight': {
      const knightDirs: [number, number][] = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ]
      for (const [dr, dc] of knightDirs) {
        const r = row + dr
        const c = col + dc
        if (isInBounds(r, c, gridSize)) {
          attacks.push([r, c])
        }
      }
      break
    }
  }

  return attacks
}

// Pre-compute safe squares for a level
function computeSafeSquares(
  gridSize: number,
  enemies: { piece: string; pos: [number, number] }[],
): [number, number][] {
  const dangerSet = new Set<string>()
  // Enemy positions are also dangerous
  enemies.forEach(({ pos }) => dangerSet.add(`${pos[0]},${pos[1]}`))
  // Add attack ranges
  enemies.forEach(({ piece, pos }) => {
    const attacks = getAttackSquares(piece, pos[0], pos[1], gridSize)
    attacks.forEach(([r, c]) => dangerSet.add(`${r},${c}`))
  })

  const safe: [number, number][] = []
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (!dangerSet.has(`${r},${c}`)) {
        safe.push([r, c])
      }
    }
  }
  return safe
}

// ---------------------------------------------------------------------------
// Level data (10 levels)
// ---------------------------------------------------------------------------

const SAFETY_LEVELS_RAW: Omit<SafetyLevel, 'safeSquares'>[] = [
  // ===== L1-6: Dodge rook =====
  { level: 1, gridSize: 6, enemies: [{ piece: 'rook', pos: [2, 3] }] },
  { level: 2, gridSize: 6, enemies: [{ piece: 'rook', pos: [0, 0] }] },
  { level: 3, gridSize: 6, enemies: [{ piece: 'rook', pos: [3, 3] }] },
  { level: 4, gridSize: 6, enemies: [{ piece: 'rook', pos: [5, 2] }] },
  { level: 5, gridSize: 6, enemies: [{ piece: 'rook', pos: [0, 0] }, { piece: 'rook', pos: [5, 5] }] },
  { level: 6, gridSize: 6, enemies: [{ piece: 'rook', pos: [2, 0] }, { piece: 'rook', pos: [4, 5] }] },
  // ===== L7-12: Dodge bishop =====
  { level: 7, gridSize: 6, enemies: [{ piece: 'bishop', pos: [3, 3] }] },
  { level: 8, gridSize: 6, enemies: [{ piece: 'bishop', pos: [1, 4] }] },
  { level: 9, gridSize: 6, enemies: [{ piece: 'bishop', pos: [0, 0] }] },
  { level: 10, gridSize: 6, enemies: [{ piece: 'bishop', pos: [2, 5] }] },
  { level: 11, gridSize: 6, enemies: [{ piece: 'bishop', pos: [0, 0] }, { piece: 'bishop', pos: [5, 5] }] },
  { level: 12, gridSize: 6, enemies: [{ piece: 'bishop', pos: [1, 1] }, { piece: 'bishop', pos: [4, 4] }] },
  // ===== L13-18: Dodge queen =====
  { level: 13, gridSize: 6, enemies: [{ piece: 'queen', pos: [3, 3] }] },
  { level: 14, gridSize: 6, enemies: [{ piece: 'queen', pos: [0, 5] }] },
  { level: 15, gridSize: 6, enemies: [{ piece: 'queen', pos: [5, 0] }] },
  { level: 16, gridSize: 6, enemies: [{ piece: 'queen', pos: [2, 4] }] },
  { level: 17, gridSize: 6, enemies: [{ piece: 'queen', pos: [0, 0] }] },
  { level: 18, gridSize: 6, enemies: [{ piece: 'queen', pos: [3, 2] }] },
  // ===== L19-24: Dodge knight =====
  { level: 19, gridSize: 6, enemies: [{ piece: 'knight', pos: [3, 3] }] },
  { level: 20, gridSize: 6, enemies: [{ piece: 'knight', pos: [2, 2] }] },
  { level: 21, gridSize: 6, enemies: [{ piece: 'knight', pos: [1, 1] }] },
  { level: 22, gridSize: 6, enemies: [{ piece: 'knight', pos: [4, 4] }] },
  { level: 23, gridSize: 6, enemies: [{ piece: 'knight', pos: [2, 3] }, { piece: 'knight', pos: [4, 1] }] },
  { level: 24, gridSize: 6, enemies: [{ piece: 'knight', pos: [1, 2] }, { piece: 'knight', pos: [3, 4] }] },
  // ===== L25-30: Multiple enemies combo =====
  { level: 25, gridSize: 6, enemies: [{ piece: 'rook', pos: [0, 0] }, { piece: 'bishop', pos: [5, 5] }] },
  { level: 26, gridSize: 6, enemies: [{ piece: 'queen', pos: [2, 2] }, { piece: 'knight', pos: [5, 0] }] },
  { level: 27, gridSize: 6, enemies: [{ piece: 'rook', pos: [0, 3] }, { piece: 'knight', pos: [4, 1] }] },
  { level: 28, gridSize: 6, enemies: [{ piece: 'bishop', pos: [1, 1] }, { piece: 'queen', pos: [4, 5] }] },
  { level: 29, gridSize: 6, enemies: [{ piece: 'rook', pos: [0, 2] }, { piece: 'bishop', pos: [5, 0] }, { piece: 'knight', pos: [3, 4] }] },
  { level: 30, gridSize: 6, enemies: [{ piece: 'queen', pos: [0, 0] }, { piece: 'knight', pos: [3, 3] }, { piece: 'rook', pos: [5, 5] }] },
]

// Pre-compute safe squares
const SAFETY_LEVELS: SafetyLevel[] = SAFETY_LEVELS_RAW.map((raw) => ({
  ...raw,
  safeSquares: computeSafeSquares(raw.gridSize, raw.enemies),
}))

const PIECE_NAMES: Record<string, string> = {
  rook: '\u8F66',
  bishop: '\u8C61',
  queen: '\u540E',
  knight: '\u9A6C',
}

const PIECE_IMAGES_BLACK: Record<string, string> = {
  rook: 'bR',
  bishop: 'bB',
  queen: 'bQ',
  knight: 'bN',
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
    @keyframes kids-danger-pulse {
      0%, 100% { opacity: 0.25; }
      50% { opacity: 0.45; }
    }
    .kids-bounce { animation: kids-bounce 0.5s ease; }
    .kids-shake { animation: kids-shake 0.4s ease; }
    .kids-star-pop { animation: kids-star-pop 0.5s ease forwards; }
    .kids-float { animation: kids-float 2s ease-in-out infinite; }
    .kids-danger-pulse { animation: kids-danger-pulse 1.2s ease-in-out infinite; }
  `}</style>
)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const KidsSafetyPage: React.FC = () => {
  const navigate = useNavigate()

  // Progress
  const [completedLevels, setCompletedLevels] = useState<number[]>([])
  const [starsMap, setStarsMap] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  // Game state
  const [phase, setPhase] = useState<GamePhase>('select')
  const [currentLevel, setCurrentLevel] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [wrongAttempts, setWrongAttempts] = useState(0)
  const [placedPos, setPlacedPos] = useState<[number, number] | null>(null)
  const [levelStars, setLevelStars] = useState(0)

  // Load progress
  useEffect(() => {
    learnApi.getKidsProgress()
      .then((res) => {
        const raw = res?.data as any
        const data = raw?.data ?? raw
        if (Array.isArray(data)) {
          const items = data.filter((p: any) => p.game_type === 'safety' && p.completed)
          setCompletedLevels(items.map((p: any) => p.level - 1))
          const stars: Record<number, number> = {}
          items.forEach((p: any) => { stars[p.level - 1] = p.stars })
          setStarsMap(stars)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const levelConfig = SAFETY_LEVELS[currentLevel]

  // Build danger set for display
  const dangerSet = useMemo(() => {
    if (!levelConfig) return new Set<string>()
    const set = new Set<string>()
    levelConfig.enemies.forEach(({ piece, pos }) => {
      const attacks = getAttackSquares(piece, pos[0], pos[1], levelConfig.gridSize)
      attacks.forEach(([r, c]) => set.add(`${r},${c}`))
    })
    return set
  }, [levelConfig])

  const enemyPosSet = useMemo(() => {
    if (!levelConfig) return new Set<string>()
    return new Set(levelConfig.enemies.map(({ pos }) => `${pos[0]},${pos[1]}`))
  }, [levelConfig])

  const safeSet = useMemo(() => {
    if (!levelConfig) return new Set<string>()
    return new Set(levelConfig.safeSquares.map(([r, c]) => `${r},${c}`))
  }, [levelConfig])

  const startLevel = useCallback((index: number) => {
    setCurrentLevel(index)
    setFeedback(null)
    setWrongAttempts(0)
    setPlacedPos(null)
    setPhase('play')
  }, [])

  const handleCellClick = useCallback((row: number, col: number) => {
    if (!levelConfig || feedback === 'correct') return
    const key = `${row},${col}`

    // Can't click on enemy squares
    if (enemyPosSet.has(key)) return

    if (safeSet.has(key)) {
      // Correct - safe square
      setFeedback('correct')
      setPlacedPos([row, col])

      const stars = wrongAttempts === 0 ? 3 : wrongAttempts === 1 ? 2 : 1
      setLevelStars(stars)

      const newCompleted = [...new Set([...completedLevels, currentLevel])]
      const newStars = { ...starsMap, [currentLevel]: Math.max(starsMap[currentLevel] ?? 0, stars) }
      setCompletedLevels(newCompleted)
      setStarsMap(newStars)

      learnApi.updateKidsProgress({
        game_type: 'safety',
        level: currentLevel + 1,
        stars,
      }).catch(() => {})

      setTimeout(() => setPhase('result'), 1000)
    } else {
      // Wrong - dangerous square
      setFeedback('wrong')
      setWrongAttempts((prev) => prev + 1)
      setTimeout(() => setFeedback(null), 600)
    }
  }, [levelConfig, feedback, enemyPosSet, safeSet, wrongAttempts, currentLevel, completedLevels, starsMap])

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-[60vh] bg-gradient-to-br from-cyan-50 via-blue-50 to-teal-50 rounded-2xl flex items-center justify-center">
        <AnimationStyles />
        <div className="text-center">
          <div className="text-5xl kids-float mb-3">{'\uD83D\uDEE1\uFE0F'}</div>
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
      <div className="min-h-[60vh] bg-gradient-to-br from-cyan-50 via-blue-50 to-teal-50 rounded-2xl p-4 md:p-6">
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
          <div className="text-4xl mb-2">{'\uD83D\uDEE1\uFE0F'}</div>
          <h1 className="text-2xl font-bold text-gray-800">{'\u5B89\u5168\u683C\u5B50'}</h1>
          <p className="text-gray-500 mt-1">{'\u628A\u68CB\u5B50\u653E\u5230\u5B89\u5168\u7684\u5730\u65B9'}</p>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-5 gap-3 max-w-lg mx-auto">
          {SAFETY_LEVELS.map((level, index) => {
            const isCompleted = completedLevels.includes(index)
            return (
              <button
                key={index}
                onClick={() => startLevel(index)}
                className={`relative rounded-2xl p-4 flex flex-col items-center gap-1.5 transition-all duration-200 border-2 ${
                  isCompleted
                    ? 'bg-white/80 border-yellow-300 shadow-md hover:scale-105 cursor-pointer'
                    : 'bg-white/80 border-cyan-200 shadow-md hover:scale-105 hover:shadow-lg cursor-pointer'
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
      <div className="min-h-[60vh] bg-gradient-to-br from-cyan-50 via-blue-50 to-teal-50 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center">
        <AnimationStyles />
        <div className="text-center space-y-6">
          <div className="text-6xl kids-float">{'\uD83C\uDF89'}</div>
          <h2 className="text-2xl font-bold text-gray-800">{'\u5B89\u5168\u5566\uFF01'}</h2>
          <p className="text-gray-600 text-lg">
            {wrongAttempts === 0 ? '\u4E00\u6B21\u5C31\u627E\u5230\u4E86\uFF01' : `\u8BD5\u4E86 ${wrongAttempts + 1} \u6B21\u627E\u5230\u5B89\u5168\u7684\u5730\u65B9`}
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
              className="px-6 py-3 rounded-full bg-white border-2 border-cyan-200 text-cyan-600 font-bold text-lg shadow-md hover:shadow-lg transition-all hover:scale-105"
            >
              {'\u8FD4\u56DE\u5173\u5361'}
            </button>
            {currentLevel < SAFETY_LEVELS.length - 1 && (
              <button
                onClick={() => startLevel(currentLevel + 1)}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 text-white font-bold text-lg shadow-md hover:shadow-lg transition-all hover:scale-105"
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
    <div className="min-h-[60vh] bg-gradient-to-br from-cyan-50 via-blue-50 to-teal-50 rounded-2xl p-4 md:p-6">
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

      {/* Instruction */}
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur rounded-2xl px-5 py-3 shadow-lg border border-white/50">
          <span className="text-lg">{'\uD83D\uDEE1\uFE0F'}</span>
          <span className="text-base font-bold text-gray-700">
            {'\u70B9\u51FB\u4E00\u4E2A\u5B89\u5168\u7684\u683C\u5B50\u653E\u7F6E\u68CB\u5B50\uFF01'}
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="flex justify-center mb-4">
        <div
          className={`grid gap-0.5 ${feedback === 'wrong' ? 'kids-shake' : ''}`}
          style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
        >
          {Array.from({ length: gridSize }, (_, row) =>
            Array.from({ length: gridSize }, (_, col) => {
              const key = `${row},${col}`
              const isEnemy = enemyPosSet.has(key)
              const isDanger = dangerSet.has(key)
              const isSafe = safeSet.has(key)
              const isPlaced = placedPos && placedPos[0] === row && placedPos[1] === col
              const isLight = (row + col) % 2 === 0

              // Find enemy at this position
              const enemyHere = isEnemy
                ? levelConfig.enemies.find(({ pos }) => pos[0] === row && pos[1] === col)
                : null

              return (
                <div
                  key={key}
                  className={`relative flex items-center justify-center rounded-lg transition-all duration-200 ${
                    isEnemy
                      ? 'bg-gray-700 cursor-not-allowed'
                      : isDanger
                        ? 'bg-red-100 kids-danger-pulse cursor-pointer hover:bg-red-200'
                        : isSafe
                          ? 'bg-green-50 cursor-pointer hover:bg-green-100 hover:ring-2 hover:ring-green-300'
                          : isLight
                            ? 'bg-white/80'
                            : 'bg-cyan-50'
                  }`}
                  style={{
                    width: 'clamp(48px, calc((100vw - 64px) / 6), 72px)',
                    height: 'clamp(48px, calc((100vw - 64px) / 6), 72px)',
                  }}
                  onClick={() => handleCellClick(row, col)}
                >
                  {/* Danger indicator */}
                  {isDanger && !isEnemy && (
                    <div className="absolute inset-1 rounded-md bg-red-300/30" />
                  )}

                  {/* Enemy piece */}
                  {enemyHere && (
                    <img
                      src={pieceSvg(PIECE_IMAGES_BLACK[enemyHere.piece])}
                      alt={PIECE_NAMES[enemyHere.piece]}
                      className="w-3/4 h-3/4 drop-shadow-md"
                      draggable={false}
                    />
                  )}

                  {/* Placed white piece */}
                  {isPlaced && (
                    <img
                      src={pieceSvg('wP')}
                      alt="white pawn"
                      className="w-3/4 h-3/4 drop-shadow-md kids-bounce"
                      draggable={false}
                    />
                  )}

                  {/* Safe indicator */}
                  {isSafe && !isPlaced && feedback !== 'correct' && (
                    <div className="absolute w-2 h-2 rounded-full bg-green-400/40" />
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Feedback text */}
      <div className="text-center h-10">
        {feedback === 'correct' && (
          <span className="text-green-600 font-bold text-xl kids-bounce inline-block">
            {'\u592A\u68D2\u4E86\uFF01\u8FD9\u91CC\u5F88\u5B89\u5168\uFF01'}
          </span>
        )}
        {feedback === 'wrong' && (
          <span className="text-red-400 font-bold text-xl kids-shake inline-block">
            {'\u8FD9\u91CC\u4E0D\u5B89\u5168\u54E6\uFF01'}
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-200" />
          <span>{'\u5371\u9669\u533A\u57DF'}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
          <span>{'\u5B89\u5168\u533A\u57DF'}</span>
        </div>
      </div>
    </div>
  )
}

export default KidsSafetyPage
