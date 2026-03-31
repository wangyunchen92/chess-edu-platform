import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { puzzlesApi } from '@/api/puzzles'
import { usePuzzleStore } from '@/stores/puzzleStore'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'
import Badge from '@/components/common/Badge'

interface MistakePuzzle {
  id: string
  fen: string
  theme: string
  difficulty: string
  date: string
  retried: boolean
}

const MistakeBookPage: React.FC = () => {
  const navigate = useNavigate()
  const setPuzzleList = usePuzzleStore((s: any) => s.setPuzzleList)
  const [mistakes, setMistakes] = useState<MistakePuzzle[]>([])
  const [loading, setLoading] = useState(true)

  const goToPuzzle = (puzzleId: string) => {
    setPuzzleList(mistakes.map((m) => m.id))
    navigate(`/puzzles/solve/${puzzleId}`)
  }

  useEffect(() => {
    setLoading(true)
    puzzlesApi.getMistakes()
      .then((res) => {
        const payload = res.data?.data ?? res.data
        const list = payload?.mistakes ?? (Array.isArray(payload) ? payload : [])
        setMistakes(list.map((m: any) => ({
          id: m.puzzle?.id ?? m.puzzle?.puzzle_code ?? m.puzzle_id ?? m.id ?? '',
          fen: m.puzzle?.fen ?? m.fen ?? '',
          theme: m.puzzle?.themes ?? m.theme ?? '',
          difficulty: m.puzzle?.difficulty_level ? `第${m.puzzle.difficulty_level}级` : (m.difficulty ?? ''),
          date: m.attempted_at ?? m.date ?? '',
          retried: m.retried ?? false,
        })))
      })
      .catch((err) => {
        console.error('[MistakeBookPage] Failed to load mistakes:', err)
        setMistakes([])
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
            {'\uD83D\uDCD6'} 错题本
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--text-sub)] mt-1">
            回顾做错的题目，温故知新
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/puzzles')}>
          返回
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="text-2xl animate-bounce">{'\uD83D\uDCD6'}</div>
          <p className="text-[var(--text-muted)] mt-2">加载中...</p>
        </div>
      ) : mistakes.length === 0 ? (
        <Card padding="lg" hoverable={false}>
          <div className="text-center py-8">
            <div className="text-4xl mb-3">{'\uD83C\uDF1F'}</div>
            <h3 className="text-[var(--text-lg)] font-bold text-[var(--text)] mb-2">
              错题本是空的！
            </h3>
            <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
              你做得太棒了，没有错题！继续保持！
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {mistakes.map((m) => (
            <Card key={m.id} padding="md" onClick={() => goToPuzzle(m.id)}>
              <div className="flex items-center gap-4">
                {/* Mini board preview (simplified) */}
                <div
                  className="w-14 h-14 rounded-[var(--radius-sm)] flex items-center justify-center text-2xl shrink-0"
                  style={{ background: 'rgba(239,68,68,0.08)' }}
                >
                  {'\u265E'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge color={m.retried ? 'success' : 'danger'}>
                      {m.retried ? '\u2705 已重做' : '\u274C 待重做'}
                    </Badge>
                    <span className="text-[var(--text-xs)] px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">
                      {m.theme}
                    </span>
                    <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
                      {m.difficulty}
                    </span>
                  </div>
                  <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">
                    {m.date}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); goToPuzzle(m.id) }}>
                  重做
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default MistakeBookPage
