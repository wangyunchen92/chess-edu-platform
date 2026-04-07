import React from 'react'
import { useUIStore, type ToastItem } from '@/stores/uiStore'

const iconMap: Record<ToastItem['type'], React.ReactNode> = {
  success: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="var(--success)" />
      <path d="M5.5 9l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="var(--danger)" />
      <path d="M6 6l6 6M12 6l-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="var(--info)" />
      <path d="M9 8v4M9 6h.01" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
}

const bgMap: Record<ToastItem['type'], string> = {
  success: 'border-l-[var(--success)]',
  error: 'border-l-[var(--danger)]',
  info: 'border-l-[var(--info)]',
}

const ToastContainer: React.FC = () => {
  const toasts = useUIStore((s) => s.toasts)
  const removeToast = useUIStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div
      className={[
        'fixed z-[1100] flex flex-col gap-[var(--space-3)]',
        // Mobile: bottom center, above BottomNav; Desktop: top right
        'bottom-20 left-4 right-4 items-center',
        'md:bottom-auto md:left-auto md:top-[var(--space-5)] md:right-[var(--space-5)] md:items-end md:max-w-sm',
      ].join(' ')}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={[
            'flex items-center gap-3 px-4 py-3 w-full',
            'bg-[var(--bg-card)] rounded-[var(--radius-sm)]',
            'shadow-[var(--shadow-lg)] border-l-4',
            bgMap[toast.type],
            'animate-[toast-in_0.25s_ease-out]',
            'md:max-w-sm',
          ].join(' ')}
        >
          {iconMap[toast.type]}
          <span className="text-[var(--text-sm)] text-[var(--text)] flex-1">
            {toast.message}
          </span>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-[var(--text-muted)] hover:text-[var(--text)] ml-2 shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}

      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (min-width: 768px) {
          @keyframes toast-in {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
          }
        }
      `}</style>
    </div>
  )
}

export default ToastContainer
