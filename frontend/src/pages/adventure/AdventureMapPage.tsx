import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { adventureApi } from '@/api/adventure'
import { playApi } from '@/api/play'
import type { RegionItem, ChallengeItem, CharacterListItem } from '@/types/api'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import CharacterAvatar from '@/components/character/CharacterAvatar'

// ---------------------------------------------------------------------------
// Theme config — derived from region id
// ---------------------------------------------------------------------------

const REGION_THEMES: Record<string, string> = {
  meadow: 'green', forest: 'forest', highland: 'storm', plateau: 'storm',
  storm: 'storm', abyss: 'shadow', shadow: 'shadow',
}

const THEME_CONFIG: Record<string, { bg: string; border: string; glow: string; accent: string }> = {
  green: {
    bg: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(22,163,74,0.08))',
    border: 'rgba(34,197,94,0.4)',
    glow: '0 0 20px rgba(34,197,94,0.15)',
    accent: 'rgb(34,197,94)',
  },
  forest: {
    bg: 'linear-gradient(135deg, rgba(101,163,13,0.15), rgba(63,98,18,0.08))',
    border: 'rgba(101,163,13,0.4)',
    glow: '0 0 20px rgba(101,163,13,0.15)',
    accent: 'rgb(101,163,13)',
  },
  storm: {
    bg: 'linear-gradient(135deg, rgba(100,116,139,0.15), rgba(51,65,85,0.08))',
    border: 'rgba(100,116,139,0.4)',
    glow: '0 0 20px rgba(100,116,139,0.15)',
    accent: 'rgb(100,116,139)',
  },
  shadow: {
    bg: 'linear-gradient(135deg, rgba(147,51,234,0.15), rgba(88,28,135,0.08))',
    border: 'rgba(147,51,234,0.4)',
    glow: '0 0 20px rgba(147,51,234,0.15)',
    accent: 'rgb(147,51,234)',
  },
}

function getTheme(regionId: string) {
  const key = REGION_THEMES[regionId] ?? 'green'
  return THEME_CONFIG[key] ?? THEME_CONFIG.green
}

// Character emoji mapping
const CHARACTER_EMOJI: Record<string, string> = {
  douding: '\uD83D\uDC30',
  mianhuatang: '\uD83E\uDDC1',
  guigui: '\uD83D\uDC22',
  dongdong: '\uD83D\uDC66',
  lihuahua: '\uD83D\uDC31',
  tiedundun: '\uD83E\uDD16',
  yinzong: '\u2694\uFE0F',
  gulu: '\uD83E\uDD8A',
  yunduo: '\u2601\uFE0F',
  lieyanbird: '\uD83D\uDD25',
  qiboshi: '\uD83E\uDDD1\u200D\uD83C\uDF93',
  anyingwang: '\uD83D\uDC79',
}

// Tier to region mapping
const TIER_TO_REGION: Record<string, string> = {
  beginner: 'meadow',
  intermediate: 'forest',
  advanced: 'plateau',
  expert: 'abyss',
}

// Challenge type to icon mapping
const CHALLENGE_TYPE_ICON: Record<string, string> = {
  quiz: '\uD83E\uDDE9',
  battle: '\u2694\uFE0F',
  puzzle: '\uD83E\uDDE9',
}

// Promotion challenge names per region boundary
const PROMOTION_CHALLENGES: Record<string, { name: string; description: string; targetRegion: string }> = {
  meadow: {
    name: '草原守护者之战',
    description: '挑战龟龟的真正实力，踏入试炼森林',
    targetRegion: 'forest',
  },
  forest: {
    name: '森林之心',
    description: '突破铁墩墩的全力防守，登上风暴高原',
    targetRegion: 'plateau',
  },
  plateau: {
    name: '高原风暴',
    description: '参透云朵师父的棋道，深入暗影深渊',
    targetRegion: 'abyss',
  },
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const AdventureMapPage: React.FC = () => {
  const navigate = useNavigate()
  const [regions, setRegions] = useState<RegionItem[]>([])
  const [currentRegion, setCurrentRegion] = useState<string>('meadow')
  const [currentRating, setCurrentRating] = useState<number>(300)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Region detail state
  const [selectedRegionDetail, setSelectedRegionDetail] = useState<{
    region: RegionItem
    challenges: ChallengeItem[]
  } | null>(null)

  // Character list per region
  const [regionCharacters, setRegionCharacters] = useState<Record<string, CharacterListItem[]>>({})

  // Challenge detail modal
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeItem | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [starting, setStarting] = useState(false)

  // Load adventure map and characters
  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      adventureApi.getAdventureMap(),
      playApi.getCharacters(),
    ])
      .then(([mapRes, charRes]) => {
        // Process map data
        const mapPayload = mapRes.data?.data ?? mapRes.data
        if (mapPayload?.regions && Array.isArray(mapPayload.regions)) {
          setRegions(mapPayload.regions)
          setCurrentRegion(mapPayload.current_region ?? 'meadow')
          setCurrentRating(mapPayload.current_rating ?? 300)
        }

        // Process character data and group by region
        const charRaw = charRes?.data as any
        const charData = charRaw?.data ?? charRaw
        if (Array.isArray(charData)) {
          const grouped: Record<string, CharacterListItem[]> = {}
          for (const c of charData) {
            const region = c.region ?? TIER_TO_REGION[c.tier] ?? 'meadow'
            if (!grouped[region]) grouped[region] = []
            grouped[region].push(c)
          }
          setRegionCharacters(grouped)
        }
      })
      .catch((err) => {
        console.error('[AdventureMapPage] Failed to load:', err)
        setError(err?.message ?? '加载冒险地图失败')
      })
      .finally(() => setLoading(false))
  }, [])

  const handleRegionClick = useCallback(async (region: RegionItem) => {
    if (!region.is_unlocked) return

    // Toggle: if already selected, deselect
    if (selectedRegionDetail?.region.id === region.id) {
      setSelectedRegionDetail(null)
      return
    }

    try {
      const res = await adventureApi.getRegionDetail(region.id)
      const detail = res.data?.data ?? res.data
      if (detail?.challenges) {
        setSelectedRegionDetail({ region, challenges: detail.challenges })
      }
    } catch {
      setSelectedRegionDetail({ region, challenges: [] })
    }
  }, [selectedRegionDetail])

  const handleChallengeClick = useCallback((challenge: ChallengeItem) => {
    setSelectedChallenge(challenge)
    setShowModal(true)
  }, [])

  const handleStartChallenge = useCallback(async () => {
    if (!selectedChallenge) return
    setStarting(true)
    try {
      const res = await adventureApi.startChallenge(selectedChallenge.id)
      const record = res.data?.data ?? res.data
      const gameId = record?.game_id ?? selectedChallenge.id
      if (selectedChallenge.type === 'quiz' || selectedChallenge.type === 'puzzle') {
        navigate(`/puzzles/solve/${gameId}`)
      } else {
        navigate(`/play/game/${gameId}`)
      }
    } catch {
      if (selectedChallenge.type === 'quiz' || selectedChallenge.type === 'puzzle') {
        navigate(`/puzzles/solve/${selectedChallenge.id}`)
      } else {
        navigate(`/play/game/local?character=douding&time=600`)
      }
    } finally {
      setStarting(false)
      setShowModal(false)
    }
  }, [selectedChallenge, navigate])

  // Navigate to promotion challenge page
  const handlePromotionChallenge = useCallback((regionId: string) => {
    // Find the corresponding challenge in the region detail
    const detail = selectedRegionDetail
    let challengeId = regionId // fallback

    if (detail?.challenges) {
      // Look for a "battle" type challenge that seems like the promotion one
      const promo = detail.challenges.find(
        (c) => c.type === 'battle' || c.name.includes('守护者') || c.name.includes('森林') || c.name.includes('高原')
      )
      if (promo) {
        challengeId = String(promo.id)
      }
    }

    navigate(`/adventure/challenge/${challengeId}`)
  }, [selectedRegionDetail, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-4xl animate-bounce">{'\uD83C\uDFD4\uFE0F'}</div>
      </div>
    )
  }

  if (error && regions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-5xl">{'\u26A0\uFE0F'}</div>
        <p className="text-[var(--text-sub)] text-lg">{error}</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          重试
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-2">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-[var(--text-3xl)] font-bold text-[var(--text)]">
          {'\uD83C\uDFD4\uFE0F'} 棋境大陆
        </h1>
        <p className="text-[var(--text-sm)] text-[var(--text-sub)] mt-2">
          踏上冒险之旅，征服每一个区域，成为棋境传说！
        </p>
        <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-1">
          当前评分: {currentRating}
        </p>
      </div>

      {/* Adventure Path */}
      <div className="relative">
        {regions.map((region, idx) => {
          const theme = getTheme(region.id)
          const isLocked = !region.is_unlocked
          const isCurrent = region.id === currentRegion
          const isExpanded = selectedRegionDetail?.region.id === region.id
          const characters = regionCharacters[region.id] ?? []
          const promotionInfo = PROMOTION_CHALLENGES[region.id]

          return (
            <React.Fragment key={region.id}>
              {/* Connector line */}
              {idx > 0 && (
                <div className="flex justify-center py-1">
                  <div
                    className="w-0.5 h-10"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(to bottom, var(--text-muted) 0, var(--text-muted) 6px, transparent 6px, transparent 12px)',
                      opacity: 0.3,
                    }}
                  />
                </div>
              )}

              {/* Region Card */}
              <div
                className="relative rounded-2xl p-5 transition-all duration-300 cursor-pointer"
                style={{
                  background: isLocked ? 'var(--card-bg)' : theme.bg,
                  border: `1.5px solid ${isLocked ? 'var(--border)' : theme.border}`,
                  boxShadow: isLocked ? 'none' : theme.glow,
                  opacity: isLocked ? 0.65 : 1,
                  filter: isLocked ? 'grayscale(0.5)' : 'none',
                }}
                onClick={() => handleRegionClick(region)}
              >
                {/* Lock overlay */}
                {isLocked && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[var(--text-muted)]"
                    style={{ background: 'rgba(0,0,0,0.15)', fontSize: '12px' }}>
                    <span>{'\uD83D\uDD12'}</span>
                    <span>评分 {region.rating_range[0]} 解锁</span>
                  </div>
                )}

                {/* Current badge */}
                {isCurrent && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-[var(--text-xs)] font-semibold"
                    style={{ background: 'rgba(34,197,94,0.2)', color: 'rgb(34,197,94)' }}>
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    当前区域
                  </div>
                )}

                {/* Region info */}
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-3xl">{region.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[var(--text-lg)] font-bold text-[var(--text)]">
                      {region.name}
                    </h2>
                    <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-0.5">
                      评分 {region.rating_range[0]} - {region.rating_range[1] >= 9999 ? '\u221E' : region.rating_range[1]}
                    </p>
                  </div>
                </div>

                <p className="text-[var(--text-sm)] text-[var(--text-sub)] mb-4 leading-relaxed">
                  {region.description}
                </p>

                {/* Characters in this region */}
                {characters.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[var(--text-xs)] text-[var(--text-muted)] mb-2 font-medium">
                      {isLocked ? '封印中的角色' : '区域角色'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {characters.map((char) => {
                        const emoji = CHARACTER_EMOJI[char.slug] ?? CHARACTER_EMOJI[char.id] ?? '\u265E'
                        const charLocked = char.is_unlocked === false
                        return (
                          <div
                            key={char.id}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200"
                            style={{
                              background: charLocked
                                ? 'rgba(0,0,0,0.08)'
                                : 'rgba(255,255,255,0.06)',
                              border: `1px solid ${charLocked ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'}`,
                              opacity: charLocked && !isLocked ? 0.55 : 1,
                              filter: charLocked ? 'grayscale(0.6)' : 'none',
                            }}
                            title={charLocked ? `${char.name} (未解锁)` : `${char.name} - 评分 ${char.base_rating}`}
                          >
                            <CharacterAvatar emoji={emoji} size="sm" />
                            <div className="min-w-0">
                              <span className="text-[var(--text-xs)] font-medium text-[var(--text)] block truncate">
                                {char.name}
                              </span>
                              <span className="text-[10px] text-[var(--text-muted)]">
                                {charLocked ? '\uD83D\uDD12 未解锁' : `R${char.base_rating}`}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Progress indicator */}
                {region.is_unlocked && (
                  <div className="flex items-center gap-2 text-[var(--text-xs)] text-[var(--text-muted)]">
                    <span>挑战进度: {region.challenges_completed}/{region.challenges_total}</span>
                    {region.challenges_completed === region.challenges_total && region.challenges_total > 0 && (
                      <span className="text-[var(--success)]">{'\u2705'} 已完成</span>
                    )}
                  </div>
                )}

                {/* Inline challenges from region detail */}
                {isExpanded && selectedRegionDetail && selectedRegionDetail.challenges.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {selectedRegionDetail.challenges.map((challenge) => (
                      <button
                        key={challenge.id}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 hover:scale-[1.01]"
                        style={{
                          background: challenge.is_completed
                            ? 'rgba(34,197,94,0.08)'
                            : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${challenge.is_completed ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)'}`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleChallengeClick(challenge)
                        }}
                      >
                        <span className="text-xl shrink-0">
                          {challenge.is_completed ? '\u2705' : (CHALLENGE_TYPE_ICON[challenge.type] ?? '\uD83E\uDDE9')}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-[var(--text-sm)] font-semibold text-[var(--text)] block">
                            {challenge.name}
                          </span>
                          <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
                            {challenge.is_completed ? '已完成' : challenge.description}
                          </span>
                        </div>
                        <span className="text-[var(--text-xs)] text-[var(--warning)] shrink-0">
                          +{challenge.reward_xp} XP
                        </span>
                        <span className="text-[var(--text-muted)] text-sm shrink-0">{'\u203A'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Promotion Challenge Entry — between regions */}
              {promotionInfo && region.is_unlocked && idx < regions.length - 1 && (
                <>
                  <div className="flex justify-center py-1">
                    <div
                      className="w-0.5 h-6"
                      style={{
                        backgroundImage: 'repeating-linear-gradient(to bottom, var(--text-muted) 0, var(--text-muted) 4px, transparent 4px, transparent 8px)',
                        opacity: 0.3,
                      }}
                    />
                  </div>
                  <button
                    className="w-full flex items-center gap-3 px-5 py-4 rounded-xl transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                    style={{
                      background: `linear-gradient(135deg, ${theme.accent}15, ${theme.accent}08)`,
                      border: `1.5px dashed ${theme.border}`,
                      boxShadow: theme.glow,
                    }}
                    onClick={() => handlePromotionChallenge(region.id)}
                  >
                    <span className="text-2xl shrink-0">{'\u2694\uFE0F'}</span>
                    <div className="flex-1 min-w-0 text-left">
                      <span className="text-[var(--text-sm)] font-bold text-[var(--text)] block">
                        {promotionInfo.name}
                      </span>
                      <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
                        {promotionInfo.description}
                      </span>
                    </div>
                    <div className="shrink-0 flex items-center gap-1 text-[var(--text-xs)] font-semibold" style={{ color: theme.accent }}>
                      <span>进入挑战</span>
                      <span>{'\u203A'}</span>
                    </div>
                  </button>
                </>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Challenge Detail Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="挑战详情"
      >
        {selectedChallenge && (
          <div className="space-y-5">
            {/* Challenge icon & name */}
            <div className="text-center">
              <div className="text-5xl mb-3">
                {CHALLENGE_TYPE_ICON[selectedChallenge.type] ?? '\uD83E\uDDE9'}
              </div>
              <h3 className="text-[var(--text-xl)] font-bold text-[var(--text)]">
                {selectedChallenge.name}
              </h3>
            </div>

            {/* Description */}
            <p className="text-[var(--text-sm)] text-[var(--text-sub)] text-center leading-relaxed">
              {selectedChallenge.description}
            </p>

            {/* Reward */}
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl"
              style={{
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.2)',
              }}
            >
              <span className="text-xl">{'\uD83C\uDF81'}</span>
              <div>
                <div className="text-[var(--text-xs)] text-[var(--text-muted)]">完成奖励</div>
                <div className="text-[var(--text-sm)] font-semibold text-[var(--warning)]">
                  +{selectedChallenge.reward_xp} XP
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowModal(false)}
              >
                返回
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                loading={starting}
                onClick={handleStartChallenge}
              >
                {selectedChallenge.is_completed ? '再次挑战' : '开始挑战'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default AdventureMapPage
