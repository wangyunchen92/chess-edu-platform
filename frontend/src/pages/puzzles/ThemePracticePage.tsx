import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { puzzlesApi } from '@/api/puzzles'
import Button from '@/components/common/Button'
import Card from '@/components/common/Card'
import { usePuzzleStore } from '@/stores/puzzleStore'

const THEME_PUZZLE_COST = 20

// Theme name mapping
const THEME_NAMES: Record<string, string> = {
  fork: '双攻',
  pin: '牵制',
  skewer: '串击',
  discoveredAttack: '闪击',
  doubleCheck: '双将',
  hangingPiece: '悬子',
  trappedPiece: '困子',
  mateIn1: '一步杀',
  mateIn2: '两步杀',
  mateIn3: '三步杀',
  backRankMate: '底线杀',
  smotheredMate: '闷杀',
  hookMate: '钩杀',
  mate: '将杀',
  sacrifice: '弃子',
  deflection: '引离',
  decoy: '引入',
  intermezzo: '中间着',
  quietMove: '安静着',
  xRayAttack: 'X光攻击',
  capturingDefender: '吃掉防守者',
  pawnEndgame: '兵残局',
  rookEndgame: '车残局',
  queenEndgame: '后残局',
  bishopEndgame: '象残局',
  knightEndgame: '马残局',
  endgame: '残局',
}

// Difficulty tabs for theme training
const DIFFICULTY_TABS = [
  { key: 1, label: '入门', emoji: '\u2B50', color: 'var(--success)' },
  { key: 2, label: '初级', emoji: '\uD83C\uDF1F', color: 'var(--info)' },
  { key: 3, label: '中级', emoji: '\uD83D\uDCAA', color: 'var(--warning)' },
  { key: 4, label: '高级', emoji: '\uD83D\uDD25', color: 'var(--danger)' },
  { key: 5, label: '大师', emoji: '\uD83D\uDC51', color: 'var(--rank-purple)' },
]

const PAGE_SIZE = 20

// Puzzle list page (shown when no specific puzzle selected)
const ThemePuzzleListPage: React.FC<{ theme: string; themeName: string }> = ({ theme, themeName }) => {
  const navigate = useNavigate()
  const [difficulty, setDifficulty] = useState(1)
  const [puzzles, setPuzzles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const setPuzzleList = usePuzzleStore((s: any) => s.setPuzzleList)

  useEffect(() => {
    setLoading(true)
    setPuzzles([])
    setPage(1)
    puzzlesApi.getThemePuzzles(theme, PAGE_SIZE * 5, difficulty)
      .then((res) => {
        const payload: any = (res.data as any)?.data ?? res.data
        const list = Array.isArray(payload) ? payload : []
        setPuzzles(list)
        // hasMore handled by comparing paginatedPuzzles.length < puzzles.length
      })
      .catch(() => setPuzzles([]))
      .finally(() => setLoading(false))
  }, [theme, difficulty])

  const paginatedPuzzles = puzzles.slice(0, page * PAGE_SIZE)
  const tabInfo = DIFFICULTY_TABS.find((t) => t.key === difficulty) ?? DIFFICULTY_TABS[0]

  const goToPuzzle = (puzzleId: string) => {
    if (setPuzzleList) {
      setPuzzleList(paginatedPuzzles.map((p: any) => p.id ?? p.puzzle_code))
    }
    navigate(`/puzzles/solve/${puzzleId}?source=theme&theme=${theme}`)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)] flex items-center gap-2">
            <span>{'\u2694\uFE0F'}</span>
            <span>{themeName}</span>
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--text-sub)] mt-1">
            选择难度，点击题目开始训练
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/puzzles/themes')}>
          返回
        </Button>
      </div>

      {/* Difficulty tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DIFFICULTY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setDifficulty(tab.key); setPage(1) }}
            className={[
              'flex items-center gap-1.5 px-3 py-2 rounded-full text-[var(--text-sm)] font-medium whitespace-nowrap transition-colors',
              difficulty === tab.key
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg)] text-[var(--text-sub)] hover:bg-[var(--bg-hover)]',
            ].join(' ')}
          >
            <span>{tab.emoji}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Progress */}
      {!loading && puzzles.length > 0 && (
        <Card padding="md" hoverable={false}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[var(--text-sm)] font-medium text-[var(--text)]">
              {tabInfo.emoji} {tabInfo.label} · 共 {puzzles.length} 题
            </span>
            <span className="inline-flex items-center gap-1 text-[var(--text-xs)] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
              {'\uD83D\uDCB0'} 每题 {THEME_PUZZLE_COST} 积分
            </span>
          </div>
        </Card>
      )}

      {/* Puzzle grid */}
      {loading ? (
        <div className="text-center py-8">
          <div className="text-2xl animate-bounce mb-2">{'\uD83E\uDDE9'}</div>
          <p className="text-[var(--text-muted)]">加载题目...</p>
        </div>
      ) : puzzles.length === 0 ? (
        <Card padding="lg" hoverable={false}>
          <div className="text-center py-4">
            <p className="text-[var(--text-sub)]">该难度暂无题目</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {paginatedPuzzles.map((puzzle, i) => {
              const solved = puzzle.solved || puzzle.is_correct
              return (
                <Card
                  key={puzzle.id ?? i}
                  padding="md"
                  onClick={() => goToPuzzle(puzzle.id ?? puzzle.puzzle_code)}
                >
                  <div className="text-center space-y-2">
                    <div
                      className="w-10 h-10 mx-auto rounded-full flex items-center justify-center text-lg font-bold"
                      style={{
                        background: solved
                          ? 'rgba(16,185,129,0.15)'
                          : 'var(--accent-light)',
                        color: solved
                          ? 'var(--success)'
                          : 'var(--accent)',
                      }}
                    >
                      {solved ? '\u2713' : i + 1}
                    </div>
                    <div className="text-[var(--text-xs)] text-[var(--text-muted)]">
                      {puzzle.rating ?? ''}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Load more */}
          {paginatedPuzzles.length < puzzles.length && (
            <div className="text-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
              >
                加载更多 ({paginatedPuzzles.length}/{puzzles.length})
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const ThemePracticePage: React.FC = () => {
  const { theme } = useParams<{ theme: string }>()
  const themeName = theme ? (THEME_NAMES[theme] || theme) : '未知主题'
  return <ThemePuzzleListPage theme={theme ?? ''} themeName={themeName} />
}

export default ThemePracticePage
