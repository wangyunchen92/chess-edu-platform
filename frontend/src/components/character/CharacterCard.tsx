import React from 'react'
import CharacterAvatar from './CharacterAvatar'
import Button from '@/components/common/Button'
import Badge from '@/components/common/Badge'

export interface CharacterCardData {
  id: string
  name: string
  emoji: string
  rating: number
  ratingRange?: string
  playStyle?: string
  playStyleLabel?: string
  playStyleColor?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral'
  styleWeights: {
    attack: number
    defense: number
    tactics: number
    positional: number
  }
  wins: number
  losses: number
  draws: number
  locked: boolean
  unlockConditionText?: string
  personality?: string
}

interface CharacterCardProps {
  character: CharacterCardData
  onPlay: (id: string) => void
  onLockedClick?: (id: string) => void
}

const StyleBar: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="flex items-center gap-2">
    <span className="text-[var(--text-xs)] text-[var(--text-muted)] w-8 shrink-0">{label}</span>
    <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] transition-all duration-500"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  </div>
)

const CharacterCard: React.FC<CharacterCardProps> = ({ character, onPlay, onLockedClick }) => {
  const {
    id, name, emoji, rating, ratingRange, playStyleLabel, playStyleColor,
    styleWeights, wins, losses, draws, locked, unlockConditionText,
  } = character
  const totalGames = wins + losses + draws

  const handleClick = () => {
    if (locked && onLockedClick) {
      onLockedClick(id)
    }
  }

  return (
    <div
      className={[
        'relative bg-[var(--bg-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-sm)]',
        'p-5 flex flex-col gap-3',
        'transition-all duration-[var(--duration-normal)] ease-[var(--ease-standard)]',
        locked
          ? 'cursor-pointer'
          : 'hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5',
      ].join(' ')}
      onClick={locked ? handleClick : undefined}
    >
      {/* Lock overlay */}
      {locked && (
        <div className="absolute inset-0 rounded-[var(--radius-card)] flex items-center justify-center z-10 bg-[var(--bg-card)]/40 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-2 text-center px-4">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-[var(--text-muted)]">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {unlockConditionText && (
              <span className="text-[var(--text-xs)] text-[var(--text-muted)] font-medium leading-tight">
                {unlockConditionText}
              </span>
            )}
            <span className="text-[10px] text-[var(--text-muted)] opacity-70">
              点击查看解锁条件
            </span>
          </div>
        </div>
      )}

      {/* Header: avatar + name + rating */}
      <div className="flex items-center gap-3">
        <CharacterAvatar emoji={emoji} size="sm" />
        <div className="flex-1 min-w-0">
          <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] truncate">{name}</h3>
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-xs)] text-[var(--text-muted)]">
              评分 {ratingRange ?? rating}
            </span>
          </div>
        </div>
      </div>

      {/* Play style badge */}
      {playStyleLabel && (
        <div>
          <Badge color={playStyleColor ?? 'neutral'}>{playStyleLabel}</Badge>
        </div>
      )}

      {/* Style bars */}
      <div className="space-y-1.5">
        <StyleBar label="攻" value={styleWeights.attack} />
        <StyleBar label="守" value={styleWeights.defense} />
        <StyleBar label="战" value={styleWeights.tactics} />
        <StyleBar label="位" value={styleWeights.positional} />
      </div>

      {/* Record */}
      {totalGames > 0 ? (
        <div className="flex items-center justify-center gap-3 text-[var(--text-xs)]">
          <span className="text-[var(--success)] font-medium">{wins}胜</span>
          <span className="text-[var(--text-muted)]">/</span>
          <span className="text-[var(--danger)] font-medium">{losses}负</span>
          <span className="text-[var(--text-muted)]">/</span>
          <span className="text-[var(--text-muted)] font-medium">{draws}和</span>
        </div>
      ) : (
        <div className="text-center text-[var(--text-xs)] text-[var(--text-muted)]">{'尚未对弈'}</div>
      )}

      {/* Play button */}
      <Button
        variant="primary"
        size="sm"
        disabled={locked}
        onClick={(e) => {
          e.stopPropagation()
          onPlay(id)
        }}
        className="w-full"
      >
        {locked ? '未解锁' : '对弈'}
      </Button>
    </div>
  )
}

export default CharacterCard
