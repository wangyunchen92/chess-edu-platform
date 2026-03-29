import React from 'react'
import { useLocation } from 'react-router-dom'

interface Props {
  children: React.ReactNode
  resetKey?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundaryClass extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidUpdate(prevProps: Props) {
    // Auto-reset when resetKey changes (i.e. route changed)
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null })
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            gap: '16px',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '48px' }}>😵</span>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
            页面出了点问题
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '400px' }}>
            {this.state.error?.message || '发生了未知错误'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '8px',
              padding: '8px 24px',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🔄 重试
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * ErrorBoundary that auto-resets on route change.
 * Uses useLocation().pathname as resetKey.
 */
const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation()

  return (
    <ErrorBoundaryClass resetKey={location.pathname}>
      {children}
    </ErrorBoundaryClass>
  )
}

export default ErrorBoundary
