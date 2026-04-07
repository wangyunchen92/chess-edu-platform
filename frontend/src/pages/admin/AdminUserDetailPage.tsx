import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'
import Avatar from '@/components/common/Avatar'
import Badge from '@/components/common/Badge'
import ProgressBar from '@/components/common/ProgressBar'
import Loading from '@/components/common/Loading'
import apiClient from '@/api/client'

function translateRank(code: string): string {
  const map: Record<string, string> = {
    apprentice_1: '学徒 I', apprentice_2: '学徒 II', apprentice_3: '学徒 III',
    knight_1: '骑士 I', knight_2: '骑士 II', knight_3: '骑士 III',
    bishop_1: '主教 I', bishop_2: '主教 II', bishop_3: '主教 III',
    rook_1: '城堡 I', rook_2: '城堡 II', rook_3: '城堡 III',
    queen_1: '女王 I', queen_2: '女王 II', queen_3: '女王 III',
    king: '国王',
  }
  return map[code] || code
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '从未'
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
function resultLabel(result: string): { text: string; color: 'success' | 'danger' | 'neutral' } {
  if (result === 'win') return { text: '胜', color: 'success' }
  if (result === 'loss') return { text: '负', color: 'danger' }
  return { text: '和', color: 'neutral' }
}

const AdminUserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get(`/admin/users/${id}/detail`)
      const data = (res.data as any)?.data ?? res.data
      setDetail(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载用户详情失败')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <Loading size="lg" text="加载中..." />

  if (error || !detail) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Button variant="secondary" size="sm" onClick={() => navigate('/admin/users-list')}>
          返回
        </Button>
        <div className="px-4 py-3 rounded-[var(--radius-sm)] bg-[rgba(239,68,68,0.1)] text-[var(--danger)] text-[var(--text-sm)]">
          {error || '未找到用户数据'}
        </div>
      </div>
    )
  }

  const { ratings, game_stats, puzzle_stats, course_stats, streak } = detail
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top bar */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/users-list')}
          className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border)] transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <Avatar
          src={detail.avatar_url}
          name={detail.nickname || detail.username}
          size="lg"
        />
        <div>
          <h1 className="text-[var(--text-xl)] font-bold text-[var(--text)]">
            {detail.nickname || detail.username}
          </h1>
          <div className="flex items-center gap-2 text-[var(--text-sm)] text-[var(--text-muted)]">
            <span>@{detail.username}</span>
            {ratings?.rank_title && <Badge color="primary">{translateRank(ratings.rank_title)}</Badge>}
          </div>
        </div>
      </div>

      {/* Login info card */}
      <Card padding="md" hoverable={false}>
        <h3 className="text-[var(--text-sm)] font-semibold text-[var(--text)] mb-3">登录信息</h3>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[var(--text-sm)] text-[var(--text-sub)]">
          <span>最近登录: <strong className="text-[var(--text)]">{formatRelativeTime(detail.last_active_at)}</strong></span>
          <span>注册时间: <strong className="text-[var(--text)]">{detail.bindtime ? new Date(detail.bindtime).toLocaleDateString('zh-CN') : '--'}</strong></span>
        </div>
      </Card>

      {/* Overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="md" hoverable={false}>
          <p className="text-[var(--text-xs)] text-[var(--text-muted)] mb-1">对弈分数</p>
          <p className="text-[var(--text-2xl)] font-bold text-[var(--text)]">{ratings?.game_rating ?? 300}</p>
          <p className="text-[var(--text-xs)] text-[var(--text-sub)] mt-1">
            {game_stats?.wins ?? 0}胜 {game_stats?.losses ?? 0}负 {game_stats?.draws ?? 0}和
          </p>
        </Card>
        <Card padding="md" hoverable={false}>
          <p className="text-[var(--text-xs)] text-[var(--text-muted)] mb-1">谜题分数</p>
          <p className="text-[var(--text-2xl)] font-bold text-[var(--text)]">{ratings?.puzzle_rating ?? 300}</p>
          <p className="text-[var(--text-xs)] text-[var(--text-sub)] mt-1">
            正确率 {Math.round((puzzle_stats?.accuracy ?? 0) * 100)}% ({puzzle_stats?.correct_count ?? 0}/{puzzle_stats?.total_attempts ?? 0})
          </p>
        </Card>
        <Card padding="md" hoverable={false}>
          <p className="text-[var(--text-xs)] text-[var(--text-muted)] mb-1">连续学习</p>
          <p className="text-[var(--text-2xl)] font-bold text-[var(--text)]">{streak?.current_login_streak ?? 0} 天</p>
          <p className="text-[var(--text-xs)] text-[var(--text-sub)] mt-1">
            最高 {streak?.max_login_streak ?? 0} 天 / 训练连续 {streak?.current_train_streak ?? 0} 天
          </p>
        </Card>
      </div>

      {/* Game stats */}
      <Card padding="lg" hoverable={false}>
        <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-4">对弈统计</h3>
        <div className="flex items-center gap-6 mb-4 text-[var(--text-sm)]">
          <span className="text-[var(--text-sub)]">
            共 <strong className="text-[var(--text)]">{game_stats?.total_games ?? 0}</strong> 局
          </span>
          <span className="text-[var(--text-sub)]">
            胜率 <strong className="text-[var(--text)]">{Math.round((game_stats?.win_rate ?? 0) * 100)}%</strong>
          </span>
        </div>
        {game_stats?.recent_games?.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[var(--text-xs)] text-[var(--text-muted)] mb-2">最近对局</p>
            {game_stats.recent_games.map((g: any) => {
              const r = resultLabel(g.result)
              return (
                <div key={g.id} className="flex items-center gap-3 py-2 px-3 rounded-[var(--radius-xs)] bg-[var(--bg)]">
                  <Badge color={r.color}>{r.text}</Badge>
                  <span className="text-[var(--text-sm)] text-[var(--text)] flex-1">vs {g.character_name}</span>
                  <span className={`text-[var(--text-sm)] font-semibold ${g.rating_change >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {g.rating_change >= 0 ? '+' : ''}{g.rating_change}
                  </span>
                  <span className="text-[var(--text-xs)] text-[var(--text-muted)]">{formatDate(g.played_at)}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-[var(--text-sm)] text-[var(--text-muted)]">暂无对局记录</p>
        )}
      </Card>
      {/* Puzzle stats */}
      <Card padding="lg" hoverable={false}>
        <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-4">做题统计</h3>
        <div className="flex flex-wrap items-center gap-6 text-[var(--text-sm)]">
          <span className="text-[var(--text-sub)]">共做 <strong className="text-[var(--text)]">{puzzle_stats?.total_attempts ?? 0}</strong> 题</span>
          <span className="text-[var(--text-sub)]">正确 <strong className="text-[var(--text)]">{puzzle_stats?.correct_count ?? 0}</strong> 题</span>
          <span className="text-[var(--text-sub)]">正确率 <strong className="text-[var(--text)]">{Math.round((puzzle_stats?.accuracy ?? 0) * 100)}%</strong></span>
          <span className="text-[var(--text-sub)]">当前连对 <strong className="text-[var(--text)]">{puzzle_stats?.current_streak ?? 0}</strong> 题</span>
        </div>
      </Card>

      {/* Course progress */}
      <Card padding="lg" hoverable={false}>
        <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-4">课程进度</h3>
        <div className="flex items-center gap-4 mb-4 text-[var(--text-sm)]">
          <span className="text-[var(--text-sub)]">
            已完成 <strong className="text-[var(--text)]">{course_stats?.completed_lessons ?? 0}</strong>/{course_stats?.total_lessons ?? 0} 课时
          </span>
          <span className="text-[var(--text-sub)]">
            完成率 <strong className="text-[var(--text)]">{Math.round((course_stats?.completion_rate ?? 0) * 100)}%</strong>
          </span>
        </div>
        {course_stats?.courses?.length > 0 ? (
          <div className="space-y-4">
            {course_stats.courses.map((c: any) => (
              <div key={c.course_id}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[var(--text-sm)] font-medium text-[var(--text)]">{c.title}</span>
                  <span className="text-[var(--text-xs)] text-[var(--text-muted)]">{c.completed}/{c.total_lessons} 课</span>
                </div>
                <ProgressBar value={Math.round(c.progress * 100)} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--text-sm)] text-[var(--text-muted)]">暂未开始课程</p>
        )}
      </Card>
    </div>
  )
}

export default AdminUserDetailPage
