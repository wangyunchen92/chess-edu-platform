import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import apiClient from '@/api/client'
import Button from '@/components/common/Button'

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = useAuthStore((s) => s.login)
  const addToast = useUIStore((s) => s.addToast)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await apiClient.post('/auth/login', { username, password })
      // Backend returns: { code: 0, message: "success", data: { user: {...}, tokens: { access_token, refresh_token, token_type } } }
      const { user, tokens } = res.data.data
      login(tokens.access_token, tokens.refresh_token, user)
      addToast('success', 'Login successful')
      navigate('/', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#0b1120' }}
    >
      {/* Decorative gradient orbs */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-30 blur-[120px]"
        style={{
          background: 'radial-gradient(circle, var(--accent), transparent)',
          top: '-10%',
          right: '-5%',
        }}
      />
      <div
        className="absolute w-[400px] h-[400px] rounded-full opacity-20 blur-[100px]"
        style={{
          background: 'radial-gradient(circle, var(--accent-2), transparent)',
          bottom: '-10%',
          left: '-5%',
        }}
      />

      {/* Login card */}
      <div
        className="relative w-full max-w-[420px] mx-4 rounded-[var(--radius-xl)] p-8"
        style={{
          background: 'rgba(30, 41, 59, 0.6)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center shadow-[var(--shadow-accent)]">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 3L3 9l11 6 11-6-11-6zM3 19l11 6 11-6M3 14l11 6 11-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-[var(--text-3xl)] font-bold gradient-text mb-1">
            棋境大陆
          </h1>
          <p className="text-slate-400 text-[var(--text-sm)]">
            在线棋类教育平台
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="block text-slate-400 text-[var(--text-xs)] font-medium mb-1.5">
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              className="w-full px-4 py-2.5 rounded-[var(--radius-sm)] text-[var(--text-sm)] text-white placeholder-slate-500 outline-none transition-colors"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-slate-400 text-[var(--text-xs)] font-medium mb-1.5">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="w-full px-4 py-2.5 rounded-[var(--radius-sm)] text-[var(--text-sm)] text-white placeholder-slate-500 outline-none transition-colors"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-[var(--danger)] text-[var(--text-xs)] mt-1">{error}</p>
          )}

          {/* Submit */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="w-full mt-6"
          >
            登录
          </Button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
