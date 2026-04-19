import { Chess, type Square } from 'chess.js'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

/**
 * Validate a FEN crafted in the board editor before starting a game.
 * Returns a Chinese reason string, or null if the position is legal.
 */
export function validateEditorFen(fen: string): string | null {
  const placement = fen.split(' ')[0] ?? ''
  const whiteKings = (placement.match(/K/g) ?? []).length
  const blackKings = (placement.match(/k/g) ?? []).length

  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // chess.js 可能在加载时就抛出"king"/"adjacent"等错误；尝试降级为中文原因
    if (/adjacent/i.test(msg) || /king.*king/i.test(msg)) {
      return '双方国王不能相邻'
    }
    if (/king/i.test(msg)) {
      if (whiteKings !== 1) {
        return `白方应有且仅有 1 个国王（当前：${whiteKings}）`
      }
      if (blackKings !== 1) {
        return `黑方应有且仅有 1 个国王（当前：${blackKings}）`
      }
    }
    return 'FEN 格式不正确'
  }

  if (whiteKings !== 1) {
    return `白方应有且仅有 1 个国王（当前：${whiteKings}）`
  }
  if (blackKings !== 1) {
    return `黑方应有且仅有 1 个国王（当前：${blackKings}）`
  }

  const wkSquare = findPiece(placement, 'K')
  const bkSquare = findPiece(placement, 'k')
  if (wkSquare && bkSquare && areAdjacent(wkSquare, bkSquare)) {
    return '双方国王不能相邻'
  }

  // 对方（非走棋方）不能被将军
  const turn = chess.turn()
  const opponentKing = turn === 'w' ? bkSquare : wkSquare
  if (opponentKing && chess.isAttacked(opponentKing as Square, turn)) {
    return turn === 'w'
      ? '黑方在白方走之前就被将军，局面非法'
      : '白方在黑方走之前就被将军，局面非法'
  }

  return null
}

function findPiece(placement: string, piece: string): string | null {
  const rows = placement.split('/')
  if (rows.length !== 8) return null
  for (let ri = 0; ri < 8; ri++) {
    const rank = 8 - ri
    let fi = 0
    for (const ch of rows[ri]) {
      if (ch >= '1' && ch <= '8') {
        fi += parseInt(ch, 10)
      } else {
        if (ch === piece) return `${FILES[fi]}${rank}`
        fi++
      }
    }
  }
  return null
}

function areAdjacent(a: string, b: string): boolean {
  const fileDiff = Math.abs(a.charCodeAt(0) - b.charCodeAt(0))
  const rankDiff = Math.abs(parseInt(a[1], 10) - parseInt(b[1], 10))
  if (fileDiff === 0 && rankDiff === 0) return false
  return fileDiff <= 1 && rankDiff <= 1
}
