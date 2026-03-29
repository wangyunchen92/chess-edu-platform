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
}

const MOCK_COURSES: Course[] = [
  {
    id: 'c1', title: '国际象棋入门', description: '认识棋盘、棋子和基本规则', level: 0, emoji: '\uD83C\uDF1F',
    lessons: [
      { id: 'l1', title: '认识棋盘', completed: true },
      { id: 'l2', title: '棋子的走法', completed: true },
      { id: 'l3', title: '特殊规则', completed: false },
      { id: 'l4', title: '将军与将杀', completed: false },
    ],
    progress: 50, locked: false,
  },
  {
    id: 'c2', title: '开局基础', description: '学习开局原则和常见开局', level: 0, emoji: '\uD83D\uDCDA',
    lessons: [
      { id: 'l5', title: '开局三原则', completed: false },
      { id: 'l6', title: '意大利开局', completed: false },
      { id: 'l7', title: '西班牙开局', completed: false },
    ],
    progress: 0, locked: false,
  },
  {
    id: 'c3', title: '战术训练', description: '学习叉子、钉子、串击等战术', level: 1, emoji: '\u2694\uFE0F',
    lessons: [
      { id: 'l8', title: '双重攻击（叉子）', completed: false },
      { id: 'l9', title: '钉子战术', completed: false },
      { id: 'l10', title: '串击战术', completed: false },
      { id: 'l11', title: '引离和引入', completed: false },
    ],
    progress: 0, locked: false,
  },
  {
    id: 'c4', title: '残局技巧', description: '掌握常见残局的胜法', level: 1, emoji: '\uD83D\uDC51',
    lessons: [
      { id: 'l12', title: '王兵残局', completed: false },
      { id: 'l13', title: '车残局基础', completed: false },
    ],
    progress: 0, locked: true,
  },
]

const CourseListPage: React.FC = () => {
  const navigate = useNavigate()
  const [courses, setCourses] = useState<Course[]>(MOCK_COURSES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    learnApi.getCourses()
      .then(async (res) => {
        // Handle nested API response: {code, message, data: [...]}
        const raw = res?.data as any
        const data = raw?.data ?? raw?.courses ?? raw
        if (Array.isArray(data) && data.length > 0) {
          // Fetch course details in parallel to get lessons for each course
          const LEVEL_EMOJI: Record<number, string> = { 0: '🌟', 1: '📚', 2: '⚔️', 3: '👑' }
          const detailResults = await Promise.allSettled(
            data.map((c: any) => learnApi.getCourseDetail(c.id ?? c.slug))
          )
          const normalized: Course[] = data.map((c: any, i: number) => {
            // Try to get lessons from detail response
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
              emoji: c.emoji ?? LEVEL_EMOJI[c.level] ?? '📖',
              lessons,
              progress: c.progress_pct ?? c.progress ?? 0,
              locked: c.locked ?? false,
              total_lessons: c.total_lessons ?? (c.lessons?.length ?? 0),
              completed_lessons: c.completed_lessons ?? 0,
            }
          })
          setCourses(normalized)
        }
        // If not array or empty, keep MOCK_COURSES from initial state
      })
      .catch((err) => { console.error('[CourseListPage] Failed to load courses:', err) })
      .finally(() => setLoading(false))
  }, [])

  const courseList = Array.isArray(courses) ? courses : MOCK_COURSES
  const level0 = courseList.filter((c) => c.level === 0)
  const level1 = courseList.filter((c) => c.level === 1)

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
          <div className="flex items-center gap-2">
            <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)]">
              {course.title}
            </h3>
            {course.locked && <Badge color="neutral">未解锁</Badge>}
            {course.progress === 100 && <Badge color="success">{'\u2705'} 已完成</Badge>}
          </div>
          <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">
            {course.description}
          </p>
          {!course.locked && (
            <div className="mt-3">
              <ProgressBar value={course.progress} max={100} height={4} />
              <div className="flex justify-between mt-1">
                <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
                  {(course as any).completed_lessons ?? course.lessons?.filter((l) => l.completed).length ?? 0}/{(course as any).total_lessons ?? course.lessons?.length ?? 0} 课时
                </span>
                <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
                  {course.progress}%
                </span>
              </div>
            </div>
          )}
          {/* Lesson list */}
          {!course.locked && (
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
                    {lesson.completed ? '\u2713' : i + 1}
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
        <p className="text-[var(--text-sub)] text-lg">暂无课程，敬请期待</p>
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

      {/* Level 0 */}
      <div>
        <h2 className="text-[var(--text-lg)] font-bold text-[var(--text)] mb-3 flex items-center gap-2">
          <span className="text-lg">{'\uD83C\uDF31'}</span> Level 0: 入门基础
        </h2>
        <div className="space-y-3">
          {level0.map(renderCourseCard)}
        </div>
      </div>

      {/* Level 1 */}
      <div>
        <h2 className="text-[var(--text-lg)] font-bold text-[var(--text)] mb-3 flex items-center gap-2">
          <span className="text-lg">{'\u2694\uFE0F'}</span> Level 1: 进阶提高
        </h2>
        <div className="space-y-3">
          {level1.map(renderCourseCard)}
        </div>
      </div>
    </div>
  )
}

export default CourseListPage
