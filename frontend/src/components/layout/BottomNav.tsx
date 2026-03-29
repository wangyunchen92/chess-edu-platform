import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'

interface BottomNavItem {
  path: string
  label: string
  emoji: string
}

const NAV_ITEMS: BottomNavItem[] = [
  { path: '/', label: '首页', emoji: '\uD83C\uDFE0' },
  { path: '/play', label: '对弈', emoji: '\u2694\uFE0F' },
  { path: '/puzzles', label: '谜题', emoji: '\uD83E\uDDE9' },
  { path: '/learn', label: '学习', emoji: '\uD83D\uDCD6' },
  { path: '/profile', label: '我的', emoji: '\uD83D\uDC64' },
]

const BottomNav: React.FC = () => {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden border-t"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.path)
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors"
            style={{
              color: active ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            <span className="text-lg leading-none">{item.emoji}</span>
            <span
              className="text-[10px] font-medium"
              style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              {item.label}
            </span>
          </NavLink>
        )
      })}
    </nav>
  )
}

export default BottomNav
