import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adventureApi } from '@/api/adventure'
import { playApi } from '@/api/play'
import type { ChallengeRecord, ChallengeItem } from '@/types/api'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import Loading from '@/components/common/Loading'
import UnlockStoryModal from '@/components/character/UnlockStoryModal'

// ---------------------------------------------------------------------------
// Challenge metadata — maps challenge IDs/types to Boss presentation
// ---------------------------------------------------------------------------

interface BossTheme {
  name: string
  emoji: string
  title: string
  description: string
  bgGradient: string
  accentColor: string
  glowColor: string
  unlockRegion: string
  unlockRegionName: string
  bossCharacterId: string
  bossCharacterEmoji: string
}

const CHALLENGE_THEMES: Record<string, BossTheme> = {
  meadow_guardian: {
    name: '草原守护者之战',
    emoji: '\uD83D\uDC22',
    title: '挑战龟龟的真正实力',
    description: '龟龟不再留手了。他将使用全力防守，证明你是否有资格踏入试炼森林。只有赢下这场对弈，才能获得进入新领域的资格。',
    bgGradient: 'from-emerald-950 via-green-950 to-teal-950',
    accentColor: 'rgb(34, 197, 94)',
    glowColor: 'rgba(34, 197, 94, 0.3)',
    unlockRegion: 'forest',
    unlockRegionName: '试炼森林',
    bossCharacterId: 'guigui',
    bossCharacterEmoji: '\uD83D\uDC22',
  },
  forest_heart: {
    name: '森林之心',
    emoji: '\uD83E\uDD16',
    title: '突破铁墩墩的防御',
    description: '铁墩墩开启了"全力防守"模式，他的防线几乎无懈可击。你需要展示耐心和战略性进攻才能获胜。对局限时20分钟。',
    bgGradient: 'from-slate-950 via-teal-950 to-cyan-950',
    accentColor: 'rgb(20, 184, 166)',
    glowColor: 'rgba(20, 184, 166, 0.3)',
    unlockRegion: 'plateau',
    unlockRegionName: '风暴高原',
    bossCharacterId: 'tiedundun',
    bossCharacterEmoji: '\uD83E\uDD16',
  },
  highland_storm: {
    name: '高原风暴',
    emoji: '\u2601\uFE0F',
    title: '参透云朵师父的棋道',
    description: '云朵师父说："风暴之中，唯有内心清明者能看见真相。" 这是一场考验计算力和记忆力的特殊对弈。',
    bgGradient: 'from-purple-950 via-indigo-950 to-violet-950',
    accentColor: 'rgb(139, 92, 246)',
    glowColor: 'rgba(139, 92, 246, 0.3)',
    unlockRegion: 'abyss',
    unlockRegionName: '暗影深渊',
    bossCharacterId: 'yunduo',
    bossCharacterEmoji: '\u2601\uFE0F',
  },
}

// Fallback theme for unknown challenges
const DEFAULT_THEME: BossTheme = {
  name: '晋级挑战',
  emoji: '\u2694\uFE0F',
  title: '晋级挑战',
  description: '赢得这场对弈，证明你的实力。',
  bgGradient: 'from-gray-950 via-slate-950 to-zinc-950',
  accentColor: 'rgb(148, 163, 184)',
  glowColor: 'rgba(148, 163, 184, 0.3)',
  unlockRegion: '',
  unlockRegionName: '新区域',
  bossCharacterId: '',
  bossCharacterEmoji: '\u2694\uFE0F',
}

// Try to match a challenge to a theme by ID or by iterating known patterns
function getTheme(challengeId: string, challenge?: ChallengeItem | null): BossTheme {
  // Direct match
  if (CHALLENGE_THEMES[challengeId]) return CHALLENGE_THEMES[challengeId]

  // Try matching by challenge name or opponent
  if (challenge) {
    const name = (challenge.name ?? '').toLowerCase()
    const opId = challenge.opponent_id ?? ''
    if (name.includes('草原') || name.includes('meadow') || opId === 'guigui') {
      return CHALLENGE_THEMES.meadow_guardian
    }
    if (name.includes('森林') || name.includes('forest') || opId === 'tiedundun') {
      return CHALLENGE_THEMES.forest_heart
    }
    if (name.includes('高原') || name.includes('highland') || name.includes('storm') || opId === 'yunduo') {
      return CHALLENGE_THEMES.highland_storm
    }
  }

  return DEFAULT_THEME
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

const PromotionChallengePage: React.FC = () => {
  const { id: challengeId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<ChallengeItem | null>(null)
  const [_record, setRecord] = useState<ChallengeRecord | null>(null)
  const [starting, setStarting] = useState(false)

  // Result state
  const [showResult, setShowResult] = useState(false)
  const [resultStatus, setResultStatus] = useState<'passed' | 'failed' | null>(null)

  // Unlock story modal
  const [showUnlockStory, setShowUnlockStory] = useState(false)
  const [unlockStoryData, setUnlockStoryData] = useState<{
    characterId: string
    characterName: string
    characterEmoji: string
    storyLines: Array<{ speaker: string; text: string; emotion?: string }>
    storyText: string
  } | null>(null)

  const theme = getTheme(challengeId ?? '', challenge)

  // Load challenge details
  useEffect(() => {
    if (!challengeId) {
      setError('无效的挑战 ID')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // Try to load challenge details from the adventure API
    // We'll try to find it via region details
    adventureApi.getAdventureMap()
      .then(async (res) => {
        const payload = res.data?.data ?? res.data
        const regions = payload?.regions ?? []

        // Search all regions for this challenge
        for (const region of regions) {
          if (!region.is_unlocked) continue
          try {
            const detailRes = await adventureApi.getRegionDetail(region.id)
            const detail = detailRes.data?.data ?? detailRes.data
            const found = detail?.challenges?.find(
              (c: ChallengeItem) => c.id === challengeId || String(c.id) === challengeId
            )
            if (found) {
              setChallenge(found)
              return
            }
          } catch {
            // Continue searching other regions
          }
        }

        // If not found in regions, create a minimal challenge from the theme
        setChallenge({
          id: challengeId,
          name: theme.name,
          type: 'battle',
          description: theme.description,
          reward_xp: 100,
          opponent_id: theme.bossCharacterId || null,
          is_completed: false,
        })
      })
      .catch((err) => {
        console.error('[PromotionChallengePage] Failed to load challenge:', err)
        setError(err?.message ?? '加载挑战信息失败')
      })
      .finally(() => setLoading(false))
  }, [challengeId])

  // Start the challenge
  const handleStartChallenge = useCallback(async () => {
    if (!challengeId) return
    setStarting(true)
    setError(null)

    try {
      const res = await adventureApi.startChallenge(challengeId)
      const data = res.data?.data ?? res.data
      setRecord(data)
      const gameId = data?.game_id ?? challengeId

      // Navigate to game page with challenge context
      navigate(
        `/play/game/${gameId}?character=${theme.bossCharacterId}&time=1200&challenge=${challengeId}&difficulty=fixed`
      )
    } catch (err: any) {
      console.error('[PromotionChallengePage] Failed to start challenge:', err)
      // Fallback: navigate to local game with challenge parameters
      navigate(
        `/play/game/local?character=${theme.bossCharacterId}&time=1200&challenge=${challengeId}&difficulty=fixed`
      )
    } finally {
      setStarting(false)
    }
  }, [challengeId, navigate, theme.bossCharacterId])

  // Complete the challenge (called when returning from game)
  const handleCompleteChallenge = useCallback(async (result: 'win' | 'loss' | 'draw') => {
    if (!challengeId) return

    const passed = result === 'win'
    setResultStatus(passed ? 'passed' : 'failed')
    setShowResult(true)

    try {
      await adventureApi.completeChallenge(challengeId, {
        result: passed ? 'passed' : 'failed',
      })

      // If passed, try to fetch unlock story for the new characters
      if (passed && theme.bossCharacterId) {
        try {
          const charRes = await playApi.getCharacterDetail(theme.bossCharacterId)
          const charData = (charRes.data as any)?.data ?? charRes.data
          if (charData?.unlock_story) {
            const story = typeof charData.unlock_story === 'string'
              ? [{ speaker: charData.name ?? theme.name, text: charData.unlock_story }]
              : Array.isArray(charData.unlock_story)
                ? charData.unlock_story
                : []
            setUnlockStoryData({
              characterId: charData.id ?? theme.bossCharacterId,
              characterName: charData.name ?? theme.name,
              characterEmoji: theme.bossCharacterEmoji,
              storyLines: story,
              storyText: typeof charData.unlock_story === 'string' ? charData.unlock_story : '',
            })
          }
        } catch {
          // Unlock story fetch failed — not critical
        }
      }
    } catch (err) {
      console.error('[PromotionChallengePage] Failed to complete challenge:', err)
    }
  }, [challengeId, theme])

  // Check URL for result param (returned from GamePage)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('result')
    if (result === 'win' || result === 'loss' || result === 'draw') {
      handleCompleteChallenge(result)
    }
  }, [handleCompleteChallenge])

  // Handle showing unlock story after result dismiss
  const handleResultDismiss = () => {
    setShowResult(false)
    if (resultStatus === 'passed' && unlockStoryData) {
      setShowUnlockStory(true)
    } else if (resultStatus === 'passed') {
      navigate('/adventure')
    }
  }

  const handleRetry = () => {
    setShowResult(false)
    setResultStatus(null)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return <Loading size="lg" text="加载挑战信息..." />
  }

  if (error && !challenge) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-5xl">{'\u26A0\uFE0F'}</div>
        <p className="text-[var(--text-sub)] text-lg">{error}</p>
        <Button variant="secondary" onClick={() => navigate('/adventure')}>
          返回冒险地图
        </Button>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gradient-to-b ${theme.bgGradient} -m-4 -mt-4 sm:-m-6 sm:-mt-6`}>
      <div className="max-w-lg mx-auto px-4 py-8 sm:py-12">

        {/* Back button */}
        <button
          className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-8"
          onClick={() => navigate('/adventure')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          返回冒险地图
        </button>

        {/* Boss presentation area */}
        <div className="text-center space-y-6">
          {/* Boss avatar with glow */}
          <div className="relative inline-block">
            {/* Glow ring */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                width: 140,
                height: 140,
                margin: '-10px',
                background: `radial-gradient(circle, ${theme.glowColor} 0%, transparent 70%)`,
                animation: 'boss-glow 3s ease-in-out infinite',
              }}
            />
            {/* Avatar */}
            <div
              className="relative w-[120px] h-[120px] rounded-full flex items-center justify-center border-2"
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                borderColor: theme.accentColor,
                boxShadow: `0 0 30px ${theme.glowColor}, inset 0 0 20px rgba(0,0,0,0.3)`,
              }}
            >
              <span className="text-6xl">{theme.emoji}</span>
            </div>
          </div>

          {/* Challenge title */}
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: theme.accentColor }}
            >
              {'--- '}晋级挑战{' ---'}
            </p>
            <h1 className="text-3xl font-bold text-white mb-2">
              {challenge?.name ?? theme.name}
            </h1>
            <p className="text-lg text-white/70">
              {theme.title}
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 px-8">
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${theme.accentColor}, transparent)` }} />
          </div>

          {/* Challenge description */}
          <div
            className="rounded-2xl p-5 text-left"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: `1px solid rgba(255, 255, 255, 0.08)`,
            }}
          >
            <p className="text-sm text-white/70 leading-relaxed">
              {challenge?.description ?? theme.description}
            </p>
          </div>

          {/* Challenge details */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-xl p-3"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div className="text-xs text-white/40 mb-1">对手</div>
              <div className="text-sm font-semibold text-white/90">
                {theme.emoji} {challenge?.name?.includes('龟龟') ? '龟龟' : theme.name.replace(/之战|之心|风暴/, '')}
              </div>
            </div>
            <div
              className="rounded-xl p-3"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div className="text-xs text-white/40 mb-1">奖励</div>
              <div className="text-sm font-semibold" style={{ color: 'rgb(251, 191, 36)' }}>
                +{challenge?.reward_xp ?? 100} XP
              </div>
            </div>
            <div
              className="rounded-xl p-3"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div className="text-xs text-white/40 mb-1">解锁区域</div>
              <div className="text-sm font-semibold text-white/90">
                {theme.unlockRegionName}
              </div>
            </div>
            <div
              className="rounded-xl p-3"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div className="text-xs text-white/40 mb-1">条件</div>
              <div className="text-sm font-semibold text-white/90">
                胜利即通过
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 space-y-3">
            <button
              className="w-full py-4 rounded-2xl text-lg font-bold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(135deg, ${theme.accentColor}, ${theme.accentColor}cc)`,
                boxShadow: `0 4px 20px ${theme.glowColor}`,
              }}
              disabled={starting || (challenge?.is_completed ?? false)}
              onClick={handleStartChallenge}
            >
              {starting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  准备中...
                </span>
              ) : challenge?.is_completed ? (
                '挑战已通过'
              ) : (
                '接受挑战'
              )}
            </button>

            {challenge?.is_completed && (
              <button
                className="w-full py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white/80 transition-colors"
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
                onClick={handleStartChallenge}
              >
                再次挑战
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Result Modal */}
      <Modal open={showResult} onClose={handleResultDismiss} width="400px">
        <div className="space-y-5 text-center">
          {resultStatus === 'passed' ? (
            <>
              <div className="text-6xl mb-2">{'\uD83C\uDF89'}</div>
              <h3 className="text-[var(--text-xl)] font-bold text-[var(--success)]">
                挑战通过!
              </h3>
              <p className="text-[var(--text-sm)] text-[var(--text-sub)] leading-relaxed">
                恭喜你战胜了{challenge?.name ?? '对手'}！新的区域和角色已经解锁，
                前方还有更多精彩的冒险等着你！
              </p>
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-xl mx-auto max-w-[240px]"
                style={{
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                }}
              >
                <span className="text-xl">{'\uD83C\uDF81'}</span>
                <div className="text-left">
                  <div className="text-[var(--text-xs)] text-[var(--text-muted)]">获得奖励</div>
                  <div className="text-[var(--text-sm)] font-semibold text-[var(--success)]">
                    +{challenge?.reward_xp ?? 100} XP | {theme.unlockRegionName} 已解锁
                  </div>
                </div>
              </div>
              <Button variant="primary" className="w-full" onClick={handleResultDismiss}>
                {unlockStoryData ? '查看新角色' : '返回冒险地图'}
              </Button>
            </>
          ) : (
            <>
              <div className="text-6xl mb-2">{'\uD83D\uDCAA'}</div>
              <h3 className="text-[var(--text-xl)] font-bold text-[var(--text)]">
                还差一点点!
              </h3>
              <p className="text-[var(--text-sm)] text-[var(--text-sub)] leading-relaxed">
                这场挑战确实很难，但不要灰心！每一次失败都是成长的养分。
                多练习一些谜题，提升战术能力，然后再来挑战吧！
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => navigate('/adventure')}>
                  返回地图
                </Button>
                <Button variant="primary" className="flex-1" onClick={handleRetry}>
                  再试一次
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Unlock Story Modal */}
      {unlockStoryData && (
        <UnlockStoryModal
          open={showUnlockStory}
          onClose={() => {
            setShowUnlockStory(false)
            navigate('/adventure')
          }}
          characterId={unlockStoryData.characterId}
          characterName={unlockStoryData.characterName}
          characterEmoji={unlockStoryData.characterEmoji}
          storyLines={unlockStoryData.storyLines}
          storyText={unlockStoryData.storyText}
        />
      )}

      {/* Boss glow animation */}
      <style>{`
        @keyframes boss-glow {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}

export default PromotionChallengePage
