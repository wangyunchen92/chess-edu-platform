import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useChessGame } from '@/hooks/useChessGame'
import { useAuthStore } from '@/stores/authStore'
import type { CharacterConfig } from '@/engine/CharacterEngine'
import { buildCharacterConfigFromJSON } from '@/engine/CharacterEngine'
import Chessboard from '@/components/chess/Chessboard'
import MoveList from '@/components/chess/MoveList'
import GameTimer from '@/components/chess/GameTimer'
import CapturedPieces from '@/components/chess/CapturedPieces'
import CharacterAvatar from '@/components/character/CharacterAvatar'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import { Chess } from 'chess.js'
import { playApi } from '@/api/play'
import { gamificationApi } from '@/api/gamification'

// ---------------------------------------------------------------------------
// Character presets (matches CharacterHallPage ids)
// ---------------------------------------------------------------------------

/**
 * 9 个角色的引擎配置预设
 *
 * 每个角色通过 buildCharacterConfigFromJSON 从 engine_params 构建完整配置，
 * 包含棋风参数 playStyleParams，用于 PlayStyleController 差异化走法选择。
 *
 * 入门段（meadow）：豆丁(500) / 棉花糖(650) / 龟龟(750)
 * 初级段（forest）：冬冬(850) / 狸花花(1000) / 铁墩墩(1100)
 * 中级段（plateau）：银鬃(1300) / 咕噜(1450) / 云朵师父(1550)
 */
const CHARACTER_PRESETS: Record<string, CharacterConfig & { emoji: string }> = {
  // ── 入门段 ─────────────────────────────────────────
  douding: {
    ...buildCharacterConfigFromJSON({
      id: 'douding', name: '豆丁', rating: 500,
      engine_params: {
        depth_min: 3, depth_max: 5, error_rate: 0.3,
        prefer_simple_moves: true, avoid_long_sequences: true,
      },
    }),
    emoji: '🐰',
  },
  mianhuatang: {
    ...buildCharacterConfigFromJSON({
      id: 'mianhuatang', name: '棉花糖', rating: 650,
      engine_params: {
        depth_min: 4, depth_max: 6, error_rate: 0.28,
        prefer_aggressive: true, prefer_center_control: true,
        avoid_long_endgames: true,
      },
    }),
    emoji: '🧁',
  },
  guigui: {
    ...buildCharacterConfigFromJSON({
      id: 'guigui', name: '龟龟', rating: 750,
      engine_params: {
        depth_min: 5, depth_max: 7, error_rate: 0.25,
        prefer_defensive: true, prefer_solid_structure: true,
        endgame_strength: 0.85,
      },
    }),
    emoji: '🐢',
  },
  // ── 初级段 ─────────────────────────────────────────
  dongdong: {
    ...buildCharacterConfigFromJSON({
      id: 'dongdong', name: '冬冬', rating: 850,
      engine_params: {
        depth_min: 6, depth_max: 8, error_rate: 0.25,
        balanced_play: true, prefer_solid_structure: true,
      },
    }),
    emoji: '👦',
  },
  lihuahua: {
    ...buildCharacterConfigFromJSON({
      id: 'lihuahua', name: '狸花花', rating: 1000,
      engine_params: {
        depth_min: 7, depth_max: 9, error_rate: 0.2,
        prefer_traps: true, prefer_tactical: true,
        trap_frequency: 0.2,
      },
    }),
    emoji: '🐱',
  },
  tiedundun: {
    ...buildCharacterConfigFromJSON({
      id: 'tiedundun', name: '铁墩墩', rating: 1100,
      engine_params: {
        depth_min: 8, depth_max: 10, error_rate: 0.15,
        defensive_bias: 0.8, prefer_solid_structure: true,
        prefer_closed_positions: true, counterattack_threshold: 0.6,
      },
    }),
    emoji: '🤖',
  },
  // ── 中级段 ─────────────────────────────────────────
  yinzong: {
    ...buildCharacterConfigFromJSON({
      id: 'yinzong', name: '银鬃', rating: 1300,
      engine_params: {
        depth_min: 10, depth_max: 12, error_rate: 0.1,
        aggressive_bias: 0.7, prefer_open_positions: true,
        prefer_piece_activity: true, kingside_attack_weight: 0.6,
      },
    }),
    emoji: '⚔️',
  },
  gulu: {
    ...buildCharacterConfigFromJSON({
      id: 'gulu', name: '咕噜', rating: 1450,
      engine_params: {
        depth_min: 11, depth_max: 13, error_rate: 0.08,
        prefer_traps: true, positional_play: true,
        trap_frequency: 0.3, sacrifice_willingness: 0.4,
        poison_pawn_tendency: 0.25,
      },
    }),
    emoji: '🦊',
  },
  yunduoshifu: {
    ...buildCharacterConfigFromJSON({
      id: 'yunduoshifu', name: '云朵师父', rating: 1550,
      engine_params: {
        depth_min: 12, depth_max: 14, error_rate: 0.05,
        positional_bias: 0.8, balanced_play: true,
        adaptive_style: true, endgame_strength: 0.9,
      },
    }),
    emoji: '☁️',
  },
}

// ---------------------------------------------------------------------------
// Dialogue map
// ---------------------------------------------------------------------------

const DIALOGUE_MAP: Record<string, Record<string, string>> = {
  douding: {
    good_move: '哇，好厉害的一步！',
    blunder: '嘻嘻，豆丁也会犯错~',
    check_given: '将军！小心哦~',
    check_received: '呀，被将军了！',
    capture_given: '吃掉你一个棋子~',
    capture_received: '呜呜，豆丁的棋子...',
    advantage: '豆丁好像占优了耶！',
    disadvantage: '呀，形势不太好...',
  },
  mianhuatang: {
    good_move: '这步走得真甜~',
    blunder: '呀，棉花糖走错了...',
    check_given: '将军！甜蜜的一击~',
    check_received: '哎呀，被将了！',
    capture_given: '再来一块棉花糖~',
    capture_received: '棉花糖的棋子被吃了！',
    advantage: '甜度正在上升中~',
    disadvantage: '甜度下降了...',
  },
  guigui: {
    good_move: '......不错的一步。',
    blunder: '......龟龟太慢了。',
    check_given: '......将军。',
    check_received: '......被将了。',
    capture_given: '......慢慢吃。',
    capture_received: '......没关系。',
    advantage: '......形势不错。',
    disadvantage: '......需要更稳。',
  },
  dongdong: {
    good_move: '不错！你基本功挺扎实的！',
    blunder: '啊...我怎么走了这步！再来！',
    check_given: '将军！我练了好久这招！',
    check_received: '被将了！没关系，冬冬不认输！',
    capture_given: '吃掉！冬冬的努力没白费！',
    capture_received: '唔...被吃了，但我会扳回来的！',
    advantage: '嘿嘿，冬冬占优了！',
    disadvantage: '形势不太好...但冬冬绝不放弃！',
  },
  lihuahua: {
    good_move: '哼~你还挺机灵的嘛！',
    blunder: '呀！花花怎么会犯这种错！',
    check_given: '嘻嘻~将军！看到了吗？',
    check_received: '哎呀！你识破了我的计划！',
    capture_given: '中计啦~吃掉你的棋子！',
    capture_received: '哼...你很狡猾嘛！',
    advantage: '嘻嘻~一切都在花花的计划中~',
    disadvantage: '哼哼...别得意，花花还有后手！',
  },
  tiedundun: {
    good_move: '检测到...优质走法。值得学习。',
    blunder: '系统错误...铁墩墩需要修复...',
    check_given: '防御模式：反击！将军！',
    check_received: '警告：王城受到威胁！启动加固程序！',
    capture_given: '目标捕获成功。',
    capture_received: '损失可控...防线依然稳固。',
    advantage: '优势确立...继续巩固阵地。',
    disadvantage: '切换防御模式...重建防线中...',
  },
  yinzong: {
    good_move: '好剑法！你是个值得尊敬的对手！',
    blunder: '失误了...骑士不该犯这种错！',
    check_given: '银鬃之剑，将军！',
    check_received: '好攻势！但骑士不会退缩！',
    capture_given: '堂堂正正，夺下此子！',
    capture_received: '好一招...但战斗才刚开始！',
    advantage: '银鬃的旗帜高高飘扬！',
    disadvantage: '形势严峻...但骑士永不言败！',
  },
  gulu: {
    good_move: '嘿嘿...你没那么好骗嘛~',
    blunder: '嗯？这步不太优雅...当我没走~',
    check_given: '将军~这步，你没想到吧？',
    check_received: '哦？有点意思...你看到了什么？',
    capture_given: '这颗子...就收下了~',
    capture_received: '这是我故意的...你信吗？嘿嘿~',
    advantage: '一切尽在掌握之中~',
    disadvantage: '有趣...局势越乱，咕噜越开心~',
  },
  yunduoshifu: {
    good_move: '善。此步...颇有悟性。',
    blunder: '...风吹动了不该动的棋子。',
    check_given: '将军。水到渠成，如是而已。',
    check_received: '嗯...你的棋有锋芒。很好。',
    capture_given: '一子落，如叶归根。',
    capture_received: '舍得...方能得。',
    advantage: '山高处，风自来。',
    disadvantage: '低谷处...恰是修行时。',
  },
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const GamePage: React.FC = () => {
  const { id: _id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const characterId = searchParams.get('character') ?? 'douding'
  const timeControl = parseInt(searchParams.get('time') ?? '600', 10)
  const difficultyMode = searchParams.get('difficulty') ?? 'adaptive'

  const charPreset = CHARACTER_PRESETS[characterId] ?? CHARACTER_PRESETS.douding
  const dialogueLines = DIALOGUE_MAP[characterId] ?? DIALOGUE_MAP.douding

  const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
    adaptive: { label: '自适应', color: '#a78bfa' },
    easy: { label: '轻松', color: '#34d399' },
    normal: { label: '正常', color: '#fbbf24' },
    hard: { label: '挑战', color: '#f87171' },
    fixed: { label: '固定', color: '#94a3b8' },
  }
  const diffLabel = DIFFICULTY_LABELS[difficultyMode] ?? DIFFICULTY_LABELS.adaptive

  const {
    gameState,
    isAiThinking,
    dialogueEvent,
    gameResult,
    moveHistory,
    timer,
    startGame,
    makeUserMove,
    getHint,
    resign,
    requestTakeback,
  } = useChessGame()

  const [started, setStarted] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [hintSquares, setHintSquares] = useState<string[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user'|'ai'; text: string}>>([])
  const [serverGameId, setServerGameId] = useState<string | null>(null)
  const [resultSubmitted, setResultSubmitted] = useState(false)

  // Start game on mount — also create server-side game record
  useEffect(() => {
    if (!started) {
      startGame(charPreset, 'white', timeControl)
      setStarted(true)

      // Create game record on server
      playApi.createGame({ character_id: characterId, time_control: timeControl })
        .then((res) => {
          const data = (res.data as any)?.data ?? res.data
          const gid = data?.game_id ?? data?.id
          if (gid) setServerGameId(gid)
        })
        .catch((err) => console.error('[GamePage] Failed to create game:', err))
    }
  }, [started, startGame, charPreset, timeControl, characterId])

  // Show result modal and submit to server when game ends
  useEffect(() => {
    if (gameResult) {
      const timeout = setTimeout(() => setShowResult(true), 500)

      // Submit game result to server
      if (serverGameId && !resultSubmitted) {
        setResultSubmitted(true)
        const resultStr = gameResult.winner === 'white' ? 'win'
          : gameResult.winner === 'black' ? 'loss'
          : 'draw'
        // Build PGN from move history (more reliable than gameState.pgn which may be stale)
        const pgnMoves = moveHistory.map((m, i) => {
          const moveNum = Math.floor(i / 2) + 1
          return i % 2 === 0 ? `${moveNum}. ${m.san}` : m.san
        }).join(' ')

        playApi.completeGame(serverGameId, {
          result: resultStr,
          pgn: gameState.pgn || pgnMoves || '',
          moves_count: moveHistory.length,
          user_color: 'white',
          final_fen: gameState.fen,
        })
          .then(() => {
            // Trigger achievement check after game completion
            gamificationApi.checkAchievements().catch(() => {})
          })
          .catch((err) => console.error('[GamePage] Failed to submit result:', err))
      }

      return () => clearTimeout(timeout)
    }
  }, [gameResult, serverGameId, resultSubmitted, gameState.fen, gameState.pgn, moveHistory.length])

  // Compute valid moves for a given square using chess.js
  const getValidMovesForSquare = useCallback(
    (square: string): string[] => {
      try {
        const chess = new Chess(gameState.fen)
        const currentTurn = chess.turn() === 'w' ? 'white' : 'black'
        if (currentTurn !== 'white') return [] // player is always white for now
        const moves = chess.moves({ square: square as any, verbose: true })
        return [...new Set(moves.map((m) => m.to))]
      } catch {
        return []
      }
    },
    [gameState.fen],
  )

  // Check highlight: find king in check
  const checkHighlights = useMemo(() => {
    if (!gameState.isCheck) return []
    try {
      const chess = new Chess(gameState.fen)
      const turn = chess.turn()
      const board = chess.board()
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const sq = board[r][c]
          if (sq && sq.type === 'k' && sq.color === turn) {
            const file = String.fromCharCode(97 + c)
            const rank = String(8 - r)
            return [`${file}${rank}`]
          }
        }
      }
    } catch {}
    return []
  }, [gameState.fen, gameState.isCheck])

  const handleBoardMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      // Sound effects are handled inside useChessGame hook
      makeUserMove(from, to, promotion)
      setHintSquares([])
    },
    [makeUserMove],
  )

  // Dialogue text
  const dialogueText = useMemo(() => {
    if (!dialogueEvent) return null
    return dialogueLines[dialogueEvent] ?? null
  }, [dialogueEvent, dialogueLines])

  // Result text & encouragement
  const resultText = useMemo(() => {
    if (!gameResult) return ''
    if (gameResult.winner === 'draw') {
      const reasons: Record<string, string> = {
        stalemate: '逼和（无子可动）',
        repetition: '三次重复局面',
        fifty_moves: '50步无吃子',
        insufficient: '子力不足',
      }
      return `和棋 - ${reasons[gameResult.reason] ?? gameResult.reason}`
    }
    const isWin = gameResult.winner === 'white'
    const reasons: Record<string, string> = {
      checkmate: '将杀',
      timeout: '超时',
      resignation: '认输',
    }
    return isWin
      ? `你赢了！ - ${reasons[gameResult.reason] ?? gameResult.reason}`
      : `你输了 - ${reasons[gameResult.reason] ?? gameResult.reason}`
  }, [gameResult])

  const resultEncouragement = useMemo(() => {
    if (!gameResult) return ''
    if (gameResult.winner === 'white') return '太棒了！你真是个小天才！继续加油哦！'
    if (gameResult.winner === 'draw') return '势均力敌！下次一定能赢！'
    return '没关系，每一盘棋都会让你变得更强！再试一次吧！'
  }, [gameResult])

  const handleHint = useCallback(async () => {
    try {
      const hint = await getHint()
      setHintSquares([hint.from, hint.to])
      setTimeout(() => setHintSquares([]), 3000)
    } catch {
      // Engine not available
    }
  }, [getHint])

  // Add AI dialogue to chat when triggered
  useEffect(() => {
    if (dialogueText) {
      setChatMessages(prev => [...prev, { role: 'ai', text: dialogueText }])
    }
  }, [dialogueText])

  const handleChatSend = useCallback(() => {
    if (!chatInput.trim()) return
    const userMsg = chatInput.trim()
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setChatInput('')
    // AI auto-reply based on simple keyword matching
    setTimeout(() => {
      const replies: Record<string, string[]> = {
        douding: [
          '嘿嘿，我也不太确定呢~一起加油吧！',
          '你问我？我还在学习中哦~',
          '哇，好问题！不过我只会下棋啦~',
          '嗯嗯，我觉得你下得很棒！',
          '别担心，我们都在进步呢！',
        ],
        mianhuatang: [
          '哼哼，你是在套我的路数吗？',
          '别说话了，专心下棋！我要赢你！',
          '你要是再这么厉害，我就不跟你玩了~',
          '嘻嘻，你在夸我吗？谢谢！',
          '认真下棋啦，别想分散我注意力！',
        ],
        guigui: [
          '慢慢来，年轻人...不急不急~',
          '老龟我下了一辈子棋，这局面嘛...有趣有趣',
          '耐心是棋手最好的朋友，记住了吗？',
          '嗯...你说的有道理，但棋盘上见真章',
          '每盘棋都是一次修行，享受过程吧~',
        ],
        dongdong: [
          '嗯！我也在想这步！一起研究研究！',
          '冬冬每天都在练习，你也要加油哦！',
          '说得好！不过我们还是用棋盘来说话吧！',
          '再来一盘！冬冬一定能做得更好！',
          '下棋就是要认真！冬冬绝不偷懒！',
        ],
        lihuahua: [
          '嘻嘻~你想知道我下一步怎么走？才不告诉你~',
          '哼~别想用聊天分散花花的注意力！',
          '你有没有注意到那个格子？噢，没有吗？嘻嘻~',
          '花花最喜欢看到对手中计时的表情了~',
          '别小看我哦，花花可是有很多小把戏的！',
        ],
        tiedundun: [
          '对话功能...在线。有何指令？',
          '铁墩墩不理解人类情感...但会认真下棋。',
          '建议：减少对话，增加思考。效率提升32%。',
          '铁墩墩的防御算法正在运行中...请勿干扰。',
          '系统提示：和铁墩墩做朋友...感觉不错。',
        ],
        yinzong: [
          '骑士之道，在于磊落。你有话直说便是！',
          '切磋棋艺，互相敬重，这才是正道！',
          '银鬃从不走捷径，每一步都堂堂正正！',
          '你的棋道还需磨练，但勇气可嘉！',
          '在高原上，只有实力说了算！加油！',
        ],
        gulu: [
          '嘿嘿~你在试探我？咕噜什么都不会说哦~',
          '你觉得我会在这里暴露自己的策略吗？',
          '有趣有趣...你越紧张，就越容易犯错哦~',
          '咕噜的每句话...都可能是陷阱~你确定要听？',
          '别信我说的任何话...或者...该不该信呢？',
        ],
        yunduoshifu: [
          '棋如人生，不在快慢，在于方向。',
          '你心中有疑惑？把它放在棋盘上，答案自现。',
          '万法归一，一亦归无。慢慢体悟吧。',
          '风来了，就让它吹。棋子动了，就让它走。',
          '师父不教棋...师父只是在旁边看着你成长。',
        ],
      }
      const charReplies = replies[characterId] ?? replies.douding
      const reply = charReplies[Math.floor(Math.random() * charReplies.length)]
      setChatMessages(prev => [...prev, { role: 'ai', text: reply }])
    }, 800 + Math.random() * 1200)
  }, [chatInput, characterId])

  const isPlayerTurn = gameState.turn === 'white' && !gameResult

  return (
    <div
      className="fixed inset-0 z-40 flex overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      }}
    >
      {/* Decorative stars via inline style (CSS pseudo-elements alternative) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {['top-[10%] left-[5%]', 'top-[20%] right-[8%]', 'top-[60%] left-[3%]', 'top-[75%] right-[12%]', 'top-[40%] left-[15%]', 'bottom-[10%] right-[5%]'].map((pos, i) => (
          <span
            key={i}
            className={`absolute ${pos} text-xl opacity-20 animate-pulse`}
            style={{ animationDelay: `${i * 400}ms`, animationDuration: '3s' }}
          >
            {['✨', '⭐', '♟️', '✨', '⭐', '♞'][i]}
          </span>
        ))}
      </div>

      {/* -- Left Panel: AI Character + Chat -- */}
      <div className="hidden lg:flex flex-col w-72 shrink-0"
        style={{ background: 'rgba(255,255,255,0.03)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Character header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/5">
          <div
            className="rounded-full p-0.5 shrink-0"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)',
              boxShadow: '0 0 16px rgba(99,102,241,0.3)',
            }}
          >
            <div className="rounded-full bg-[#1a1a2e] p-1.5">
              <CharacterAvatar
                emoji={charPreset.emoji}
                size="sm"
                mood={isAiThinking ? 'thinking' : gameResult ? (gameResult.winner !== 'white' ? 'happy' : 'sad') : 'neutral'}
              />
            </div>
          </div>
          <div>
            <h3
              className="text-base font-extrabold leading-tight"
              style={{
                background: 'linear-gradient(90deg, #a78bfa, #f472b6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {charPreset.name}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40">评分 {charPreset.rating}</span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: `${diffLabel.color}20`,
                  color: diffLabel.color,
                  border: `1px solid ${diffLabel.color}40`,
                }}
              >
                {diffLabel.label}
              </span>
            </div>
          </div>
          {isAiThinking && (
            <div className="flex gap-1 ml-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>

        {/* Chat messages - scrollable */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ scrollbarWidth: 'thin' }}>
          {chatMessages.length === 0 && (
            <div className="text-center text-white/20 text-xs py-8">
              💬 和{charPreset.name}聊聊天吧~
            </div>
          )}
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[85%] px-3 py-2 text-xs leading-relaxed"
                style={{
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.3))'
                    : 'rgba(255,255,255,0.08)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  color: msg.role === 'user' ? '#c4b5fd' : 'rgba(255,255,255,0.8)',
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Chat input */}
        <div className="p-3 border-t border-white/5">
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
              placeholder={`对${charPreset.name}说点什么...`}
              className="flex-1 px-3 py-2 rounded-full text-xs outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.8)',
              }}
            />
            <button
              onClick={handleChatSend}
              className="px-3 py-2 rounded-full text-xs font-medium shrink-0"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white',
              }}
            >
              发送
            </button>
          </div>
        </div>
      </div>

      {/* -- Center: Board Area -- */}
      <div className="flex-1 flex items-center justify-center p-2 min-w-0">
        <div className="flex flex-col items-center gap-2 md:gap-0 md:flex-row md:items-center md:gap-3">
          {/* Opponent info bar (mobile only) */}
          <div className="flex md:hidden items-center gap-2 w-full justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">{charPreset.emoji}</span>
              <span className="text-xs text-white/60">{charPreset.name}</span>
            </div>
            <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <GameTimer seconds={timer.black} active={gameState.turn === 'black' && !gameResult} />
            </div>
          </div>

          {/* Left timer column: opponent (black/top) timer - desktop only */}
          <div className="hidden md:flex flex-col items-center gap-2">
            <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <GameTimer seconds={timer.black} active={gameState.turn === 'black' && !gameResult} />
            </div>
            <span className="text-[10px] text-white/50">{charPreset.emoji} {charPreset.name}</span>
            <CapturedPieces pieces={gameState.capturedPieces.white} color="white" />
          </div>

          {/* Chessboard with glow - full width on mobile */}
          <div className="w-full max-w-[min(100vw-16px,480px)] md:w-auto md:max-w-none" style={{ boxShadow: '0 0 30px rgba(99,102,241,0.3), 0 0 60px rgba(99,102,241,0.1)', borderRadius: '8px' }}>
            <Chessboard
              fen={gameState.fen}
              onMove={handleBoardMove}
              lastMove={gameState.lastMove}
              getValidMoves={getValidMovesForSquare}
              orientation="white"
              highlights={[...checkHighlights, ...hintSquares]}
              interactive={isPlayerTurn}
            />
          </div>

          {/* Right timer column: player (white/bottom) timer - desktop only */}
          <div className="hidden md:flex flex-col items-center gap-2">
            <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <GameTimer seconds={timer.white} active={gameState.turn === 'white' && !gameResult} />
            </div>
            <span className="text-[10px] text-white/50">{user?.nickname ?? '你'}</span>
            <CapturedPieces pieces={gameState.capturedPieces.black} color="black" />
          </div>

          {/* Player info bar + controls (mobile only) */}
          <div className="flex md:hidden items-center gap-2 w-full justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60">{user?.nickname ?? '你'}</span>
            </div>
            <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <GameTimer seconds={timer.white} active={gameState.turn === 'white' && !gameResult} />
            </div>
          </div>

          {/* Mobile controls */}
          <div className="flex md:hidden items-center gap-2 w-full px-2 mt-1">
            <button
              className="flex-1 py-2 rounded-full text-xs font-medium disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
                border: '1px solid rgba(99,102,241,0.3)',
                color: '#c4b5fd',
              }}
              onClick={handleHint}
              disabled={!isPlayerTurn}
            >
              {'\uD83D\uDCA1'} 提示
            </button>
            <button
              className="flex-1 py-2 rounded-full text-xs font-medium disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
                border: '1px solid rgba(99,102,241,0.3)',
                color: '#c4b5fd',
              }}
              onClick={() => requestTakeback()}
              disabled={!isPlayerTurn || moveHistory.length < 2}
            >
              {'↩️'} 悔棋
            </button>
            <button
              className="flex-1 py-2 rounded-full text-xs font-medium disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(220,38,38,0.25))',
                border: '1px solid rgba(239,68,68,0.4)',
                color: '#fca5a5',
              }}
              onClick={resign}
              disabled={!!gameResult}
            >
              {'\uD83C\uDFF3️'} 认输
            </button>
            <button
              className="py-2 px-3 rounded-full text-xs font-medium"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(79,70,229,0.15))',
                border: '1px solid rgba(99,102,241,0.2)',
                color: '#a5b4fc',
              }}
              onClick={() => navigate('/play')}
            >
              {'\uD83C\uDFE0'}
            </button>
          </div>
        </div>
      </div>

      {/* -- Right Panel: Moves + Controls -- */}
      <div
        className="hidden md:flex flex-col w-72 shrink-0"
        style={{ background: 'rgba(255,255,255,0.03)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Move list */}
        <div className="flex-1 p-4 overflow-auto rounded-xl m-3 mb-0" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <MoveList
            moves={moveHistory}
            className=""
          />
        </div>

        {/* Controls */}
        <div className="p-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              className="py-2.5 px-3 rounded-full text-sm font-medium transition-all duration-200 disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
                border: '1px solid rgba(99,102,241,0.3)',
                color: '#c4b5fd',
              }}
              onClick={handleHint}
              disabled={!isPlayerTurn}
            >
              💡 提示
            </button>
            <button
              className="py-2.5 px-3 rounded-full text-sm font-medium transition-all duration-200 disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
                border: '1px solid rgba(99,102,241,0.3)',
                color: '#c4b5fd',
              }}
              onClick={() => requestTakeback()}
              disabled={!isPlayerTurn || moveHistory.length < 2}
            >
              ↩️ 悔棋
            </button>
          </div>
          <button
            className="w-full py-2.5 px-3 rounded-full text-sm font-medium transition-all duration-200 disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(220,38,38,0.25))',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#fca5a5',
            }}
            onClick={resign}
            disabled={!!gameResult}
          >
            🏳️ 认输
          </button>
          <button
            className="w-full py-2.5 px-3 rounded-full text-sm font-medium transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(79,70,229,0.15))',
              border: '1px solid rgba(99,102,241,0.2)',
              color: '#a5b4fc',
            }}
            onClick={() => navigate('/play')}
          >
            🏠 返回
          </button>
        </div>
      </div>

      {/* -- Result Modal -- */}
      <Modal
        open={showResult}
        onClose={() => setShowResult(false)}
        title="对局结束"
      >
        <div className="text-center space-y-4">
          <div
            className="text-5xl"
            style={{
              animation: showResult ? 'game-result-pop 0.6s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
            }}
          >
            {gameResult?.winner === 'white' ? '🎉🎊🏆🎊🎉' : gameResult?.winner === 'draw' ? '🤝' : '💪'}
          </div>
          <p className="text-[var(--text-xl)] font-bold text-[var(--text)]">
            {resultText}
          </p>
          <p className="text-[var(--text-sm)] text-[var(--text-sub)]">
            {resultEncouragement}
          </p>
          <p className="text-[var(--text-xs)] text-[var(--text-muted)]">
            共 {moveHistory.length} 步
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/play')}>
              🏠 返回大厅
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => {
                setShowResult(false)
                setStarted(false)
              }}
            >
              🔥 再来一局
            </Button>
          </div>
        </div>
      </Modal>

      {/* Animation keyframes for game page effects */}
      <style>{`
        @keyframes game-result-pop {
          0% { transform: scale(0.3); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

export default GamePage
