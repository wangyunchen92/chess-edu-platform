import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '@/stores/uiStore'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'
import Avatar from '@/components/common/Avatar'
import Badge from '@/components/common/Badge'
import Modal from '@/components/common/Modal'
import Loading from '@/components/common/Loading'
import * as teacherApi from '@/api/teacher'
import type { TeacherStudentItem, InviteCodeResponse } from '@/types/api'

/** Translate rank_title code to Chinese display name */
function translateRank(code: string): string {
  const map: Record<string, string> = {
    apprentice_1: '学徒 I',
    apprentice_2: '学徒 II',
    apprentice_3: '学徒 III',
    knight_1: '骑士 I',
    knight_2: '骑士 II',
    knight_3: '骑士 III',
    bishop_1: '主教 I',
    bishop_2: '主教 II',
    bishop_3: '主教 III',
    rook_1: '城堡 I',
    rook_2: '城堡 II',
    rook_3: '城堡 III',
    queen_1: '女王 I',
    queen_2: '女王 II',
    queen_3: '女王 III',
    king: '国王',
  }
  return map[code] || code
}

/** Format a date string to a friendly relative time */
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

const TeacherDashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const addToast = useUIStore((s) => s.addToast)

  const [students, setStudents] = useState<TeacherStudentItem[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Invite code modal
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteCodes, setInviteCodes] = useState<InviteCodeResponse[]>([])
  const [generatingCode, setGeneratingCode] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const loadStudents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await teacherApi.getStudents({ page: 1, page_size: 50 })
      const data = res.data?.data ?? res.data
      setStudents(data.items ?? [])
      setTotalStudents(data.total ?? 0)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载学生列表失败'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadInviteCodes = useCallback(async () => {
    try {
      const res = await teacherApi.getInviteCodes()
      const data = res.data?.data ?? res.data
      setInviteCodes(Array.isArray(data) ? data : [])
    } catch {
      // silently fail, modal will show empty
    }
  }, [])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  const handleGenerateCode = async () => {
    setGeneratingCode(true)
    try {
      const res = await teacherApi.createInviteCode()
      const data = res.data?.data ?? res.data
      setInviteCodes((prev) => [data, ...prev])
      addToast('success', '邀请码已生成')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '生成邀请码失败'
      addToast('error', msg)
    } finally {
      setGeneratingCode(false)
    }
  }

  const handleRevokeCode = async (codeId: string) => {
    try {
      await teacherApi.revokeInviteCode(codeId)
      setInviteCodes((prev) => prev.filter((c) => c.id !== codeId))
      addToast('success', '邀请码已撤销')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '撤销失败'
      addToast('error', msg)
    }
  }

  const handleCopyCode = async (code: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code)
      } else {
        // Fallback for HTTP environments
        const textarea = document.createElement('textarea')
        textarea.value = code
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopiedCode(code)
      addToast('success', '已复制到剪贴板')
      setTimeout(() => setCopiedCode(null), 2000)
    } catch {
      addToast('error', '复制失败，请手动复制')
    }
  }

  const openInviteModal = () => {
    loadInviteCodes()
    setShowInviteModal(true)
  }

  if (loading) {
    return <Loading size="lg" text="加载中..." />
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
            我的学生
          </h1>
          {totalStudents > 0 && (
            <p className="text-[var(--text-sm)] text-[var(--text-muted)] mt-1">
              共 {totalStudents} 名学生
            </p>
          )}
        </div>
        <Button variant="primary" size="md" onClick={openInviteModal}>
          生成邀请码
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-[var(--radius-sm)] bg-[rgba(239,68,68,0.1)] text-[var(--danger)] text-[var(--text-sm)]">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!error && students.length === 0 && (
        <Card padding="lg" hoverable={false}>
          <div className="text-center py-8">
            <div className="text-5xl mb-4">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mx-auto opacity-40">
                <circle cx="32" cy="24" r="10" stroke="currentColor" strokeWidth="2.5" className="text-[var(--text-muted)]" />
                <path d="M14 52c0-10 8-16 18-16s18 6 18 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-[var(--text-muted)]" />
              </svg>
            </div>
            <h3 className="text-[var(--text-lg)] font-semibold text-[var(--text)] mb-2">
              还没有学生
            </h3>
            <p className="text-[var(--text-sm)] text-[var(--text-muted)] mb-6">
              生成邀请码，让学生在"设置"页输入即可加入
            </p>
            <Button variant="primary" size="lg" onClick={openInviteModal}>
              生成邀请码
            </Button>
          </div>
        </Card>
      )}

      {/* Student cards */}
      <div className="grid gap-4">
        {students.map((student) => (
          <Card
            key={student.student_id}
            padding="md"
            hoverable
            onClick={() => navigate(`/teacher/student/${student.student_id}`)}
          >
            <div className="flex items-center gap-4">
              {/* Avatar + Name */}
              <Avatar
                src={student.avatar_url}
                name={student.nickname || student.username}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[var(--text-md)] font-semibold text-[var(--text)] truncate">
                    {student.nickname || student.username}
                  </span>
                  <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
                    @{student.username}
                  </span>
                  <Badge color="primary">{translateRank(student.summary.rank_title)}</Badge>
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[var(--text-xs)] text-[var(--text-sub)]">
                  <span>
                    对弈 <strong className="text-[var(--text)]">{student.summary.total_games}</strong> 局
                    {' / '}
                    胜率 <strong className="text-[var(--text)]">{Math.round(student.summary.win_rate * 100)}%</strong>
                  </span>
                  <span>
                    做题 <strong className="text-[var(--text)]">{student.summary.total_puzzles}</strong> 题
                    {' / '}
                    正确率 <strong className="text-[var(--text)]">{Math.round(student.summary.puzzle_accuracy * 100)}%</strong>
                  </span>
                  <span>
                    课程完成 <strong className="text-[var(--text)]">{Math.round(student.summary.course_completion * 100)}%</strong>
                  </span>
                </div>

                {/* Last active */}
                <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">
                  最近活跃: {formatRelativeTime(student.summary.last_active_at)}
                </p>
              </div>

              {/* Arrow */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[var(--text-muted)] shrink-0">
                <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </Card>
        ))}
      </div>

      {/* Invite Code Modal */}
      <Modal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="邀请码管理"
        width="520px"
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
              让学生在"设置 &gt; 加入老师"中输入邀请码
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerateCode}
              loading={generatingCode}
            >
              新建邀请码
            </Button>
          </div>

          {inviteCodes.length === 0 && (
            <div className="text-center py-6 text-[var(--text-muted)] text-[var(--text-sm)]">
              暂无邀请码，点击上方按钮生成
            </div>
          )}

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {inviteCodes.map((ic) => {
              const isActive = ic.status === 'active'
              const isExpired = isActive && new Date(ic.expires_at) < new Date()
              return (
                <div
                  key={ic.id}
                  className="flex items-center gap-4 p-4 rounded-[var(--radius-sm)] bg-[var(--bg)]"
                >
                  {/* Code display - large monospace font for classroom visibility */}
                  <div className="flex-1">
                    <div className="font-mono text-3xl font-bold tracking-[0.2em] text-[var(--text)] select-all">
                      {ic.code}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[var(--text-xs)] text-[var(--text-muted)]">
                      <span>已用 {ic.used_count}/{ic.max_uses}</span>
                      <span>
                        {isExpired
                          ? '已过期'
                          : isActive
                          ? `${new Date(ic.expires_at).toLocaleDateString('zh-CN')} 过期`
                          : ic.status === 'revoked'
                          ? '已撤销'
                          : ic.status}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {isActive && !isExpired && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopyCode(ic.code)
                          }}
                        >
                          {copiedCode === ic.code ? '已复制' : '复制'}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRevokeCode(ic.id)
                          }}
                        >
                          撤销
                        </Button>
                      </>
                    )}
                    {(isExpired || ic.status !== 'active') && (
                      <Badge color={isExpired ? 'warning' : 'neutral'}>
                        {isExpired ? '已过期' : '已撤销'}
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default TeacherDashboardPage
