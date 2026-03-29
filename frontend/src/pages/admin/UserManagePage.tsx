import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import apiClient from '@/api/client'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'

interface ManagedUser {
  id: string
  username: string
  nickname: string
  role: 'student' | 'teacher' | 'admin'
  membership_tier: 'free' | 'basic' | 'premium'
  status: 'active' | 'disabled'
  createdAt: string
}

const ROLE_LABEL: Record<string, string> = { student: '学生', teacher: '教师', admin: '管理员' }
const ROLE_COLOR: Record<string, string> = { student: 'var(--accent)', teacher: 'var(--success)', admin: 'var(--danger)' }
const MEMBERSHIP_LABEL: Record<string, string> = { free: '免费', basic: '基础版', premium: '高级版' }
const STATUS_LABEL: Record<string, string> = { active: '正常', disabled: '已禁用' }
const STATUS_COLOR: Record<string, string> = { active: 'var(--success)', disabled: 'var(--text-muted)' }

const UserManagePage: React.FC = () => {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showMemberModal, setShowMemberModal] = useState<ManagedUser | null>(null)
  const [memberExpiry, setMemberExpiry] = useState('')

  // Form state for new user
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newNickname, setNewNickname] = useState('')
  const [newRole, setNewRole] = useState<'student' | 'teacher'>('student')

  // Permission check: only admins can access
  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-5xl">{'\uD83D\uDEAB'}</div>
        <h2 className="text-[var(--text-xl)] font-bold text-[var(--text)]">无权访问</h2>
        <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
          只有管理员才能访问用户管理页面
        </p>
        <Button variant="primary" size="sm" onClick={() => navigate('/dashboard')}>
          返回首页
        </Button>
      </div>
    )
  }

  const fetchUsers = useCallback(() => {
    setLoading(true)
    setError(null)
    apiClient.get('/admin/users')
      .then((res) => {
        const payload = res.data?.data ?? res.data
        const rawList = payload?.items ?? payload?.users ?? (Array.isArray(payload) ? payload : null)
        if (Array.isArray(rawList) && rawList.length > 0) {
          const mapped: ManagedUser[] = rawList.map((u: any) => ({
            id: u.id ?? '',
            username: u.username ?? '',
            nickname: u.nickname ?? u.username ?? '',
            role: u.role ?? 'student',
            membership_tier: u.membership_tier ?? 'free',
            status: u.status ?? 'active',
            createdAt: u.created_at ?? u.createdAt ?? '',
          }))
          setUsers(mapped)
        } else {
          setUsers([])
        }
      })
      .catch((err) => {
        console.error('[UserManagePage] Failed to load users:', err)
        setError('加载用户列表失败，请检查网络连接或权限')
        setUsers([])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.nickname.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreateUser = async () => {
    if (!newUsername || !newPassword) return
    try {
      await apiClient.post('/admin/users', {
        username: newUsername,
        password: newPassword,
        nickname: newNickname || newUsername,
        role: newRole,
      })
      fetchUsers()
    } catch (err) {
      console.error('[UserManagePage] Failed to create user:', err)
    }
    setNewUsername('')
    setNewPassword('')
    setNewNickname('')
    setNewRole('student')
    setShowCreateModal(false)
  }

  const handleSetMembership = async (userId: string, membership_tier: 'free' | 'basic' | 'premium') => {
    try {
      await apiClient.put(`/admin/users/${userId}/membership`, {
        membership_tier,
        membership_expires_at: memberExpiry || null,
      })
      fetchUsers()
    } catch (err) {
      console.error('[UserManagePage] Failed to update membership:', err)
    }
    setShowMemberModal(null)
    setMemberExpiry('')
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
          {'\uD83D\uDC65'} 用户管理
        </h1>
        <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
          + 新增用户
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 rounded-[var(--radius-sm)] bg-[rgba(239,68,68,0.1)] text-[var(--danger)] text-[var(--text-sm)]">
          {error}
        </div>
      )}

      {/* ── Search ── */}
      <div className="flex gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={'\uD83D\uDD0D 搜索用户名或昵称...'}
          className="flex-1 px-4 py-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-[var(--text-sm)] outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>

      {/* ── User Table ── */}
      <Card padding="none" hoverable={false}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-4xl animate-bounce">{'\uD83D\uDC65'}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['用户名', '昵称', '角色', '会员', '状态', '创建时间', '操作'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-[var(--text-xs)] font-semibold text-[var(--text-muted)] uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-[var(--text-sm)] text-[var(--text-muted)]">
                      没有找到匹配的用户
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors">
                      <td className="px-4 py-3 text-[var(--text-sm)] text-[var(--text)] font-medium">{u.username}</td>
                      <td className="px-4 py-3 text-[var(--text-sm)] text-[var(--text)]">{u.nickname}</td>
                      <td className="px-4 py-3">
                        <span
                          className="text-[var(--text-xs)] font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: ROLE_COLOR[u.role], background: `${ROLE_COLOR[u.role]}15` }}
                        >
                          {ROLE_LABEL[u.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-xs)] text-[var(--text-sub)]">
                        {MEMBERSHIP_LABEL[u.membership_tier] ?? u.membership_tier}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-[var(--text-xs)] font-medium"
                          style={{ color: STATUS_COLOR[u.status] }}
                        >
                          {STATUS_LABEL[u.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-xs)] text-[var(--text-muted)] tabular-nums">{u.createdAt}</td>
                      <td className="px-4 py-3">
                        <Button variant="secondary" size="sm" onClick={() => { setShowMemberModal(u); setMemberExpiry(''); }}>
                          分配会员
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Create User Modal ── */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-[var(--bg-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-lg)] p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[var(--text-lg)] font-bold text-[var(--text)] mb-4">
              {'\u2795'} 新增用户
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-[var(--text-xs)] text-[var(--text-muted)] mb-1 block">用户名 *</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-[var(--text-sm)] outline-none focus:border-[var(--accent)]"
                  placeholder="输入用户名"
                />
              </div>
              <div>
                <label className="text-[var(--text-xs)] text-[var(--text-muted)] mb-1 block">密码 *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-[var(--text-sm)] outline-none focus:border-[var(--accent)]"
                  placeholder="输入密码"
                />
              </div>
              <div>
                <label className="text-[var(--text-xs)] text-[var(--text-muted)] mb-1 block">昵称</label>
                <input
                  type="text"
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-[var(--text-sm)] outline-none focus:border-[var(--accent)]"
                  placeholder="输入昵称（选填）"
                />
              </div>
              <div>
                <label className="text-[var(--text-xs)] text-[var(--text-muted)] mb-1 block">角色</label>
                <div className="flex gap-3">
                  {(['student', 'teacher'] as const).map((r) => (
                    <button
                      key={r}
                      className="flex-1 px-3 py-2 rounded-[var(--radius-sm)] text-[var(--text-sm)] font-medium transition-colors"
                      style={{
                        background: newRole === r ? 'var(--accent-light)' : 'var(--bg)',
                        color: newRole === r ? 'var(--accent)' : 'var(--text-sub)',
                        border: newRole === r ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                      }}
                      onClick={() => setNewRole(r)}
                    >
                      {ROLE_LABEL[r]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(false)}>
                取消
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!newUsername || !newPassword}
                onClick={handleCreateUser}
              >
                创建
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Membership Modal ── */}
      {showMemberModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowMemberModal(null)}
        >
          <div
            className="bg-[var(--bg-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-lg)] p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[var(--text-lg)] font-bold text-[var(--text)] mb-2">
              {'\uD83C\uDF1F'} 分配会员
            </h2>
            <p className="text-[var(--text-sm)] text-[var(--text-sub)] mb-4">
              为 <span className="font-semibold text-[var(--text)]">{showMemberModal.nickname}</span> 分配会员等级
            </p>
            <div className="flex gap-3">
              {(['free', 'basic', 'premium'] as const).map((m) => (
                <button
                  key={m}
                  className="flex-1 px-3 py-3 rounded-[var(--radius-sm)] text-center transition-all"
                  style={{
                    background: showMemberModal.membership_tier === m
                      ? 'linear-gradient(135deg, var(--accent), var(--accent-2))'
                      : 'var(--bg)',
                    color: showMemberModal.membership_tier === m ? '#fff' : 'var(--text)',
                    border: `1.5px solid ${showMemberModal.membership_tier === m ? 'transparent' : 'var(--border)'}`,
                  }}
                  onClick={() => handleSetMembership(showMemberModal.id, m)}
                >
                  <div className="text-lg mb-1">{m === 'free' ? '\uD83C\uDD93' : m === 'basic' ? '\u2B50' : '\uD83D\uDC51'}</div>
                  <div className="text-[var(--text-sm)] font-semibold">{MEMBERSHIP_LABEL[m]}</div>
                </button>
              ))}
            </div>
            {/* Expiry date */}
            <div className="mt-4">
              <label className="text-[var(--text-xs)] text-[var(--text-muted)] mb-1 block">到期日期（选填）</label>
              <input
                type="datetime-local"
                value={memberExpiry}
                onChange={(e) => setMemberExpiry(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-[var(--text-sm)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="flex justify-end mt-5">
              <Button variant="secondary" size="sm" onClick={() => setShowMemberModal(null)}>
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagePage
