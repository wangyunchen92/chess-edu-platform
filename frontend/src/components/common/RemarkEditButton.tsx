import React from 'react'

interface RemarkEditButtonProps {
  onClick: (e: React.MouseEvent) => void
  title?: string
}

/** Small pencil icon button for editing remark names. */
const RemarkEditButton: React.FC<RemarkEditButtonProps> = ({ onClick, title = '编辑备注名' }) => (
  <button
    onClick={(e) => {
      e.stopPropagation()
      onClick(e)
    }}
    title={title}
    className="inline-flex items-center justify-center w-6 h-6 rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors shrink-0"
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M10.08 1.92a1.5 1.5 0 0 1 2.12 2.12L4.95 11.29l-2.83.71.71-2.83L10.08 1.92z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
)

export default RemarkEditButton
