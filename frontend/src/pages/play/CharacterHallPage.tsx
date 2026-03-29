import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import CharacterCard, { type CharacterCardData } from '@/components/character/CharacterCard'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import { playApi } from '@/api/play'
import Loading from '@/components/common/Loading'

// ---------------------------------------------------------------------------
// Mock data (fallback when API is unavailable)
// ---------------------------------------------------------------------------

interface CharacterGroup {
  title: string
  subtitle: string
  characters: CharacterCardData[]
}

const MOCK_CHARACTER_GROUPS: CharacterGroup[] = [
  {
    title: '入门段',
    subtitle: 'Rating 400-800',
    characters: [
      {
        id: 'douding',
        name: '豆丁',
        emoji: '🐰',
        rating: 500,
        styleWeights: { attack: 0.3, defense: 0.2, tactics: 0.2, positional: 0.3 },
        wins: 0, losses: 0, draws: 0,
        locked: false,
      },
      {
        id: 'mianhuatang',
        name: '棉花糖',
        emoji: '🧁',
        rating: 650,
        styleWeights: { attack: 0.2, defense: 0.4, tactics: 0.2, positional: 0.2 },
        wins: 0, losses: 0, draws: 0,
        locked: false,
      },
      {
        id: 'guigui',
        name: '龟龟',
        emoji: '🐢',
        rating: 750,
        styleWeights: { attack: 0.1, defense: 0.5, tactics: 0.1, positional: 0.3 },
        wins: 0, losses: 0, draws: 0,
        locked: false,
      },
    ],
  },
  {
    title: '初级段',
    subtitle: 'Rating 800-1200',
    characters: [
      {
        id: 'fox',
        name: '狡狐',
        emoji: '\uD83E\uDD8A',
        rating: 900,
        styleWeights: { attack: 0.5, defense: 0.1, tactics: 0.3, positional: 0.1 },
        wins: 0, losses: 0, draws: 0,
        locked: true,
      },
      {
        id: 'owl',
        name: '智慧枭',
        emoji: '\uD83E\uDD89',
        rating: 1100,
        styleWeights: { attack: 0.2, defense: 0.3, tactics: 0.3, positional: 0.2 },
        wins: 0, losses: 0, draws: 0,
        locked: true,
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Time control options
// ---------------------------------------------------------------------------

const TIME_OPTIONS = [
  { label: '5 分钟', value: 300 },
  { label: '10 分钟', value: 600 },
  { label: '15 分钟', value: 900 },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const CharacterHallPage: React.FC = () => {
  const navigate = useNavigate()
  const [characterGroups, setCharacterGroups] = useState<CharacterGroup[]>(MOCK_CHARACTER_GROUPS)
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedTime, setSelectedTime] = useState(600)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)

  // Fetch characters from API with mock fallback
  useEffect(() => {
    setLoading(true)
    playApi.getCharacters()
      .then((res) => {
        // Unwrap nested: {code, message, data: [...]}
        const raw = res?.data as any
        const data = raw?.data ?? raw
        if (!Array.isArray(data) || data.length === 0) return

        // API returns flat array of characters — group by tier
        const TIER_INFO: Record<string, { title: string; subtitle: string }> = {
          beginner: { title: '入门段', subtitle: 'Rating 400-800' },
          intermediate: { title: '初级段', subtitle: 'Rating 800-1200' },
          advanced: { title: '中级段', subtitle: 'Rating 1200-1600' },
          expert: { title: '高级段', subtitle: 'Rating 1600+' },
        }
        const TIER_EMOJI: Record<string, string> = {
          douding: '🐰', mianhuatang: '🧁', guigui: '🐢',
        }
        const grouped: Record<string, CharacterCardData[]> = {}
        const tierOrder: string[] = []

        for (const c of data as any[]) {
          const tier = c.tier ?? 'beginner'
          if (!grouped[tier]) {
            grouped[tier] = []
            tierOrder.push(tier)
          }
          grouped[tier].push({
            id: c.id ?? c.slug,
            name: c.name ?? c.slug,
            emoji: TIER_EMOJI[c.id] ?? TIER_EMOJI[c.slug] ?? '♟️',
            rating: c.base_rating ?? c.rating ?? 500,
            styleWeights: c.styleWeights ?? { attack: 0.25, defense: 0.25, tactics: 0.25, positional: 0.25 },
            wins: c.stats?.games_won ?? 0,
            losses: c.stats?.games_lost ?? 0,
            draws: c.stats?.games_drawn ?? 0,
            locked: c.is_unlocked === false,
          })
        }

        const groups: CharacterGroup[] = tierOrder.map((tier) => ({
          title: TIER_INFO[tier]?.title ?? tier,
          subtitle: TIER_INFO[tier]?.subtitle ?? '',
          characters: grouped[tier],
        }))

        if (groups.length > 0) {
          setCharacterGroups(groups)
        }
      })
      .catch((err) => {
        console.error('[CharacterHallPage] Failed to load characters:', err)
      })
      .finally(() => setLoading(false))
  }, [])

  const handlePlay = useCallback((id: string) => {
    setSelectedCharId(id)
    setShowModal(true)
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
      navigate(`/play/game/${gameId}?character=${selectedCharId}&time=${selectedTime}`)
    } catch {
      // If API not available, navigate with params anyway (offline mode)
      navigate(`/play/game/local?character=${selectedCharId}&time=${selectedTime}`)
    } finally {
      setCreating(false)
      setShowModal(false)
    }
  }, [selectedCharId, selectedTime, navigate])

  if (loading) {
    return <Loading size="lg" text="加载角色..." />
  }

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-[var(--text-3xl)] font-bold text-[var(--text)]">
          选择你的对手
        </h1>
        <p className="mt-1 text-[var(--text-sm)] text-[var(--text-sub)]">
          每个角色都有独特的棋风和性格，选择适合你的对手开始对弈吧
        </p>
      </div>

      {/* Character groups */}
      {characterGroups.map((group) => (
        <section key={group.title}>
          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="text-[var(--text-xl)] font-semibold text-[var(--text)]">
              {group.title}
            </h2>
            <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
              {group.subtitle}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {group.characters.map((char) => (
              <CharacterCard
                key={char.id}
                character={char}
                onPlay={handlePlay}
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
    </div>
  )
}

export default CharacterHallPage
