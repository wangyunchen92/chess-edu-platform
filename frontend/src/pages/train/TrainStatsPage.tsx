import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { trainApi } from '@/api/train'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'
import StreakBadge from '@/components/gamification/StreakBadge'

interface DayStat {
  label: string
  puzzles: number
  lessons: number
  games: number
}

const BAR_COLORS = {
  puzzles: 'var(--warning)',
  lessons: 'var(--info)',
  games: 'var(--success)',
}

const TrainStatsPage: React.FC = () => {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [data, setData] = useState<DayStat[]>([])
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      trainApi.getTrainStats().catch((err) => { console.error('[TrainStatsPage] Failed to load stats:', err); setError('加载训练统计失败'); return null }),
      trainApi.getStreak().catch((err) => { console.error('[TrainStatsPage] Failed to load streak:', err); return null }),
    ]).then(([statsRes, streakRes]) => {
      if (statsRes?.data) {
        const statsPayload: any = (statsRes.data as any)?.data ?? statsRes.data
        setData(statsPayload?.days ?? (Array.isArray(statsPayload) ? statsPayload : []))
      } else {
        setData([])
      }
      if (streakRes?.data) {
        const streakPayload: any = (streakRes.data as any)?.data ?? streakRes.data
        setStreak(streakPayload?.train_streak ?? streakPayload?.days ?? 0)
      }
    }).finally(() => setLoading(false))
  }, [period])

  const maxValue = Math.max(...data.map((d) => d.puzzles + d.lessons + d.games), 1)

  const totals = data.reduce(
    (acc, d) => ({
      puzzles: acc.puzzles + d.puzzles,
      lessons: acc.lessons + d.lessons,
      games: acc.games + d.games,
    }),
    { puzzles: 0, lessons: 0, games: 0 },
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
            {'\uD83D\uDCCA'} 训练统计
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--text-sub)] mt-1">
            回顾你的训练成果
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StreakBadge days={streak} />
          <Button variant="secondary" size="sm" onClick={() => navigate('/train')}>
            返回
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '谜题', value: totals.puzzles, color: BAR_COLORS.puzzles, emoji: '\uD83E\uDDE9' },
          { label: '课程', value: totals.lessons, color: BAR_COLORS.lessons, emoji: '\uD83D\uDCDA' },
          { label: '对局', value: totals.games, color: BAR_COLORS.games, emoji: '\u265E' },
        ].map((s) => (
          <Card key={s.label} padding="md" hoverable={false}>
            <div className="text-center">
              <div className="text-xl mb-1">{s.emoji}</div>
              <div className="text-[var(--text-xl)] font-bold" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="text-[var(--text-xs)] text-[var(--text-muted)]">{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Period toggle */}
      <div className="flex gap-2">
        {(['week', 'month'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className="px-4 py-2 rounded-full text-[var(--text-sm)] font-medium transition-colors"
            style={{
              background: period === p ? 'var(--accent)' : 'var(--bg-card)',
              color: period === p ? '#fff' : 'var(--text-sub)',
              border: `1px solid ${period === p ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            {p === 'week' ? '本周' : '本月'}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 rounded-[var(--radius-sm)] bg-[rgba(239,68,68,0.1)] text-[var(--danger)] text-[var(--text-sm)]">
          {error}
        </div>
      )}

      {/* Bar chart */}
      <Card padding="lg" hoverable={false}>
        {loading ? (
          <div className="text-center py-8 text-[var(--text-muted)]">加载中...</div>
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">暂无训练数据</div>
        ) : (
          <div className="space-y-4">
            {/* Legend */}
            <div className="flex gap-4 justify-end">
              {[
                { label: '谜题', color: BAR_COLORS.puzzles },
                { label: '课程', color: BAR_COLORS.lessons },
                { label: '对局', color: BAR_COLORS.games },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
                  <span className="text-[var(--text-xs)] text-[var(--text-muted)]">{l.label}</span>
                </div>
              ))}
            </div>

            {/* Bars */}
            <div className="flex items-end gap-2 h-48">
              {data.map((d, i) => {
                const total = d.puzzles + d.lessons + d.games
                const heightPercent = (total / maxValue) * 100
                const puzzleH = total > 0 ? (d.puzzles / total) * heightPercent : 0
                const lessonH = total > 0 ? (d.lessons / total) * heightPercent : 0
                const gameH = total > 0 ? (d.games / total) * heightPercent : 0

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    {/* Stacked bar */}
                    <div className="w-full flex flex-col-reverse items-stretch" style={{ height: '85%' }}>
                      <div
                        className="rounded-b transition-all duration-300"
                        style={{ height: `${puzzleH}%`, background: BAR_COLORS.puzzles, minHeight: d.puzzles > 0 ? 4 : 0 }}
                      />
                      <div
                        className="transition-all duration-300"
                        style={{ height: `${lessonH}%`, background: BAR_COLORS.lessons, minHeight: d.lessons > 0 ? 4 : 0 }}
                      />
                      <div
                        className="rounded-t transition-all duration-300"
                        style={{ height: `${gameH}%`, background: BAR_COLORS.games, minHeight: d.games > 0 ? 4 : 0 }}
                      />
                    </div>
                    {/* Value label */}
                    <span className="text-[10px] font-medium text-[var(--text-muted)]">
                      {total > 0 ? total : ''}
                    </span>
                    {/* Day label */}
                    <span className="text-[10px] text-[var(--text-muted)]">{d.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Encouragement */}
      <Card padding="md" hoverable={false}>
        <div className="text-center">
          <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
            {streak >= 7
              ? '\uD83D\uDD25 连续训练一周了，你太厉害了！保持下去！'
              : streak >= 3
                ? '\uD83D\uDCAA 连续训练中，加油！目标是连续7天！'
                : '\uD83C\uDF31 每天训练一点点，日积月累你就是大师！'}
          </p>
        </div>
      </Card>
    </div>
  )
}

export default TrainStatsPage
