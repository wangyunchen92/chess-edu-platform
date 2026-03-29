import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { playApi } from '@/api/play'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'
import Badge from '@/components/common/Badge'

interface GameRecord {
  id: string
  opponent: string
  opponent_emoji: string
  result: 'win' | 'loss' | 'draw'
  rating_change: number
  date: string
  total_moves: number
  time_control: number
}

const RESULT_MAP = {
  win:  { label: '胜利', color: 'success' as const, emoji: '\uD83C\uDFC6' },
  loss: { label: '失败', color: 'danger' as const, emoji: '\uD83D\uDCAA' },
  draw: { label: '和棋', color: 'warning' as const, emoji: '\uD83E\uDD1D' },
}

const GameHistoryPage: React.FC = () => {
  const navigate = useNavigate()
  const [games, setGames] = useState<GameRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    setLoading(true)
    playApi.getGameHistory(page, 10)
      .then((res) => {
        // Handle nested {code, data: {...}} format
        const payload = res.data?.data ?? res.data
        const items = Array.isArray(payload) ? payload : (payload?.items ?? [])
        setGames((prev) => (page === 1 ? items : [...prev, ...items]))
        setHasMore(items.length >= 10)
      })
      .catch((err) => {
        console.error('[GameHistoryPage] Failed to load game history:', err)
        setGames([
          { id: '1', opponent: '豆丁', opponent_emoji: '\uD83D\uDC30', result: 'win', rating_change: 15, date: '2026-03-28', total_moves: 34, time_control: 600 },
          { id: '2', opponent: '棉花糖', opponent_emoji: '\uD83E\uDDC1', result: 'loss', rating_change: -12, date: '2026-03-27', total_moves: 42, time_control: 600 },
          { id: '3', opponent: '豆丁', opponent_emoji: '\uD83D\uDC30', result: 'win', rating_change: 10, date: '2026-03-27', total_moves: 28, time_control: 300 },
          { id: '4', opponent: '龟龟', opponent_emoji: '\uD83D\uDC22', result: 'draw', rating_change: 0, date: '2026-03-26', total_moves: 56, time_control: 600 },
          { id: '5', opponent: '豆丁', opponent_emoji: '\uD83D\uDC30', result: 'win', rating_change: 8, date: '2026-03-25', total_moves: 22, time_control: 300 },
        ])
        setHasMore(false)
      })
      .finally(() => setLoading(false))
  }, [page])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
          {'\uD83D\uDCCB'} 对局历史
        </h1>
        <Button variant="secondary" size="sm" onClick={() => navigate('/play')}>
          去对弈
        </Button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '总对局', value: games.length, color: 'var(--accent)' },
          { label: '胜局', value: games.filter((g) => g.result === 'win').length, color: 'var(--success)' },
          { label: '胜率', value: games.length > 0 ? `${Math.round((games.filter((g) => g.result === 'win').length / games.length) * 100)}%` : '--', color: 'var(--warning)' },
        ].map((s) => (
          <Card key={s.label} padding="md" hoverable={false}>
            <div className="text-center">
              <div className="text-[var(--text-xl)] font-bold" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="text-[var(--text-xs)] text-[var(--text-muted)]">{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Game list */}
      <div className="space-y-3">
        {games.map((game) => {
          const result = RESULT_MAP[game.result]
          return (
            <Card
              key={game.id}
              padding="md"
              onClick={() => navigate(`/play/review/${game.id}`)}
            >
              <div className="flex items-center gap-4">
                {/* Opponent avatar */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0"
                  style={{
                    background: game.result === 'win'
                      ? 'rgba(16,185,129,0.1)'
                      : game.result === 'loss'
                        ? 'rgba(239,68,68,0.1)'
                        : 'rgba(245,158,11,0.1)',
                  }}
                >
                  {game.opponent_emoji}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-md)] font-semibold text-[var(--text)]">
                      vs {game.opponent}
                    </span>
                    <Badge color={result.color}>{result.label}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[var(--text-xs)] text-[var(--text-muted)]">
                    <span>{game.date}</span>
                    <span>{game.total_moves} 步</span>
                    <span>{game.time_control / 60} 分钟</span>
                  </div>
                </div>

                {/* Rating change */}
                <div className="text-right shrink-0">
                  <div
                    className="text-[var(--text-md)] font-bold tabular-nums"
                    style={{
                      color: game.rating_change > 0
                        ? 'var(--success)'
                        : game.rating_change < 0
                          ? 'var(--danger)'
                          : 'var(--text-muted)',
                    }}
                  >
                    {game.rating_change > 0 ? '+' : ''}{game.rating_change}
                  </div>
                  <div className="text-[var(--text-xs)] text-[var(--text-muted)]">Rating</div>
                </div>

                {/* Arrow */}
                <div className="text-[var(--text-muted)] text-sm shrink-0">{'\u203A'}</div>
              </div>
            </Card>
          )
        })}
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="text-2xl animate-bounce mb-2">{'\u265E'}</div>
          <p className="text-[var(--text-muted)] text-[var(--text-sm)]">加载中...</p>
        </div>
      )}

      {!loading && games.length === 0 && (
        <Card padding="lg" hoverable={false}>
          <div className="text-center py-8">
            <div className="text-4xl mb-3">{'\uD83C\uDFAE'}</div>
            <p className="text-[var(--text-sub)] mb-4">还没有对局记录</p>
            <Button variant="primary" onClick={() => navigate('/play')}>
              去下第一盘棋
            </Button>
          </div>
        </Card>
      )}

      {hasMore && !loading && games.length > 0 && (
        <div className="text-center">
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)}>
            加载更多
          </Button>
        </div>
      )}
    </div>
  )
}

export default GameHistoryPage
