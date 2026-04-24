import React from 'react'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'

interface DoudingWelcomeProps {
  open: boolean
  onClose: () => void
  onAccept: () => void
}

const DoudingWelcome: React.FC<DoudingWelcomeProps> = ({ open, onClose, onAccept }) => {
  return (
    <Modal open={open} onClose={onClose} title="">
      <div className="flex flex-col items-center text-center py-2">
        <div className="text-8xl mb-4 animate-bounce">{'\uD83D\uDC30'}</div>
        <h2 className="text-2xl font-bold text-[var(--text)] mb-2">
          Hi，我是豆丁老师 {'\uD83D\uDC4B'}
        </h2>
        <p className="text-[var(--text-sub)] text-sm mb-1">
          欢迎来到棋境大陆！
        </p>
        <p className="text-[var(--text-sub)] text-sm mb-6">
          现在跟我下第一局吧 {'\uD83D\uDE0A'}
        </p>

        <div className="flex gap-3 w-full">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            先看看
          </Button>
          <Button variant="primary" className="flex-1" onClick={onAccept}>
            好！来一局 {'\uD83D\uDC3E'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default DoudingWelcome
