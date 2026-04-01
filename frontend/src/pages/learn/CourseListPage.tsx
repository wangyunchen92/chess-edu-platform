import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { learnApi } from '@/api/learn'
import Card from '@/components/common/Card'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import ProgressBar from '@/components/common/ProgressBar'
import type { ExerciseOverviewResponse, ExerciseOverviewLesson } from '@/types/api'

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

type TabType = 'courses' | 'exercises'

// ────────────────────────────────────────────────────────────────
// Exercise Overview Sub-view
// ────────────────────────────────────────────────────────────────

const ExercisesOverview: React.FC = () => {
  const navigate = useNavigate()
  const [data, setData] = useState<ExerciseOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsedLevels, setCollapsedLevels] = useState<Record<number, boolean>>({})

  useEffect(() => {
    setLoading(true)
    learnApi.getExercisesOverview()
      .then((res) => {
        const payload = (res.data as any)?.data ?? res.data
        // Backend returns array of courses; transform to { summary, lessons }
        if (Array.isArray(payload)) {
          const allLessons: ExerciseOverviewLesson[] = []
          for (const course of payload) {
            for (const l of (course.lessons ?? [])) {
              allLessons.push({
                lesson_id: l.lesson_id,
                lesson_title: l.lesson_title,
                course_id: course.course_id,
                course_title: course.course_title,
                level: course.course_level,
                total_exercises: l.exercise_count ?? l.total ?? 0,
                completed_exercises: l.completed_count ?? 0,
                correct_count: l.score ?? 0,
                status: l.status ?? 'not_started',
                lesson_learned: l.lesson_learned ?? false,
              })
            }
          }
          const total = allLessons.reduce((s, l) => s + l.total_exercises, 0)
          const completed = allLessons.reduce((s, l) => s + l.completed_exercises, 0)
          const correct = allLessons.reduce((s, l) => s + l.correct_count, 0)
          setData({
            summary: {
              total_exercises: total,
              completed_exercises: completed,
              accuracy_pct: completed > 0 ? Math.round((correct / completed) * 100) : 0,
            },
            lessons: allLessons,
          })
        } else if (payload) {
          setData(payload)
        }
      })
      .catch((err) => {
        console.error('[ExercisesOverview] Failed to load:', err)
        setError('加载练习概览失败，请检查网络后重试')
      })
      .finally(() => setLoading(false))
  }, [])

  const toggleLevel = (level: number) => {
    setCollapsedLevels((prev) => ({ ...prev, [level]: !prev[level] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-3">{'\u270D\uFE0F'}</div>
          <p className="text-[var(--text-muted)] text-[var(--text-sm)]">加载练习数据...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <div className="text-5xl">{'\u270D\uFE0F'}</div>
        <p className="text-[var(--text-sub)] text-lg">{error ?? '暂无练习数据'}</p>
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

  const { summary, lessons } = data

  // Group lessons by level
  const groupedByLevel: Record<number, ExerciseOverviewLesson[]> = {}
  for (const l of lessons) {
    if (!groupedByLevel[l.level]) groupedByLevel[l.level] = []
    groupedByLevel[l.level].push(l)
  }
  const levels = Object.keys(groupedByLevel).map(Number).sort((a, b) => a - b)

  const statusBadge = (status: ExerciseOverviewLesson['status']) => {
    switch (status) {
      case 'completed':
        return <Badge color="success">已完成</Badge>
      case 'in_progress':
        return <Badge color="info">进行中</Badge>
      case 'not_started':
      default:
        return <Badge color="neutral">未开始</Badge>
    }
  }

  return (
    <div className="space-y-5">
      {/* Summary card */}
      <Card padding="lg" hoverable={false}>
        <div className="flex items-center justify-around text-center">
          <div>
            <div className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
              {summary.total_exercises}
            </div>
            <div className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">总题数</div>
          </div>
          <div className="w-px h-10 bg-[var(--border)]" />
          <div>
            <div className="text-[var(--text-2xl)] font-bold text-[var(--success)]">
              {summary.completed_exercises}
            </div>
            <div className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">已完成</div>
          </div>
          <div className="w-px h-10 bg-[var(--border)]" />
          <div>
            <div className="text-[var(--text-2xl)] font-bold text-[var(--accent)]">
              {summary.accuracy_pct}%
            </div>
            <div className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">正确率</div>
          </div>
        </div>
      </Card>

      {/* Grouped by level */}
      {levels.map((level) => {
        const config = LEVEL_CONFIG[level]
        const lessonsInLevel = groupedByLevel[level]
        const collapsed = !!collapsedLevels[level]

        return (
          <div key={level}>
            <button
              onClick={() => toggleLevel(level)}
              className="w-full flex items-center justify-between py-2 text-left group"
            >
              <h2 className="text-[var(--text-lg)] font-bold text-[var(--text)] flex items-center gap-2">
                <span className="text-lg">{config?.icon ?? '\uD83D\uDCD6'}</span>
                {config?.title ?? `Level ${level}`}
                <span className="text-[var(--text-xs)] text-[var(--text-muted)] font-normal">
                  ({lessonsInLevel.length} 课)
                </span>
              </h2>
              <span
                className="text-[var(--text-muted)] transition-transform duration-200"
                style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>

            {!collapsed && (
              <div className="space-y-2 mt-1">
                {lessonsInLevel.map((lesson) => (
                  <Card key={lesson.lesson_id} padding="sm" hoverable={false}>
                    <div className="flex items-center gap-3">
                      {/* Lesson title */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[var(--text-sm)] font-medium text-[var(--text)] truncate">
                            {lesson.lesson_title}
                          </span>
                          {statusBadge(lesson.status)}
                        </div>

                        {/* Progress bar */}
                        <div className="mt-2">
                          <ProgressBar
                            value={lesson.completed_exercises}
                            max={lesson.total_exercises || 1}
                            height={4}
                          />
                          <div className="flex justify-between mt-1">
                            <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
                              {lesson.completed_exercises}/{lesson.total_exercises} 题
                            </span>
                            <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
                              得分 {lesson.correct_count}/{lesson.total_exercises}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action button */}
                      <div className="shrink-0 flex items-center">
                        {lesson.lesson_learned ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigate(`/learn/exercise/${lesson.lesson_id}`)}
                          >
                            做练习
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/learn/lesson/${lesson.lesson_id}`)}
                          >
                            先去学习
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {lessons.length === 0 && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          暂无练习数据
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────

const CourseListPage: React.FC = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('courses')
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

  // ── Tab bar ──────────────────────────────────────────────────

  const renderTabs = () => (
    <div className="flex gap-0 border-b border-[var(--border)] mb-5">
      {([
        { key: 'courses' as TabType, label: '课程' },
        { key: 'exercises' as TabType, label: '课后练习' },
      ]).map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={[
            'relative px-5 py-2.5 text-[var(--text-sm)] font-semibold transition-colors',
            activeTab === tab.key
              ? 'text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-sub)]',
          ].join(' ')}
        >
          {tab.label}
          {activeTab === tab.key && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)] rounded-t" />
          )}
        </button>
      ))}
    </div>
  )

  // ── Course loading / empty states ────────────────────────────

  if (loading && activeTab === 'courses') {
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
        {renderTabs()}
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center">
            <div className="text-4xl animate-bounce mb-3">{'\uD83D\uDCDA'}</div>
            <p className="text-[var(--text-muted)] text-[var(--text-sm)]">加载课程...</p>
          </div>
        </div>
      </div>
    )
  }

  if (courseList.length === 0 && activeTab === 'courses' && !loading) {
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
        {renderTabs()}
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
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

      {renderTabs()}

      {activeTab === 'courses' && (
        <>
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
        </>
      )}

      {activeTab === 'exercises' && <ExercisesOverview />}
    </div>
  )
}

export default CourseListPage
