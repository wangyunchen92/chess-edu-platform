import React, { useState, useEffect } from 'react'
import Card from '@/components/common/Card'
import Badge from '@/components/common/Badge'
import { getAdminStats, type AdminStats } from '@/api/admin'

const ROLE_LABEL: Record<string, string> = { student: '学生', teacher: '教师', admin: '管理员' }
const MEMBERSHIP_LABEL: Record<string, string> = { free: '免费', basic: '基础版', premium: '高级版' }
const MEMBERSHIP_COLOR: Record<string, string> = { free: '#94a3b8', basic: '#3b82f6', premium: '#f59e0b' }

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getAdminStats()
      .then((res) => {
        const data = res.data?.data ?? res.data
        setStats(data as AdminStats)
      })
      .catch((err) => {
        console.error('[AdminDashboard] Failed to load stats:', err)
        setError('加载统计数据失败')
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <div className="animate-pulse">
                <div className="h-3 bg-[var(--border)] rounded w-16 mb-3" />
                <div className="h-8 bg-[var(--border)] rounded w-20" />
              </div>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <div className="animate-pulse">
                <div className="h-4 bg-[var(--border)] rounded w-24 mb-4" />
                <div className="space-y-2">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-6 bg-[var(--border)] rounded" />
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-3 rounded-[var(--radius-sm)] bg-[rgba(239,68,68,0.1)] text-[var(--danger)] text-[var(--text-sm)]">
        {error}
      </div>
    )
  }

  if (!stats) return null

  const summaryCards = [
    { label: '总用户数', value: stats.total_users, color: 'var(--accent)' },
    { label: '今日活跃', value: stats.today_active, color: 'var(--success)' },
    { label: '付费会员', value: (stats.membership_distribution?.basic ?? 0) + (stats.membership_distribution?.premium ?? 0), color: 'var(--warning)' },
    { label: '今日新增', value: stats.today_registered, color: 'var(--info)' },
  ]

  // Membership distribution for bar chart
  const membershipEntries = Object.entries(stats.membership_distribution || {})
  const membershipTotal = membershipEntries.reduce((sum, [, v]) => sum + v, 0)

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <p className="text-[var(--text-xs)] text-[var(--text-muted)] mb-1">{card.label}</p>
            <p className="text-[var(--text-2xl)] font-bold" style={{ color: card.color }}>
              {card.value}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Membership Distribution */}
        <Card>
          <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-4">会员分布</h3>
          <div className="space-y-3">
            {membershipEntries.map(([tier, count]) => {
              const pct = membershipTotal > 0 ? (count / membershipTotal) * 100 : 0
              return (
                <div key={tier}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[var(--text-sm)] text-[var(--text-sub)]">
                      {MEMBERSHIP_LABEL[tier] ?? tier}
                    </span>
                    <span className="text-[var(--text-sm)] font-medium text-[var(--text)]">
                      {count} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2.5 bg-[var(--bg)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: MEMBERSHIP_COLOR[tier] ?? 'var(--accent)',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Role Distribution */}
        <Card>
          <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-4">角色分布</h3>
          <div className="space-y-3">
            {Object.entries(stats.role_distribution || {}).map(([role, count]) => {
              const total = Object.values(stats.role_distribution || {}).reduce((s, v) => s + v, 0)
              const pct = total > 0 ? (count / total) * 100 : 0
              return (
                <div key={role}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[var(--text-sm)] text-[var(--text-sub)]">
                      {ROLE_LABEL[role] ?? role}
                    </span>
                    <span className="text-[var(--text-sm)] font-medium text-[var(--text)]">
                      {count} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2.5 bg-[var(--bg)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: role === 'admin' ? 'var(--danger)' : role === 'teacher' ? 'var(--success)' : 'var(--accent)',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Recent Users */}
      <Card padding="none" hoverable={false}>
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">最近注册用户</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['用户名', '昵称', '角色', '注册时间'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-[var(--text-xs)] font-semibold text-[var(--text-muted)] uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(stats.recent_users ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-[var(--text-sm)] text-[var(--text-muted)]">
                    暂无用户
                  </td>
                </tr>
              ) : (
                (stats.recent_users ?? []).map((u) => (
                  <tr key={u.id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg)] transition-colors">
                    <td className="px-5 py-3 text-[var(--text-sm)] text-[var(--text)] font-medium">{u.username}</td>
                    <td className="px-5 py-3 text-[var(--text-sm)] text-[var(--text)]">{u.nickname}</td>
                    <td className="px-5 py-3">
                      <Badge color={u.role === 'admin' ? 'danger' : u.role === 'teacher' ? 'success' : 'primary'}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-[var(--text-xs)] text-[var(--text-muted)] tabular-nums">
                      {u.created_at ? new Date(u.created_at).toLocaleString('zh-CN') : '--'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export default AdminDashboard
