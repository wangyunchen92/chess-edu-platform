import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import BottomNav from './BottomNav'
import { useUIStore } from '@/stores/uiStore'
import { useBreakpoint } from '@/hooks/useBreakpoint'

const AppLayout: React.FC = () => {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const { isMobile } = useBreakpoint()

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Sidebar + TopNav: desktop only */}
      {!isMobile && (
        <>
          <Sidebar />
          <TopNav />
        </>
      )}

      {/* Main content area */}
      <main
        className="min-h-screen transition-[margin-left] duration-300 ease-[var(--ease-standard)]"
        style={{
          marginLeft: isMobile ? 0 : (collapsed ? 68 : 240),
          paddingTop: isMobile ? 0 : 64,
        }}
      >
        <div className="p-4 md:p-6 lg:p-8 pb-20 md:pb-6">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav: mobile only */}
      {isMobile && <BottomNav />}
    </div>
  )
}

export default AppLayout
