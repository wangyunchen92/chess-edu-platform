import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { learnApi } from '@/api/learn'
import Card from '@/components/common/Card'
import Badge from '@/components/common/Badge'
import ProgressBar from '@/components/common/ProgressBar'

interface Lesson {
  id: string
  title: string
  completed: boolean
}

interface Course {
  id: string
  title: string
  description: string
  level: number
  emoji: string
  lessons: Lesson[]
  progress: number
  locked: boolean
  total_lessons: number
  completed_lessons: number
  prerequisite_id: string | null
}

// Level metadata
const LEVEL_CONFIG: Record<number, { emoji: string; icon: string; title: string; description: string }> = {
  0: {
    emoji: '\uD83C\uDF1F',
    icon: '\uD83C\uDF31',
    title: 'Level 0: 入门基础',
    description: '认识棋盘和棋子，学会基本规则',
  },
  1: {
    emoji: '\uD83D\uDCDA',
    icon: '⚔️',
    title: 'Level 1: 进阶提高',
    description: '掌握棋子价值与基本战术',
  },
  2: {
    emoji: '⚔️',
    icon: '\uD83D\uDCA5',
    title: 'Level 2: 基础战术',
    description: '双重攻击、牵制、闪击、串击等战术主题',
  },
  3: {
    emoji: '\uD83D\uDC51',
    icon: '\uD83C\uDFAF',
    title: 'Level 3: 中级战略',
    description: '中局计划、兵结构、开放线控制、弱格利用',
  },
}

// Determine lock reason based on prerequisite
function getLockReason(level: number): string {
  if (level === 2) return '完成 Level 1 全部课程后解锁'
  if (level === 3) return '完成 Level 2 全部课程后解锁'
  return '未解锁'
}

const CourseListPage: React.FC = () => {
  const navigate = useNavigate()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    learnApi.getCourses()
      .then(async (res) => {
        const raw = res?.data as any
        const data = raw?.data ?? raw?.courses ?? raw
        if (Array.isArray(data) && data.length > 0) {
          // Fetch course details in parallel to get lessons for each course
          const detailResults = await Promise.allSettled(
            data.map((c: any) => learnApi.getCourseDetail(c.id ?? c.slug))
          )
          const normalized: Course[] = data.map((c: any, i: number) => {
            let lessons: Lesson[] = []
            const detailResult = detailResults[i]
            if (detailResult.status === 'fulfilled') {
              const detailRaw = detailResult.value?.data as any
              const detail = detailRaw?.data ?? detailRaw
              if (detail?.lessons && Array.isArray(detail.lessons)) {
                lessons = detail.lessons.map((l: any) => ({
                  id: l.id,
                  title: l.title ?? '',
                  completed: l.status === 'completed' || l.progress_pct === 100,
                }))
              }
            }
            return {
              id: c.id ?? c.slug,
              title: c.title ?? '',
              description: c.description ?? '',
              level: c.level ?? 0,
              emoji: LEVEL_CONFIG[c.level]?.emoji ?? '\uD83D\uDCD6',
              lessons,
              progress: c.progress_pct ?? c.progress ?? 0,
              locked: c.locked ?? false,
              total_lessons: c.total_lessons ?? lessons.length,
              completed_lessons: c.completed_lessons ?? 0,
              prerequisite_id: c.prerequisite_id ?? null,
            }
          })
          setCourses(normalized)
        }
      })
      .catch((err) => {
        console.error('[CourseListPage] Failed to load courses:', err)
        setError('加载课程失败，请检查网络后重试')
        setCourses([])
      })
      .finally(() => setLoading(false))
  }, [])

  const courseList = Array.isArray(courses) ? courses : []

  // Group courses by level
  const groupedByLevel: Record<number, Course[]> = {}
  for (const c of courseList) {
    if (!groupedByLevel[c.level]) groupedByLevel[c.level] = []
    groupedByLevel[c.level].push(c)
  }
  const levels = Object.keys(groupedByLevel).map(Number).sort((a, b) => a - b)

  const renderCourseCard = (course: Course) => (
    <Card
      key={course.id}
      padding="lg"
      onClick={course.locked ? undefined : () => navigate(`/learn/lesson/${course.lessons?.[0]?.id ?? course.id}`)}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-[var(--radius-md)] flex items-center justify-center text-2xl shrink-0"
          style={{
            background: course.locked ? 'var(--border)' : 'var(--accent-light)',
            opacity: course.locked ? 0.5 : 1,
          }}
        >
          {course.locked ? '\uD83D\uDD12' : course.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">
              {course.title}
            </h3>
            {course.locked && <Badge color="neutral">{'未解锁'}</Badge>}
            {course.progress === 100 && <Badge color="success">{'✅ 已完成'}</Badge>}
          </div>
          <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">
            {course.description}
          </p>

          {/* Lock reason for locked courses */}
          {course.locked && (
            <div className="mt-2 px-3 py-2 rounded-[var(--radius-xs)] bg-slate-50 border border-[var(--border)]">
              <p className="text-[var(--text-xs)] text-[var(--text-muted)] flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {getLockReason(course.level)}
              </p>
            </div>
          )}

          {!course.locked && (
            <div className="mt-3">
              <ProgressBar value={course.progress} max={100} height={4} />
              <div className="flex justify-between mt-1">
                <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
                  {course.completed_lessons}/{course.total_lessons} 课时
                </span>
                <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
                  {course.progress}%
                </span>
              </div>
            </div>
          )}

          {/* Lesson list for unlocked courses */}
          {!course.locked && course.lessons.length > 0 && (
            <div className="mt-3 space-y-1">
              {course.lessons.map((lesson, i) => (
                <button
                  key={lesson.id}
                  className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-[var(--radius-xs)] hover:bg-[var(--accent-light)] transition-colors"
                  onClick={(e) => { e.stopPropagation(); navigate(`/learn/lesson/${lesson.id}`) }}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{
                      background: lesson.completed ? 'var(--success)' : 'var(--border)',
                      color: lesson.completed ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    {lesson.completed ? '✓' : i + 1}
                  </span>
                  <span className="text-[var(--text-sm)] text-[var(--text-sub)]">{lesson.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-3">{'\uD83D\uDCDA'}</div>
          <p className="text-[var(--text-muted)] text-[var(--text-sm)]">加载课程...</p>
        </div>
      </div>
    )
  }

  if (courseList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-5xl">{'\uD83D\uDCDA'}</div>
        <p className="text-[var(--text-sub)] text-lg">
          {error ? error : '暂无课程，敬请期待'}
        </p>
        {error && (
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-full bg-[var(--accent)] text-white text-sm hover:opacity-90"
          >
            重试
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
          {'\uD83D\uDCDA'} 学习中心
        </h1>
        <p className="text-[var(--text-sm)] text-[var(--text-sub)] mt-1">
          系统学习国际象棋，从入门到精通！
        </p>
      </div>

      {levels.map((level) => {
        const config = LEVEL_CONFIG[level]
        const coursesInLevel = groupedByLevel[level]
        return (
          <div key={level}>
            <h2 className="text-[var(--text-lg)] font-bold text-[var(--text)] mb-1 flex items-center gap-2">
              <span className="text-lg">{config?.icon ?? '\uD83D\uDCD6'}</span> {config?.title ?? `Level ${level}`}
            </h2>
            {config?.description && (
              <p className="text-[var(--text-xs)] text-[var(--text-muted)] mb-3">{config.description}</p>
            )}
            <div className="space-y-3">
              {coursesInLevel.map(renderCourseCard)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default CourseListPage
