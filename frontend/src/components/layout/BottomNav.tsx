import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

interface BottomNavItem {
  path: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
}

const NAV_ITEMS: BottomNavItem[] = [
  {
    path: '/',
    label: '首页',
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
        <path d="M3 10l7-7 7 7M5 8.5V16a1 1 0 001 1h3v-4h2v4h3a1 1 0 001-1V8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    path: '/play',
    label: '对弈',
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
        <path d="M10 3c-1.5 0-2.5 1-2.5 2 0 .8.4 1.5 1 2L7 9h6l-1.5-2c.6-.5 1-1.2 1-2 0-1-1-2-2.5-2zM6 9v1l-1 3h10l-1-3V9M5 13l-1 4h12l-1-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    path: '/puzzles',
    label: '谜题',
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 6v8M6 10h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    path: '/learn',
    label: '学习',
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
        <path d="M4 5a1 1 0 011-1h10a1 1 0 011 1v11l-6-3-6 3V5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    path: '/profile',
    label: '我的',
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4 17c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    path: '/settings',
    label: '设置',
    adminOnly: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
        <path d="M10 13a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16.5 10a6.5 6.5 0 01-.4 2.2l1.6 1.3-1.4 2.4-2-.5a6.5 6.5 0 01-3.8 0l-2 .5-1.4-2.4 1.6-1.3a6.5 6.5 0 010-4.4L7.1 6.5l1.4-2.4 2 .5a6.5 6.5 0 013.8 0l2-.5 1.4 2.4-1.6 1.3c.3.7.4 1.4.4 2.2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

const BottomNav: React.FC = () => {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex">
        {items.map((item) => {
          const active = isActive(item.path)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[52px] min-w-[44px] py-1.5 transition-colors active:opacity-70"
              style={{
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                /* 44px minimum touch target */
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span className="flex items-center justify-center w-[44px] h-[28px]">
                {item.icon}
              </span>
              <span
                className="text-[10px] font-medium leading-none"
                style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
              >
                {item.label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
