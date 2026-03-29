import React, { useState, useEffect, useCallback } from 'react'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import {
  getUsers,
  getUserPoints,
  adjustUserPoints,
  type UserListItem,
  type UserListParams,
  type UserPointsDetail,
} from '@/api/admin'

const RANK_LABEL: Record<string, string> = {
  beginner: '入门',
  apprentice_1: '学徒 I',
  apprentice_2: '学徒 II',
  apprentice_3: '学徒 III',
  knight_1: '骑士 I',
  knight_2: '骑士 II',
  knight_3: '骑士 III',
  master_1: '大师 I',
  master_2: '大师 II',
  master_3: '大师 III',
}

const inputClass =
  'w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-[var(--text-sm)] outline-none focus:border-[var(--accent)] transition-colors'
const labelClass = 'text-[var(--text-xs)] text-[var(--text-muted)] mb-1 block'

const AdminPoints: React.FC = () => {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 20

  // Filters
  const [search, setSearch] = useState('')

  // Detail modal
  const [detailUser, setDetailUser] = useState<UserPointsDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Adjust modal
  const [adjustUser, setAdjustUser] = useState<UserListItem | null>(null)
  const [adjustDetail, setAdjustDetail] = useState<UserPointsDetail | null>(null)
  const [xpChange, setXpChange] = useState(0)
  const [coinsChange, setCoinsChange] = useState(0)
  const [gameRatingChange, setGameRatingChange] = useState(0)
  const [puzzleRatingChange, setPuzzleRatingChange] = useState(0)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchUsers = useCallback(() => {
    setLoading(true)
    setError(null)
    const params: UserListParams = { page, page_size: pageSize }
    if (search) params.search = search

    getUsers(params)
      .then((res) => {
        const payload = res.data?.data ?? res.data
        const d = payload as any
        setUsers(d?.items ?? [])
        setTotal(d?.total ?? 0)
        setTotalPages(d?.total_pages ?? 1)
      })
      .catch((err) => {
        console.error('[AdminPoints] Failed to load users:', err)
        setError('加载用户列表失败')
        setUsers([])
      })
      .finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => { fetchUsers() }, [fetchUsers])
  useEffect(() => { setPage(1) }, [search])

  const openDetail = async (u: UserListItem) => {
    setDetailLoading(true)
    setDetailUser(null)
    try {
      const res = await getUserPoints(u.id)
      const data = res.data?.data ?? res.data
      setDetailUser(data as UserPointsDetail)
    } catch (err) {
      console.error('[AdminPoints] Failed to load points:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  const openAdjust = async (u: UserListItem) => {
    setAdjustUser(u)
    setXpChange(0)
    setCoinsChange(0)
    setGameRatingChange(0)
    setPuzzleRatingChange(0)
    setReason('')
    setAdjustDetail(null)
    try {
      const res = await getUserPoints(u.id)
      const data = res.data?.data ?? res.data
      setAdjustDetail(data as UserPointsDetail)
    } catch {
      // fail silently, form still works
    }
  }

  const handleAdjust = async () => {
    if (!adjustUser || !reason) return
    setSubmitting(true)
    try {
      await adjustUserPoints(adjustUser.id, {
        xp_change: xpChange,
        coins_change: coinsChange,
        game_rating_change: gameRatingChange,
        puzzle_rating_change: puzzleRatingChange,
        reason,
      })
      setAdjustUser(null)
      fetchUsers()
    } catch (err) {
      console.error('[AdminPoints] Adjust failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <p className="text-[var(--text-sm)] text-[var(--text-muted)]">
        共 {total} 个用户
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索用户名或昵称..."
          className={`flex-1 min-w-[200px] ${inputClass}`}
        />
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
                  {['用户名', '昵称', '操作'].map((h) => (
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
                    <td colSpan={3} className="text-center py-10 text-[var(--text-sm)] text-[var(--text-muted)]">
                      没有找到匹配的用户
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg)] transition-colors">
                      <td className="px-4 py-3 text-[var(--text-sm)] text-[var(--text)] font-medium">{u.username}</td>
                      <td className="px-4 py-3 text-[var(--text-sm)] text-[var(--text)]">{u.nickname}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button variant="secondary" size="sm" onClick={() => openDetail(u)}>
                            查看详情
                          </Button>
                          <Button variant="primary" size="sm" onClick={() => openAdjust(u)}>
                            调整
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
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            上一页
          </Button>
          <span className="text-[var(--text-sm)] text-[var(--text-sub)] px-3">{page} / {totalPages}</span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            下一页
          </Button>
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={detailLoading || !!detailUser} onClose={() => { setDetailUser(null); setDetailLoading(false) }} title="积分详情">
        {detailLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-2xl animate-spin">&#x231B;</div>
          </div>
        ) : detailUser ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg)]">
                <p className="text-[var(--text-xs)] text-[var(--text-muted)]">用户</p>
                <p className="text-[var(--text-sm)] font-medium text-[var(--text)]">{detailUser.nickname} ({detailUser.username})</p>
              </div>
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg)]">
                <p className="text-[var(--text-xs)] text-[var(--text-muted)]">段位</p>
                <p className="text-[var(--text-sm)] font-medium text-[var(--text)]">{RANK_LABEL[detailUser.rank_title] ?? detailUser.rank_title}</p>
              </div>
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg)]">
                <p className="text-[var(--text-xs)] text-[var(--text-muted)]">对弈评分</p>
                <p className="text-[var(--text-md)] font-bold text-[var(--accent)]">{detailUser.game_rating}</p>
              </div>
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg)]">
                <p className="text-[var(--text-xs)] text-[var(--text-muted)]">谜题评分</p>
                <p className="text-[var(--text-md)] font-bold text-[var(--accent)]">{detailUser.puzzle_rating}</p>
              </div>
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg)]">
                <p className="text-[var(--text-xs)] text-[var(--text-muted)]">总经验值</p>
                <p className="text-[var(--text-md)] font-bold text-[var(--success)]">{detailUser.xp_total}</p>
              </div>
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg)]">
                <p className="text-[var(--text-xs)] text-[var(--text-muted)]">今日经验</p>
                <p className="text-[var(--text-md)] font-bold text-[var(--success)]">{detailUser.xp_today}</p>
              </div>
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg)]">
                <p className="text-[var(--text-xs)] text-[var(--text-muted)]">金币</p>
                <p className="text-[var(--text-md)] font-bold text-[var(--warning)]">{detailUser.coins}</p>
              </div>
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg)]">
                <p className="text-[var(--text-xs)] text-[var(--text-muted)]">段位区域</p>
                <p className="text-[var(--text-sm)] font-medium text-[var(--text)]">{detailUser.rank_region}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setDetailUser(null)}>关闭</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Adjust Modal */}
      <Modal open={!!adjustUser} onClose={() => setAdjustUser(null)} title="调整积分/经验">
        {adjustUser && (
          <>
            <p className="text-[var(--text-sm)] text-[var(--text-sub)] mb-1">
              调整用户: <span className="font-semibold text-[var(--text)]">{adjustUser.nickname} ({adjustUser.username})</span>
            </p>
            {adjustDetail && (
              <p className="text-[var(--text-xs)] text-[var(--text-muted)] mb-4">
                当前: 经验 {adjustDetail.xp_total} | 金币 {adjustDetail.coins} | 对弈 {adjustDetail.game_rating} | 谜题 {adjustDetail.puzzle_rating}
              </p>
            )}
            <div className="space-y-3">
              <div>
                <label className={labelClass}>经验值变动（正数增加，负数扣除）</label>
                <input type="number" value={xpChange} onChange={(e) => setXpChange(Number(e.target.value))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>金币变动</label>
                <input type="number" value={coinsChange} onChange={(e) => setCoinsChange(Number(e.target.value))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>对弈评分变动</label>
                <input type="number" value={gameRatingChange} onChange={(e) => setGameRatingChange(Number(e.target.value))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>谜题评分变动</label>
                <input type="number" value={puzzleRatingChange} onChange={(e) => setPuzzleRatingChange(Number(e.target.value))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>调整原因 *</label>
                <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="输入调整原因（必填）" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" size="sm" onClick={() => setAdjustUser(null)}>取消</Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!reason || submitting}
                loading={submitting}
                onClick={handleAdjust}
              >
                确认调整
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

export default AdminPoints
