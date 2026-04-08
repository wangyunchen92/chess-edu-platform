import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreditStore } from '@/stores/creditStore'

interface CreditsBadgeProps {
  collapsed?: boolean
}

const CreditsBadge: React.FC<CreditsBadgeProps> = ({ collapsed = false }) => {
  const navigate = useNavigate()
  const balance = useCreditStore((s) => s.balance)
  const fetchBalance = useCreditStore((s) => s.fetchBalance)

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  const isLow = balance < 100

  return (
    <button
      onClick={() => navigate('/profile')}
      className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] transition-colors hover:bg-white/[0.06] w-full"
      title={`${balance} 积分`}
    >
      <span className="text-base shrink-0">{'\uD83D\uDCB0'}</span>
      {!collapsed && (
        <span
          className={[
            'text-[var(--text-sm)] font-semibold tabular-nums',
            isLow ? 'text-[var(--danger)]' : 'text-amber-400',
          ].join(' ')}
        >
          {balance}
        </span>
      )}
    </button>
  )
}

export default CreditsBadge
