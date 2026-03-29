import React from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import Button from '@/components/common/Button'

const tabs = [
  { label: '数据概览', path: '/admin', exact: true },
  { label: '账号管理', path: '/admin/users', exact: false },
  { label: '会员管理', path: '/admin/membership', exact: false },
  { label: '积分经验', path: '/admin/points', exact: false },
]

const AdminLayout: React.FC = () => {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const location = useLocation()

  // Permission check
  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-5xl">&#x1F6AB;</div>
        <h2 className="text-[var(--text-xl)] font-bold text-[var(--text)]">无权访问</h2>
        <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
          只有管理员才能访问后台管理页面
        </p>
        <Button variant="primary" size="sm" onClick={() => navigate('/dashboard')}>
          返回首页
        </Button>
      </div>
    )
  }

  const isTabActive = (tab: typeof tabs[number]) => {
    if (tab.exact) return location.pathname === tab.path
    return location.pathname.startsWith(tab.path)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[var(--text-2xl)] font-bold text-[var(--text)] mb-4">
          后台管理
        </h1>

        {/* Tab Navigation */}
        <div className="flex gap-1 border-b border-[var(--border)]">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.exact}
              className={() =>
                [
                  'px-4 py-2.5 text-[var(--text-sm)] font-medium transition-colors relative',
                  isTabActive(tab)
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                ].join(' ')
              }
            >
              {tab.label}
              {isTabActive(tab) && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)] rounded-t" />
              )}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Child route content */}
      <Outlet />
    </div>
  )
}

export default AdminLayout
