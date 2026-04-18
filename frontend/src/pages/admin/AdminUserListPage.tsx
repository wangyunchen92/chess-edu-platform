import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '@/components/common/Card'
import Badge from '@/components/common/Badge'
import Loading from '@/components/common/Loading'
import { getUsers, type UserListItem, type UserListParams } from '@/api/admin'
import { useRemarks } from '@/hooks/useRemarks'
import RemarkEditButton from '@/components/common/RemarkEditButton'

const ROLE_LABEL: Record<string, string> = { student: '学生', teacher: '教师', admin: '管理员' }
const ROLE_COLOR: Record<string, 'primary' | 'success' | 'danger'> = { student: 'primary', teacher: 'success', admin: 'danger' }

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '从未登录'
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return date.toLocaleDateString('zh-CN')
}

const AdminUserListPage: React.FC = () => {
  const navigate = useNavigate()
  const { remarkMap, promptRemark } = useRemarks()
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const loadUsers = useCallback(() => {
    setLoading(true)
    setError(null)
    const params: UserListParams = { page: 1, page_size: 100 }
    if (debouncedSearch) params.search = debouncedSearch
    if (filterRole) params.role = filterRole
    getUsers(params)
      .then((res) => {
        const payload = (res.data as any)?.data ?? res.data
        setUsers(payload?.items ?? [])
        setTotal(payload?.total ?? 0)
      })
      .catch((err) => {
        console.error('[AdminUserList] Failed:', err)
        setError('加载用户列表失败')
        setUsers([])
      })
      .finally(() => setLoading(false))
  }, [debouncedSearch, filterRole])

  useEffect(() => { loadUsers() }, [loadUsers])

  if (loading && users.length === 0) return <Loading size="lg" text="加载中..." />

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/profile')}
          className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border)] transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">用户管理</h1>
          <p className="text-[var(--text-sm)] text-[var(--text-muted)]">共 {total} 个用户</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索用户名或昵称..."
          className="flex-1 min-w-[200px] px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-[var(--text-sm)] outline-none focus:border-[var(--accent)]"
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-[var(--text-sm)] outline-none focus:border-[var(--accent)]"
        >
          <option value="">全部角色</option>
          <option value="student">学生</option>
          <option value="teacher">教师</option>
          <option value="admin">管理员</option>
        </select>
      </div>
      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-[var(--radius-sm)] bg-[rgba(239,68,68,0.1)] text-[var(--danger)] text-[var(--text-sm)]">
          {error}
        </div>
      )}

      {/* User cards */}
      <div className="grid gap-3">
        {users.map((u) => (
          <Card
            key={u.id}
            padding="md"
            hoverable
            onClick={() => navigate(`/admin/user/${u.id}`)}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ background: u.role === 'admin' ? 'var(--danger)' : u.role === 'teacher' ? 'var(--success)' : 'var(--accent)' }}
              >
                {(remarkMap.get(u.id) || u.nickname || u.username || '?').charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[var(--text-md)] font-semibold text-[var(--text)] truncate">
                    {remarkMap.get(u.id) || u.nickname}
                  </span>
                  <RemarkEditButton onClick={() => promptRemark(u.id, remarkMap.get(u.id))} />
                  <Badge color={ROLE_COLOR[u.role] ?? 'primary'}>{ROLE_LABEL[u.role] ?? u.role}</Badge>
                  {u.status === 'disabled' && <Badge color="neutral">已禁用</Badge>}
                </div>
                <p className="text-[var(--text-xs)] text-[var(--text-muted)]">
                  @{u.username}{remarkMap.get(u.id) && u.nickname ? ` ${u.nickname}` : ''}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[var(--text-xs)] text-[var(--text-sub)]">
                  <span>登录 <strong className="text-[var(--text)]">{u.login_count}</strong> 次</span>
                  <span>最近: <strong className="text-[var(--text)]">{formatRelativeTime(u.last_login_at)}</strong></span>
                  <span>注册: {u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN') : '--'}</span>
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[var(--text-muted)] shrink-0">
                <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </Card>
        ))}
      </div>

      {users.length === 0 && !loading && !error && (
        <p className="text-center text-[var(--text-muted)] text-[var(--text-sm)] py-8">没有找到匹配的用户</p>
      )}
    </div>
  )
}

export default AdminUserListPage
