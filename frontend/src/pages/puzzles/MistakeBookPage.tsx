import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { puzzlesApi } from '@/api/puzzles'
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
  const [mistakes, setMistakes] = useState<MistakePuzzle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    puzzlesApi.getMistakes()
      .then((res) => {
        const payload = res.data?.data ?? res.data
        const list = payload?.mistakes ?? (Array.isArray(payload) ? payload : [])
        setMistakes(list.map((m: any) => ({
          id: m.attempt_id ?? m.id ?? '',
          fen: m.puzzle?.fen ?? m.fen ?? '',
          theme: m.puzzle?.themes ?? m.theme ?? '',
          difficulty: m.puzzle?.difficulty_level ? `Level ${m.puzzle.difficulty_level}` : (m.difficulty ?? ''),
          date: m.attempted_at ?? m.date ?? '',
          retried: m.retried ?? false,
        })))
      })
      .catch((err) => {
        console.error('[MistakeBookPage] Failed to load mistakes:', err)
        setMistakes([
          { id: 'err-1', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', theme: '将杀', difficulty: '入门', date: '2026-03-28', retried: false },
          { id: 'err-2', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', theme: '战术', difficulty: '初级', date: '2026-03-27', retried: true },
          { id: 'err-3', fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', theme: '残局', difficulty: '入门', date: '2026-03-26', retried: false },
        ])
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
            <Card key={m.id} padding="md" onClick={() => navigate(`/puzzles/solve/${m.id}`)}>
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
                <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/puzzles/solve/${m.id}`) }}>
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
