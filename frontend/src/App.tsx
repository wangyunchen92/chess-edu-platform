import React, { Suspense } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import ToastContainer from '@/components/common/Toast'
import AppLayout from '@/components/layout/AppLayout'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import Loading from '@/components/common/Loading'

// Auth (kept eager — small & on critical path)
import LoginPage from '@/pages/auth/LoginPage'
import AssessmentPage from '@/pages/auth/AssessmentPage'

// ── Lazy-loaded page components (grouped by module) ──────────────

// Dashboard
const DashboardPage = React.lazy(() => import('@/pages/dashboard/DashboardPage'))

// Play
const CharacterHallPage = React.lazy(() => import('@/pages/play/CharacterHallPage'))
const GamePage = React.lazy(() => import('@/pages/play/GamePage'))
const ReviewPage = React.lazy(() => import('@/pages/play/ReviewPage'))
const GameHistoryPage = React.lazy(() => import('@/pages/play/GameHistoryPage'))

// Puzzles
const PuzzlesHomePage = React.lazy(() => import('@/pages/puzzles/PuzzlesHomePage'))
const DailyPuzzlePage = React.lazy(() => import('@/pages/puzzles/DailyPuzzlePage'))
const PuzzleChallengePage = React.lazy(() => import('@/pages/puzzles/PuzzleChallengePage'))
const PuzzleSolvePage = React.lazy(() => import('@/pages/puzzles/PuzzleSolvePage'))
const MistakeBookPage = React.lazy(() => import('@/pages/puzzles/MistakeBookPage'))

// Learn
const CourseListPage = React.lazy(() => import('@/pages/learn/CourseListPage'))
const LessonPage = React.lazy(() => import('@/pages/learn/LessonPage'))
const InteractiveTeachPage = React.lazy(() => import('@/pages/learn/InteractiveTeachPage'))
const ExercisePage = React.lazy(() => import('@/pages/learn/ExercisePage'))

// Adventure
const AdventureMapPage = React.lazy(() => import('@/pages/adventure/AdventureMapPage'))

// Train
const DailyPlanPage = React.lazy(() => import('@/pages/train/DailyPlanPage'))
const TrainStatsPage = React.lazy(() => import('@/pages/train/TrainStatsPage'))

// Profile
const ProfilePage = React.lazy(() => import('@/pages/profile/ProfilePage'))
const AchievementsPage = React.lazy(() => import('@/pages/profile/AchievementsPage'))

// Settings
const SettingsPage = React.lazy(() => import('@/pages/settings/SettingsPage'))

// Admin
const UserManagePage = React.lazy(() => import('@/pages/admin/UserManagePage'))

/**
 * Suspense wrapper providing a loading fallback for lazy-loaded pages.
 */
const SuspenseWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<Loading size="lg" text="加载中..." />}>
    <ErrorBoundary>{children}</ErrorBoundary>
  </Suspense>
)

/**
 * ProtectedRoute: redirects to /login if not authenticated.
 * Optionally requires admin role.
 */
const ProtectedRoute: React.FC<{ requireAdmin?: boolean }> = ({ requireAdmin = false }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

/**
 * PublicRoute: redirects to / if already authenticated.
 */
const PublicRoute: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

function App() {
  return (
    <>
      <ToastContainer />

      <Routes>
        {/* Public routes */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Assessment (protected, no layout) */}
        <Route element={<ProtectedRoute />}>
          <Route path="/assessment" element={<AssessmentPage />} />
        </Route>

        {/* Lesson page — full-screen immersive, no app layout */}
        <Route element={<ProtectedRoute />}>
          <Route path="/learn/lesson/:id" element={<SuspenseWrapper><LessonPage /></SuspenseWrapper>} />
        </Route>

        {/* Protected routes with layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<SuspenseWrapper><DashboardPage /></SuspenseWrapper>} />

            {/* Play */}
            <Route path="/play" element={<SuspenseWrapper><CharacterHallPage /></SuspenseWrapper>} />
            <Route path="/play/game/:id" element={<SuspenseWrapper><GamePage /></SuspenseWrapper>} />
            <Route path="/play/review/:id" element={<SuspenseWrapper><ReviewPage /></SuspenseWrapper>} />
            <Route path="/play/history" element={<SuspenseWrapper><GameHistoryPage /></SuspenseWrapper>} />

            {/* Puzzles */}
            <Route path="/puzzles" element={<SuspenseWrapper><PuzzlesHomePage /></SuspenseWrapper>} />
            <Route path="/puzzles/daily" element={<SuspenseWrapper><DailyPuzzlePage /></SuspenseWrapper>} />
            <Route path="/puzzles/challenge" element={<SuspenseWrapper><PuzzleChallengePage /></SuspenseWrapper>} />
            <Route path="/puzzles/solve/:id" element={<SuspenseWrapper><PuzzleSolvePage /></SuspenseWrapper>} />
            <Route path="/puzzles/mistakes" element={<SuspenseWrapper><MistakeBookPage /></SuspenseWrapper>} />

            {/* Learn */}
            <Route path="/learn" element={<SuspenseWrapper><CourseListPage /></SuspenseWrapper>} />
            <Route path="/learn/ai-teach/:id" element={<SuspenseWrapper><InteractiveTeachPage /></SuspenseWrapper>} />
            <Route path="/learn/exercise/:id" element={<SuspenseWrapper><ExercisePage /></SuspenseWrapper>} />

            {/* Adventure */}
            <Route path="/adventure" element={<SuspenseWrapper><AdventureMapPage /></SuspenseWrapper>} />

            {/* Train */}
            <Route path="/train" element={<SuspenseWrapper><DailyPlanPage /></SuspenseWrapper>} />
            <Route path="/train/stats" element={<SuspenseWrapper><TrainStatsPage /></SuspenseWrapper>} />

            {/* Profile */}
            <Route path="/profile" element={<SuspenseWrapper><ProfilePage /></SuspenseWrapper>} />
            <Route path="/profile/achievements" element={<SuspenseWrapper><AchievementsPage /></SuspenseWrapper>} />

            {/* Settings */}
            <Route path="/settings" element={<SuspenseWrapper><SettingsPage /></SuspenseWrapper>} />
          </Route>
        </Route>

        {/* Admin routes */}
        <Route element={<ProtectedRoute requireAdmin />}>
          <Route element={<AppLayout />}>
            <Route path="/admin/users" element={<SuspenseWrapper><UserManagePage /></SuspenseWrapper>} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
