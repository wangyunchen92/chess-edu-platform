import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { dashboardApi } from '@/api/dashboard'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'
import RatingDisplay from '@/components/gamification/RatingDisplay'
import XPBar from '@/components/gamification/XPBar'
import StreakBadge from '@/components/gamification/StreakBadge'
import ProgressBar from '@/components/common/ProgressBar'
import Loading from '@/components/common/Loading'
import { translateRankTitle } from '@/utils/rank'

interface DashboardData {
  trainProgress: { completed: number; total: number }
  xp: { current: number; target: number; level: number }
  streak: number
  rating: number
  rankTitle: string
  dailyPuzzlesRemaining: number
  todayGamesCount: number
  recentGames: Array<{
    id: string
    opponent: string
    result: 'win' | 'loss' | 'draw'
    ratingChange: number
  }>
  weekStats: {
    games: number
    winRate: string
    puzzles: number
    learnMinutes: number
  }
  recommendations: Array<{
    type: string
    title: string
    emoji: string
    link: string
  }>
}

const MOCK_DASHBOARD: DashboardData = {
  trainProgress: { completed: 1, total: 3 },
  xp: { current: 65, target: 100, level: 3 },
  streak: 7,
  rating: 1200,
  rankTitle: '',
  dailyPuzzlesRemaining: 3,
  todayGamesCount: 0,
  recentGames: [
    { id: '1', opponent: '豆丁', result: 'win', ratingChange: 15 },
    { id: '2', opponent: '棉花糖', result: 'loss', ratingChange: -12 },
    { id: '3', opponent: '豆丁', result: 'win', ratingChange: 10 },
  ],
  weekStats: { games: 5, winRate: '60%', puzzles: 12, learnMinutes: 45 },
  recommendations: [
    { type: 'puzzle', title: '完成今日谜题', emoji: '\uD83E\uDDE9', link: '/puzzles/daily' },
    { type: 'learn', title: '继续学习：认识棋盘', emoji: '\uD83D\uDCDA', link: '/learn' },
    { type: 'game', title: '挑战新对手', emoji: '\u265E', link: '/play' },
  ],
}

const RESULT_EMOJI = { win: '\uD83C\uDFC6', loss: '\uD83D\uDCAA', draw: '\uD83E\uDD1D' }
const RESULT_LABEL = { win: '胜', loss: '负', draw: '和' }
const RESULT_COLOR = { win: 'var(--success)', loss: 'var(--danger)', draw: 'var(--warning)' }

/** Safely extract DashboardData from API response, handling nested formats and snake_case */
function parseDashboardResponse(resData: unknown): DashboardData | null {
  if (!resData || typeof resData !== 'object') return null
  const obj = resData as Record<string, unknown>
  // Handle { data: { ... } } wrapper format (backend returns {code, data: {...}})
  const payload = (obj.data && typeof obj.data === 'object') ? obj.data as Record<string, any> : obj as Record<string, any>

  // Accept both camelCase (old mock) and snake_case (real backend) fields
  const trainProgress = payload.trainProgress ?? (payload.train_progress ? {
    completed: payload.train_progress.completed_items ?? 0,
    total: payload.train_progress.total_items ?? 3,
  } : null)

  // XP progress: show progress within current level
  // xp_to_next_level = remaining XP to reach next level
  // We show: current = (level_xp_total - remaining), target = level_xp_total
  const xpToNext = payload.xp_to_next_level ?? 200
  const xpLevel = payload.level ?? 1
  // Estimate total XP needed for this level: level * 200 (matching backend formula)
  const levelTotalXp = xpLevel * 200
  const xpCurrent = Math.max(0, levelTotalXp - xpToNext)
  const xp = payload.xp ?? {
    current: xpCurrent,
    target: levelTotalXp,
    level: xpLevel,
  }

  const ratingObj = (typeof payload.rating === 'object' && payload.rating) ? payload.rating : null
  const rating = typeof payload.rating === 'number'
    ? payload.rating
    : ratingObj?.game_rating ?? payload.game_rating ?? undefined
  const rankTitleRaw = ratingObj?.rank_title ?? payload.rank_title ?? ''
  const rankTitle = translateRankTitle(rankTitleRaw)

  const streak = payload.streak ?? payload.login_streak ?? payload.train_streak ?? 0

  const recentGames = Array.isArray(payload.recentGames)
    ? payload.recentGames
    : Array.isArray(payload.recent_games)
      ? payload.recent_games.map((g: any) => ({
          id: g.game_id ?? g.id ?? '',
          opponent: g.character_name ?? g.opponent ?? '?',
          result: g.result ?? 'draw',
          ratingChange: g.rating_change ?? g.ratingChange ?? 0,
        }))
      : []

  // Compute weekStats from real data (backend doesn't return a separate weekStats)
  const gamesCount = recentGames.length
  const winsCount = recentGames.filter((g: any) => g.result === 'win').length
  const computedWinRate = gamesCount > 0 ? `${Math.round((winsCount / gamesCount) * 100)}%` : '0%'
  const dailyUsed = payload.daily_puzzles_remaining != null
    ? (payload.quota?.limit ?? 3) - (payload.daily_puzzles_remaining ?? 3)
    : 0
  const weekStats = payload.weekStats ?? payload.week_stats ?? {
    games: gamesCount,
    winRate: computedWinRate,
    puzzles: dailyUsed,
    learnMinutes: 0,
  }

  const recommendations = payload.recommendations ?? MOCK_DASHBOARD.recommendations

  const dailyPuzzlesRemaining = payload.dailyPuzzlesRemaining ?? payload.daily_puzzles_remaining ?? 3
  const todayGamesCount = payload.todayGamesCount ?? payload.today_games_count ?? 0

  if (trainProgress == null && rating == null) return null

  return {
    trainProgress: trainProgress ?? { completed: 0, total: 3 },
    xp,
    streak,
    rating: rating ?? 1200,
    rankTitle,
    dailyPuzzlesRemaining,
    todayGamesCount,
    recentGames,
    weekStats,
    recommendations,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [data, setData] = useState<DashboardData>(MOCK_DASHBOARD)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Reload dashboard data every time the page becomes visible (returning from game/puzzle/etc)
  const loadDashboard = useCallback(() => {
    setLoading(true)
    setError(null)
    dashboardApi.getDashboard()
      .then((res) => {
        const parsed = parseDashboardResponse(res.data)
        if (parsed) {
          setData(parsed)
        } else {
          setData({ ...MOCK_DASHBOARD })
        }
      })
      .catch((err) => {
        console.error('[DashboardPage] Failed to load dashboard:', err)
        setData({ ...MOCK_DASHBOARD })
        setError(err?.message ?? 'Failed to load dashboard')
      })
      .finally(() => setLoading(false))
  }, [])

  // Load on mount
  useEffect(() => { loadDashboard() }, [loadDashboard])

  // Reload when page becomes visible again (user returns from other page)
  useEffect(() => {
    const handleFocus = () => loadDashboard()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [loadDashboard])

  const d = data

  if (loading) {
    return <Loading size="lg" text="加载仪表盘..." />
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-4xl">😿</div>
        <p className="text-[var(--text-sub)]">加载失败，请稍后重试</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Welcome Section ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center text-white text-xl sm:text-2xl font-bold shrink-0">
            {user?.nickname?.charAt(0) ?? user?.username?.charAt(0) ?? '?'}
          </div>
          <div>
            <h1 className="text-[var(--text-xl)] sm:text-[var(--text-2xl)] font-bold text-[var(--text)]">
              {user?.nickname ?? user?.username ?? '冒险者'}，你好！
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <RatingDisplay rating={d.rating} />
              <span className="text-[var(--text-xs)] text-[var(--text-muted)]">对弈评分</span>
            </div>
          </div>
        </div>
        <StreakBadge days={d.streak} />
      </div>

      {/* ── Daily Todo Checklist ── */}
      <Card padding="lg">
        <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-3">
          {'\uD83D\uDCCB'} 今日待办
        </h3>
        <div className="space-y-2">
          {[
            {
              done: d.trainProgress.completed >= d.trainProgress.total && d.trainProgress.total > 0,
              label: d.trainProgress.completed >= d.trainProgress.total && d.trainProgress.total > 0
                ? '每日训练已完成'
                : `完成每日训练 (${d.trainProgress.completed}/${d.trainProgress.total})`,
              link: '/train',
              emoji: '\uD83C\uDFAF',
            },
            ...(d.dailyPuzzlesRemaining === 0 ? [{
              done: true,
              label: '每日谜题已完成',
              link: '/puzzles/daily',
              emoji: '\uD83E\uDDE9',
            }] : d.dailyPuzzlesRemaining > 0 ? [{
              done: false,
              label: `完成每日谜题 (剩余${d.dailyPuzzlesRemaining}题)`,
              link: '/puzzles/daily',
              emoji: '\uD83E\uDDE9',
            }] : []),
            // dailyPuzzlesRemaining === -1 (unlimited/premium) → don't show
            {
              done: false,
              label: d.todayGamesCount > 0
                ? `今日已下${d.todayGamesCount}盘棋，再来一局？`
                : '和AI角色下一盘棋',
              link: '/play',
              emoji: '\u265E',
            },
            {
              done: false,
              label: '继续学习课程',
              link: '/learn',
              emoji: '\uD83D\uDCDA',
            },
          ].map((item) => (
            <div
              key={item.label}
              onClick={() => navigate(item.link)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors hover:bg-[var(--accent-light)]"
            >
              <span className="text-lg shrink-0">
                {item.done ? '\u2705' : item.emoji}
              </span>
              <span
                className={`text-[var(--text-sm)] flex-1 ${
                  item.done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text)]'
                }`}
              >
                {item.label}
              </span>
              <span className="text-[var(--text-muted)] text-sm">{'\u203A'}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Top Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Today's Training */}
        <Card padding="lg" onClick={() => navigate('/train')}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[var(--accent-light)] flex items-center justify-center text-xl">
              {'\uD83C\uDFAF'}
            </div>
            <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">今日训练</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[var(--text-sm)]">
              <span className="text-[var(--text-sub)]">训练进度</span>
              <span className="text-[var(--text-muted)]">{d.trainProgress.completed} / {d.trainProgress.total}</span>
            </div>
            <ProgressBar value={d.trainProgress.completed} max={d.trainProgress.total} height={6} />
            <XPBar current={d.xp.current} target={d.xp.target} level={d.xp.level} className="mt-2" />
          </div>
        </Card>

        {/* Quick Play */}
        <Card padding="lg" onClick={() => navigate('/play')}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[rgba(16,185,129,0.1)] flex items-center justify-center text-xl">
              {'\u265E'}
            </div>
            <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">快速对弈</h3>
          </div>
          <p className="text-[var(--text-sm)] text-[var(--text-sub)] mb-4">
            挑战AI角色，提升你的棋力
          </p>
          <Button variant="primary" size="sm" className="w-full">
            进入对弈大厅
          </Button>
        </Card>

        {/* Daily Puzzle */}
        <Card padding="lg" onClick={() => navigate('/puzzles/daily')}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[rgba(245,158,11,0.1)] flex items-center justify-center text-xl">
              {'\uD83E\uDDE9'}
            </div>
            <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">每日谜题</h3>
          </div>
          <p className="text-[var(--text-sm)] text-[var(--text-sub)] mb-4">
            每天三道精选谜题，锻炼战术思维
          </p>
          <Button variant="secondary" size="sm" className="w-full">
            今日谜题
          </Button>
        </Card>
      </div>

      {/* ── Recent Games ── */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">
            {'\uD83C\uDFAE'} 最近对局
          </h3>
          <Button variant="secondary" size="sm" onClick={() => navigate('/play/history')}>
            查看全部
          </Button>
        </div>
        {d.recentGames.length > 0 ? (
          <div className="space-y-2">
            {d.recentGames.map((game) => (
              <div
                key={game.id}
                className="flex items-center justify-between px-3 py-2 rounded-[var(--radius-sm)] hover:bg-[var(--bg)] cursor-pointer transition-colors"
                onClick={() => navigate(`/play/review/${game.id}`)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{RESULT_EMOJI[game.result]}</span>
                  <span className="text-[var(--text-sm)] text-[var(--text)]">vs {game.opponent}</span>
                  <span
                    className="text-[var(--text-xs)] font-semibold px-1.5 py-0.5 rounded"
                    style={{ color: RESULT_COLOR[game.result], background: `${RESULT_COLOR[game.result]}15` }}
                  >
                    {RESULT_LABEL[game.result]}
                  </span>
                </div>
                <span
                  className="text-[var(--text-sm)] font-bold tabular-nums"
                  style={{ color: game.ratingChange > 0 ? 'var(--success)' : game.ratingChange < 0 ? 'var(--danger)' : 'var(--text-muted)' }}
                >
                  {game.ratingChange > 0 ? '+' : ''}{game.ratingChange}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--text-sm)] text-[var(--text-muted)] text-center py-4">
            还没有对局记录，去下一盘棋吧！
          </p>
        )}
      </Card>

      {/* ── Weekly Overview ── */}
      <Card padding="lg">
        <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-4">
          {'\uD83D\uDCCA'} 本周数据概览
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: '对局', value: d.weekStats.games, color: 'var(--accent)', emoji: '\u265E' },
            { label: '胜率', value: d.weekStats.winRate, color: 'var(--success)', emoji: '\uD83C\uDFC6' },
            { label: '谜题', value: d.weekStats.puzzles, color: 'var(--warning)', emoji: '\uD83E\uDDE9' },
            { label: '学习', value: `${d.weekStats.learnMinutes}分钟`, color: 'var(--info)', emoji: '\uD83D\uDCDA' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-xl mb-1">{stat.emoji}</div>
              <div className="text-[var(--text-2xl)] font-bold" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Recommendations ── */}
      <Card padding="lg">
        <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-3">
          {'\uD83D\uDCA1'} 推荐内容
        </h3>
        <div className="space-y-2">
          {d.recommendations.map((rec, i) => (
            <button
              key={i}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[var(--radius-sm)] hover:bg-[var(--accent-light)] transition-colors text-left"
              onClick={() => navigate(rec.link)}
            >
              <span className="text-xl">{rec.emoji}</span>
              <span className="text-[var(--text-sm)] text-[var(--text)] flex-1">{rec.title}</span>
              <span className="text-[var(--text-muted)] text-sm">{'\u203A'}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default DashboardPage
