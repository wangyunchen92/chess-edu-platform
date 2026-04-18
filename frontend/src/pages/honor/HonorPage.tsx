import React, { useState, useEffect, useCallback } from 'react'
import { honorApi } from '@/api/honor'
import type { HonorWallItem, CompetitionHonorItem, MilestoneItem } from '@/types/api'

// ── Category metadata for milestones ──
const MILESTONE_CATEGORIES: Record<string, { emoji: string; label: string; color: string }> = {
  game_rating: { emoji: '\u265F', label: '对弈评分', color: 'blue' },
  puzzle_rating: { emoji: '\uD83E\uDDE9', label: '谜题评分', color: 'purple' },
  games: { emoji: '\u2694\uFE0F', label: '对局数', color: 'green' },
  puzzles: { emoji: '\u2728', label: '解题数', color: 'indigo' },
  win_streak: { emoji: '\uD83D\uDD25', label: '连胜', color: 'red' },
  train_streak: { emoji: '\uD83D\uDCC5', label: '连续训练', color: 'orange' },
}

const COLOR_MAP: Record<string, { bg: string; text: string; bar: string }> = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', bar: 'bg-blue-500' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-700 dark:text-purple-300', bar: 'bg-purple-500' },
  green: { bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-300', bar: 'bg-green-500' },
  indigo: { bg: 'bg-indigo-50 dark:bg-indigo-950/30', text: 'text-indigo-700 dark:text-indigo-300', bar: 'bg-indigo-500' },
  red: { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-300', bar: 'bg-red-500' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-300', bar: 'bg-orange-500' },
}

// ── Rank badge colors ──
function rankColor(rank: string | null): string {
  if (!rank) return 'bg-gray-100 text-gray-600'
  const r = rank.toLowerCase()
  if (r.includes('gold') || r === '1' || r === 'first' || r.includes('\u91D1') || r.includes('\u51A0\u519B'))
    return 'bg-yellow-100 text-yellow-800 border-yellow-300'
  if (r.includes('silver') || r === '2' || r === 'second' || r.includes('\u94F6') || r.includes('\u4E9A\u519B'))
    return 'bg-gray-100 text-gray-700 border-gray-300'
  if (r.includes('bronze') || r === '3' || r === 'third' || r.includes('\u94DC') || r.includes('\u5B63\u519B'))
    return 'bg-orange-100 text-orange-800 border-orange-300'
  return 'bg-blue-50 text-blue-700 border-blue-200'
}

// ── Wall Tab ──
const WallTab: React.FC = () => {
  const [items, setItems] = useState<HonorWallItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [competitions, setCompetitions] = useState<string[]>([])
  const [filterComp, setFilterComp] = useState('')

  const fetchCompetitions = useCallback(async () => {
    try {
      const res = await honorApi.getCompetitionNames()
      const raw = res?.data as any
      const data = raw?.data ?? raw
      setCompetitions(data ?? [])
    } catch {
      // ignore
    }
  }, [])

  const fetchWall = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page, page_size: 12 }
      if (filterComp) params.competition_name = filterComp
      const res = await honorApi.getWall(params)
      const raw = res?.data as any
      const data = raw?.data ?? raw
      setItems(data?.items ?? [])
      setTotalPages(data?.total_pages ?? 1)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [page, filterComp])

  useEffect(() => {
    fetchCompetitions()
  }, [fetchCompetitions])

  useEffect(() => {
    fetchWall()
  }, [fetchWall])

  const handleFilterChange = (val: string) => {
    setFilterComp(val)
    setPage(1)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text)]">{'\uD83C\uDFC6'} 光荣榜</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">每一次努力都被看见</p>
      </div>

      {/* Filter */}
      {competitions.length > 0 && (
        <div className="mb-4">
          <select
            value={filterComp}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-sm"
          >
            <option value="">全部赛事</option>
            {competitions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      )}

      {/* Cards */}
      {loading ? (
        <div className="text-center py-12 text-[var(--text-muted)]">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">{'\uD83C\uDFC6'}</div>
          <p className="text-[var(--text-muted)]">暂无荣誉记录，期待大家的精彩表现</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4"
            >
              <div className="flex items-start gap-3">
                {/* Avatar circle */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {(item.user_nickname || '?')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[var(--text)] text-sm truncate">{item.user_nickname}</span>
                    {item.rank && (
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${rankColor(item.rank)}`}>
                        {item.rank}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[var(--text)] mt-1">{item.title}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-[var(--text-muted)]">
                    <span>{item.competition_name}</span>
                    <span>{'·'}</span>
                    <span>{item.competition_date}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text)] disabled:opacity-40 hover:bg-[var(--bg-hover)]"
          >
            上一页
          </button>
          <span className="text-sm text-[var(--text-muted)]">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text)] disabled:opacity-40 hover:bg-[var(--bg-hover)]"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}

// ── Mine Tab ──
const MineTab: React.FC = () => {
  const [competitions, setCompetitions] = useState<CompetitionHonorItem[]>([])
  const [milestones, setMilestones] = useState<MilestoneItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMine = async () => {
      setLoading(true)
      try {
        const res = await honorApi.getMine()
        const raw = res?.data as any
        const data = raw?.data ?? raw
        setCompetitions(data?.competitions ?? [])
        setMilestones(data?.milestones ?? [])
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchMine()
  }, [])

  // Group milestones by category
  const grouped = milestones.reduce<Record<string, MilestoneItem[]>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = []
    acc[m.category].push(m)
    return acc
  }, {})

  if (loading) {
    return <div className="text-center py-12 text-[var(--text-muted)]">加载中...</div>
  }

  return (
    <div className="space-y-8">
      {/* Competition honors */}
      <div>
        <h3 className="text-lg font-bold text-[var(--text)] mb-4">{'\uD83C\uDFC5'} 赛事荣誉</h3>
        {competitions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">{'\uD83C\uDFC5'}</div>
            <p className="text-sm text-[var(--text-muted)]">暂无赛事荣誉，继续加油</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {competitions.map((c) => (
              <div
                key={c.id}
                className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[var(--text)] text-sm">{c.title}</span>
                  {c.rank && (
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${rankColor(c.rank)}`}>
                      {c.rank}
                    </span>
                  )}
                </div>
                {c.description && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">{c.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2 text-xs text-[var(--text-muted)]">
                  <span>{c.competition_name}</span>
                  <span>{'·'}</span>
                  <span>{c.competition_date}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--border)]" />

      {/* Milestones */}
      <div>
        <h3 className="text-lg font-bold text-[var(--text)] mb-4">{'\uD83D\uDCCA'} 成长里程碑</h3>
        {milestones.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">{'\uD83D\uDCCA'}</div>
            <p className="text-sm text-[var(--text-muted)]">暂无里程碑数据</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, items]) => {
              const meta = MILESTONE_CATEGORIES[cat] || { emoji: '\uD83C\uDFAF', label: cat, color: 'blue' }
              const colors = COLOR_MAP[meta.color] || COLOR_MAP.blue
              return (
                <div key={cat}>
                  <h4 className={`text-sm font-semibold mb-3 ${colors.text}`}>
                    {meta.emoji} {meta.label}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {items.map((m) => (
                      <div
                        key={m.milestone_key}
                        className={`rounded-lg p-3 border ${
                          m.achieved
                            ? `${colors.bg} border-current/10`
                            : 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {m.achieved ? (
                            <span className={`text-sm ${colors.text}`}>{'\u2705'}</span>
                          ) : (
                            <span className="text-sm text-gray-400">{'\u25CB'}</span>
                          )}
                          <span className={`text-xs font-medium ${m.achieved ? colors.text : 'text-gray-500 dark:text-gray-400'}`}>
                            {m.title}
                          </span>
                        </div>
                        {m.achieved ? (
                          <p className="text-xs text-[var(--text-muted)] ml-6">
                            {m.achieved_at ? new Date(m.achieved_at).toLocaleDateString('zh-CN') : '已达成'}
                          </p>
                        ) : (
                          <div className="ml-6">
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                              <span>{m.current_value} / {m.target_value}</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${colors.bar}`}
                                style={{ width: `${Math.min(100, (m.current_value / m.target_value) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main HonorPage ──
const HonorPage: React.FC = () => {
  const [tab, setTab] = useState<'wall' | 'mine'>('wall')

  return (
    <div className="max-w-5xl mx-auto">
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-[var(--bg-card)] rounded-lg p-1 border border-[var(--border)] w-fit">
        <button
          onClick={() => setTab('wall')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'wall'
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          光荣榜
        </button>
        <button
          onClick={() => setTab('mine')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'mine'
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          我的荣誉
        </button>
      </div>

      {/* Tab content */}
      {tab === 'wall' ? <WallTab /> : <MineTab />}
    </div>
  )
}

export default HonorPage
