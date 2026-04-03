import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
  teacherOnly?: boolean
}

const navItems: NavItem[] = [
  {
    path: '/',
    label: '首页',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 10l7-7 7 7M5 8.5V16a1 1 0 001 1h3v-4h2v4h3a1 1 0 001-1V8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    path: '/play',
    label: '对弈',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 3c-1.5 0-2.5 1-2.5 2 0 .8.4 1.5 1 2L7 9h6l-1.5-2c.6-.5 1-1.2 1-2 0-1-1-2-2.5-2zM6 9v1l-1 3h10l-1-3V9M5 13l-1 4h12l-1-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    path: '/puzzles',
    label: '谜题',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 6v8M6 10h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    path: '/learn',
    label: '学习',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 5a1 1 0 011-1h10a1 1 0 011 1v11l-6-3-6 3V5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    path: '/adventure',
    label: '冒险',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2l2.5 5.5L18 8.5l-4 4 1 5.5L10 15l-5 3 1-5.5-4-4 5.5-1L10 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    path: '/train',
    label: '训练',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 10a6 6 0 1112 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M10 10V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="10" cy="10" r="1.5" fill="currentColor" />
        <path d="M6 16h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    path: '/diagnosis',
    label: '弱点诊断',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    path: '/profile',
    label: '我的',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4 17c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    path: '/teacher',
    label: '我的学生',
    teacherOnly: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M2 17c0-3.3 2.4-5.5 6-5.5s6 2.2 6 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="15" cy="7" r="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M15 11c2.2 0 4 1.3 4 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    path: '/settings',
    label: '设置',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 13a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16.5 10a6.5 6.5 0 01-.4 2.2l1.6 1.3-1.4 2.4-2-.5a6.5 6.5 0 01-3.8 0l-2 .5-1.4-2.4 1.6-1.3a6.5 6.5 0 010-4.4L7.1 6.5l1.4-2.4 2 .5a6.5 6.5 0 013.8 0l2-.5 1.4 2.4-1.6 1.3c.3.7.4 1.4.4 2.2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

const Sidebar: React.FC = () => {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const isTeacher = user?.role === 'teacher'
  const visibleItems = navItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false
    if (item.teacherOnly && !isTeacher) return false
    return true
  })

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-30 flex flex-col transition-[width] duration-300 ease-[var(--ease-standard)]"
      style={{
        width: collapsed ? 68 : 240,
        backgroundColor: '#0b1120',
      }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Logo icon */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 2L2 6l7 4 7-4-7-4zM2 12l7 4 7-4M2 9l7 4 7-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {!collapsed && (
            <span className="text-white font-bold text-[var(--text-lg)] whitespace-nowrap">
              棋境大陆
            </span>
          )}
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 mt-2 px-3 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={() =>
              [
                'flex items-center gap-3 rounded-[var(--radius-sm)] transition-all duration-200',
                collapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5',
                isActive(item.path)
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]',
              ].join(' ')
            }
          >
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && (
              <span className="text-[var(--text-sm)] font-medium whitespace-nowrap">
                {item.label}
              </span>
            )}
            {/* Active indicator */}
            {isActive(item.path) && (
              <span
                className="absolute left-0 w-[3px] h-6 rounded-r-full bg-[var(--accent)]"
                style={{ position: 'absolute' }}
              />
            )}
          </NavLink>
        ))}
      </nav>

      {/* Collapse button */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-[var(--radius-sm)] text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
          >
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {!collapsed && (
            <span className="text-[var(--text-xs)] font-medium">折叠</span>
          )}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
