import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import { freePlayApi } from '@/api/freePlay'
import { Chess } from 'chess.js'

// ---------------------------------------------------------------------------
// Mode card data
// ---------------------------------------------------------------------------

interface ModeCard {
  key: string
  title: string
  description: string
  icon: string
  color: string
}

const MODE_CARDS: ModeCard[] = [
  {
    key: 'face_to_face',
    title: '面对面对弈',
    description: '两人共用一个屏幕，轮流走子。适合和朋友、家人一起下棋。',
    icon: '\u{1F91D}',
    color: 'from-blue-500/20 to-cyan-500/10',
  },
  {
    key: 'solo',
    title: '自己摆棋',
    description: '一个人两边都走，研究局面和走法，随意摆布棋子。',
    icon: '\u{1F9D0}',
    color: 'from-purple-500/20 to-violet-500/10',
  },
  {
    key: 'import_pgn',
    title: '导入棋谱',
    description: '粘贴 PGN 棋谱文本，直接进入复盘分析。',
    icon: '\u{1F4CB}',
    color: 'from-amber-500/20 to-orange-500/10',
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const FreePlayPage: React.FC = () => {
  const navigate = useNavigate()

  // Settings
  const [opponentName, setOpponentName] = useState('')
  const [timeControl, setTimeControl] = useState(0)

  // PGN import modal
  const [showPgnModal, setShowPgnModal] = useState(false)
  const [pgnText, setPgnText] = useState('')
  const [pgnError, setPgnError] = useState('')
  const [importing, setImporting] = useState(false)

  // ---------------------------------------------------------------------------
  // Create a free game (face_to_face or solo)
  // ---------------------------------------------------------------------------

  const handleCreateFreeGame = useCallback(async () => {
    try {
      const res = await freePlayApi.createFreeGame({
        game_type: 'free_play',
        opponent_name: opponentName.trim() || undefined,
        time_control: timeControl,
      })
      const data = (res.data as any)?.data ?? res.data
      const gameId = data?.game_id ?? data?.id
      if (gameId) {
        navigate(`/play/free/game/${gameId}`)
      }
    } catch (err) {
      console.error('[FreePlayPage] Failed to create free game:', err)
    }
  }, [opponentName, timeControl, navigate])

  // ---------------------------------------------------------------------------
  // Handle mode card click
  // ---------------------------------------------------------------------------

  const handleModeClick = useCallback((key: string) => {
    if (key === 'face_to_face' || key === 'solo') {
      handleCreateFreeGame()
    } else if (key === 'import_pgn') {
      setShowPgnModal(true)
      setPgnText('')
      setPgnError('')
    }
  }, [handleCreateFreeGame])

  // ---------------------------------------------------------------------------
  // PGN import
  // ---------------------------------------------------------------------------

  const handleImportPgn = useCallback(async () => {
    const trimmed = pgnText.trim()
    if (!trimmed) {
      setPgnError('请输入 PGN 棋谱文本')
      return
    }

    // Validate PGN with chess.js
    try {
      const chess = new Chess()
      chess.loadPgn(trimmed)
      if (chess.history().length === 0) {
        setPgnError('PGN 中未包含有效走法')
        return
      }
    } catch {
      setPgnError('PGN 格式不正确，请检查后重试')
      return
    }

    setPgnError('')
    setImporting(true)

    try {
      const res = await freePlayApi.createFreeGame({
        game_type: 'imported',
        pgn: trimmed,
      })
      const data = (res.data as any)?.data ?? res.data
      const gameId = data?.game_id ?? data?.id
      if (gameId) {
        setShowPgnModal(false)
        navigate(`/play/review/${gameId}`)
      }
    } catch (err) {
      console.error('[FreePlayPage] Failed to import PGN:', err)
      setPgnError('导入失败，请稍后重试')
    } finally {
      setImporting(false)
    }
  }, [pgnText, navigate])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => navigate('/play')}
            className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4L6 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-[var(--text-3xl)] font-bold text-[var(--text)]">
            自由对弈
          </h1>
        </div>
        <p className="text-[var(--text-sm)] text-[var(--text-sub)] ml-8">
          不计评分，自由练习。和朋友下棋、自己研究局面、或导入棋谱复盘分析。
        </p>
      </div>

      {/* Mode cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {MODE_CARDS.map((mode) => (
          <Card
            key={mode.key}
            hoverable
            padding="lg"
            className={`bg-gradient-to-br ${mode.color} border border-[var(--border)] cursor-pointer group`}
            onClick={() => handleModeClick(mode.key)}
          >
            <div className="text-center space-y-3">
              <div className="text-4xl">{mode.icon}</div>
              <h3 className="text-[var(--text-lg)] font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                {mode.title}
              </h3>
              <p className="text-[var(--text-sm)] text-[var(--text-sub)] leading-relaxed">
                {mode.description}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Settings */}
      <Card padding="md">
        <h3 className="text-[var(--text-md)] font-semibold text-[var(--text)] mb-4">
          对弈设置（可选）
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Opponent name */}
          <div>
            <label className="block text-[var(--text-sm)] text-[var(--text-sub)] mb-1.5">
              对手名称
            </label>
            <input
              type="text"
              value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)}
              placeholder="输入对手的名字..."
              maxLength={100}
              className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-[var(--text-sm)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Time control */}
          <div>
            <label className="block text-[var(--text-sm)] text-[var(--text-sub)] mb-1.5">
              时间控制
            </label>
            <select
              value={timeControl}
              onChange={(e) => setTimeControl(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-[var(--text-sm)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value={0}>无限制</option>
              <option value={180}>3 分钟</option>
              <option value={300}>5 分钟</option>
              <option value={600}>10 分钟</option>
              <option value={900}>15 分钟</option>
              <option value={1800}>30 分钟</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Quick links */}
      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={() => navigate('/play/editor')}>
          棋盘编辑器
        </Button>
        <Button variant="secondary" onClick={() => navigate('/play/history')}>
          对局历史
        </Button>
      </div>

      {/* PGN Import Modal */}
      <Modal
        open={showPgnModal}
        onClose={() => setShowPgnModal(false)}
        title="导入 PGN 棋谱"
        width="560px"
      >
        <div className="space-y-4">
          <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
            粘贴标准 PGN 格式的棋谱文本，导入后可进行复盘分析。
          </p>
          <textarea
            value={pgnText}
            onChange={(e) => {
              setPgnText(e.target.value)
              setPgnError('')
            }}
            placeholder={`例如:\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7`}
            rows={10}
            className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-[var(--text-sm)] font-mono placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-y"
          />
          {pgnError && (
            <p className="text-[var(--text-sm)] text-[var(--danger)]">
              {pgnError}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowPgnModal(false)}>
              取消
            </Button>
            <Button loading={importing} onClick={handleImportPgn}>
              导入并分析
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default FreePlayPage
