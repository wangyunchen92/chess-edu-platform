import React, { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import apiClient from '@/api/client'
import Button from '@/components/common/Button'

const RegisterPage: React.FC = () => {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = useAuthStore((s) => s.login)
  const addToast = useUIStore((s) => s.addToast)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const refCode = useMemo(() => searchParams.get('ref') || '', [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!phone.trim() || !password.trim() || !inviteCode.trim()) {
      setError('请填写所有必填项')
      return
    }

    if (!/^1\d{10}$/.test(phone)) {
      setError('请输入正确的11位手机号')
      return
    }

    if (password.length < 6) {
      setError('密码至少6位')
      return
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await apiClient.post('/auth/register', {
        phone,
        password,
        invite_code: inviteCode,
        ...(refCode ? { ref: refCode } : {}),
      })
      const { user, tokens } = res.data.data
      login(tokens.access_token, tokens.refresh_token, user)
      addToast('success', '注册成功')
      navigate('/', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : '注册失败'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'var(--accent)'
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
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

      {/* Register card */}
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
        <div className="text-center mb-6">
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
            注册账号
          </h1>
          <p className="text-slate-400 text-[var(--text-sm)]">
            棋境大陆 · 在线棋类教育平台
          </p>
        </div>

        {/* Referral banner */}
        {refCode && (
          <div className="mb-4 px-4 py-3 rounded-[var(--radius-sm)] text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))',
              border: '1px solid rgba(139,92,246,0.3)',
            }}
          >
            <span className="text-lg mr-1.5">{'\uD83C\uDF81'}</span>
            <span className="text-[var(--text-sm)] font-medium text-purple-300">
              好友邀请你来学棋！
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Phone */}
          <div>
            <label className="block text-slate-400 text-[var(--text-xs)] font-medium mb-1.5">
              手机号
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="请输入11位手机号"
              autoComplete="tel"
              className="w-full px-4 py-2.5 rounded-[var(--radius-sm)] text-[var(--text-sm)] text-white placeholder-slate-500 outline-none transition-colors"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
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
              placeholder="请输入密码（至少6位）"
              autoComplete="new-password"
              className="w-full px-4 py-2.5 rounded-[var(--radius-sm)] text-[var(--text-sm)] text-white placeholder-slate-500 outline-none transition-colors"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-slate-400 text-[var(--text-xs)] font-medium mb-1.5">
              确认密码
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入密码"
              autoComplete="new-password"
              className="w-full px-4 py-2.5 rounded-[var(--radius-sm)] text-[var(--text-sm)] text-white placeholder-slate-500 outline-none transition-colors"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

          {/* Invite Code */}
          <div>
            <label className="block text-slate-400 text-[var(--text-xs)] font-medium mb-1.5">
              邀请码
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="请输入邀请码"
              autoComplete="off"
              className="w-full px-4 py-2.5 rounded-[var(--radius-sm)] text-[var(--text-sm)] text-white placeholder-slate-500 outline-none transition-colors"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
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
            className="w-full mt-4"
          >
            注册
          </Button>
        </form>

        {/* Link to login */}
        <p className="text-center text-slate-400 text-[var(--text-sm)] mt-5">
          已有账号？{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-[var(--accent)] hover:underline font-medium"
          >
            返回登录
          </button>
        </p>
      </div>
    </div>
  )
}

export default RegisterPage
