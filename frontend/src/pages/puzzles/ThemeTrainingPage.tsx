import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { puzzlesApi } from '@/api/puzzles'
import type { ThemeItem } from '@/types/api'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'
import Badge from '@/components/common/Badge'
import ProgressBar from '@/components/common/ProgressBar'
import Loading from '@/components/common/Loading'

// Theme name mapping (English key -> Chinese display name)
const THEME_NAMES: Record<string, string> = {
  fork: '双攻',
  pin: '牵制',
  skewer: '串击',
  discoveredAttack: '闪击',
  doubleCheck: '双将',
  hangingPiece: '悬子',
  trappedPiece: '困子',
  mateIn1: '一步杀',
  mateIn2: '两步杀',
  mateIn3: '三步杀',
  backRankMate: '底线杀',
  smotheredMate: '闷杀',
  hookMate: '钩杀',
  mate: '将杀',
  sacrifice: '弃子',
  deflection: '引离',
  decoy: '引入',
  intermezzo: '中间着',
  quietMove: '安静着',
  xRayAttack: 'X光攻击',
  capturingDefender: '吃掉防守者',
  pawnEndgame: '兵残局',
  rookEndgame: '车残局',
  queenEndgame: '后残局',
  bishopEndgame: '象残局',
  knightEndgame: '马残局',
  endgame: '残局',
}

const CATEGORIES = [
  { key: 'basic_tactics', title: '基础战术', emoji: '\u2694\uFE0F', description: '双攻、牵制、串击等基本战术' },
  { key: 'checkmate', title: '将杀训练', emoji: '\uD83D\uDC51', description: '各种将杀模式' },
  { key: 'advanced_tactics', title: '高级战术', emoji: '\uD83C\uDFAF', description: '弃子、引离、中间着等进阶战术' },
  { key: 'endgame', title: '残局训练', emoji: '\u265F\uFE0F', description: '各类残局技巧' },
]

const ThemeTrainingPage: React.FC = () => {
  const navigate = useNavigate()
  const [themes, setThemes] = useState<ThemeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(CATEGORIES.map((c) => c.key))
  )

  useEffect(() => {
    setLoading(true)
    setError(null)
    puzzlesApi.getThemes()
      .then((res) => {
        const payload: any = (res.data as any)?.data ?? res.data
        const list = Array.isArray(payload) ? payload : []
        setThemes(list)
      })
      .catch((err) => {
        console.error('[ThemeTrainingPage] Failed to load themes:', err)
        setError('加载主题列表失败，请稍后重试')
      })
      .finally(() => setLoading(false))
  }, [])

  const grouped = useMemo(() => {
    const map: Record<string, ThemeItem[]> = {}
    for (const cat of CATEGORIES) {
      map[cat.key] = []
    }
    map['other'] = []
    for (const t of themes) {
      const cat = t.category || 'other'
      if (map[cat]) {
        map[cat].push(t)
      } else {
        map['other'].push(t)
      }
    }
    return map
  }, [themes])

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  if (loading) {
    return <Loading size="lg" text="加载专项训练..." />
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
            {'\u2694\uFE0F'} 专项训练
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--text-sub)] mt-1">
            按战术主题针对性练习
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/puzzles')}>
          返回
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <Card padding="lg" hoverable={false}>
          <div className="text-center space-y-3">
            <p className="text-[var(--text-sub)]">{error}</p>
            <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
              重新加载
            </Button>
          </div>
        </Card>
      )}

      {/* Category cards */}
      {!error && CATEGORIES.map((cat) => {
        const catThemes = grouped[cat.key] || []
        if (catThemes.length === 0) return null
        const isExpanded = expandedCategories.has(cat.key)
        const totalCount = catThemes.reduce((sum, t) => sum + t.count, 0)
        const totalAttempted = catThemes.reduce((sum, t) => sum + t.attempted, 0)

        return (
          <Card key={cat.key} padding="none" hoverable={false}>
            {/* Category header - clickable to toggle */}
            <button
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--bg-hover)] transition-colors rounded-t-[var(--radius-md)]"
              onClick={() => toggleCategory(cat.key)}
            >
              <span className="text-2xl">{cat.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-[var(--text-md)] font-bold text-[var(--text)]">
                    {cat.title}
                  </h2>
                  <Badge color="neutral">{catThemes.length} 个主题</Badge>
                </div>
                <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-0.5">
                  {cat.description} {'\u00B7'} 共 {totalCount} 题 {'\u00B7'} 已做 {totalAttempted} 题
                </p>
              </div>
              <span
                className="text-[var(--text-muted)] transition-transform duration-200"
                style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                {'\u25BC'}
              </span>
            </button>

            {/* Theme list */}
            {isExpanded && (
              <div className="border-t border-[var(--border)]">
                {catThemes.map((theme) => (
                  <div
                    key={theme.theme}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors border-b border-[var(--border)] last:border-b-0"
                    onClick={() => navigate(`/puzzles/theme/${theme.theme}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-sm)] font-semibold text-[var(--text)]">
                          {THEME_NAMES[theme.theme] || theme.name || theme.theme}
                        </span>
                        <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
                          {theme.count} 题
                        </span>
                      </div>
                      {/* Progress bar */}
                      {theme.attempted > 0 ? (
                        <div className="mt-1.5">
                          <ProgressBar
                            value={theme.correct}
                            max={theme.count}
                            height={4}
                          />
                        </div>
                      ) : (
                        <div className="mt-1.5">
                          <ProgressBar value={0} max={100} height={4} />
                        </div>
                      )}
                    </div>
                    {/* Stats */}
                    <div className="text-right shrink-0">
                      {theme.attempted > 0 ? (
                        <>
                          <div className="text-[var(--text-xs)] text-[var(--text-muted)]">
                            已做 {theme.attempted}
                          </div>
                          <div className="text-[var(--text-xs)] font-semibold" style={{
                            color: theme.accuracy >= 80 ? 'var(--success)' : theme.accuracy >= 50 ? 'var(--warning)' : 'var(--danger)'
                          }}>
                            {theme.accuracy}% 正确率
                          </div>
                        </>
                      ) : (
                        <Badge color="neutral">未开始</Badge>
                      )}
                    </div>
                    <div className="text-[var(--text-muted)] text-sm shrink-0">{'\u203A'}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )
      })}

      {/* Empty state */}
      {!error && !loading && themes.length === 0 && (
        <Card padding="lg" hoverable={false}>
          <div className="text-center py-6">
            <div className="text-4xl mb-3">{'\uD83D\uDCDA'}</div>
            <p className="text-[var(--text-sub)]">暂无可用训练主题</p>
          </div>
        </Card>
      )}
    </div>
  )
}

export default ThemeTrainingPage
