import React from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from './Modal'
import Button from './Button'

interface InsufficientCreditsModalProps {
  open: boolean
  onClose: () => void
  required: number
  balance: number
}

const InsufficientCreditsModal: React.FC<InsufficientCreditsModalProps> = ({
  open,
  onClose,
  required,
  balance,
}) => {
  const navigate = useNavigate()

  return (
    <Modal open={open} onClose={onClose} title="积分不足" width="400px">
      <div className="text-center space-y-5 py-2">
        <div className="text-5xl">{'\uD83D\uDCB0'}</div>
        <div className="space-y-2">
          <p className="text-[var(--text-md)] text-[var(--text)] font-semibold">
            积分不足
          </p>
          <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
            本次操作需要 <strong className="text-[var(--accent)]">{required}</strong> 积分
          </p>
          <p className="text-[var(--text-sm)] text-[var(--text-muted)]">
            当前余额: <strong className="text-[var(--danger)]">{balance}</strong> 积分
          </p>
        </div>
        <div className="space-y-3">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              onClose()
              navigate('/profile')
            }}
          >
            去充值
          </Button>
          <button
            onClick={onClose}
            className="text-[var(--text-xs)] text-[var(--text-muted)] hover:text-[var(--text-sub)] transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default InsufficientCreditsModal
