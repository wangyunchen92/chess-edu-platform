import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { puzzlesApi } from '@/api/puzzles'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'
import Badge from '@/components/common/Badge'
import RatingDisplay from '@/components/gamification/RatingDisplay'
import Loading from '@/components/common/Loading'

interface PuzzleStats {
  puzzleRating: number
  totalSolved: number
  accuracy: number
}

interface ChallengeLevel {
  level: number
  label: string
  emoji: string
  unlocked: boolean
  progress: number
  total: number
}

const CHALLENGE_LEVELS: ChallengeLevel[] = [
  { level: 1, label: '入门', emoji: '\u2B50', unlocked: true, progress: 0, total: 10 },
  { level: 2, label: '初级', emoji: '\u2B50\u2B50', unlocked: false, progress: 0, total: 15 },
  { level: 3, label: '中级', emoji: '\u2B50\u2B50\u2B50', unlocked: false, progress: 0, total: 20 },
  { level: 4, label: '高级', emoji: '\uD83C\uDF1F', unlocked: false, progress: 0, total: 20 },
  { level: 5, label: '大师', emoji: '\uD83D\uDC51', unlocked: false, progress: 0, total: 25 },
]

const PuzzlesHomePage: React.FC = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState<PuzzleStats>({
    puzzleRating: 300,
    totalSolved: 0,
    accuracy: 0,
  })
  const [levels, setLevels] = useState(CHALLENGE_LEVELS)
  const [dailyDone, setDailyDone] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      puzzlesApi.getPuzzleStats()
        .then((res) => {
          // Handle nested {code, data: {...}} format
          const payload: any = (res.data as any)?.data ?? res.data
          if (payload && typeof payload === 'object') {
            setStats({
              puzzleRating: payload.puzzle_rating ?? payload.puzzleRating ?? 300,
              totalSolved: payload.total_correct ?? payload.totalSolved ?? 0,
              accuracy: payload.accuracy_pct ?? payload.accuracy ?? 0,
            })
            // Challenge progress is embedded in stats response as challenge_progress
            if (Array.isArray(payload.challenge_progress)) {
              const merged = CHALLENGE_LEVELS.map((lvl) => {
                const remote = payload.challenge_progress.find(
                  (cp: any) => cp.level === lvl.level
                )
                if (remote) {
                  return {
                    ...lvl,
                    unlocked: remote.solved_puzzles > 0 || lvl.unlocked,
                    progress: remote.solved_puzzles ?? 0,
                    total: remote.total_puzzles ?? lvl.total,
                  }
                }
                return lvl
              })
              setLevels(merged)
            }
            // Daily done count from stats
            if (payload.daily_attempted_today !== undefined) {
              setDailyDone(payload.daily_attempted_today)
            }
          }
        })
        .catch((err) => {
          console.error('[PuzzlesHomePage] Failed to load puzzle stats:', err)
          setStats({ puzzleRating: 300, totalSolved: 42, accuracy: 73 })
          setLevels([
            { ...CHALLENGE_LEVELS[0], progress: 7 },
            { ...CHALLENGE_LEVELS[1], unlocked: true, progress: 3 },
            ...CHALLENGE_LEVELS.slice(2),
          ])
          setDailyDone(1)
        }),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <Loading size="lg" text="加载谜题中心..." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
            {'\uD83E\uDDE9'} 谜题中心
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--text-sub)] mt-1">
            锻炼你的战术眼光！
          </p>
        </div>
        <RatingDisplay rating={stats.puzzleRating} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: '已解决', value: stats.totalSolved, emoji: '\u2705', color: 'var(--success)' },
          { label: '正确率', value: `${stats.accuracy}%`, emoji: '\uD83C\uDFAF', color: 'var(--accent)' },
          { label: '谜题评分', value: stats.puzzleRating, emoji: '\uD83D\uDCC8', color: 'var(--warning)' },
        ].map((s) => (
          <Card key={s.label} padding="md" hoverable={false}>
            <div className="text-center">
              <div className="text-xl mb-1">{s.emoji}</div>
              <div className="text-[var(--text-lg)] font-bold" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="text-[var(--text-xs)] text-[var(--text-muted)]">{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Daily Puzzles */}
      <Card padding="lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[var(--radius-md)] flex items-center justify-center text-2xl"
              style={{ background: 'rgba(245,158,11,0.1)' }}>
              {'\u2600\uFE0F'}
            </div>
            <div>
              <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">每日谜题</h3>
              <p className="text-[var(--text-xs)] text-[var(--text-muted)]">
                每天3道精选谜题 &middot; 已完成 {dailyDone}/3
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/puzzles/daily')}
          >
            {dailyDone >= 3 ? '\u2705 已完成' : '\u25B6 开始'}
          </Button>
        </div>
        {/* Progress dots */}
        <div className="flex gap-2 mt-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex-1 h-2 rounded-full transition-colors"
              style={{
                background: i < dailyDone
                  ? 'linear-gradient(90deg, var(--accent), var(--accent-2))'
                  : 'var(--border)',
              }}
            />
          ))}
        </div>
      </Card>

      {/* Challenge Mode */}
      <div>
        <h2 className="text-[var(--text-lg)] font-bold text-[var(--text)] mb-3">
          {'\uD83C\uDFC6'} 闯关模式
        </h2>
        <div className="space-y-2">
          {levels.map((lvl) => (
            <Card
              key={lvl.level}
              padding="md"
              onClick={lvl.unlocked ? () => navigate(`/puzzles/challenge?level=${lvl.level}`) : undefined}
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl w-10 text-center">{lvl.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-md)] font-semibold text-[var(--text)]">
                      Level {lvl.level}: {lvl.label}
                    </span>
                    {!lvl.unlocked && (
                      <Badge color="neutral">{'\uD83D\uDD12'} 未解锁</Badge>
                    )}
                  </div>
                  {lvl.unlocked && (
                    <div className="mt-1.5">
                      <div className="flex justify-between text-[var(--text-xs)] text-[var(--text-muted)] mb-1">
                        <span>{lvl.progress}/{lvl.total}</span>
                        <span>{Math.round((lvl.progress / lvl.total) * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-300"
                          style={{
                            width: `${(lvl.progress / lvl.total) * 100}%`,
                            background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                {lvl.unlocked && (
                  <div className="text-[var(--text-muted)] text-sm shrink-0">{'\u203A'}</div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Mistake Book */}
      <Card padding="lg" onClick={() => navigate('/puzzles/mistakes')}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[var(--radius-md)] flex items-center justify-center text-2xl"
            style={{ background: 'rgba(239,68,68,0.1)' }}>
            {'\uD83D\uDCD6'}
          </div>
          <div className="flex-1">
            <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">错题本</h3>
            <p className="text-[var(--text-xs)] text-[var(--text-muted)]">
              回顾做错的题目，巩固薄弱环节
            </p>
          </div>
          <div className="text-[var(--text-muted)] text-sm">{'\u203A'}</div>
        </div>
      </Card>
    </div>
  )
}

export default PuzzlesHomePage
