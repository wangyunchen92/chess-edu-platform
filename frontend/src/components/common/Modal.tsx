import React, { useEffect, useRef } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  width?: string
}

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  width = '480px',
}) => {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    // Prevent body scroll
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Content */}
      <div
        className="relative bg-[var(--bg-card)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xl)] p-[var(--space-6)] animate-[modal-in_0.2s_ease-out]"
        style={{ width, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between mb-[var(--space-5)]">
            <h2 className="text-[var(--text-xl)] font-semibold text-[var(--text)]">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-xs)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--accent-light)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        {children}
      </div>

      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default Modal
