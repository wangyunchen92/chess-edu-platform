import React, { useEffect, useRef } from 'react'
import { useBreakpoint } from '@/hooks/useBreakpoint'

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
  const { isMobile } = useBreakpoint()

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
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
      className={[
        'fixed inset-0 z-[1000]',
        isMobile ? 'flex items-end' : 'flex items-center justify-center',
      ].join(' ')}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-none" />

      {/* Content */}
      <div
        className={[
          'relative bg-[var(--bg-card)] shadow-[var(--shadow-xl)]',
          isMobile
            ? 'w-full rounded-t-[20px] max-h-[85vh] overflow-y-auto animate-[sheet-up_0.3s_ease-out]'
            : 'rounded-[var(--radius-lg)] animate-[modal-in_0.2s_ease-out]',
        ].join(' ')}
        style={isMobile
          ? { paddingBottom: 'env(safe-area-inset-bottom, 16px)' }
          : { width, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }
        }
      >
        {/* Drag handle for mobile */}
        {isMobile && (
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
          </div>
        )}

        <div className={isMobile ? 'px-5 pt-2 pb-5' : 'p-[var(--space-6)]'}>
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between mb-[var(--space-5)]">
              <h2 className="text-[var(--text-xl)] font-semibold text-[var(--text)]">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[var(--radius-xs)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--accent-light)] transition-colors"
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
      </div>

      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes sheet-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default Modal
