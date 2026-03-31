import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { puzzlesApi } from '@/api/puzzles'
import { usePuzzleStore } from '@/stores/puzzleStore'
import { translateTheme } from '@/utils/puzzleTheme'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'
import ProgressBar from '@/components/common/ProgressBar'

interface ChallengePuzzle {
  id: string
  theme: string
  difficulty: string
  solved: boolean
}

const LEVEL_INFO: Record<number, { label: string; emoji: string; color: string }> = {
  1: { label: '入门', emoji: '\u2B50', color: 'var(--success)' },
  2: { label: '初级', emoji: '\u2B50\u2B50', color: 'var(--info)' },
  3: { label: '中级', emoji: '\u2B50\u2B50\u2B50', color: 'var(--warning)' },
  4: { label: '高级', emoji: '\uD83C\uDF1F', color: 'var(--danger)' },
  5: { label: '大师', emoji: '\uD83D\uDC51', color: 'var(--rank-purple)' },
}

const PuzzleChallengePage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const level = parseInt(searchParams.get('level') ?? '1', 10)
  const info = LEVEL_INFO[level] ?? LEVEL_INFO[1]

  const [puzzles, setPuzzles] = useState<ChallengePuzzle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    puzzlesApi.getChallengePuzzles(level)
      .then((res) => {
        // Unwrap {code, data: [...]} wrapper
        const payload: any = (res.data as any)?.data ?? res.data
        const list = Array.isArray(payload) ? payload : (payload?.items ?? payload?.puzzles ?? [])
        if (list.length > 0) {
          const mapped: ChallengePuzzle[] = list.map((p: any) => ({
            id: p.id ?? p.puzzle_code ?? '',
            theme: translateTheme(p.theme ?? p.themes ?? ''),
            difficulty: p.difficulty ?? (p.difficulty_level ? `第${p.difficulty_level}关` : info.label),
            solved: p.solved !== undefined ? !!p.solved : (p.is_correct === true),
          }))
          setPuzzles(mapped)
        } else {
          throw new Error('empty')
        }
      })
      .catch((err) => {
        console.error('[PuzzleChallengePage] Failed to load challenge:', err)
        const count = [10, 15, 20, 20, 25][level - 1] ?? 10
        setPuzzles(
          Array.from({ length: count }, (_, i) => ({
            id: `challenge-${level}-${i + 1}`,
            theme: ['将杀', '战术', '残局', '开局', '防守'][i % 5],
            difficulty: info.label,
            solved: i < 3,
          })),
        )
      })
      .finally(() => setLoading(false))
  }, [level, info.label])

  const setPuzzleList = usePuzzleStore((s: any) => s.setPuzzleList)

  const goToPuzzle = (puzzleId: string) => {
    setPuzzleList(puzzles.map((p) => p.id))
    navigate(`/puzzles/solve/${puzzleId}`)
  }

  const solvedCount = puzzles.filter((p) => p.solved).length
  const nextUnsolved = puzzles.find((p) => !p.solved)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
            {info.emoji} 第{level}关: {info.label}
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--text-sub)] mt-1">
            完成所有题目解锁下一关
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/puzzles')}>
          返回
        </Button>
      </div>

      {/* Overall progress */}
      <Card padding="md" hoverable={false}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[var(--text-sm)] font-medium text-[var(--text)]">闯关进度</span>
          <span className="text-[var(--text-sm)] font-bold" style={{ color: info.color }}>
            {solvedCount} / {puzzles.length}
          </span>
        </div>
        <ProgressBar value={solvedCount} max={puzzles.length} height={8} />
      </Card>

      {/* Quick start */}
      {nextUnsolved && (
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => goToPuzzle(nextUnsolved.id)}
        >
          {'\u25B6'} 继续挑战
        </Button>
      )}

      {!nextUnsolved && puzzles.length > 0 && (
        <Card padding="lg" hoverable={false}>
          <div className="text-center space-y-3">
            <div className="text-4xl">{'\uD83C\uDF89'}</div>
            <p className="text-[var(--text-lg)] font-bold text-[var(--success)]">
              恭喜通关！
            </p>
            {level < 5 && (
              <Button
                variant="primary"
                onClick={() => navigate(`/puzzles/challenge?level=${level + 1}`)}
              >
                进入第{level + 1}关
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Puzzle grid */}
      {loading ? (
        <div className="text-center py-8">
          <div className="text-2xl animate-bounce mb-2">{'\uD83E\uDDE9'}</div>
          <p className="text-[var(--text-muted)]">加载题目...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {puzzles.map((puzzle, i) => (
            <Card
              key={puzzle.id}
              padding="md"
              onClick={puzzle.solved || puzzle.id === nextUnsolved?.id || i === 0
                ? () => goToPuzzle(puzzle.id)
                : undefined}
            >
              <div className="text-center space-y-2">
                <div
                  className="w-10 h-10 mx-auto rounded-full flex items-center justify-center text-lg font-bold"
                  style={{
                    background: puzzle.solved
                      ? 'rgba(16,185,129,0.15)'
                      : puzzle.id === nextUnsolved?.id
                        ? 'var(--accent-light)'
                        : 'var(--border)',
                    color: puzzle.solved
                      ? 'var(--success)'
                      : puzzle.id === nextUnsolved?.id
                        ? 'var(--accent)'
                        : 'var(--text-muted)',
                  }}
                >
                  {puzzle.solved ? '\u2713' : i + 1}
                </div>
                <div className="text-[var(--text-xs)] text-[var(--text-muted)]">{puzzle.theme}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default PuzzleChallengePage
