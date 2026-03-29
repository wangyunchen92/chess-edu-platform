import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import BottomNav from './BottomNav'
import { useUIStore } from '@/stores/uiStore'

const AppLayout: React.FC = () => {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Sidebar: hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* TopNav: hidden on mobile */}
      <div className="hidden md:block">
        <TopNav />
      </div>

      {/* Main content area */}
      <main
        className="min-h-screen transition-[margin-left] duration-300 ease-[var(--ease-standard)] pt-0 md:pt-16"
        style={{ marginLeft: typeof window !== 'undefined' && window.innerWidth >= 768 ? (collapsed ? 68 : 240) : 0 }}
      >
        {/* Responsive margin-left via CSS */}
        <style>{`
          @media (max-width: 767px) {
            main { margin-left: 0 !important; }
          }
        `}</style>
        <div className="p-4 md:p-6 lg:p-8 pb-20 md:pb-6">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav: visible only on mobile */}
      <BottomNav />
    </div>
  )
}

export default AppLayout
