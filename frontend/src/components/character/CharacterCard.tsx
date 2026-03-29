import React from 'react'
import CharacterAvatar from './CharacterAvatar'
import Button from '@/components/common/Button'

export interface CharacterCardData {
  id: string
  name: string
  emoji: string
  rating: number
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
}

interface CharacterCardProps {
  character: CharacterCardData
  onPlay: (id: string) => void
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

const CharacterCard: React.FC<CharacterCardProps> = ({ character, onPlay }) => {
  const { id, name, emoji, rating, styleWeights, wins, losses, draws, locked } = character
  const totalGames = wins + losses + draws

  return (
    <div
      className={[
        'relative bg-[var(--bg-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-sm)]',
        'p-5 flex flex-col gap-4',
        'transition-all duration-[var(--duration-normal)] ease-[var(--ease-standard)]',
        locked ? 'opacity-50 grayscale-[40%]' : 'hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5',
      ].join(' ')}
    >
      {/* Lock overlay */}
      {locked && (
        <div className="absolute inset-0 rounded-[var(--radius-card)] flex items-center justify-center z-10 bg-[var(--bg-card)]/30 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-1">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-[var(--text-muted)]">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="text-[var(--text-xs)] text-[var(--text-muted)] font-medium">段位不足</span>
          </div>
        </div>
      )}

      {/* Header: avatar + name + rating */}
      <div className="flex items-center gap-3">
        <CharacterAvatar emoji={emoji} size="sm" />
        <div className="flex-1 min-w-0">
          <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] truncate">{name}</h3>
          <span className="text-[var(--text-xs)] text-[var(--text-muted)]">Rating {rating}</span>
        </div>
      </div>

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
        <div className="text-center text-[var(--text-xs)] text-[var(--text-muted)]">尚未对弈</div>
      )}

      {/* Play button */}
      <Button
        variant="primary"
        size="sm"
        disabled={locked}
        onClick={() => onPlay(id)}
        className="w-full"
      >
        {locked ? '未解锁' : '对弈'}
      </Button>
    </div>
  )
}

export default CharacterCard
