import React, { useState, useEffect, useCallback } from 'react'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'
import Badge from '@/components/common/Badge'
import Modal from '@/components/common/Modal'
import {
  getUsers,
  createUser,
  updateUser,
  resetPassword,
  updateUserStatus,
  type UserListItem,
  type UserListParams,
} from '@/api/admin'

const ROLE_LABEL: Record<string, string> = { student: '学生', teacher: '教师', admin: '管理员' }
const MEMBERSHIP_LABEL: Record<string, string> = { free: '免费', basic: '基础版', premium: '高级版' }
const STATUS_LABEL: Record<string, string> = { active: '正常', disabled: '已禁用' }

const inputClass =
  'w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-[var(--text-sm)] outline-none focus:border-[var(--accent)] transition-colors'
const selectClass =
  'px-3 py-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-[var(--text-sm)] outline-none focus:border-[var(--accent)] transition-colors'
const labelClass = 'text-[var(--text-xs)] text-[var(--text-muted)] mb-1 block'

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 20

  // Filters
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMembership, setFilterMembership] = useState('')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editUser, setEditUser] = useState<UserListItem | null>(null)
  const [resetPwUser, setResetPwUser] = useState<UserListItem | null>(null)
  const [statusUser, setStatusUser] = useState<UserListItem | null>(null)

  // Create form
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newNickname, setNewNickname] = useState('')
  const [newRole, setNewRole] = useState('student')

  // Edit form
  const [editNickname, setEditNickname] = useState('')
  const [editRole, setEditRole] = useState('')

  // Reset password form
  const [newPw, setNewPw] = useState('')

  // Submitting states
  const [submitting, setSubmitting] = useState(false)

  const fetchUsers = useCallback(() => {
    setLoading(true)
    setError(null)
    const params: UserListParams = {
      page,
      page_size: pageSize,
    }
    if (search) params.search = search
    if (filterRole) params.role = filterRole
    if (filterStatus) params.status = filterStatus
    if (filterMembership) params.membership_tier = filterMembership

    getUsers(params)
      .then((res) => {
        const payload = res.data?.data ?? res.data
        const d = payload as any
        setUsers(d?.items ?? [])
        setTotal(d?.total ?? 0)
        setTotalPages(d?.total_pages ?? 1)
      })
      .catch((err) => {
        console.error('[AdminUsers] Failed to load users:', err)
        setError('加载用户列表失败')
        setUsers([])
      })
      .finally(() => setLoading(false))
  }, [page, search, filterRole, filterStatus, filterMembership])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [search, filterRole, filterStatus, filterMembership])

  // --- Handlers ---

  const handleCreate = async () => {
    if (!newUsername || !newPassword) return
    setSubmitting(true)
    try {
      await createUser({
        username: newUsername,
        password: newPassword,
        nickname: newNickname || newUsername,
        role: newRole,
      })
      setShowCreateModal(false)
      setNewUsername('')
      setNewPassword('')
      setNewNickname('')
      setNewRole('student')
      fetchUsers()
    } catch (err) {
      console.error('[AdminUsers] Create user failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async () => {
    if (!editUser) return
    setSubmitting(true)
    try {
      await updateUser(editUser.id, {
        nickname: editNickname || undefined,
        role: editRole || undefined,
      })
      setEditUser(null)
      fetchUsers()
    } catch (err) {
      console.error('[AdminUsers] Edit user failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetPwUser || !newPw) return
    setSubmitting(true)
    try {
      await resetPassword(resetPwUser.id, newPw)
      setResetPwUser(null)
      setNewPw('')
    } catch (err) {
      console.error('[AdminUsers] Reset password failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!statusUser) return
    setSubmitting(true)
    const newStatus = statusUser.status === 'active' ? 'disabled' : 'active'
    try {
      await updateUserStatus(statusUser.id, newStatus)
      setStatusUser(null)
      fetchUsers()
    } catch (err) {
      console.error('[AdminUsers] Toggle status failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = (u: UserListItem) => {
    setEditNickname(u.nickname)
    setEditRole(u.role)
    setEditUser(u)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[var(--text-sm)] text-[var(--text-muted)]">
          共 {total} 个用户
        </p>
        <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
          + 新增用户
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索用户名或昵称..."
          className={`flex-1 min-w-[200px] ${inputClass}`}
        />
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className={selectClass}>
          <option value="">全部角色</option>
          <option value="student">学生</option>
          <option value="teacher">教师</option>
          <option value="admin">管理员</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass}>
          <option value="">全部状态</option>
          <option value="active">正常</option>
          <option value="disabled">已禁用</option>
        </select>
        <select value={filterMembership} onChange={(e) => setFilterMembership(e.target.value)} className={selectClass}>
          <option value="">全部会员</option>
          <option value="free">免费</option>
          <option value="basic">基础版</option>
          <option value="premium">高级版</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-[var(--radius-sm)] bg-[rgba(239,68,68,0.1)] text-[var(--danger)] text-[var(--text-sm)]">
          {error}
        </div>
      )}

      {/* Table */}
      <Card padding="none" hoverable={false}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-4xl animate-bounce">&#x1F465;</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['用户名', '昵称', '角色', '会员', '状态', '注册时间', '最近登录', '操作'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-[var(--text-xs)] font-semibold text-[var(--text-muted)] uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-[var(--text-sm)] text-[var(--text-muted)]">
                      没有找到匹配的用户
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg)] transition-colors">
                      <td className="px-4 py-3 text-[var(--text-sm)] text-[var(--text)] font-medium">{u.username}</td>
                      <td className="px-4 py-3 text-[var(--text-sm)] text-[var(--text)]">{u.nickname}</td>
                      <td className="px-4 py-3">
                        <Badge color={u.role === 'admin' ? 'danger' : u.role === 'teacher' ? 'success' : 'primary'}>
                          {ROLE_LABEL[u.role] ?? u.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={u.membership_tier === 'premium' ? 'warning' : u.membership_tier === 'basic' ? 'info' : 'neutral'}>
                          {MEMBERSHIP_LABEL[u.membership_tier] ?? u.membership_tier}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={u.status === 'active' ? 'success' : 'neutral'} dot>
                          {STATUS_LABEL[u.status] ?? u.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-xs)] text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                        {u.created_at ? new Date(u.created_at).toLocaleString('zh-CN') : '--'}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-xs)] text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString('zh-CN') : '--'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button variant="secondary" size="sm" onClick={() => openEdit(u)}>
                            编辑
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => { setResetPwUser(u); setNewPw(''); }}>
                            重置密码
                          </Button>
                          <Button
                            variant={u.status === 'active' ? 'danger' : 'primary'}
                            size="sm"
                            onClick={() => setStatusUser(u)}
                          >
                            {u.status === 'active' ? '禁用' : '启用'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <span className="text-[var(--text-sm)] text-[var(--text-sub)] px-3">
            {page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}

      {/* Create User Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="新增用户">
        <div className="space-y-3">
          <div>
            <label className={labelClass}>用户名 *</label>
            <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className={inputClass} placeholder="输入用户名" />
          </div>
          <div>
            <label className={labelClass}>密码 *</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} placeholder="输入密码" />
          </div>
          <div>
            <label className={labelClass}>昵称</label>
            <input type="text" value={newNickname} onChange={(e) => setNewNickname(e.target.value)} className={inputClass} placeholder="输入昵称（选填）" />
          </div>
          <div>
            <label className={labelClass}>角色</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className={`${inputClass}`}>
              <option value="student">学生</option>
              <option value="teacher">教师</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(false)}>取消</Button>
          <Button variant="primary" size="sm" disabled={!newUsername || !newPassword || submitting} loading={submitting} onClick={handleCreate}>
            创建
          </Button>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="编辑用户">
        {editUser && (
          <>
            <p className="text-[var(--text-sm)] text-[var(--text-sub)] mb-4">
              编辑用户: <span className="font-semibold text-[var(--text)]">{editUser.username}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>昵称</label>
                <input type="text" value={editNickname} onChange={(e) => setEditNickname(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>角色</label>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className={`${inputClass}`}>
                  <option value="student">学生</option>
                  <option value="teacher">教师</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" size="sm" onClick={() => setEditUser(null)}>取消</Button>
              <Button variant="primary" size="sm" disabled={submitting} loading={submitting} onClick={handleEdit}>
                保存
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetPwUser} onClose={() => setResetPwUser(null)} title="重置密码">
        {resetPwUser && (
          <>
            <p className="text-[var(--text-sm)] text-[var(--text-sub)] mb-4">
              重置 <span className="font-semibold text-[var(--text)]">{resetPwUser.username}</span> 的密码
            </p>
            <div>
              <label className={labelClass}>新密码 *</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className={inputClass} placeholder="输入新密码（至少6位）" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" size="sm" onClick={() => setResetPwUser(null)}>取消</Button>
              <Button variant="primary" size="sm" disabled={newPw.length < 6 || submitting} loading={submitting} onClick={handleResetPassword}>
                确认重置
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Toggle Status Confirm Modal */}
      <Modal open={!!statusUser} onClose={() => setStatusUser(null)} title={statusUser?.status === 'active' ? '禁用用户' : '启用用户'} width="400px">
        {statusUser && (
          <>
            <p className="text-[var(--text-sm)] text-[var(--text)]">
              {statusUser.status === 'active'
                ? `确定要禁用用户 "${statusUser.username}" 吗？禁用后该用户将无法登录。`
                : `确定要启用用户 "${statusUser.username}" 吗？启用后该用户可以正常登录。`
              }
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" size="sm" onClick={() => setStatusUser(null)}>取消</Button>
              <Button
                variant={statusUser.status === 'active' ? 'danger' : 'primary'}
                size="sm"
                disabled={submitting}
                loading={submitting}
                onClick={handleToggleStatus}
              >
                {statusUser.status === 'active' ? '确认禁用' : '确认启用'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

export default AdminUsers
