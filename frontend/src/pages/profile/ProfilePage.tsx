import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { userApi } from '@/api/user'
import { gamificationApi } from '@/api/gamification'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'
import RatingDisplay from '@/components/gamification/RatingDisplay'
import StreakBadge from '@/components/gamification/StreakBadge'
import ProgressBar from '@/components/common/ProgressBar'

interface ProfileData {
  rating: number
  xp: { current: number; target: number; level: number }
  streak: number
  gameStats: { total: number; wins: number; losses: number; draws: number; winRate: number }
  puzzleStats: { rating: number; solved: number; accuracy: number }
  learnProgress: { completed: number; total: number }
  achievements: Array<{ id: string; name: string; emoji: string; unlockedAt: string }>
}

const MOCK_PROFILE: ProfileData = {
  rating: 300,
  xp: { current: 0, target: 200, level: 1 },
  streak: 0,
  gameStats: { total: 0, wins: 0, losses: 0, draws: 0, winRate: 0 },
  puzzleStats: { rating: 300, solved: 0, accuracy: 0 },
  learnProgress: { completed: 0, total: 0 },
  achievements: [],
}

const ACHIEVEMENT_EMOJI: Record<string, string> = {
  first_game: '\u2694\uFE0F',
  first_win: '\uD83C\uDFC6',
  ten_wins: '\uD83C\uDF1F',
  speed_master: '\u26A1',
  comeback: '\uD83D\uDD04',
  studious: '\uD83D\uDCDA',
  puzzle_eye: '\uD83D\uDC41\uFE0F',
  perfect_streak: '\uD83D\uDC8E',
  persistent: '\uD83D\uDD25',
  all_rounder: '\uD83C\uDFAF',
}

const ProfilePage: React.FC = () => {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [data, setData] = useState<ProfileData>(MOCK_PROFILE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      userApi.getProfileStats().catch((err) => {
        console.error('[ProfilePage] Failed to load profile stats:', err)
        return null
      }),
      userApi.getProfile().catch((err) => {
        console.error('[ProfilePage] Failed to load user profile:', err)
        return null
      }),
      gamificationApi.getXP().catch((err) => {
        console.error('[ProfilePage] Failed to load XP:', err)
        return null
      }),
      gamificationApi.getAchievements().catch((err) => {
        console.error('[ProfilePage] Failed to load achievements:', err)
        return null
      }),
    ]).then(([statsRes, profileRes, xpRes, achRes]) => {
      // Any non-null response means at least one API succeeded
      let hadAnyData = !!(statsRes || profileRes || xpRes || achRes)

      setData((prev) => {
        const next = { ...prev }

        // Profile stats: game_stats, puzzle_stats, learning_stats
        if (statsRes?.data) {
          const s: any = (statsRes.data as any)?.data ?? statsRes.data
          if (s.game_stats) {
            next.gameStats = {
              total: s.game_stats.total_games ?? 0,
              wins: s.game_stats.wins ?? 0,
              losses: s.game_stats.losses ?? 0,
              draws: s.game_stats.draws ?? 0,
              winRate: s.game_stats.win_rate ?? 0,
            }
          }
          if (s.puzzle_stats) {
            next.puzzleStats = {
              rating: s.puzzle_stats.puzzle_rating ?? 300,
              solved: s.puzzle_stats.total_solved ?? 0,
              accuracy: s.puzzle_stats.accuracy ?? 0,
            }
          }
          if (s.learning_stats) {
            next.learnProgress = {
              completed: s.learning_stats.completed_lessons ?? 0,
              total: s.learning_stats.total_lessons ?? 0,
            }
          }
          // Recent achievements from profile stats
          if (Array.isArray(s.recent_achievements)) {
            next.achievements = s.recent_achievements.map((a: any) => ({
              id: a.id ?? '',
              name: a.name ?? '',
              emoji: ACHIEVEMENT_EMOJI[a.slug ?? a.id] ?? a.icon_key ?? '\uD83C\uDFC5',
              unlockedAt: a.achieved_at ?? '',
            }))
          }
        }

        // User profile: rating, streak
        if (profileRes?.data) {
          const p: any = (profileRes.data as any)?.data ?? profileRes.data
          if (p.rating) {
            next.rating = p.rating.game_rating ?? next.rating
            // Also update puzzle stats rating
            if (p.rating.puzzle_rating !== undefined) {
              next.puzzleStats = { ...next.puzzleStats, rating: p.rating.puzzle_rating }
            }
          }
          if (p.streak) {
            next.streak = p.streak.login_streak ?? p.streak.train_streak ?? next.streak
          }
        }

        // XP: use xp_total with level calculation, not xp_today
        if (xpRes?.data) {
          const x: any = (xpRes.data as any)?.data ?? xpRes.data
          const xpTotal = x.xp_total ?? 0
          const xpToNext = x.xp_to_next_level ?? 200
          const level = x.level ?? 1
          // XP progress bar: show progress toward next level using xp_total
          // current = xp_total mod xp_to_next_level (approximate), target = xp_to_next_level
          // Better: use xp_to_next_level as remaining, so current = xpToNext - remaining...
          // Actually the backend provides xp_to_next_level as the total needed for next level
          // The progress within current level: xp_total - (cumulative XP for current level)
          // Simplest correct approach: current = xpTotal, target = xpTotal + xpToNext
          // That way the bar shows how close to next level
          next.xp = {
            current: xpTotal,
            target: xpTotal + xpToNext,
            level,
          }
        }

        // Achievements from gamification API (as fallback/supplement)
        if (achRes?.data && !statsRes?.data) {
          const a: any = (achRes.data as any)?.data ?? achRes.data
          if (Array.isArray(a.achievements)) {
            next.achievements = a.achievements
              .filter((ac: any) => ac.achieved_at || ac.achieved)
              .map((ac: any) => ({
                id: ac.id ?? ac.slug ?? '',
                name: ac.name ?? '',
                emoji: ACHIEVEMENT_EMOJI[ac.slug ?? ''] ?? ac.icon_key ?? '\uD83C\uDFC5',
                unlockedAt: ac.achieved_at ?? '',
              }))
              .slice(0, 3)
          }
        }

        return next
      })

      if (!hadAnyData) {
        setError('加载个人数据失败，请检查网络后重试')
      }
    }).finally(() => setLoading(false))
  }, [])

  const nickname = user?.nickname ?? user?.username ?? '冒险者'
  const username = user?.username ?? 'player'
  const winRate = data.gameStats.winRate > 0
    ? Math.round(data.gameStats.winRate * 100) / 100
    : data.gameStats.total > 0
      ? Math.round((data.gameStats.wins / data.gameStats.total) * 100)
      : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-3">{'\uD83D\uDC64'}</div>
          <p className="text-[var(--text-muted)] text-[var(--text-sm)]">加载个人资料...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 rounded-[var(--radius-sm)] bg-[rgba(245,158,11,0.1)] text-[var(--warning)] text-[var(--text-sm)] flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => window.location.reload()}
            className="text-xs px-3 py-1 rounded-full bg-[var(--warning)] text-white hover:opacity-90"
          >
            重试
          </button>
        </div>
      )}

      {/* ── Profile Header ── */}
      <Card padding="lg" hoverable={false}>
        <div className="flex items-center gap-5">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          >
            {nickname.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">{nickname}</h1>
              <span className="text-[var(--text-xs)] px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] font-semibold">
                {user?.role === 'admin' ? '管理员' : user?.role === 'teacher' ? '教师' : '学生'}
              </span>
            </div>
            <p className="text-[var(--text-sm)] text-[var(--text-muted)] mt-0.5">@{username}</p>
            <div className="flex items-center gap-4 mt-2">
              <StreakBadge days={data.streak} />
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/settings')}>
            编辑资料
          </Button>
        </div>
      </Card>

      {/* ── Rating Cards ── */}
      <div className="grid grid-cols-2 gap-4">
        <Card padding="lg" hoverable={false}>
          <div className="text-center">
            <span className="text-xs text-[var(--text-muted)]">对弈评分</span>
            <div className="mt-1">
              <RatingDisplay rating={data.rating} />
            </div>
          </div>
        </Card>
        <Card padding="lg" hoverable={false}>
          <div className="text-center">
            <span className="text-xs text-[var(--text-muted)]">谜题评分</span>
            <div className="mt-1">
              <RatingDisplay rating={data.puzzleStats.rating} />
            </div>
          </div>
        </Card>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Game Stats */}
        <Card padding="lg" hoverable={false}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">{'\u265E'}</span>
            <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">对弈统计</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-sm)] text-[var(--text-sub)]">总对局</span>
              <span className="text-[var(--text-sm)] font-bold text-[var(--text)] tabular-nums">{data.gameStats.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-sm)] text-[var(--text-sub)]">{'\uD83C\uDFC6'} 胜</span>
              <span className="text-[var(--text-sm)] font-bold tabular-nums" style={{ color: 'var(--success)' }}>{data.gameStats.wins}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-sm)] text-[var(--text-sub)]">{'\uD83D\uDCAA'} 负</span>
              <span className="text-[var(--text-sm)] font-bold tabular-nums" style={{ color: 'var(--danger)' }}>{data.gameStats.losses}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-sm)] text-[var(--text-sub)]">{'\uD83E\uDD1D'} 和</span>
              <span className="text-[var(--text-sm)] font-bold tabular-nums" style={{ color: 'var(--warning)' }}>{data.gameStats.draws}</span>
            </div>
            <div className="pt-2 border-t border-[var(--border)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[var(--text-sm)] text-[var(--text-sub)]">胜率</span>
                <span className="text-[var(--text-sm)] font-bold text-[var(--accent)]">{winRate}%</span>
              </div>
              <ProgressBar value={winRate} max={100} height={6} />
            </div>
          </div>
        </Card>

        {/* Puzzle Stats */}
        <Card padding="lg" hoverable={false}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">{'\uD83E\uDDE9'}</span>
            <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">谜题统计</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-sm)] text-[var(--text-sub)]">谜题评分</span>
              <span className="text-[var(--text-md)] font-bold tabular-nums" style={{ color: 'var(--warning)' }}>{data.puzzleStats.rating}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-sm)] text-[var(--text-sub)]">已解题数</span>
              <span className="text-[var(--text-sm)] font-bold text-[var(--text)] tabular-nums">{data.puzzleStats.solved}</span>
            </div>
            <div className="pt-2 border-t border-[var(--border)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[var(--text-sm)] text-[var(--text-sub)]">正确率</span>
                <span className="text-[var(--text-sm)] font-bold text-[var(--success)]">{data.puzzleStats.accuracy}%</span>
              </div>
              <ProgressBar value={data.puzzleStats.accuracy} max={100} height={6} color="var(--success)" gradient={false} />
            </div>
          </div>
        </Card>

        {/* Learning Progress */}
        <Card padding="lg" hoverable={false}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">{'\uD83D\uDCDA'}</span>
            <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">学习进度</h3>
          </div>
          <div className="flex flex-col items-center py-4">
            <div className="relative w-24 h-24 mb-3">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke="url(#learnGrad)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${data.learnProgress.total > 0 ? (data.learnProgress.completed / data.learnProgress.total) * 264 : 0} 264`}
                  className="transition-all duration-500"
                />
                <defs>
                  <linearGradient id="learnGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--accent)" />
                    <stop offset="100%" stopColor="var(--accent-2)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[var(--text-lg)] font-bold text-[var(--text)]">
                  {data.learnProgress.completed}/{data.learnProgress.total}
                </span>
              </div>
            </div>
            <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
              已完成 {data.learnProgress.completed} / {data.learnProgress.total} 门课程
            </p>
          </div>
          <Button variant="secondary" size="sm" className="w-full" onClick={() => navigate('/learn')}>
            继续学习
          </Button>
        </Card>
      </div>

      {/* ── Recent Achievements ── */}
      <Card padding="lg" hoverable={false}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">{'\uD83C\uDFC5'}</span>
            <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">最近成就</h3>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/profile/achievements')}>
            查看全部
          </Button>
        </div>
        {data.achievements.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {data.achievements.slice(0, 3).map((ach) => (
              <div
                key={ach.id}
                className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-sm)] bg-[var(--bg)]"
              >
                <span className="text-2xl">{ach.emoji}</span>
                <div className="min-w-0">
                  <p className="text-[var(--text-sm)] font-semibold text-[var(--text)] truncate">{ach.name}</p>
                  <p className="text-[var(--text-xs)] text-[var(--text-muted)]">{ach.unlockedAt}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--text-sm)] text-[var(--text-muted)] text-center py-4">
            还没有解锁成就，继续努力吧！
          </p>
        )}
      </Card>

      {/* Logout */}
      <button
        onClick={() => {
          useAuthStore.getState().logout()
          window.location.href = import.meta.env.BASE_URL || '/'
        }}
        className="w-full py-3 rounded-xl text-center text-[var(--danger)] font-semibold bg-[rgba(239,68,68,0.08)] hover:bg-[rgba(239,68,68,0.15)] transition-colors"
      >
        退出登录
      </button>
    </div>
  )
}

export default ProfilePage
