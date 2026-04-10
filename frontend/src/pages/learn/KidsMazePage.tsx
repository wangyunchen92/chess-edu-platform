import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { learnApi } from '@/api/learn'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MazeLevel {
  level: number
  piece: 'rook' | 'bishop' | 'queen' | 'knight'
  gridSize: number
  start: [number, number]
  end: [number, number]
  obstacles: [number, number][]
  minMoves: number
}

type CellType = 'empty' | 'obstacle' | 'start' | 'end' | 'visited'
type GamePhase = 'select' | 'play' | 'result'

// ---------------------------------------------------------------------------
// Level data (10 levels)
// ---------------------------------------------------------------------------

const MAZE_LEVELS: MazeLevel[] = [
  // ===== L1-6: Rook maze (straight lines, increasing obstacles) =====
  {
    level: 1,
    piece: 'rook',
    gridSize: 6,
    start: [5, 0],
    end: [0, 0],
    obstacles: [[2, 1], [3, 2], [4, 3]],
    minMoves: 1,
  },
  {
    level: 2,
    piece: 'rook',
    gridSize: 6,
    start: [5, 0],
    end: [5, 5],
    obstacles: [[5, 3], [3, 0], [1, 2]],
    minMoves: 3,
  },
  {
    level: 3,
    piece: 'rook',
    gridSize: 6,
    start: [5, 0],
    end: [0, 5],
    obstacles: [[5, 3], [3, 0], [0, 2], [2, 5]],
    minMoves: 4,
  },
  {
    level: 4,
    piece: 'rook',
    gridSize: 6,
    start: [5, 0],
    end: [0, 5],
    obstacles: [[5, 2], [3, 0], [0, 3], [2, 5], [4, 4]],
    minMoves: 4,
  },
  {
    level: 5,
    piece: 'rook',
    gridSize: 6,
    start: [5, 0],
    end: [0, 5],
    obstacles: [[5, 3], [3, 0], [0, 2], [2, 5], [4, 4], [1, 1]],
    minMoves: 4,
  },
  {
    level: 6,
    piece: 'rook',
    gridSize: 6,
    start: [5, 0],
    end: [0, 5],
    obstacles: [[5, 2], [3, 0], [0, 3], [2, 5], [4, 4], [1, 1], [3, 3]],
    minMoves: 5,
  },
  // ===== L7-12: Bishop maze (diagonals, increasing obstacles) =====
  {
    level: 7,
    piece: 'bishop',
    gridSize: 6,
    start: [5, 0],
    end: [2, 3],
    obstacles: [[3, 1], [4, 3]],
    minMoves: 1,
  },
  {
    level: 8,
    piece: 'bishop',
    gridSize: 6,
    start: [5, 0],
    end: [1, 0],
    obstacles: [[3, 1], [4, 3], [2, 3]],
    minMoves: 2,
  },
  {
    // Bishop L9: (5,0)->(4,1)->(3,0)->(0,3) = 3 moves. Obs (3,2) blocks direct diag.
    level: 9,
    piece: 'bishop',
    gridSize: 6,
    start: [5, 0],
    end: [0, 3],
    obstacles: [[3, 2]],
    minMoves: 3,
  },
  {
    // Bishop L10: (5,0)->(4,1)->(5,2)->(2,5) = 3 moves (sliding through (4,3)(3,4)(2,5))
    level: 10,
    piece: 'bishop',
    gridSize: 6,
    start: [5, 0],
    end: [2, 5],
    obstacles: [[3, 2], [1, 4]],
    minMoves: 3,
  },
  {
    // Bishop L11: block (3,2) and (4,3) to force longer detour
    // (5,0)->(4,1)->(3,0)->(0,3)->(1,4)->(0,5) = 5 moves
    level: 11,
    piece: 'bishop',
    gridSize: 6,
    start: [5, 0],
    end: [0, 5],
    obstacles: [[3, 2], [4, 3]],
    minMoves: 5,
  },
  {
    // Bishop L12: same as L11 but more visual obstacles (not blocking path)
    level: 12,
    piece: 'bishop',
    gridSize: 6,
    start: [5, 0],
    end: [0, 5],
    obstacles: [[3, 2], [4, 3], [5, 3]],
    minMoves: 5,
  },
  // ===== L13-18: Queen maze (combined, complex routes) =====
  {
    level: 13,
    piece: 'queen',
    gridSize: 6,
    start: [5, 0],
    end: [0, 5],
    obstacles: [[3, 2], [2, 3], [4, 4]],
    minMoves: 2,
  },
  {
    level: 14,
    piece: 'queen',
    gridSize: 6,
    start: [5, 0],
    end: [0, 5],
    obstacles: [[4, 1], [3, 2], [2, 3], [1, 4]],
    minMoves: 2,
  },
  {
    level: 15,
    piece: 'queen',
    gridSize: 6,
    start: [5, 0],
    end: [0, 5],
    obstacles: [[4, 1], [3, 2], [2, 3], [1, 4], [5, 3]],
    minMoves: 2,
  },
  {
    level: 16,
    piece: 'queen',
    gridSize: 6,
    start: [5, 0],
    end: [0, 5],
    obstacles: [[4, 1], [3, 2], [2, 3], [1, 4], [5, 3], [0, 2]],
    minMoves: 3,
  },
  {
    level: 17,
    piece: 'queen',
    gridSize: 6,
    start: [5, 0],
    end: [0, 5],
    obstacles: [[4, 1], [3, 2], [2, 3], [1, 4], [5, 3], [0, 2], [3, 5]],
    minMoves: 3,
  },
  {
    level: 18,
    piece: 'queen',
    gridSize: 6,
    start: [5, 0],
    end: [0, 5],
    obstacles: [[4, 1], [3, 2], [2, 3], [1, 4], [5, 3], [0, 2], [3, 5], [2, 0]],
    minMoves: 3,
  },
  // ===== L19-30: Knight maze (L-shape, most fun, many obstacles) =====
  {
    level: 19,
    piece: 'knight',
    gridSize: 6,
    start: [5, 0],
    end: [3, 1],
    obstacles: [[4, 2], [2, 0]],
    minMoves: 1,
  },
  {
    // From (5,0): can go (3,1) or (4,2). (3,1)->(1,0) or (1,2). (1,2)->(3,1) back.
    // (3,1)->(1,0)->(2,2)->(0,1)? No, target is (1,1).
    // (5,0)->(3,1)->(1,2)->(3,3)? or (5,0)->(4,2)->(2,1)? then (2,1) targets (0,0)(0,2)(1,3)(3,3)(4,3).
    // Simplest: (5,0)->(3,1)->(1,2) = 2 if target (1,2). Let me pick easy targets.
    level: 20,
    piece: 'knight',
    gridSize: 6,
    start: [5, 0],
    end: [1, 2],
    obstacles: [[4, 2]],
    minMoves: 2,
  },
  {
    // (5,0)->(3,1)->(1,2)->(0,4) = 3
    level: 21,
    piece: 'knight',
    gridSize: 6,
    start: [5, 0],
    end: [0, 4],
    obstacles: [[4, 2], [2, 0]],
    minMoves: 3,
  },
  {
    // (5,0)->(3,1)->(1,2)->(3,3) or (5,0)->(3,1)->(4,3)->(2,2) = 3
    level: 22,
    piece: 'knight',
    gridSize: 6,
    start: [5, 0],
    end: [2, 2],
    obstacles: [[4, 2], [1, 1]],
    minMoves: 3,
  },
  {
    // Block (4,2), force through (3,1). To (0,2): (5,0)->(3,1)->(1,0)->(0,2) = 3
    level: 23,
    piece: 'knight',
    gridSize: 6,
    start: [5, 0],
    end: [0, 2],
    obstacles: [[4, 2], [3, 3]],
    minMoves: 3,
  },
  {
    // (5,0)->(3,1)->(1,2)->(0,4)->(2,5) or (5,0)->(3,1)->(4,3)->(2,4)->(0,5) = 4
    // Let me just pick target (0,5) with obs blocking short routes
    level: 24,
    piece: 'knight',
    gridSize: 6,
    start: [5, 0],
    end: [0, 5],
    obstacles: [[4, 2], [2, 3]],
    minMoves: 4,
  },
  {
    // More obstacles, target (0, 1)
    level: 25,
    piece: 'knight',
    gridSize: 6,
    start: [5, 0],
    end: [0, 1],
    obstacles: [[4, 2], [3, 3], [2, 0]],
    minMoves: 4,
  },
  {
    level: 26,
    piece: 'knight',
    gridSize: 6,
    start: [5, 0],
    end: [0, 0],
    obstacles: [[4, 2], [1, 4], [2, 3]],
    minMoves: 3,
  },
  {
    level: 27,
    piece: 'knight',
    gridSize: 6,
    start: [5, 0],
    end: [0, 5],
    obstacles: [[4, 2], [3, 3], [1, 1]],
    minMoves: 4,
  },
  {
    level: 28,
    piece: 'knight',
    gridSize: 6,
    start: [5, 0],
    end: [0, 5],
    obstacles: [[4, 2], [3, 3], [1, 1], [0, 3]],
    minMoves: 4,
  },
  {
    level: 29,
    piece: 'knight',
    gridSize: 6,
    start: [5, 0],
    end: [0, 5],
    obstacles: [[4, 2], [3, 3], [1, 1], [0, 3], [2, 4]],
    minMoves: 6,
  },
  {
    level: 30,
    piece: 'knight',
    gridSize: 6,
    start: [5, 0],
    end: [0, 5],
    obstacles: [[4, 2], [3, 3], [1, 1], [0, 3], [2, 4], [5, 4]],
    minMoves: 6,
  },
]

const PIECE_NAMES: Record<string, string> = {
  rook: '\u8F66',
  bishop: '\u8C61',
  queen: '\u540E',
  knight: '\u9A6C',
}

const PIECE_IMAGES: Record<string, string> = {
  rook: 'wR',
  bishop: 'wB',
  queen: 'wQ',
  knight: 'wN',
}

const BASE = import.meta.env.BASE_URL || '/'
const pieceSvg = (key: string) => `${BASE}assets/pieces/${key}.svg`

// ---------------------------------------------------------------------------
// Move validation (no chess.js)
// ---------------------------------------------------------------------------

function isInBounds(r: number, c: number, size: number): boolean {
  return r >= 0 && r < size && c >= 0 && c < size
}

function isObstacle(r: number, c: number, obstacles: Set<string>): boolean {
  return obstacles.has(`${r},${c}`)
}

function getValidMoves(
  piece: string,
  row: number,
  col: number,
  gridSize: number,
  obstacleSet: Set<string>,
): [number, number][] {
  const moves: [number, number][] = []

  const addSlidingMoves = (dirs: [number, number][]) => {
    for (const [dr, dc] of dirs) {
      let r = row + dr
      let c = col + dc
      while (isInBounds(r, c, gridSize)) {
        if (isObstacle(r, c, obstacleSet)) break
        moves.push([r, c])
        r += dr
        c += dc
      }
    }
  }

  switch (piece) {
    case 'rook':
      addSlidingMoves([[0, 1], [0, -1], [1, 0], [-1, 0]])
      break
    case 'bishop':
      addSlidingMoves([[1, 1], [1, -1], [-1, 1], [-1, -1]])
      break
    case 'queen':
      addSlidingMoves([[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]])
      break
    case 'knight': {
      const knightDirs: [number, number][] = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ]
      for (const [dr, dc] of knightDirs) {
        const r = row + dr
        const c = col + dc
        if (isInBounds(r, c, gridSize) && !isObstacle(r, c, obstacleSet)) {
          moves.push([r, c])
        }
      }
      break
    }
  }

  return moves
}

// ---------------------------------------------------------------------------
// CSS animations
// ---------------------------------------------------------------------------

const AnimationStyles: React.FC = () => (
  <style>{`
    @keyframes kids-bounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
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
    @keyframes kids-path-glow {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.7; }
    }
    .kids-bounce { animation: kids-bounce 0.5s ease; }
    .kids-star-pop { animation: kids-star-pop 0.5s ease forwards; }
    .kids-float { animation: kids-float 2s ease-in-out infinite; }
    .kids-path-glow { animation: kids-path-glow 1.5s ease-in-out infinite; }
  `}</style>
)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const KidsMazePage: React.FC = () => {
  const navigate = useNavigate()

  // Progress
  const [completedLevels, setCompletedLevels] = useState<number[]>([])
  const [starsMap, setStarsMap] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  // Game state
  const [phase, setPhase] = useState<GamePhase>('select')
  const [currentLevel, setCurrentLevel] = useState(0)
  const [playerPos, setPlayerPos] = useState<[number, number]>([0, 0])
  const [moveCount, setMoveCount] = useState(0)
  const [visited, setVisited] = useState<Set<string>>(new Set())
  const [highlightedMoves, setHighlightedMoves] = useState<Set<string>>(new Set())
  const [isSelected, setIsSelected] = useState(false)
  const [levelStars, setLevelStars] = useState(0)

  // Load progress
  useEffect(() => {
    learnApi.getKidsProgress()
      .then((res) => {
        const raw = res?.data as any
        const data = raw?.data ?? raw
        if (Array.isArray(data)) {
          const items = data.filter((p: any) => p.game_type === 'maze' && p.completed)
          setCompletedLevels(items.map((p: any) => p.level - 1))
          const stars: Record<number, number> = {}
          items.forEach((p: any) => { stars[p.level - 1] = p.stars })
          setStarsMap(stars)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const levelConfig = MAZE_LEVELS[currentLevel]

  const obstacleSet = useMemo(() => {
    if (!levelConfig) return new Set<string>()
    return new Set(levelConfig.obstacles.map(([r, c]) => `${r},${c}`))
  }, [levelConfig])

  // Start level
  const startLevel = useCallback((index: number) => {
    const config = MAZE_LEVELS[index]
    if (!config) return
    setCurrentLevel(index)
    setPlayerPos([...config.start])
    setMoveCount(0)
    setVisited(new Set([`${config.start[0]},${config.start[1]}`]))
    setHighlightedMoves(new Set())
    setIsSelected(false)
    setPhase('play')
  }, [])

  // Click on player piece to show moves
  const handlePieceClick = useCallback(() => {
    if (!levelConfig) return
    if (isSelected) {
      setIsSelected(false)
      setHighlightedMoves(new Set())
      return
    }
    const moves = getValidMoves(levelConfig.piece, playerPos[0], playerPos[1], levelConfig.gridSize, obstacleSet)
    setHighlightedMoves(new Set(moves.map(([r, c]) => `${r},${c}`)))
    setIsSelected(true)
  }, [levelConfig, playerPos, obstacleSet, isSelected])

  // Click on a cell to move
  const handleCellClick = useCallback((row: number, col: number) => {
    if (!isSelected || !levelConfig) return
    const key = `${row},${col}`
    if (!highlightedMoves.has(key)) {
      setIsSelected(false)
      setHighlightedMoves(new Set())
      return
    }

    // Move player
    const newPos: [number, number] = [row, col]
    setPlayerPos(newPos)
    const newMoveCount = moveCount + 1
    setMoveCount(newMoveCount)
    setVisited((prev) => new Set([...prev, key]))
    setIsSelected(false)
    setHighlightedMoves(new Set())

    // Check win
    if (row === levelConfig.end[0] && col === levelConfig.end[1]) {
      const stars = newMoveCount <= levelConfig.minMoves ? 3 : newMoveCount <= levelConfig.minMoves + 2 ? 2 : 1
      setLevelStars(stars)

      const newCompleted = [...new Set([...completedLevels, currentLevel])]
      const newStars = { ...starsMap, [currentLevel]: Math.max(starsMap[currentLevel] ?? 0, stars) }
      setCompletedLevels(newCompleted)
      setStarsMap(newStars)

      learnApi.updateKidsProgress({
        game_type: 'maze',
        level: currentLevel + 1,
        stars,
      }).catch(() => {})

      setTimeout(() => setPhase('result'), 400)
    }
  }, [isSelected, highlightedMoves, levelConfig, moveCount, currentLevel, completedLevels, starsMap])

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-[60vh] bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 rounded-2xl flex items-center justify-center">
        <AnimationStyles />
        <div className="text-center">
          <div className="text-5xl kids-float mb-3">{'\uD83C\uDFF0'}</div>
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
      <div className="min-h-[60vh] bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 rounded-2xl p-4 md:p-6">
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
          <div className="text-4xl mb-2">{'\uD83C\uDFF0'}</div>
          <h1 className="text-2xl font-bold text-gray-800">{'\u68CB\u5B50\u8FF7\u5BAB'}</h1>
          <p className="text-gray-500 mt-1">{'\u64CD\u63A7\u68CB\u5B50\u8D70\u5230\u7EC8\u70B9'}</p>
        </div>

        <div className="space-y-6 max-w-lg mx-auto">
          {/* Group by piece type */}
          {(['rook', 'bishop', 'queen', 'knight'] as const).map((pieceType) => {
            const pieceLevels = MAZE_LEVELS.map((l, i) => ({ ...l, index: i })).filter((l) => l.piece === pieceType)
            if (pieceLevels.length === 0) return null

            return (
              <div key={pieceType}>
                <div className="flex items-center gap-3 mb-3">
                  <img src={pieceSvg(PIECE_IMAGES[pieceType])} alt={PIECE_NAMES[pieceType]} className="w-10 h-10 drop-shadow-md" />
                  <h2 className="text-lg font-bold text-gray-700">{PIECE_NAMES[pieceType]}</h2>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {pieceLevels.map((level) => {
                    const isCompleted = completedLevels.includes(level.index)
                    return (
                      <button
                        key={level.index}
                        onClick={() => startLevel(level.index)}
                        className={`relative rounded-2xl p-4 flex flex-col items-center gap-1.5 transition-all duration-200 border-2 ${
                          isCompleted
                            ? 'bg-white/80 border-yellow-300 shadow-md hover:scale-105 cursor-pointer'
                            : 'bg-white/80 border-indigo-200 shadow-md hover:scale-105 hover:shadow-lg cursor-pointer'
                        }`}
                      >
                        <span className="text-2xl font-bold text-gray-700">{level.level}</span>
                        {isCompleted && (
                          <div className="flex gap-0.5">
                            {[1, 2, 3].map((s) => (
                              <span key={s} className={`text-sm ${s <= (starsMap[level.index] ?? 0) ? 'text-yellow-400' : 'text-gray-300'}`}>
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
      <div className="min-h-[60vh] bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center">
        <AnimationStyles />
        <div className="text-center space-y-6">
          <div className="text-6xl kids-float">{'\uD83C\uDF89'}</div>
          <h2 className="text-2xl font-bold text-gray-800">{'\u5230\u8FBE\u7EC8\u70B9\u5566\uFF01'}</h2>
          <p className="text-gray-600 text-lg">
            {'\u7528\u4E86'} <strong>{moveCount}</strong> {'\u6B65\u8D70\u51FA\u8FF7\u5BAB'}
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
              className="px-6 py-3 rounded-full bg-white border-2 border-indigo-200 text-indigo-600 font-bold text-lg shadow-md hover:shadow-lg transition-all hover:scale-105"
            >
              {'\u8FD4\u56DE\u5173\u5361'}
            </button>
            {currentLevel < MAZE_LEVELS.length - 1 && (
              <button
                onClick={() => startLevel(currentLevel + 1)}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-indigo-400 to-purple-400 text-white font-bold text-lg shadow-md hover:shadow-lg transition-all hover:scale-105"
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
    <div className="min-h-[60vh] bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 rounded-2xl p-4 md:p-6">
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
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{'\u6B65\u6570: '}<strong>{moveCount}</strong></span>
          <span>
            <img src={pieceSvg(PIECE_IMAGES[levelConfig.piece])} alt="" className="w-5 h-5 inline-block mr-1" />
            {PIECE_NAMES[levelConfig.piece]}
          </span>
        </div>
      </div>

      {/* Instruction */}
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur rounded-2xl px-5 py-3 shadow-lg border border-white/50">
          <span className="text-lg">{'\uD83C\uDFF0'}</span>
          <span className="text-base font-bold text-gray-700">
            {'\u70B9\u51FB\u68CB\u5B50\uFF0C\u7136\u540E\u8D70\u5230\u2B50\u5904\uFF01'}
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="flex justify-center mb-4">
        <div
          className="grid gap-0.5"
          style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
        >
          {Array.from({ length: gridSize }, (_, row) =>
            Array.from({ length: gridSize }, (_, col) => {
              const key = `${row},${col}`
              const isPlayer = playerPos[0] === row && playerPos[1] === col
              const isEnd = levelConfig.end[0] === row && levelConfig.end[1] === col
              const isObs = obstacleSet.has(key)
              const isVisited = visited.has(key) && !isPlayer
              const isHighlighted = highlightedMoves.has(key)
              const isLight = (row + col) % 2 === 0

              let cellType: CellType = 'empty'
              if (isObs) cellType = 'obstacle'
              else if (isPlayer) cellType = 'start'
              else if (isEnd) cellType = 'end'
              else if (isVisited) cellType = 'visited'

              // Suppress unused variable warning
              void cellType

              return (
                <div
                  key={key}
                  className={`relative flex items-center justify-center rounded-lg transition-all duration-200 ${
                    isObs
                      ? 'bg-gray-300 cursor-not-allowed'
                      : isHighlighted
                        ? 'bg-indigo-200 cursor-pointer hover:bg-indigo-300 ring-2 ring-indigo-400'
                        : isVisited
                          ? 'bg-indigo-100/50 kids-path-glow'
                          : isLight
                            ? 'bg-white/80'
                            : 'bg-indigo-50'
                  } ${isPlayer ? 'cursor-pointer' : ''}`}
                  style={{
                    width: 'clamp(48px, calc((100vw - 64px) / 6), 72px)',
                    height: 'clamp(48px, calc((100vw - 64px) / 6), 72px)',
                  }}
                  onClick={() => {
                    if (isPlayer) {
                      handlePieceClick()
                    } else if (isHighlighted) {
                      handleCellClick(row, col)
                    }
                  }}
                >
                  {/* Obstacle */}
                  {isObs && (
                    <div className="w-3/4 h-3/4 bg-gray-400 rounded-lg opacity-60" />
                  )}

                  {/* End marker */}
                  {isEnd && !isPlayer && (
                    <span className="text-2xl md:text-3xl kids-float">{'\u2B50'}</span>
                  )}

                  {/* Player piece */}
                  {isPlayer && (
                    <img
                      src={pieceSvg(PIECE_IMAGES[levelConfig.piece])}
                      alt={PIECE_NAMES[levelConfig.piece]}
                      className={`w-3/4 h-3/4 drop-shadow-md transition-transform ${isSelected ? 'scale-110' : ''}`}
                      draggable={false}
                    />
                  )}

                  {/* Valid move dot */}
                  {isHighlighted && !isEnd && !isPlayer && (
                    <div className="absolute w-[28%] h-[28%] rounded-full bg-indigo-400/40" />
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Restart */}
      <div className="text-center mt-4">
        <button
          onClick={() => startLevel(currentLevel)}
          className="px-4 py-2 rounded-full bg-white/80 border border-gray-200 text-gray-600 text-sm hover:bg-white hover:shadow transition-all"
        >
          {'\u91CD\u65B0\u5F00\u59CB'}
        </button>
      </div>
    </div>
  )
}

export default KidsMazePage
