import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { userApi } from '@/api/user'
import { gamificationApi } from '@/api/gamification'
import { creditsApi } from '@/api/credits'
import * as teacherApi from '@/api/teacher'
import * as studentApi from '@/api/student'
import apiClient from '@/api/client'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import RatingDisplay from '@/components/gamification/RatingDisplay'
import StreakBadge from '@/components/gamification/StreakBadge'
import ProgressBar from '@/components/common/ProgressBar'
import { useUIStore } from '@/stores/uiStore'
import type { CreditTransactionItem } from '@/types/api'

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
  const [showPwdModal, setShowPwdModal] = useState(false)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const addToast = useUIStore((s) => s.addToast)

  // Credits state
  const [creditBalance, setCreditBalance] = useState(0)
  const [creditTotalEarned, setCreditTotalEarned] = useState(0)
  const [creditTotalSpent, setCreditTotalSpent] = useState(0)
  const [creditTransactions, setCreditTransactions] = useState<CreditTransactionItem[]>([])

  // Fetch credits
  useEffect(() => {
    creditsApi.getBalance().then((res) => {
      const d: any = (res.data as any)?.data ?? res.data
      setCreditBalance(d.balance ?? 0)
      setCreditTotalEarned(d.total_earned ?? 0)
      setCreditTotalSpent(d.total_spent ?? 0)
    }).catch(() => {})

    creditsApi.getTransactions(1, 10).then((res) => {
      const d: any = (res.data as any)?.data ?? res.data
      setCreditTransactions(d.items ?? [])
    }).catch(() => {})
  }, [])

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

  const handleChangePassword = async () => {
    if (!oldPwd || !newPwd) {
      setPwdError('请填写所有字段')
      return
    }
    if (newPwd.length < 6) {
      setPwdError('新密码至少6位')
      return
    }
    if (newPwd !== confirmPwd) {
      setPwdError('两次输入的新密码不一致')
      return
    }
    setPwdLoading(true)
    setPwdError('')
    try {
      await apiClient.put('/auth/password', {
        old_password: oldPwd,
        new_password: newPwd,
      })
      addToast('success', '密码修改成功')
      setShowPwdModal(false)
      setOldPwd('')
      setNewPwd('')
      setConfirmPwd('')
    } catch (err) {
      const message = err instanceof Error ? err.message : '修改失败'
      setPwdError(message)
    } finally {
      setPwdLoading(false)
    }
  }

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
        <div className="flex flex-col items-center text-center md:flex-row md:text-left md:items-center gap-4 md:gap-5">
          <div
            className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-white text-2xl md:text-3xl font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          >
            {nickname.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <h1 className="text-[var(--text-xl)] md:text-[var(--text-2xl)] font-bold text-[var(--text)] truncate">{nickname}</h1>
              <span className="text-[var(--text-xs)] px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] font-semibold shrink-0">
                {user?.role === 'admin' ? '管理员' : user?.role === 'teacher' ? '教师' : '学生'}
              </span>
            </div>
            <p className="text-[var(--text-sm)] text-[var(--text-muted)] mt-0.5">@{username}</p>
            <div className="flex items-center justify-center md:justify-start gap-4 mt-2">
              <StreakBadge days={data.streak} />
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button variant="secondary" size="sm" className="flex-1 md:flex-none" onClick={() => {
              setShowPwdModal(true)
              setOldPwd('')
              setNewPwd('')
              setConfirmPwd('')
              setPwdError('')
            }}>
              修改密码
            </Button>
            <Button variant="secondary" size="sm" className="flex-1 md:flex-none" onClick={() => navigate('/settings')}>
              编辑资料
            </Button>
          </div>
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

      {/* ── Referral Invite Card ── */}
      <ReferralCard />

      {/* ── Honor Records Link ── */}
      <button
        onClick={() => navigate('/honor')}
        className="w-full bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 text-left transition-all hover:shadow-md"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{'\uD83C\uDFC6'}</span>
            <div>
              <h3 className="font-semibold text-[var(--text)]">我的荣誉</h3>
              <p className="text-xs text-[var(--text-muted)]">赛事荣誉与成长里程碑</p>
            </div>
          </div>
          <span className="text-[var(--text-muted)]">{'\u203A'}</span>
        </div>
      </button>

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

      {/* Teacher: Student Management + Invite Code */}
      {user?.role === 'teacher' && (
        <Card padding="lg" hoverable={false}>
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => navigate('/teacher')}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{'\uD83D\uDCCA'}</span>
              <div>
                <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">学生管理</h3>
                <p className="text-[var(--text-xs)] text-[var(--text-muted)]">查看学生学习进度、对弈数据、谜题统计</p>
              </div>
            </div>
            <span className="text-[var(--text-muted)] text-lg">&#8250;</span>
          </div>
        </Card>
      )}
      {user?.role === 'teacher' && <TeacherInviteSection />}

      {/* Student: Join Teacher Section */}
      {user?.role === 'student' && <StudentJoinSection />}

      {/* Admin: User Management */}
      {user?.role === 'admin' && (
        <Card padding="lg" hoverable={false}>
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => navigate('/admin/users-list')}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{'\uD83D\uDC65'}</span>
              <div>
                <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">用户管理</h3>
                <p className="text-[var(--text-xs)] text-[var(--text-muted)]">查看所有用户信息、登录数据、学习进度</p>
              </div>
            </div>
            <span className="text-[var(--text-muted)] text-lg">&#8250;</span>
          </div>
        </Card>
      )}

      {/* ── Credits Section ── */}
      <Card padding="lg" hoverable={false}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">{'\uD83D\uDCB0'}</span>
          <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">我的积分</h3>
        </div>

        {/* Balance + Stats */}
        <div className="flex items-center gap-6 mb-5">
          <div className="text-center">
            <p className="text-3xl font-bold text-[var(--accent)] tabular-nums">{creditBalance}</p>
            <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">积分</p>
          </div>
          <div className="h-10 w-px bg-[var(--border)]" />
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-[var(--text-sm)] font-semibold text-[var(--success)] tabular-nums">{creditTotalEarned}</p>
              <p className="text-[var(--text-xs)] text-[var(--text-muted)]">累计获得</p>
            </div>
            <div className="text-center">
              <p className="text-[var(--text-sm)] font-semibold text-[var(--danger)] tabular-nums">{creditTotalSpent}</p>
              <p className="text-[var(--text-xs)] text-[var(--text-muted)]">累计消耗</p>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        {creditTransactions.length > 0 ? (
          <div>
            <h4 className="text-[var(--text-xs)] text-[var(--text-muted)] font-medium mb-2">最近流水</h4>
            <div className="space-y-1.5">
              {creditTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg)]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--text-sm)] text-[var(--text)] truncate">{tx.description}</p>
                    <p className="text-[var(--text-xs)] text-[var(--text-muted)]">
                      {new Date(tx.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span
                    className="text-[var(--text-sm)] font-semibold tabular-nums shrink-0 ml-3"
                    style={{ color: tx.amount > 0 ? 'var(--success)' : 'var(--danger)' }}
                  >
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[var(--text-sm)] text-[var(--text-muted)] text-center py-3">
            暂无积分流水
          </p>
        )}
      </Card>

      {/* Password Change Modal */}
      <Modal open={showPwdModal} onClose={() => setShowPwdModal(false)} title="修改密码">
        <div className="space-y-4">
          <div>
            <label className="block text-[var(--text-xs)] text-[var(--text-sub)] font-medium mb-1.5">当前密码</label>
            <input
              type="password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              placeholder="请输入当前密码"
              className="w-full px-4 py-2.5 rounded-[var(--radius-sm)] text-[var(--text-sm)] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--text-xs)] text-[var(--text-sub)] font-medium mb-1.5">新密码</label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="请输入新密码（至少6位）"
              className="w-full px-4 py-2.5 rounded-[var(--radius-sm)] text-[var(--text-sm)] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] outline-none"
            />
          </div>
          <div>
            <label className="block text-[var(--text-xs)] text-[var(--text-sub)] font-medium mb-1.5">确认新密码</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              placeholder="请再次输入新密码"
              className="w-full px-4 py-2.5 rounded-[var(--radius-sm)] text-[var(--text-sm)] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] outline-none"
            />
          </div>
          {pwdError && (
            <p className="text-[var(--text-xs)] text-[var(--danger)] text-center">{pwdError}</p>
          )}
          <Button variant="primary" className="w-full" onClick={handleChangePassword} loading={pwdLoading}>
            确认修改
          </Button>
        </div>
      </Modal>

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

// ---------------------------------------------------------------------------
// Teacher: Generate & manage invite codes
// ---------------------------------------------------------------------------

const TeacherInviteSection: React.FC = () => {
  const addToast = useUIStore((s) => s.addToast)
  const [codes, setCodes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const loadCodes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await teacherApi.getInviteCodes()
      const data = (res.data as any)?.data ?? res.data
      setCodes(Array.isArray(data) ? data : [])
    } catch { setCodes([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadCodes() }, [loadCodes])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await teacherApi.createInviteCode()
      addToast('success', '邀请码已生成')
      loadCodes()
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : '生成失败')
    } finally { setGenerating(false) }
  }

  const handleCopy = async (code: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code)
      } else {
        const ta = document.createElement('textarea')
        ta.value = code
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopiedCode(code)
      addToast('success', '已复制到剪贴板')
      setTimeout(() => setCopiedCode(null), 2000)
    } catch { addToast('error', '复制失败') }
  }

  const activeCodes = codes.filter((c) => c.status === 'active' && new Date(c.expires_at) > new Date())

  return (
    <Card padding="lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{'\uD83D\uDCE8'}</span>
          <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">邀请学生</h3>
        </div>
        <Button variant="primary" size="sm" onClick={handleGenerate} loading={generating}>
          生成邀请码
        </Button>
      </div>

      {loading ? (
        <p className="text-[var(--text-xs)] text-[var(--text-muted)] text-center py-2">加载中...</p>
      ) : activeCodes.length === 0 ? (
        <p className="text-[var(--text-sm)] text-[var(--text-muted)] text-center py-4">
          点击"生成邀请码"，把码分享给学生即可绑定
        </p>
      ) : (
        <div className="space-y-3">
          {activeCodes.map((c) => (
            <div key={c.id || c.code} className="flex items-center justify-between px-4 py-3 rounded-[var(--radius-sm)] bg-[var(--bg)]">
              <div>
                <span className="font-mono text-2xl font-bold tracking-[0.15em] text-[var(--text)] select-all">
                  {c.code}
                </span>
                <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">
                  {new Date(c.expires_at).toLocaleDateString('zh-CN')} 过期 · 已使用 {c.used_count}/{c.max_uses}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => handleCopy(c.code)}>
                {copiedCode === c.code ? '已复制' : '复制'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Student: Join teacher with invite code
// ---------------------------------------------------------------------------

const StudentJoinSection: React.FC = () => {
  const addToast = useUIStore((s) => s.addToast)
  const [teachers, setTeachers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  const loadTeachers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await studentApi.getMyTeachers()
      const data = (res.data as any)?.data ?? res.data
      setTeachers(Array.isArray(data) ? data : [])
    } catch { setTeachers([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadTeachers() }, [loadTeachers])

  const handleJoin = async () => {
    const code = inviteCode.trim().toUpperCase()
    if (code.length !== 6) {
      setJoinError('请输入6位邀请码')
      return
    }
    setJoining(true)
    setJoinError('')
    try {
      const res = await studentApi.joinTeacher({ invite_code: code })
      const data = (res.data as any)?.data ?? res.data
      addToast('success', `已加入 ${data?.teacher_nickname ?? '老师'}`)
      setShowModal(false)
      setInviteCode('')
      loadTeachers()
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : '加入失败')
    } finally { setJoining(false) }
  }

  return (
    <Card padding="lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{'\uD83D\uDC68\u200D\uD83C\uDFEB'}</span>
          <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">我的老师</h3>
        </div>
        <Button variant="primary" size="sm" onClick={() => { setShowModal(true); setInviteCode(''); setJoinError('') }}>
          加入老师
        </Button>
      </div>

      {loading ? (
        <p className="text-[var(--text-xs)] text-[var(--text-muted)] text-center py-2">加载中...</p>
      ) : teachers.length === 0 ? (
        <p className="text-[var(--text-sm)] text-[var(--text-muted)] text-center py-4">
          还没有加入老师，向老师要一个邀请码吧
        </p>
      ) : (
        <div className="space-y-2">
          {teachers.map((t) => (
            <div key={t.teacher_id} className="flex items-center justify-between px-4 py-3 rounded-[var(--radius-sm)] bg-[var(--bg)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-lg">
                  {'\uD83D\uDC68\u200D\uD83C\uDFEB'}
                </div>
                <div>
                  <p className="text-[var(--text-sm)] font-semibold text-[var(--text)]">{t.teacher_nickname || '老师'}</p>
                  <p className="text-[var(--text-xs)] text-[var(--text-muted)]">加入于 {t.bindtime ? new Date(t.bindtime).toLocaleDateString('zh-CN') : '未知'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Join modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="加入老师">
        <div className="space-y-4">
          <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
            输入老师给你的6位邀请码
          </p>
          <input
            type="text"
            maxLength={6}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="例如 A3K9X2"
            className="w-full px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.2em] rounded-[var(--radius-sm)] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] outline-none"
          />
          {joinError && (
            <p className="text-[var(--text-xs)] text-[var(--danger)] text-center">{joinError}</p>
          )}
          <Button variant="primary" className="w-full" onClick={handleJoin} loading={joining}>
            确认加入
          </Button>
        </div>
      </Modal>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Referral: Invite friends card
// ---------------------------------------------------------------------------

const ReferralCard: React.FC = () => {
  const addToast = useUIStore((s) => s.addToast)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [invitedCount, setInvitedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    userApi.getReferralInfo()
      .then((res) => {
        const d: any = (res.data as any)?.data ?? res.data
        setReferralCode(d.code ?? null)
        setInvitedCount(d.invited_count ?? 0)
      })
      .catch(() => {
        // API not available yet, hide the card gracefully
        setReferralCode(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleCopyLink = async () => {
    if (!referralCode) return
    const link = `https://chess.ccwu.cc/register?ref=${referralCode}`
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link)
      } else {
        const ta = document.createElement('textarea')
        ta.value = link
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      addToast('success', '邀请链接已复制')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      addToast('error', '复制失败，请手动复制')
    }
  }

  // Don't render if loading or API failed
  if (loading || referralCode === null) return null

  return (
    <div
      className="rounded-[var(--radius-xl)] p-5 md:p-6"
      style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.12) 50%, rgba(236,72,153,0.08) 100%)',
        border: '1px solid rgba(139,92,246,0.2)',
      }}
    >
      {/* Title row */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{'\uD83C\uDF81'}</span>
        <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">邀请好友</h3>
      </div>
      <p className="text-[var(--text-xs)] text-[var(--text-muted)] mb-4">
        邀请好友注册，双方各得100积分
      </p>

      {/* Referral code display */}
      <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
        <div
          className="flex-1 w-full sm:w-auto text-center px-5 py-3 rounded-[var(--radius-sm)]"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px dashed rgba(139,92,246,0.4)',
          }}
        >
          <p className="text-[var(--text-xs)] text-[var(--text-muted)] mb-1">我的邀请码</p>
          <span className="font-mono text-2xl md:text-3xl font-bold tracking-[0.15em] text-purple-300 select-all">
            {referralCode}
          </span>
        </div>
      </div>

      {/* Copy button + invited count */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="primary" size="sm" onClick={handleCopyLink} className="flex-shrink-0">
          {copied ? '\u2713 已复制' : '复制邀请链接'}
        </Button>
        <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
          已邀请 <span className="font-semibold text-[var(--accent)] tabular-nums">{invitedCount}</span> 人
        </span>
      </div>
    </div>
  )
}

export default ProfilePage
