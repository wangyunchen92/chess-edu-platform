import React, { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

const LandingPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code') || ''
  const ref = searchParams.get('ref') || ''

  const registerHref = useMemo(() => {
    const params = new URLSearchParams()
    if (code) params.set('code', code)
    if (ref || !code) params.set('ref', ref || 'landing')
    const qs = params.toString()
    return qs ? `/register?${qs}` : '/register'
  }, [code, ref])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between px-6 py-10"
      style={{
        background:
          'linear-gradient(180deg, rgba(30,27,75,1) 0%, rgba(15,23,42,1) 100%)',
      }}
    >
      <div />
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="text-8xl mb-6">{'\uD83C\uDFF0'}</div>
        <h1 className="text-4xl font-extrabold text-white tracking-wide">
          棋境大陆
        </h1>
        <p className="text-lg text-slate-300 mt-3">
          让孩子在家，学会国际象棋
        </p>
        <div className="flex gap-2 mt-4 text-xs text-slate-400 flex-wrap justify-center">
          <span className="px-3 py-1 rounded-full bg-white/10">AI 陪练</span>
          <span className="px-3 py-1 rounded-full bg-white/10">每周数据</span>
          <span className="px-3 py-1 rounded-full bg-white/10">游戏化</span>
        </div>

        <Link
          to={registerHref}
          className="mt-10 px-10 py-4 rounded-full font-bold text-lg text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{
            background: 'linear-gradient(90deg, #8b5cf6, #6366f1)',
            boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4)',
          }}
        >
          开始试玩 {'\u2192'}
        </Link>

        <p className="text-xs text-slate-500 mt-6">
          已有小棋手在这里冒险学习
        </p>
      </div>

      <div className="text-[10px] text-slate-600 text-center">
        <p>© 棋境大陆 · 面向 4-12 岁儿童的国际象棋在线学习平台</p>
      </div>
    </div>
  )
}

export default LandingPage
