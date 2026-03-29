import React from 'react'
import Modal from './Modal'
import Button from './Button'

interface PaywallModalProps {
  open: boolean
  onClose: () => void
  message?: string
}

const PaywallModal: React.FC<PaywallModalProps> = ({
  open,
  onClose,
  message = '今日免费次数已用完',
}) => {
  return (
    <Modal open={open} onClose={onClose} title="免费额度已用完" width="400px">
      <div className="text-center space-y-5 py-2">
        <div className="text-5xl">{'\uD83D\uDD12'}</div>
        <p className="text-[var(--text-md)] text-[var(--text-sub)] leading-relaxed">
          {message}
        </p>
        <div
          className="p-4 rounded-[var(--radius-md)]"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))',
            border: '1px solid rgba(99,102,241,0.15)',
          }}
        >
          <div className="text-lg font-bold text-[var(--text)] mb-1">
            {'\u2728'} 升级会员
          </div>
          <p className="text-[var(--text-xs)] text-[var(--text-muted)] mb-3">
            解锁无限谜题、AI教学和更多功能！
          </p>
          <Button variant="primary" size="md" className="w-full">
            了解会员权益
          </Button>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--text-xs)] text-[var(--text-muted)] hover:text-[var(--text-sub)] transition-colors"
        >
          明天再来 (每日重置)
        </button>
      </div>
    </Modal>
  )
}

export default PaywallModal
