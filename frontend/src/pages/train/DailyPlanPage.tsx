import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { trainApi } from '@/api/train'
import { useTrainStore } from '@/stores/trainStore'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'
import StreakBadge from '@/components/gamification/StreakBadge'
import XPBar from '@/components/gamification/XPBar'

interface PlanTask {
  id: string
  type: 'puzzle' | 'lesson' | 'game'
  title: string
  description: string
  emoji: string
  link: string
  completed: boolean
}

const MOCK_TASKS: PlanTask[] = [
  {
    id: 't1', type: 'puzzle', title: '战术热身',
    description: '完成3道每日谜题', emoji: '\uD83E\uDDE9',
    link: '/puzzles/daily', completed: false,
  },
  {
    id: 't2', type: 'lesson', title: '继续学习',
    description: '完成一节课程', emoji: '\uD83D\uDCDA',
    link: '/learn', completed: false,
  },
  {
    id: 't3', type: 'game', title: '实战对弈',
    description: '和AI对弈一局', emoji: '\u265E',
    link: '/play', completed: false,
  },
]

const DailyPlanPage: React.FC = () => {
  const navigate = useNavigate()
  const trainStore = useTrainStore()
  const [tasks, setTasks] = useState<PlanTask[]>([])
  const [loading, setLoading] = useState(true)
  const [streakDays, setStreakDays] = useState(0)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      trainApi.getTodayPlan().catch((err) => { console.error('[DailyPlanPage] Failed to load plan:', err); return { data: { tasks: MOCK_TASKS } } as any }),
      trainApi.getStreak().catch((err) => { console.error('[DailyPlanPage] Failed to load streak:', err); return { data: { train_streak: 0 } } as any }),
    ]).then(([planRes, streakRes]) => {
      // Handle nested {code, data: {...}} format
      const planPayload: any = (planRes.data as any)?.data ?? planRes.data
      // Backend returns { items: [...] }, frontend expects tasks
      const rawTasks = Array.isArray(planPayload)
        ? planPayload
        : planPayload?.tasks ?? planPayload?.items ?? MOCK_TASKS
      // Normalize field names from backend snake_case to frontend camelCase
      const TASK_EMOJI: Record<string, string> = { puzzle: '\uD83E\uDDE9', lesson: '\uD83D\uDCDA', game: '\u265E' }
      const planTasks: PlanTask[] = rawTasks.map((t: any, idx: number) => ({
        id: t.id ?? String(t.index ?? idx),
        type: t.type ?? t.item_type ?? 'puzzle',
        title: t.title ?? '',
        description: t.description ?? '',
        emoji: t.emoji ?? TASK_EMOJI[t.item_type ?? t.type ?? 'puzzle'] ?? '\uD83C\uDFAF',
        link: t.link ?? '/',
        completed: t.completed ?? t.is_completed ?? false,
      }))
      setTasks(planTasks)
      trainStore.setDailyTasks(planTasks.map((t: PlanTask) => ({
        id: t.id, type: t.type, title: t.title, completed: t.completed,
      })))
      const streakPayload: any = (streakRes.data as any)?.data ?? streakRes.data
      setStreakDays(streakPayload?.train_streak ?? streakPayload?.days ?? 0)
      trainStore.setStreak(streakPayload?.train_streak ?? streakPayload?.days ?? 0)
    }).finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const completedCount = tasks.filter((t) => t.completed).length
  const totalCount = tasks.length
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const handleCompleteTask = useCallback(async (idx: number) => {
    try {
      await trainApi.completeItem(idx)
    } catch (err) { console.error('[DailyPlanPage] Failed to complete task:', err) }
    setTasks((prev) => prev.map((t, i) => i === idx ? { ...t, completed: true } : t))
    trainStore.completeTask(tasks[idx]?.id)
    trainStore.addXP(30)
  }, [tasks, trainStore])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-3">{'\uD83C\uDFAF'}</div>
          <p className="text-[var(--text-muted)] text-[var(--text-sm)]">加载训练计划...</p>
        </div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-5xl">{'\uD83C\uDF89'}</div>
        <p className="text-[var(--text-sub)] text-lg">今日暂无训练任务</p>
        <p className="text-[var(--text-muted)] text-sm">明天再来看看吧！</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
            {'\uD83C\uDFAF'} 今日训练
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--text-sub)] mt-1">
            每天坚持训练，棋力稳步提升！
          </p>
        </div>
        <StreakBadge days={streakDays} />
      </div>

      {/* Completion ring (simplified as progress circle) */}
      <Card padding="lg" hoverable={false}>
        <div className="flex items-center gap-6">
          {/* Progress circle */}
          <div className="relative w-24 h-24 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke="url(#grad)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${completionPercent * 2.64} 264`}
                className="transition-all duration-500"
              />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--accent)" />
                  <stop offset="100%" stopColor="var(--accent-2)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[var(--text-xl)] font-bold text-[var(--text)]">
                {completedCount}/{totalCount}
              </span>
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">
              {completedCount === totalCount
                ? '\uD83C\uDF89 今日任务全部完成！太棒了！'
                : `还有 ${totalCount - completedCount} 项任务等你完成`}
            </h3>
            <XPBar
              current={trainStore.xpToday}
              target={trainStore.xpTarget}
              className="mt-3"
            />
          </div>
        </div>
      </Card>

      {/* Task list */}
      <div className="space-y-3">
        {tasks.map((task, idx) => (
          <Card key={task.id} padding="md">
            <div className="flex items-center gap-4">
              {/* Checkbox */}
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center text-lg shrink-0 transition-all"
                style={{
                  background: task.completed
                    ? 'linear-gradient(135deg, var(--success), #34d399)'
                    : 'var(--border)',
                  color: task.completed ? '#fff' : 'var(--text-muted)',
                  cursor: task.completed ? 'default' : 'pointer',
                }}
                onClick={() => !task.completed && handleCompleteTask(idx)}
              >
                {task.completed ? '\u2713' : ''}
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{task.emoji}</span>
                  <span
                    className="text-[var(--text-md)] font-semibold"
                    style={{
                      color: task.completed ? 'var(--text-muted)' : 'var(--text)',
                      textDecoration: task.completed ? 'line-through' : 'none',
                    }}
                  >
                    {task.title}
                  </span>
                </div>
                <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-0.5">
                  {task.description}
                </p>
              </div>

              {/* Go button */}
              <Button
                variant={task.completed ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => navigate(task.link)}
              >
                {task.completed ? '再去看看' : '去完成'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Stats link */}
      <div className="text-center">
        <Button variant="secondary" size="sm" onClick={() => navigate('/train/stats')}>
          {'\uD83D\uDCCA'} 查看训练统计
        </Button>
      </div>
    </div>
  )
}

export default DailyPlanPage
