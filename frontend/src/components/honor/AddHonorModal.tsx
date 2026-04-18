import React, { useState } from 'react'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import { honorApi } from '@/api/honor'
import { useUIStore } from '@/stores/uiStore'

interface AddHonorModalProps {
  open: boolean
  onClose: () => void
  userId: string
  userNickname: string
  onSuccess?: () => void
}

const AddHonorModal: React.FC<AddHonorModalProps> = ({
  open,
  onClose,
  userId,
  userNickname,
  onSuccess,
}) => {
  const addToast = useUIStore((s) => s.addToast)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    competition_name: '',
    competition_date: '',
    rank: '',
    description: '',
    is_public: true,
  })

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.competition_name.trim() || !form.competition_date) {
      addToast('error', '请填写荣誉标题、赛事名称和日期')
      return
    }
    setSubmitting(true)
    try {
      await honorApi.createRecord({
        user_id: userId,
        title: form.title.trim(),
        competition_name: form.competition_name.trim(),
        competition_date: form.competition_date,
        rank: form.rank.trim() || undefined,
        description: form.description.trim() || undefined,
        is_public: form.is_public,
      })
      addToast('success', '荣誉记录添加成功')
      setForm({ title: '', competition_name: '', competition_date: '', rank: '', description: '', is_public: true })
      onClose()
      onSuccess?.()
    } catch (err) {
      addToast('error', '添加失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`为 ${userNickname} 添加荣誉`}>
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-[var(--text-sm)] font-medium text-[var(--text)] mb-1">
            荣誉标题 <span className="text-[var(--danger)]">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="如：春季杯赛季军"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          />
        </div>

        {/* Competition name */}
        <div>
          <label className="block text-[var(--text-sm)] font-medium text-[var(--text)] mb-1">
            赛事名称 <span className="text-[var(--danger)]">*</span>
          </label>
          <input
            type="text"
            value={form.competition_name}
            onChange={(e) => setForm((f) => ({ ...f, competition_name: e.target.value }))}
            placeholder="如：2026春季校际象棋锦标赛"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          />
        </div>

        {/* Date + Rank row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[var(--text-sm)] font-medium text-[var(--text)] mb-1">
              赛事日期 <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="date"
              value={form.competition_date}
              onChange={(e) => setForm((f) => ({ ...f, competition_date: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            />
          </div>
          <div>
            <label className="block text-[var(--text-sm)] font-medium text-[var(--text)] mb-1">
              名次
            </label>
            <input
              type="text"
              value={form.rank}
              onChange={(e) => setForm((f) => ({ ...f, rank: e.target.value }))}
              placeholder="如：冠军、第3名"
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-[var(--text-sm)] font-medium text-[var(--text)] mb-1">
            补充说明
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="可选，如比赛详情等"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          />
        </div>

        {/* Public toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_public}
            onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))}
            className="w-4 h-4 rounded border-[var(--border)] accent-[var(--accent)]"
          />
          <span className="text-[var(--text-sm)] text-[var(--text)]">展示到光荣榜</span>
        </label>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" size="md" onClick={onClose} className="flex-1">
            取消
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1"
          >
            {submitting ? '提交中...' : '确认添加'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default AddHonorModal
