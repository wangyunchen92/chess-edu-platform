import React from 'react'
import { useLocation } from 'react-router-dom'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import Avatar from '@/components/common/Avatar'

/** Map route paths to page titles */
function getPageTitle(pathname: string): string {
  const map: Record<string, string> = {
    '/': '首页',
    '/play': '角色大厅',
    '/play/history': '对局记录',
    '/puzzles': '谜题',
    '/puzzles/daily': '每日一题',
    '/puzzles/challenge': '谜题挑战',
    '/puzzles/mistakes': '错题本',
    '/learn': '课程学习',
    '/train': '每日训练',
    '/profile': '个人中心',
    '/profile/achievements': '成就',
    '/settings': '设置',
    '/admin/users': '用户管理',
    '/adventure': '棋境大陆',
  }

  // Exact match first
  if (map[pathname]) return map[pathname]

  // Prefix match
  if (pathname.startsWith('/play/game/')) return '对弈'
  if (pathname.startsWith('/play/review/')) return '复盘'
  if (pathname.startsWith('/puzzles/solve/')) return '解题'
  if (pathname.startsWith('/learn/lesson/')) return '课程'
  if (pathname.startsWith('/learn/exercise/')) return '练习'

  return '棋境大陆'
}

const TopNav: React.FC = () => {
  const location = useLocation()
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const user = useAuthStore((s) => s.user)
  const title = getPageTitle(location.pathname)

  return (
    <header
      className="fixed top-0 right-0 z-20 h-16 flex items-center justify-between px-6 glass border-b border-[var(--border)]"
      style={{
        left: collapsed ? 68 : 240,
        transition: 'left 0.3s var(--ease-standard)',
      }}
    >
      {/* Left: Page title */}
      <h1 className="text-[var(--text-lg)] font-semibold text-[var(--text)]">
        {title}
      </h1>

      {/* Right: actions */}
      <div className="flex items-center gap-4">
        {/* Notification bell */}
        <button className="relative w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--accent-light)] transition-colors">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2a5 5 0 00-5 5v3l-1.5 2.5h13L15 10V7a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 15a2 2 0 004 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {/* Notification dot */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--danger)] rounded-full" />
        </button>

        {/* User avatar */}
        {user && (
          <div className="flex items-center gap-2.5">
            <Avatar
              src={user.avatar_url ?? undefined}
              name={user.nickname || user.username}
              size="sm"
            />
            <span className="text-[var(--text-sm)] font-medium text-[var(--text)] hidden sm:block">
              {user.nickname || user.username}
            </span>
          </div>
        )}
      </div>
    </header>
  )
}

export default TopNav
