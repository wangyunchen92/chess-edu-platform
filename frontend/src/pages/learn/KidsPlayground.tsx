import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { learnApi } from '@/api/learn'

interface ProgressItem {
  game_type: string
  level: number
  completed: boolean
  stars: number
}

const KidsPlayground: React.FC = () => {
  const navigate = useNavigate()
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    learnApi.getKidsProgress()
      .then((res) => {
        const raw = res?.data as any
        const data = raw?.data ?? raw
        if (Array.isArray(data)) {
          setProgressItems(data)
        }
      })
      .catch((err) => {
        console.error('[KidsPlayground] Failed to load progress:', err)
      })
      .finally(() => setLoading(false))
  }, [])

  // Count completed levels per game_type
  const recognizeCompleted = progressItems.filter(
    (p) => p.game_type === 'recognize' && p.completed
  ).length
  const captureCompleted = progressItems.filter(
    (p) => p.game_type === 'capture' && p.completed
  ).length

  const games = [
    {
      key: 'recognize',
      title: '找朋友',
      emoji: '\uD83C\uDFAF',
      subtitle: '认识每一个棋子朋友',
      gradient: 'from-pink-200 via-pink-100 to-rose-50',
      border: 'border-pink-200',
      shadow: 'shadow-pink-100/50',
      totalLevels: 6,
      completedLevels: recognizeCompleted,
      route: '/learn/kids/recognize',
    },
    {
      key: 'capture',
      title: '贪吃小棋手',
      emoji: '\uD83C\uDF54',
      subtitle: '用棋子吃掉所有目标',
      gradient: 'from-green-200 via-emerald-100 to-teal-50',
      border: 'border-green-200',
      shadow: 'shadow-green-100/50',
      totalLevels: 12,
      completedLevels: captureCompleted,
      route: '/learn/kids/capture',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <div className="text-5xl animate-bounce mb-3">{'\uD83C\uDFAA'}</div>
          <p className="text-[var(--text-muted)] text-lg">loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center py-4">
        <div className="text-4xl mb-2">{'\uD83C\uDFAA'}</div>
        <h2 className="text-xl font-bold text-[var(--text)]">
          {'\u6B22\u8FCE\u6765\u5230\u513F\u7AE5\u4E50\u56ED\uFF01'}
        </h2>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          {'\u9009\u62E9\u4E00\u4E2A\u6E38\u620F\u5F00\u59CB\u5427'}
        </p>
      </div>

      {/* Game cards */}
      <div className="space-y-4">
        {games.map((game) => (
          <button
            key={game.key}
            onClick={() => navigate(game.route)}
            className={`w-full bg-gradient-to-br ${game.gradient} ${game.border} border-2 rounded-2xl p-6 shadow-lg ${game.shadow} text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]`}
          >
            <div className="flex items-center gap-4">
              <div className="text-5xl shrink-0">{game.emoji}</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-gray-800">{game.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{game.subtitle}</p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 bg-white/60 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full transition-all duration-500"
                      style={{ width: `${(game.completedLevels / game.totalLevels) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 shrink-0">
                    {game.completedLevels}/{game.totalLevels}
                    {'\u5173'}
                  </span>
                </div>
              </div>
              <div className="text-2xl text-gray-400 shrink-0">{'\u203A'}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default KidsPlayground
