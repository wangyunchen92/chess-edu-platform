import React, { useState, useEffect, useCallback } from 'react'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'
import Badge from '@/components/common/Badge'
import Modal from '@/components/common/Modal'
import {
  getUsers,
  updateMembership,
  batchUpdateMembership,
  type UserListItem,
  type UserListParams,
} from '@/api/admin'

const MEMBERSHIP_LABEL: Record<string, string> = { free: '免费', basic: '基础版', premium: '高级版' }

const inputClass =
  'w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-[var(--text-sm)] outline-none focus:border-[var(--accent)] transition-colors'
const selectClass =
  'px-3 py-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-[var(--text-sm)] outline-none focus:border-[var(--accent)] transition-colors'
const labelClass = 'text-[var(--text-xs)] text-[var(--text-muted)] mb-1 block'

const AdminMembership: React.FC = () => {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 20

  // Filters
  const [search, setSearch] = useState('')
  const [filterMembership, setFilterMembership] = useState('')

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Modals
  const [singleUser, setSingleUser] = useState<UserListItem | null>(null)
  const [showBatchModal, setShowBatchModal] = useState(false)

  // Form
  const [memberTier, setMemberTier] = useState('basic')
  const [memberExpiry, setMemberExpiry] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchUsers = useCallback(() => {
    setLoading(true)
    setError(null)
    const params: UserListParams = { page, page_size: pageSize }
    if (search) params.search = search
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
        console.error('[AdminMembership] Failed to load users:', err)
        setError('加载用户列表失败')
        setUsers([])
      })
      .finally(() => setLoading(false))
  }, [page, search, filterMembership])

  useEffect(() => { fetchUsers() }, [fetchUsers])
  useEffect(() => { setPage(1) }, [search, filterMembership])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(users.map((u) => u.id)))
    }
  }

  const handleSingleMembership = async () => {
    if (!singleUser) return
    setSubmitting(true)
    try {
      await updateMembership(singleUser.id, {
        membership_tier: memberTier,
        membership_expires_at: memberExpiry || null,
      })
      setSingleUser(null)
      setMemberTier('basic')
      setMemberExpiry('')
      fetchUsers()
    } catch (err) {
      console.error('[AdminMembership] Update membership failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleBatchMembership = async () => {
    if (selectedIds.size === 0) return
    setSubmitting(true)
    try {
      await batchUpdateMembership({
        user_ids: Array.from(selectedIds),
        membership_tier: memberTier,
        membership_expires_at: memberExpiry || null,
      })
      setShowBatchModal(false)
      setSelectedIds(new Set())
      setMemberTier('basic')
      setMemberExpiry('')
      fetchUsers()
    } catch (err) {
      console.error('[AdminMembership] Batch update failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const openSingle = (u: UserListItem) => {
    setMemberTier(u.membership_tier || 'basic')
    setMemberExpiry('')
    setSingleUser(u)
  }

  const openBatch = () => {
    setMemberTier('basic')
    setMemberExpiry('')
    setShowBatchModal(true)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[var(--text-sm)] text-[var(--text-muted)]">
          共 {total} 个用户 {selectedIds.size > 0 && `| 已选 ${selectedIds.size} 个`}
        </p>
        <Button
          variant="primary"
          size="sm"
          disabled={selectedIds.size === 0}
          onClick={openBatch}
        >
          批量授权 ({selectedIds.size})
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
        <select value={filterMembership} onChange={(e) => setFilterMembership(e.target.value)} className={selectClass}>
          <option value="">全部会员</option>
          <option value="free">免费</option>
          <option value="basic">基础版</option>
          <option value="premium">高级版</option>
        </select>
      </div>

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
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={users.length > 0 && selectedIds.size === users.length}
                      onChange={toggleSelectAll}
                      className="accent-[var(--accent)]"
                    />
                  </th>
                  {['用户名', '昵称', '当前会员', '到期时间', '操作'].map((h) => (
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
                    <td colSpan={6} className="text-center py-10 text-[var(--text-sm)] text-[var(--text-muted)]">
                      没有找到匹配的用户
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg)] transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(u.id)}
                          onChange={() => toggleSelect(u.id)}
                          className="accent-[var(--accent)]"
                        />
                      </td>
                      <td className="px-4 py-3 text-[var(--text-sm)] text-[var(--text)] font-medium">{u.username}</td>
                      <td className="px-4 py-3 text-[var(--text-sm)] text-[var(--text)]">{u.nickname}</td>
                      <td className="px-4 py-3">
                        <Badge color={u.membership_tier === 'premium' ? 'warning' : u.membership_tier === 'basic' ? 'info' : 'neutral'}>
                          {MEMBERSHIP_LABEL[u.membership_tier] ?? u.membership_tier}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-xs)] text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                        {u.membership_expires_at ? new Date(u.membership_expires_at).toLocaleString('zh-CN') : '--'}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="secondary" size="sm" onClick={() => openSingle(u)}>
                          授权会员
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            上一页
          </Button>
          <span className="text-[var(--text-sm)] text-[var(--text-sub)] px-3">{page} / {totalPages}</span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            下一页
          </Button>
        </div>
      )}

      {/* Single Membership Modal */}
      <Modal open={!!singleUser} onClose={() => setSingleUser(null)} title="授权会员" width="400px">
        {singleUser && (
          <>
            <p className="text-[var(--text-sm)] text-[var(--text-sub)] mb-4">
              为 <span className="font-semibold text-[var(--text)]">{singleUser.nickname}</span> 分配会员等级
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>会员等级</label>
                <select value={memberTier} onChange={(e) => setMemberTier(e.target.value)} className={inputClass}>
                  <option value="free">免费</option>
                  <option value="basic">基础版</option>
                  <option value="premium">高级版</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>到期时间（选填）</label>
                <input
                  type="datetime-local"
                  value={memberExpiry}
                  onChange={(e) => setMemberExpiry(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" size="sm" onClick={() => setSingleUser(null)}>取消</Button>
              <Button variant="primary" size="sm" disabled={submitting} loading={submitting} onClick={handleSingleMembership}>
                确认
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Batch Membership Modal */}
      <Modal open={showBatchModal} onClose={() => setShowBatchModal(false)} title="批量授权会员" width="400px">
        <p className="text-[var(--text-sm)] text-[var(--text-sub)] mb-4">
          将为 <span className="font-semibold text-[var(--text)]">{selectedIds.size}</span> 个用户设置会员等级
        </p>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>会员等级</label>
            <select value={memberTier} onChange={(e) => setMemberTier(e.target.value)} className={inputClass}>
              <option value="free">免费</option>
              <option value="basic">基础版</option>
              <option value="premium">高级版</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>到期时间（选填）</label>
            <input
              type="datetime-local"
              value={memberExpiry}
              onChange={(e) => setMemberExpiry(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" size="sm" onClick={() => setShowBatchModal(false)}>取消</Button>
          <Button variant="primary" size="sm" disabled={submitting} loading={submitting} onClick={handleBatchMembership}>
            确认批量授权
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default AdminMembership
