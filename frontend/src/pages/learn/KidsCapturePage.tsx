import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chess } from 'chess.js'
import Chessboard from '@/components/chess/Chessboard'
import { learnApi } from '@/api/learn'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CaptureLevel {
  level: number
  fen: string
  targets: string[]
  minMoves: number
}

interface GroupConfig {
  key: string
  name: string
  emoji: string
  image: string
  levels: CaptureLevel[]
}

type LevelStatus = 'locked' | 'available' | 'completed'

interface LevelDisplay {
  groupIndex: number
  levelIndex: number
  globalIndex: number
  config: CaptureLevel
  status: LevelStatus
  stars: number
}

type GamePhase = 'select' | 'play' | 'result'

// ---------------------------------------------------------------------------
// Level data (hardcoded)
// ---------------------------------------------------------------------------

const CAPTURE_GROUPS: GroupConfig[] = [
  {
    key: 'rook',
    name: '\u8F66',
    emoji: '\u2656',
    image: 'wR',
    levels: [
      { level: 1, fen: '8/8/8/3p4/8/8/8/R7 w - - 0 1', targets: ['d5'], minMoves: 1 },
      { level: 2, fen: '8/8/8/8/8/2p5/8/R7 w - - 0 1', targets: ['c3'], minMoves: 1 },
      { level: 3, fen: '8/8/2p5/8/8/8/5p2/R7 w - - 0 1', targets: ['c6', 'f2'], minMoves: 2 },
    ],
  },
  {
    key: 'bishop',
    name: '\u8C61',
    emoji: '\u2657',
    image: 'wB',
    levels: [
      { level: 1, fen: '8/8/8/8/3p4/8/8/B7 w - - 0 1', targets: ['d4'], minMoves: 1 },
      { level: 2, fen: '8/8/8/8/8/8/6p1/B7 w - - 0 1', targets: ['g2'], minMoves: 1 },
      { level: 3, fen: '8/8/5p2/8/3p4/8/8/B7 w - - 0 1', targets: ['d4', 'f6'], minMoves: 2 },
    ],
  },
  {
    key: 'queen',
    name: '\u540E',
    emoji: '\u2655',
    image: 'wQ',
    levels: [
      { level: 1, fen: '8/8/8/3p4/8/8/8/Q7 w - - 0 1', targets: ['d5'], minMoves: 1 },
      { level: 2, fen: '8/8/8/8/8/5p2/8/Q7 w - - 0 1', targets: ['f3'], minMoves: 1 },
      { level: 3, fen: '8/5p2/8/8/8/2p5/8/Q7 w - - 0 1', targets: ['c3', 'f8'], minMoves: 2 },
    ],
  },
  {
    key: 'knight',
    name: '\u9A6C',
    emoji: '\u2658',
    image: 'wN',
    levels: [
      { level: 1, fen: '8/8/8/8/8/5p2/8/N7 w - - 0 1', targets: ['f3'], minMoves: 2 },
      { level: 2, fen: '8/8/8/3p4/8/8/8/N7 w - - 0 1', targets: ['d5'], minMoves: 2 },
      { level: 3, fen: '8/8/5p2/8/2p5/8/8/4N3 w - - 0 1', targets: ['c4', 'f6'], minMoves: 3 },
    ],
  },
]

const BASE = import.meta.env.BASE_URL || '/'
const pieceSvg = (key: string) => `${BASE}assets/pieces/${key}.svg`

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const KidsCapturePage: React.FC = () => {
  const navigate = useNavigate()

  // Progress
  const [completedLevels, setCompletedLevels] = useState<number[]>([])
  const [starsMap, setStarsMap] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  // Game state
  const [phase, setPhase] = useState<GamePhase>('select')
  const [currentGlobal, setCurrentGlobal] = useState(0)
  const [game, setGame] = useState<Chess | null>(null)
  const [fen, setFen] = useState('')
  const [moveCount, setMoveCount] = useState(0)
  const [remainingTargets, setRemainingTargets] = useState<string[]>([])
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | undefined>(undefined)
  const [levelStars, setLevelStars] = useState(0)
  const [, setSelectedSquare] = useState<string | null>(null)
  const [validMoves, setValidMoves] = useState<string[]>([])

  // Load progress
  useEffect(() => {
    learnApi.getKidsProgress()
      .then((res) => {
        const raw = res?.data as any
        const data = raw?.data ?? raw
        if (Array.isArray(data)) {
          const rec = data.find((p: any) => p.game === 'capture')
          if (rec) {
            setCompletedLevels(rec.completed_levels ?? [])
            setStarsMap(rec.stars ?? {})
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Build flattened level list
  const allLevels: LevelDisplay[] = useMemo(() => {
    let globalIdx = 0
    const result: LevelDisplay[] = []
    CAPTURE_GROUPS.forEach((group, gi) => {
      group.levels.forEach((lvl, li) => {
        const isCompleted = completedLevels.includes(globalIdx)
        const isAvailable = globalIdx === 0 || completedLevels.includes(globalIdx - 1)
        result.push({
          groupIndex: gi,
          levelIndex: li,
          globalIndex: globalIdx,
          config: lvl,
          status: isCompleted ? 'completed' : isAvailable ? 'available' : 'locked',
          stars: starsMap[globalIdx] ?? 0,
        })
        globalIdx++
      })
    })
    return result
  }, [completedLevels, starsMap])

  // Start level
  const startLevel = useCallback((globalIndex: number) => {
    const level = allLevels[globalIndex]
    if (!level || level.status === 'locked') return

    const chess = new Chess(level.config.fen)
    setGame(chess)
    setFen(level.config.fen)
    setMoveCount(0)
    setRemainingTargets([...level.config.targets])
    setLastMove(undefined)
    setSelectedSquare(null)
    setValidMoves([])
    setCurrentGlobal(globalIndex)
    setPhase('play')
  }, [allLevels])

  // Get valid moves for a square
  const getValidMoves = useCallback((square: string): string[] => {
    if (!game) return []
    const moves = game.moves({ square: square as any, verbose: true })
    return moves.map((m) => m.to)
  }, [game])

  // Handle move
  const handleMove = useCallback((from: string, to: string) => {
    if (!game) return

    try {
      const move = game.move({ from, to })
      if (!move) return

      const newMoveCount = moveCount + 1
      setMoveCount(newMoveCount)
      setFen(game.fen())
      setLastMove({ from, to })
      setSelectedSquare(null)
      setValidMoves([])

      // Check if target was captured
      const newTargets = remainingTargets.filter((t) => t !== to)
      setRemainingTargets(newTargets)

      if (newTargets.length === 0) {
        // Level complete
        const level = allLevels[currentGlobal]
        const minMoves = level.config.minMoves
        const stars = newMoveCount <= minMoves ? 3 : newMoveCount <= minMoves + 2 ? 2 : 1
        setLevelStars(stars)

        const newCompleted = [...new Set([...completedLevels, currentGlobal])]
        const newStars = { ...starsMap, [currentGlobal]: Math.max(starsMap[currentGlobal] ?? 0, stars) }
        setCompletedLevels(newCompleted)
        setStarsMap(newStars)

        learnApi.updateKidsProgress({
          game: 'capture',
          level: currentGlobal,
          stars,
        }).catch(() => {})

        setTimeout(() => setPhase('result'), 500)
      }
    } catch {
      // Invalid move, ignore
    }
  }, [game, moveCount, remainingTargets, allLevels, currentGlobal, completedLevels, starsMap])

  // Handle square click for highlighting
  const handleSquareClick = useCallback((square: string) => {
    if (!game) return
    const piece = game.get(square as any)
    if (piece && piece.color === 'w') {
      setSelectedSquare(square)
      setValidMoves(getValidMoves(square))
    }
  }, [game, getValidMoves])

  // Target highlights (golden squares)
  const targetHighlights = useMemo(() => {
    return remainingTargets
  }, [remainingTargets])

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-[60vh] bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-2xl flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl animate-bounce mb-3">{'\uD83C\uDF54'}</div>
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
      <div className="min-h-[60vh] bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-2xl p-4 md:p-6">
        <style>{`
          @keyframes kids-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          .kids-float { animation: kids-float 2s ease-in-out infinite; }
        `}</style>

        {/* Back */}
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
          <div className="text-4xl mb-2">{'\uD83C\uDF54'}</div>
          <h1 className="text-2xl font-bold text-gray-800">{'\u8D2A\u5403\u5C0F\u68CB\u624B'}</h1>
          <p className="text-gray-500 mt-1">{'\u7528\u68CB\u5B50\u5403\u6389\u6240\u6709\u76EE\u6807'}</p>
        </div>

        {/* Groups */}
        <div className="space-y-6 max-w-lg mx-auto">
          {CAPTURE_GROUPS.map((group, gi) => {
            const groupLevels = allLevels.filter((l) => l.groupIndex === gi)

            return (
              <div key={group.key}>
                {/* Group header */}
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={pieceSvg(group.image)}
                    alt={group.name}
                    className="w-10 h-10 drop-shadow-md"
                  />
                  <h2 className="text-lg font-bold text-gray-700">{group.name}</h2>
                </div>

                {/* Level cards */}
                <div className="grid grid-cols-3 gap-3">
                  {groupLevels.map((level) => {
                    const isLocked = level.status === 'locked'
                    const isCompleted = level.status === 'completed'

                    return (
                      <button
                        key={level.globalIndex}
                        disabled={isLocked}
                        onClick={() => startLevel(level.globalIndex)}
                        className={`relative rounded-2xl p-4 flex flex-col items-center gap-1.5 transition-all duration-200 border-2 ${
                          isLocked
                            ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'
                            : isCompleted
                              ? 'bg-white/80 border-yellow-300 shadow-md hover:scale-105 cursor-pointer'
                              : 'bg-white/80 border-green-200 shadow-md hover:scale-105 hover:shadow-lg cursor-pointer'
                        }`}
                      >
                        <span className={`text-2xl font-bold ${isLocked ? 'text-gray-400' : 'text-gray-700'}`}>
                          {isLocked ? '\uD83D\uDD12' : `${level.levelIndex + 1}`}
                        </span>

                        {isCompleted && (
                          <div className="flex gap-0.5">
                            {[1, 2, 3].map((s) => (
                              <span
                                key={s}
                                className={`text-sm ${s <= level.stars ? 'text-yellow-400' : 'text-gray-300'}`}
                              >
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
      <div className="min-h-[60vh] bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center">
        <style>{`
          @keyframes kids-star-pop {
            0% { transform: scale(0) rotate(-30deg); opacity: 0; }
            60% { transform: scale(1.3) rotate(10deg); opacity: 1; }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
          }
          @keyframes kids-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          .kids-star-pop { animation: kids-star-pop 0.5s ease forwards; }
          .kids-float { animation: kids-float 2s ease-in-out infinite; }
        `}</style>

        <div className="text-center space-y-6">
          <div className="text-6xl kids-float">{'\uD83C\uDF89'}</div>
          <h2 className="text-2xl font-bold text-gray-800">{'\u901A\u5173\u5566\uFF01'}</h2>
          <p className="text-gray-600 text-lg">
            {'\u7528\u4E86'} <strong>{moveCount}</strong> {'\u6B65\u5403\u6389\u4E86\u6240\u6709\u76EE\u6807'}
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
              onClick={() => setPhase('select')}
              className="px-6 py-3 rounded-full bg-white border-2 border-green-200 text-green-600 font-bold text-lg shadow-md hover:shadow-lg transition-all hover:scale-105"
            >
              {'\u8FD4\u56DE\u5173\u5361'}
            </button>
            {currentGlobal < allLevels.length - 1 && allLevels[currentGlobal + 1]?.status !== 'locked' && (
              <button
                onClick={() => startLevel(currentGlobal + 1)}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-green-400 to-teal-400 text-white font-bold text-lg shadow-md hover:shadow-lg transition-all hover:scale-105"
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
    <div className="min-h-[60vh] bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-2xl p-4 md:p-6">
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
          <span>{'\u5269\u4F59\u76EE\u6807: '}<strong>{remainingTargets.length}</strong></span>
        </div>
      </div>

      {/* Instruction bubble */}
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur rounded-2xl px-5 py-3 shadow-lg border border-white/50">
          <span className="text-lg">{'\uD83C\uDFAF'}</span>
          <span className="text-base font-bold text-gray-700">
            {'\u5403\u6389\u6240\u6709\u6807\u8BB0\u7684\u68CB\u5B50\uFF01'}
          </span>
        </div>
      </div>

      {/* Chessboard */}
      <div className="flex justify-center mb-4">
        <Chessboard
          fen={fen}
          onMove={handleMove}
          onSquareClick={handleSquareClick}
          lastMove={lastMove}
          validMoves={validMoves}
          getValidMoves={getValidMoves}
          highlights={targetHighlights}
          interactive={true}
          orientation="white"
        />
      </div>

      {/* Hint: remaining targets */}
      {remainingTargets.length > 0 && (
        <div className="text-center">
          <span className="text-sm text-gray-500">
            {'\u76EE\u6807\u4F4D\u7F6E: '}
            {remainingTargets.map((t) => t.toUpperCase()).join(', ')}
          </span>
        </div>
      )}

      {/* Restart button */}
      <div className="text-center mt-4">
        <button
          onClick={() => startLevel(currentGlobal)}
          className="px-4 py-2 rounded-full bg-white/80 border border-gray-200 text-gray-600 text-sm hover:bg-white hover:shadow transition-all"
        >
          {'\u91CD\u65B0\u5F00\u59CB'}
        </button>
      </div>
    </div>
  )
}

export default KidsCapturePage
