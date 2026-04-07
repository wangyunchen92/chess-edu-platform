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
      setError('请输入用户名和密码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await apiClient.post('/auth/login', { username, password })
      // Backend returns: { code: 0, message: "success", data: { user: {...}, tokens: { access_token, refresh_token, token_type } } }
      const { user, tokens } = res.data.data
      login(tokens.access_token, tokens.refresh_token, user)
      addToast('success', '登录成功')
      navigate('/', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : '登录失败'
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
            <svg width="28" height="28" viewBox="0 0 45 45" fill="none">
              <g fill="#fff" fillRule="evenodd" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" />
                <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" />
                <path d="M 9.5,25.5 A 0.5,0.5 0 1 1 8.5,25.5 A 0.5,0.5 0 1 1 9.5,25.5 z" fill="#fff" />
                <path d="M 15,15.5 A 0.5,1.5 0 1 1 14,15.5 A 0.5,1.5 0 1 1 15,15.5 z" fill="#fff" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" />
              </g>
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
              placeholder="请输入用户名"
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
              placeholder="请输入密码"
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

        {/* Link to register */}
        <p className="text-center text-slate-400 text-[var(--text-sm)] mt-5">
          没有账号？{' '}
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="text-[var(--accent)] hover:underline font-medium"
          >
            立即注册
          </button>
        </p>
      </div>
    </div>
  )
}

export default LoginPage
