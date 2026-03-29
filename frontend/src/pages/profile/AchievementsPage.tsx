import React, { useState, useEffect } from 'react'
import { gamificationApi } from '@/api/gamification'
import Card from '@/components/common/Card'
import Loading from '@/components/common/Loading'

interface Achievement {
  id: string
  slug: string
  name: string
  description: string
  category: string
  emoji: string
  unlocked: boolean
  unlockedAt?: string
  xpReward: number
  coinReward: number
  rarity: string
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

const MOCK_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_game', slug: 'first_game', name: '初出茅庐', description: '完成第一盘对局', category: 'game', emoji: '\u2694\uFE0F', unlocked: true, unlockedAt: '2026-03-15', xpReward: 50, coinReward: 10, rarity: 'common' },
  { id: 'first_win', slug: 'first_win', name: '初次胜利', description: '赢得第一盘对局', category: 'game', emoji: '\uD83C\uDFC6', unlocked: true, unlockedAt: '2026-03-16', xpReward: 100, coinReward: 20, rarity: 'common' },
  { id: 'ten_wins', slug: 'ten_wins', name: '十胜将军', description: '累计赢得10盘对局', category: 'game', emoji: '\uD83C\uDF1F', unlocked: true, unlockedAt: '2026-03-22', xpReward: 200, coinReward: 50, rarity: 'uncommon' },
  { id: 'speed_master', slug: 'speed_master', name: '闪电战术', description: '在30秒内完成一道谜题', category: 'puzzle', emoji: '\u26A1', unlocked: false, xpReward: 150, coinReward: 30, rarity: 'uncommon' },
  { id: 'comeback', slug: 'comeback', name: '绝地反击', description: '在劣势局面下逆转获胜', category: 'game', emoji: '\uD83D\uDD04', unlocked: false, xpReward: 300, coinReward: 80, rarity: 'rare' },
  { id: 'studious', slug: 'studious', name: '好学不倦', description: '完成5节课程学习', category: 'learn', emoji: '\uD83D\uDCDA', unlocked: true, unlockedAt: '2026-03-24', xpReward: 200, coinReward: 50, rarity: 'uncommon' },
  { id: 'puzzle_eye', slug: 'puzzle_eye', name: '火眼金睛', description: '谜题正确率达到80%以上', category: 'puzzle', emoji: '\uD83D\uDC41\uFE0F', unlocked: false, xpReward: 250, coinReward: 60, rarity: 'rare' },
  { id: 'perfect_streak', slug: 'perfect_streak', name: '完美连胜', description: '连续赢得5盘对局', category: 'game', emoji: '\uD83D\uDC8E', unlocked: false, xpReward: 350, coinReward: 100, rarity: 'epic' },
  { id: 'persistent', slug: 'persistent', name: '坚持不懈', description: '连续7天完成每日训练', category: 'train', emoji: '\uD83D\uDD25', unlocked: true, unlockedAt: '2026-03-27', xpReward: 300, coinReward: 80, rarity: 'rare' },
  { id: 'all_rounder', slug: 'all_rounder', name: '全能选手', description: '在对弈、谜题、学习中均达到一定水平', category: 'general', emoji: '\uD83C\uDFAF', unlocked: false, xpReward: 500, coinReward: 150, rarity: 'legendary' },
]

const AchievementsPage: React.FC = () => {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [unlockedCount, setUnlockedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    gamificationApi.getAchievements()
      .then((res) => {
        const payload: any = (res.data as any)?.data ?? res.data
        if (payload && Array.isArray(payload.achievements)) {
          // Use backend data as primary source
          const mapped: Achievement[] = payload.achievements.map((a: any) => ({
            id: a.id ?? '',
            slug: a.slug ?? '',
            name: a.name ?? '',
            description: a.description ?? '',
            category: a.category ?? '',
            emoji: ACHIEVEMENT_EMOJI[a.slug] ?? a.icon_key ?? '\uD83C\uDFC5',
            unlocked: a.achieved === true,
            unlockedAt: a.achieved_at ?? undefined,
            xpReward: a.xp_reward ?? 0,
            coinReward: a.coin_reward ?? 0,
            rarity: a.rarity ?? 'common',
          }))
          setAchievements(mapped)
          setUnlockedCount(payload.unlocked_count ?? mapped.filter((a) => a.unlocked).length)
          setTotalCount(payload.total_count ?? mapped.length)
        } else {
          // Unexpected format, fall back to mock
          console.error('[AchievementsPage] Unexpected response format:', payload)
          setAchievements(MOCK_ACHIEVEMENTS)
          setUnlockedCount(MOCK_ACHIEVEMENTS.filter((a) => a.unlocked).length)
          setTotalCount(MOCK_ACHIEVEMENTS.length)
          setError('数据格式异常，显示缓存数据')
        }
      })
      .catch((err) => {
        console.error('[AchievementsPage] Failed to load achievements:', err)
        setAchievements(MOCK_ACHIEVEMENTS)
        setUnlockedCount(MOCK_ACHIEVEMENTS.filter((a) => a.unlocked).length)
        setTotalCount(MOCK_ACHIEVEMENTS.length)
        setError('加载成就失败，显示缓存数据')
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <Loading size="lg" text="加载成就..." />
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
          {'\uD83C\uDFC5'} 我的成就
        </h1>
        <p className="text-[var(--text-sm)] text-[var(--text-sub)] mt-1">
          已解锁 <span className="font-bold text-[var(--accent)]">{unlockedCount}</span> / {totalCount} 个成就
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 rounded-[var(--radius-sm)] bg-[rgba(245,158,11,0.1)] text-[var(--warning)] text-[var(--text-sm)]">
          {error}
        </div>
      )}

      {/* ── Progress Bar ── */}
      <Card padding="md" hoverable={false}>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div
              className="w-full overflow-hidden"
              style={{ height: 10, borderRadius: 5, background: 'var(--border)' }}
            >
              <div
                className="h-full transition-[width] duration-500"
                style={{
                  width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%`,
                  borderRadius: 5,
                  background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
                }}
              />
            </div>
          </div>
          <span className="text-[var(--text-sm)] font-bold text-[var(--accent)] tabular-nums shrink-0">
            {totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0}%
          </span>
        </div>
      </Card>

      {/* ── Achievement Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {achievements.map((ach) => (
          <Card
            key={ach.id}
            padding="md"
            hoverable={ach.unlocked}
            className={ach.unlocked ? '' : 'opacity-55'}
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0"
                style={{
                  background: ach.unlocked
                    ? 'linear-gradient(135deg, var(--accent-light), rgba(139,92,246,0.12))'
                    : 'var(--border)',
                  filter: ach.unlocked ? 'none' : 'grayscale(1)',
                }}
              >
                {ach.unlocked ? ach.emoji : '\uD83D\uDD12'}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3
                  className="text-[var(--text-sm)] font-semibold truncate"
                  style={{ color: ach.unlocked ? 'var(--text)' : 'var(--text-muted)' }}
                >
                  {ach.name}
                </h3>
                <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-0.5">
                  {ach.description}
                </p>
                {ach.unlocked && ach.unlockedAt && (
                  <p className="text-[var(--text-xs)] mt-1.5" style={{ color: 'var(--success)' }}>
                    {'\u2705'} {ach.unlockedAt} 解锁
                  </p>
                )}
                {!ach.unlocked && (
                  <p className="text-[var(--text-xs)] mt-1.5 text-[var(--text-muted)]">
                    奖励: {ach.xpReward} XP / {ach.coinReward} 金币
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default AchievementsPage
