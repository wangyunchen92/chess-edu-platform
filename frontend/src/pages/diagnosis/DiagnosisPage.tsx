import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { diagnosisApi } from '@/api/diagnosis'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'
import Badge from '@/components/common/Badge'
import Loading from '@/components/common/Loading'
import type {
  DiagnosisProfileResponse,
  DiagnosisScores,
  RecommendationItem,
} from '@/types/api'

// ---------------------------------------------------------------------------
// Dimension metadata
// ---------------------------------------------------------------------------

interface DimensionMeta {
  key: keyof DiagnosisScores
  label: string
  emoji: string
  description: string
}

const DIMENSIONS: DimensionMeta[] = [
  { key: 'opening', label: '开局', emoji: '\uD83C\uDFAC', description: '开局原则和布局知识' },
  { key: 'middlegame_tactics', label: '中局战术', emoji: '⚔️', description: '战术计算和组合招法' },
  { key: 'middlegame_strategy', label: '中局战略', emoji: '\uD83C\uDFAF', description: '位置判断和长期计划' },
  { key: 'endgame', label: '残局', emoji: '\uD83D\uDC51', description: '残局技巧和兵的使用' },
  { key: 'time_management', label: '时间管理', emoji: '⏰', description: '用时分配和决策速度' },
]

// Theme labels
const THEME_LABELS: Record<string, string> = {
  fork: '双重攻击',
  pin: '牵制',
  skewer: '串击',
  discoveredAttack: '闪击',
  doubleCheck: '双将',
  hangingPiece: '悬子',
  trappedPiece: '困子',
  backRankMate: '底线杀',
  smotheredMate: '闷杀',
  hookMate: '钩杀',
  arabianMate: '阿拉伯杀',
  anastasiaMate: '安娜杀',
  doubleBishopMate: '双象杀',
  pillsburysMate: '皮尔斯伯里杀',
  killBoxMate: '围杀',
  operaMate: '歌剧杀',
  deflection: '引开',
  decoy: '引入',
  sacrifice: '弃子',
  intermezzo: '中间着',
  quietMove: '安静着',
  xRayAttack: 'X光攻击',
  capturingDefender: '吃掉防守者',
  mate: '将杀',
  mateIn1: '一步杀',
  mateIn2: '两步杀',
  mateIn3: '三步杀',
  checkmate: '将杀',
  endgame: '残局',
  opening: '开局',
  middlegame: '中局',
  master: '大师级',
  masterVsMaster: '大师对决',
  short: '短局',
  long: '长局',
  crushing: '碾压',
  advantage: '优势',
  promotion: '升变',
  castling: '王车易位',
  kingsideAttack: '王翼攻击',
  queensideAttack: '后翼攻击',
  exposedKing: '暴露王',
  pawnEndgame: '兵残局',
  rookEndgame: '车残局',
  queenEndgame: '后残局',
  bishopEndgame: '象残局',
  knightEndgame: '马残局',
  oneMove: '一步解',
  defensiveMove: '防守着',
}

// Recommendation type routing
function getRecommendationLink(rec: RecommendationItem): string {
  switch (rec.recommendation_type) {
    case 'puzzle_theme':
      return '/puzzles'
    case 'course':
      return rec.target_id ? `/learn` : '/learn'
    case 'training_plan':
      return '/train'
    case 'practice_game':
      return '/play'
    default:
      return '/'
  }
}

function getRecommendationEmoji(type: string): string {
  switch (type) {
    case 'puzzle_theme': return '\uD83E\uDDE9'
    case 'course': return '\uD83D\uDCDA'
    case 'training_plan': return '\uD83C\uDFAF'
    case 'practice_game': return '♞'
    default: return '\uD83D\uDCA1'
  }
}

// ---------------------------------------------------------------------------
// Radar Chart (SVG)
// ---------------------------------------------------------------------------

interface RadarChartProps {
  scores: DiagnosisScores
}

const RadarChart: React.FC<RadarChartProps> = ({ scores }) => {
  const size = 340
  const center = size / 2
  const radius = 100
  const levels = [20, 40, 60, 80, 100]

  const dims = DIMENSIONS
  const angleStep = (Math.PI * 2) / dims.length
  // Start from top (- PI/2)
  const startAngle = -Math.PI / 2

  const getPoint = (angle: number, r: number): [number, number] => {
    return [
      center + r * Math.cos(angle),
      center + r * Math.sin(angle),
    ]
  }

  // Build polygon points for a given set of values
  const buildPolygon = (values: number[]): string => {
    return values.map((val, i) => {
      const angle = startAngle + i * angleStep
      const r = (val / 100) * radius
      const [x, y] = getPoint(angle, r)
      return `${x},${y}`
    }).join(' ')
  }

  const scoreValues = dims.map((d) => scores[d.key] ?? 50)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {/* Background levels */}
      {levels.map((level) => (
        <polygon
          key={level}
          points={dims.map((_, i) => {
            const angle = startAngle + i * angleStep
            const r = (level / 100) * radius
            const [x, y] = getPoint(angle, r)
            return `${x},${y}`
          }).join(' ')}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1"
          opacity={0.5}
        />
      ))}

      {/* Axis lines */}
      {dims.map((_, i) => {
        const angle = startAngle + i * angleStep
        const [x, y] = getPoint(angle, radius)
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            stroke="var(--border)"
            strokeWidth="1"
            opacity={0.3}
          />
        )
      })}

      {/* Score polygon */}
      <polygon
        points={buildPolygon(scoreValues)}
        fill="var(--accent)"
        fillOpacity={0.15}
        stroke="var(--accent)"
        strokeWidth="2"
      />

      {/* Score dots */}
      {scoreValues.map((val, i) => {
        const angle = startAngle + i * angleStep
        const r = (val / 100) * radius
        const [x, y] = getPoint(angle, r)
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={4}
            fill="var(--accent)"
            stroke="white"
            strokeWidth="2"
          />
        )
      })}

      {/* Labels */}
      {dims.map((dim, i) => {
        const angle = startAngle + i * angleStep
        const labelR = radius + 30
        const [x, y] = getPoint(angle, labelR)
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[12px] font-medium"
            fill="var(--text-sub)"
          >
            {dim.label}
          </text>
        )
      })}

      {/* Score values */}
      {scoreValues.map((val, i) => {
        const angle = startAngle + i * angleStep
        const labelR = radius + 50
        const [x, y] = getPoint(angle, labelR)
        return (
          <text
            key={`v-${i}`}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[10px] font-bold"
            fill={val < 40 ? 'var(--danger)' : val < 60 ? 'var(--warning)' : 'var(--success)'}
          >
            {val}
          </text>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Score Bar
// ---------------------------------------------------------------------------

const ScoreBar: React.FC<{ label: string; score: number; emoji: string }> = ({ label, score, emoji }) => {
  const color = score < 40 ? 'var(--danger)' : score < 60 ? 'var(--warning)' : 'var(--success)'
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg shrink-0">{emoji}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[var(--text-sm)] text-[var(--text)]">{label}</span>
          <span className="text-[var(--text-sm)] font-bold" style={{ color }}>{score}</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${score}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const DiagnosisPage: React.FC = () => {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<DiagnosisProfileResponse | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [profileRes, recRes] = await Promise.allSettled([
        diagnosisApi.getProfile(),
        diagnosisApi.getRecommendations(),
      ])

      if (profileRes.status === 'fulfilled') {
        const data = (profileRes.value.data as any)?.data ?? profileRes.value.data
        setProfile(data)
      } else {
        setError('加载诊断数据失败')
      }

      if (recRes.status === 'fulfilled') {
        const data = (recRes.value.data as any)?.data ?? recRes.value.data
        setRecommendations(Array.isArray(data) ? data : [])
      }
    } catch (err: any) {
      setError(err?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true)
    try {
      await diagnosisApi.analyze({ force: true })
      await loadData()
    } catch {
      // ignore
    } finally {
      setAnalyzing(false)
    }
  }, [loadData])

  if (loading) {
    return <Loading size="lg" text="加载弱点诊断..." />
  }

  // Data insufficient state
  const isInsufficient = !profile || profile.confidence === 'low' || !profile.scores

  if (isInsufficient) {
    const gamesNeeded = (profile?.min_games_required ?? 10) - (profile?.games_analyzed ?? 0)
    const puzzlesNeeded = (profile?.min_puzzles_required ?? 30) - (profile?.puzzles_analyzed ?? 0)

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
            {'\uD83D\uDD0D'} 弱点诊断
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--text-sub)] mt-1">
            分析你的对弈和解题数据，找出薄弱环节
          </p>
        </div>

        <Card padding="lg">
          <div className="flex flex-col items-center text-center py-8 gap-4">
            <div className="text-6xl">{'\uD83E\uDDD0'}</div>
            <h2 className="text-[var(--text-xl)] font-bold text-[var(--text)]">
              再下几局棋就能看到你的弱点分析了
            </h2>
            <p className="text-[var(--text-sm)] text-[var(--text-sub)] max-w-md">
              {profile?.message ?? '需要更多对弈和解题数据才能生成准确的弱点诊断'}
            </p>

            <div className="flex items-center gap-6 mt-2">
              {gamesNeeded > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-[var(--accent)]">{gamesNeeded}</div>
                  <div className="text-[var(--text-xs)] text-[var(--text-muted)]">还需对弈</div>
                </div>
              )}
              {puzzlesNeeded > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-[var(--accent-2)]">{puzzlesNeeded}</div>
                  <div className="text-[var(--text-xs)] text-[var(--text-muted)]">还需解题</div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-4">
              <Button variant="primary" onClick={() => navigate('/play')}>
                去对弈
              </Button>
              <Button variant="secondary" onClick={() => navigate('/puzzles')}>
                去解题
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const scores = profile.scores!
  const themeScores = profile.theme_scores ?? {}
  const weakest = profile.weakest_dimensions ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
            {'\uD83D\uDD0D'} 弱点诊断
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--text-sub)] mt-1">
            基于 {profile.games_analyzed} 局对弈和 {profile.puzzles_analyzed} 道谜题的分析
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={profile.confidence === 'high' ? 'success' : profile.confidence === 'medium' ? 'warning' : 'neutral'}>
            {profile.confidence === 'high' ? '高可信度' : profile.confidence === 'medium' ? '基本可信' : '数据不足'}
          </Badge>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={analyzing}
              onClick={handleAnalyze}
            >
              重新分析
            </Button>
            <span className="inline-flex items-center gap-1 text-[var(--text-xs)] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
              {'\uD83D\uDCB0'} 消耗 30 积分
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-[var(--radius-sm)] bg-[rgba(239,68,68,0.1)] text-[var(--danger)] text-[var(--text-sm)]">
          {error}
        </div>
      )}

      {/* Radar Chart + Score Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-4">能力雷达图</h3>
          <RadarChart scores={scores} />
        </Card>

        <Card padding="lg">
          <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-4">各维度详情</h3>
          <div className="space-y-4">
            {DIMENSIONS.map((dim) => (
              <ScoreBar
                key={dim.key}
                label={dim.label}
                score={scores[dim.key]}
                emoji={dim.emoji}
              />
            ))}
          </div>
        </Card>
      </div>

      {/* Weakest dimensions highlight */}
      {weakest.length > 0 && (
        <Card padding="lg">
          <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-3">
            {'⚠️'} 薄弱环节
          </h3>
          <div className="flex flex-wrap gap-2">
            {weakest.map((w) => {
              const dim = DIMENSIONS.find((d) => d.key === w)
              const themeLabel = THEME_LABELS[w]
              return (
                <Badge key={w} color="danger">
                  {dim?.emoji ?? '⚠️'} {dim?.label ?? themeLabel ?? w}
                </Badge>
              )
            })}
          </div>
        </Card>
      )}

      {/* Theme scores breakdown */}
      {Object.keys(themeScores).length > 0 && (
        <Card padding="lg">
          <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-3">
            {'\uD83E\uDDE9'} 战术主题正确率
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(themeScores)
              .sort(([, a], [, b]) => a.score - b.score)
              .map(([theme, data]) => (
                <div
                  key={theme}
                  className="px-3 py-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-card)]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[var(--text-xs)] font-medium text-[var(--text)]">
                      {THEME_LABELS[theme] ?? theme}
                    </span>
                    <span
                      className="text-[var(--text-xs)] font-bold"
                      style={{ color: data.score < 40 ? 'var(--danger)' : data.score < 60 ? 'var(--warning)' : 'var(--success)' }}
                    >
                      {data.score}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${data.score}%`,
                        backgroundColor: data.score < 40 ? 'var(--danger)' : data.score < 60 ? 'var(--warning)' : 'var(--success)',
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-1">
                    {data.correct}/{data.total} 正确
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card padding="lg">
          <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-3">
            {'\uD83D\uDCA1'} 推荐训练
          </h3>
          <div className="space-y-2">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-sm)] border border-[var(--border)] hover:border-[var(--accent)] cursor-pointer transition-colors"
                onClick={() => navigate(getRecommendationLink(rec))}
              >
                <span className="text-2xl shrink-0">{getRecommendationEmoji(rec.recommendation_type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[var(--text-sm)] font-medium text-[var(--text)]">
                    {rec.target_label}
                  </div>
                  {rec.reason && (
                    <div className="text-[var(--text-xs)] text-[var(--text-muted)] mt-0.5">
                      {rec.reason}
                    </div>
                  )}
                </div>
                <Badge color={
                  rec.recommendation_type === 'puzzle_theme' ? 'warning'
                    : rec.recommendation_type === 'course' ? 'info'
                    : rec.recommendation_type === 'practice_game' ? 'primary'
                    : 'neutral'
                }>
                  {rec.recommendation_type === 'puzzle_theme' ? '谜题'
                    : rec.recommendation_type === 'course' ? '课程'
                    : rec.recommendation_type === 'practice_game' ? '对弈'
                    : '训练'}
                </Badge>
                <span className="text-[var(--text-muted)] text-sm">{'›'}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Last analyzed time */}
      {profile.last_analyzed_at && (
        <p className="text-[var(--text-xs)] text-[var(--text-muted)] text-center">
          上次分析时间：{new Date(profile.last_analyzed_at).toLocaleString('zh-CN')}
        </p>
      )}
    </div>
  )
}

export default DiagnosisPage
