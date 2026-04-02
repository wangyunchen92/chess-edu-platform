import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CharacterCard, { type CharacterCardData } from '@/components/character/CharacterCard'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import Badge from '@/components/common/Badge'
import { playApi } from '@/api/play'
import Loading from '@/components/common/Loading'
import UnlockStoryModal from '@/components/character/UnlockStoryModal'
import type { UnlockConditionItem } from '@/types/api'

// ---------------------------------------------------------------------------
// Region metadata
// ---------------------------------------------------------------------------

interface RegionInfo {
  title: string
  subtitle: string
  description: string
  emoji: string
  gradient: string
}

const REGION_META: Record<string, RegionInfo> = {
  meadow: {
    title: '启蒙草原',
    subtitle: '评分 400-800',
    description: '阳光明媚的绿色草原，适合新手冒险的温暖起点',
    emoji: '\uD83C\uDF3B',
    gradient: 'from-emerald-500/10 to-green-500/5',
  },
  forest: {
    title: '试炼森林',
    subtitle: '评分 800-1200',
    description: '茂密的树林中光影交错，挑战开始升级',
    emoji: '\uD83C\uDF32',
    gradient: 'from-teal-500/10 to-emerald-500/5',
  },
  plateau: {
    title: '风暴高原',
    subtitle: '评分 1200-1600',
    description: '高山城堡与风暴之地，只有真正的骑士才能踏足',
    emoji: '⚡',
    gradient: 'from-purple-500/10 to-indigo-500/5',
  },
  abyss: {
    title: '暗影深渊',
    subtitle: '评分 1600+',
    description: '最终领域，暗影王在此等待',
    emoji: '\uD83C\uDF11',
    gradient: 'from-slate-500/10 to-gray-500/5',
  },
}

// Tier to region mapping (fallback when API doesn't return region)
const TIER_TO_REGION: Record<string, string> = {
  beginner: 'meadow',
  intermediate: 'forest',
  advanced: 'plateau',
  expert: 'abyss',
}

// Character emoji mapping
const CHARACTER_EMOJI: Record<string, string> = {
  douding: '\uD83D\uDC30',
  mianhuatang: '\uD83E\uDDC1',
  guigui: '\uD83D\uDC22',
  dongdong: '\uD83D\uDC66',
  lihuahua: '\uD83D\uDC31',
  tiedundun: '\uD83E\uDD16',
  yinzong: '⚔️',
  gulu: '\uD83E\uDD8A',
  yunduo: '☁️',
  lieyanbird: '\uD83D\uDD25',
  qiboshi: '\uD83E\uDDD1‍\uD83C\uDF93',
  anyingwang: '\uD83D\uDC79',
}

// Play style labels
// Per-character style labels and colors (keyed by slug)
const CHARACTER_STYLE: Record<string, { label: string; color: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral' }> = {
  douding:      { label: '随机可爱',   color: 'success' },
  mianhuatang:  { label: '冲动进攻',   color: 'danger' },
  guigui:       { label: '沉稳防守',   color: 'info' },
  dongdong:     { label: '均衡踏实',   color: 'primary' },
  lihuahua:     { label: '陷阱诡计',   color: 'warning' },
  tiedundun:    { label: '防守反击',   color: 'info' },
  yinzong:      { label: '正统进攻',   color: 'danger' },
  gulu:         { label: '阴险狡诈',   color: 'purple' },
  yunduoshifu:  { label: '全能大师',   color: 'purple' },
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface CharacterGroup {
  region: string
  info: RegionInfo
  characters: CharacterCardData[]
}

// ---------------------------------------------------------------------------
// Time control options
// ---------------------------------------------------------------------------

const TIME_OPTIONS = [
  { label: '5 分钟', value: 300 },
  { label: '10 分钟', value: 600 },
  { label: '15 分钟', value: 900 },
]

// Region display order
const REGION_ORDER = ['meadow', 'forest', 'plateau', 'abyss']

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const CharacterHallPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [characterGroups, setCharacterGroups] = useState<CharacterGroup[]>([])
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null)
  const [selectedCharName, setSelectedCharName] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [selectedTime, setSelectedTime] = useState(600)
  const [difficultyMode, setDifficultyMode] = useState<string>('adaptive')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Unlock condition modal
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [unlockConditions, setUnlockConditions] = useState<UnlockConditionItem[]>([])
  const [unlockCharName, setUnlockCharName] = useState('')
  const [checkingUnlock, setCheckingUnlock] = useState(false)

  // Unlock story modal
  const [showUnlockStory, setShowUnlockStory] = useState(false)
  const [unlockStoryProps, setUnlockStoryProps] = useState<{
    characterId: string
    characterName: string
    characterEmoji: string
    storyLines: Array<{ speaker: string; text: string; emotion?: string }>
    storyText: string
  } | null>(null)

  // Fetch characters from API
  useEffect(() => {
    setLoading(true)
    setError(null)
    playApi.getCharacters()
      .then((res) => {
        const raw = res?.data as any
        const data = raw?.data ?? raw
        if (!Array.isArray(data) || data.length === 0) {
          setError('暂无角色数据')
          return
        }

        // Group by region
        const grouped: Record<string, CharacterCardData[]> = {}

        for (const c of data as any[]) {
          const region = c.region ?? TIER_TO_REGION[c.tier] ?? 'meadow'
          if (!grouped[region]) {
            grouped[region] = []
          }
          grouped[region].push({
            id: c.id ?? c.slug,
            name: c.name ?? c.slug,
            emoji: CHARACTER_EMOJI[c.slug] ?? CHARACTER_EMOJI[c.id] ?? '♟️',
            rating: c.base_rating ?? 500,
            ratingRange: c.rating_range_min && c.rating_range_max
              ? `${c.rating_range_min}-${c.rating_range_max}`
              : undefined,
            playStyle: c.play_style ?? '',
            playStyleLabel: CHARACTER_STYLE[c.slug ?? c.id]?.label ?? c.play_style?.split('，')[0] ?? '',
            playStyleColor: CHARACTER_STYLE[c.slug ?? c.id]?.color ?? 'neutral',
            styleWeights: c.styleWeights ?? { attack: 0.25, defense: 0.25, tactics: 0.25, positional: 0.25 },
            wins: c.stats?.games_won ?? 0,
            losses: c.stats?.games_lost ?? 0,
            draws: c.stats?.games_drawn ?? 0,
            locked: c.is_unlocked === false,
            unlockConditionText: c.is_unlocked === false
              ? getUnlockHint(region)
              : undefined,
            personality: c.personality ?? undefined,
          })
        }

        // Build ordered groups
        const groups: CharacterGroup[] = REGION_ORDER
          .filter((r) => grouped[r] && grouped[r].length > 0)
          .map((r) => ({
            region: r,
            info: REGION_META[r] ?? REGION_META.meadow,
            characters: grouped[r],
          }))

        setCharacterGroups(groups)
      })
      .catch((err) => {
        console.error('[CharacterHallPage] Failed to load characters:', err)
        setError(err?.message ?? '加载角色失败，请检查网络后重试')
      })
      .finally(() => setLoading(false))
  }, [])

  // Auto-select character from URL param (e.g., from UnlockStoryModal "start game" button)
  useEffect(() => {
    const autoSelect = searchParams.get('autoSelect')
    if (autoSelect && characterGroups.length > 0) {
      for (const group of characterGroups) {
        const found = group.characters.find((c) => c.id === autoSelect || c.id === String(autoSelect))
        if (found && !found.locked) {
          setSelectedCharId(found.id)
          setSelectedCharName(found.name)
          setShowModal(true)
          break
        }
      }
    }
  }, [searchParams, characterGroups])

  const handlePlay = useCallback((id: string, name: string) => {
    setSelectedCharId(id)
    setSelectedCharName(name)
    setShowModal(true)
  }, [])

  const handleLockedClick = useCallback(async (id: string, name: string) => {
    setUnlockCharName(name)
    setCheckingUnlock(true)
    setShowUnlockModal(true)
    setUnlockConditions([])

    try {
      const res = await playApi.checkUnlock(id)
      const data = (res.data as any)?.data ?? res.data
      const conditions = data?.conditions ?? []
      setUnlockConditions(conditions)

      // If all conditions are met, auto-trigger unlock
      if (conditions.length > 0 && conditions.every((c: UnlockConditionItem) => c.met)) {
        try {
          const unlockRes = await playApi.unlockCharacter(id)
          const unlockData = (unlockRes.data as any)?.data ?? unlockRes.data
          if (unlockData?.unlocked) {
            setShowUnlockModal(false)
            // Show unlock story
            const emoji = CHARACTER_EMOJI[id] ?? '\u265E'
            const storyLines = Array.isArray(unlockData.unlock_story) ? unlockData.unlock_story : []
            const storyText = typeof unlockData.unlock_story === 'string' ? unlockData.unlock_story : ''
            setUnlockStoryProps({
              characterId: id,
              characterName: unlockData.character_name ?? name,
              characterEmoji: emoji,
              storyLines,
              storyText,
            })
            setShowUnlockStory(true)
          }
        } catch {
          // Unlock attempt failed — just show conditions
        }
      }
    } catch {
      setUnlockConditions([{
        type: 'unknown',
        label: '无法获取解锁条件，请稍后重试',
        required: '',
        met: false,
      }])
    } finally {
      setCheckingUnlock(false)
    }
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!selectedCharId) return
    setCreating(true)

    try {
      const res = await playApi.createGame({
        character_id: selectedCharId,
        time_control: selectedTime,
      })
      const payload = res.data?.data ?? res.data
      const gameId = payload?.game_id ?? selectedCharId
      navigate(`/play/game/${gameId}?character=${selectedCharId}&time=${selectedTime}&difficulty=${difficultyMode}`)
    } catch {
      navigate(`/play/game/local?character=${selectedCharId}&time=${selectedTime}&difficulty=${difficultyMode}`)
    } finally {
      setCreating(false)
      setShowModal(false)
    }
  }, [selectedCharId, selectedTime, navigate])

  if (loading) {
    return <Loading size="lg" text="加载角色..." />
  }

  if (error && characterGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-5xl">{'♞'}</div>
        <p className="text-[var(--text-sub)] text-lg">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-full bg-[var(--accent)] text-white text-sm hover:opacity-90"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-[var(--text-3xl)] font-bold text-[var(--text)]">
          选择你的对手
        </h1>
        <p className="mt-1 text-[var(--text-sm)] text-[var(--text-sub)]">
          棋境大陆的伙伴们在等你，每个角色都有独特的棋风和性格
        </p>
      </div>

      {/* Character groups by region */}
      {characterGroups.map((group) => (
        <section key={group.region}>
          {/* Region header */}
          <div className={`rounded-[var(--radius-card)] bg-gradient-to-r ${group.info.gradient} p-4 mb-4 border border-[var(--border)]`}>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl">{group.info.emoji}</span>
              <div>
                <h2 className="text-[var(--text-xl)] font-semibold text-[var(--text)]">
                  {group.info.title}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
                    {group.info.subtitle}
                  </span>
                  <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
                    {'\u00B7'} {group.info.description}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {group.characters.map((char) => (
              <CharacterCard
                key={char.id}
                character={char}
                onPlay={(id) => handlePlay(id, char.name)}
                onLockedClick={(id) => handleLockedClick(id, char.name)}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Game setup modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="对局设置"
      >
        <div className="space-y-5">
          <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
            即将与 <strong className="text-[var(--text)]">{selectedCharName}</strong> 对弈
          </p>

          {/* Time control */}
          <div>
            <label className="block text-[var(--text-sm)] font-medium text-[var(--text)] mb-3">
              时间控制
            </label>
            <div className="grid grid-cols-3 gap-3">
              {TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={[
                    'py-3 rounded-[var(--radius-sm)] text-[var(--text-sm)] font-medium',
                    'border transition-all duration-150',
                    selectedTime === opt.value
                      ? 'border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--text-sub)] hover:border-[var(--accent)]',
                  ].join(' ')}
                  onClick={() => setSelectedTime(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty mode */}
          <div>
            <label className="block text-[var(--text-sm)] font-medium text-[var(--text)] mb-3">
              难度模式
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'adaptive', label: '自适应', desc: '根据战绩动态调整' },
                { value: 'fixed', label: '固定', desc: '使用角色原始难度' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  className={[
                    'py-3 px-3 rounded-[var(--radius-sm)] text-left',
                    'border transition-all duration-150',
                    difficultyMode === opt.value
                      ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                      : 'border-[var(--border)] hover:border-[var(--accent)]',
                  ].join(' ')}
                  onClick={() => setDifficultyMode(opt.value)}
                >
                  <div className={[
                    'text-[var(--text-sm)] font-medium',
                    difficultyMode === opt.value ? 'text-[var(--accent)]' : 'text-[var(--text-sub)]',
                  ].join(' ')}>
                    {opt.label}
                  </div>
                  <div className="text-[var(--text-xs)] text-[var(--text-muted)] mt-0.5">
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowModal(false)}
            >
              取消
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              loading={creating}
              onClick={handleConfirm}
            >
              开始对弈
            </Button>
          </div>
        </div>
      </Modal>

      {/* Unlock story modal */}
      {unlockStoryProps && (
        <UnlockStoryModal
          open={showUnlockStory}
          onClose={() => {
            setShowUnlockStory(false)
            // Reload page to refresh character lock states
            window.location.reload()
          }}
          characterId={unlockStoryProps.characterId}
          characterName={unlockStoryProps.characterName}
          characterEmoji={unlockStoryProps.characterEmoji}
          storyLines={unlockStoryProps.storyLines}
          storyText={unlockStoryProps.storyText}
        />
      )}

      {/* Unlock condition modal */}
      <Modal
        open={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        title={`解锁 ${unlockCharName}`}
      >
        <div className="space-y-4">
          <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
            完成以下条件即可解锁 <strong className="text-[var(--text)]">{unlockCharName}</strong>：
          </p>

          {checkingUnlock ? (
            <div className="flex items-center justify-center py-6">
              <Loading size="sm" text="检查解锁条件..." />
            </div>
          ) : (
            <div className="space-y-2">
              {unlockConditions.map((cond, i) => (
                <div
                  key={i}
                  className={[
                    'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)]',
                    cond.met ? 'bg-emerald-50' : 'bg-slate-50',
                  ].join(' ')}
                >
                  <span className="text-lg shrink-0">
                    {cond.met ? '✅' : '⚪'}
                  </span>
                  <div className="flex-1">
                    <span className={[
                      'text-[var(--text-sm)]',
                      cond.met ? 'text-[var(--success)] line-through' : 'text-[var(--text)]',
                    ].join(' ')}>
                      {cond.label}
                    </span>
                    {!cond.met && cond.current != null && cond.required != null && (
                      <span className="text-[var(--text-xs)] text-[var(--text-muted)] ml-2">
                        (当前: {cond.current} / 需要: {cond.required})
                      </span>
                    )}
                  </div>
                  {cond.met && (
                    <Badge color="success">已达成</Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="pt-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setShowUnlockModal(false)}
            >
              我知道了
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// Helper: get a human-readable unlock hint based on region
function getUnlockHint(region: string): string {
  switch (region) {
    case 'forest':
      return '通过"草原守护者之战"晋级挑战解锁'
    case 'plateau':
      return '通过"森林之心"晋级挑战解锁'
    case 'abyss':
      return '通过"高原风暴"晋级挑战解锁'
    default:
      return '段位不足'
  }
}

export default CharacterHallPage
