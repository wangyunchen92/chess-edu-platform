#!/usr/bin/env node
/**
 * 验证儿童乐园吃子关卡的所有 FEN 合法性
 * 用法: node scripts/verify-kids-fen.js
 */

const { Chess } = require('../frontend/node_modules/chess.js')

const CAPTURE_GROUPS = [
  { name: '车', piece: 'r', levels: [
    { level: 1, fen: '4k3/8/8/p7/8/8/8/R3K3 w - - 0 1', targets: ['a5'] },
    { level: 2, fen: '4k3/8/8/8/8/p7/8/R3K3 w - - 0 1', targets: ['a3'] },
    { level: 3, fen: '4k3/p7/8/8/8/8/8/R3K3 w - - 0 1', targets: ['a7'] },
    { level: 4, fen: '4k3/8/8/p7/8/p7/8/R3K3 w - - 0 1', targets: ['a3', 'a5'] },
    { level: 5, fen: '4k3/p7/8/8/8/p7/8/R3K3 w - - 0 1', targets: ['a3', 'a7'] },
    { level: 6, fen: '4k3/p7/8/p7/8/p7/8/R3K3 w - - 0 1', targets: ['a3', 'a5', 'a7'] },
    { level: 7, fen: '4k3/8/8/8/8/8/p6p/R3K3 w - - 0 1', targets: ['a2', 'h2'] },
    { level: 8, fen: '4k3/8/8/p7/8/8/p7/R3K3 w - - 0 1', targets: ['a2', 'a5'] },
    { level: 9, fen: '4k3/p7/8/p7/8/p7/p7/R3K3 w - - 0 1', targets: ['a2', 'a3', 'a5', 'a7'] },
    { level: 10, fen: '4k3/p7/p7/p7/8/p7/p7/R3K3 w - - 0 1', targets: ['a2', 'a3', 'a5', 'a6', 'a7'] },
  ]},
  { name: '象', piece: 'b', levels: [
    { level: 1, fen: '4k3/8/8/8/8/8/1p6/B3K3 w - - 0 1', targets: ['b2'] },
    { level: 2, fen: '4k3/8/8/8/4p3/8/8/1B2K3 w - - 0 1', targets: ['e4'] },
    { level: 3, fen: '4k3/8/5p2/8/8/8/8/B3K3 w - - 0 1', targets: ['f6'] },
    { level: 4, fen: '4k3/8/8/8/8/8/1p4p1/B3K3 w - - 0 1', targets: ['b2', 'g2'] },
    { level: 5, fen: '4k3/8/5p2/8/3p4/8/8/B3K3 w - - 0 1', targets: ['d4', 'f6'] },
    { level: 6, fen: '4k3/8/5p2/8/3p4/8/1p6/B3K3 w - - 0 1', targets: ['b2', 'd4', 'f6'] },
    { level: 7, fen: '4k3/8/8/4p3/8/2p5/8/B3K3 w - - 0 1', targets: ['c3', 'e5'] },
    { level: 8, fen: '4k3/8/5p2/4p3/3p4/2p5/1p6/B3K3 w - - 0 1', targets: ['b2', 'c3', 'd4', 'e5', 'f6'] },
    { level: 9, fen: '4k3/7p/6p1/8/8/8/1p6/B3K3 w - - 0 1', targets: ['b2', 'g6', 'h7'] },
    { level: 10, fen: '4k3/7p/6p1/5p2/8/2p5/1p6/B3K3 w - - 0 1', targets: ['b2', 'c3', 'f5', 'g6', 'h7'] },
  ]},
  { name: '后', piece: 'q', levels: [
    { level: 1, fen: '4k3/8/8/p7/8/8/8/Q3K3 w - - 0 1', targets: ['a5'] },
    { level: 2, fen: '4k3/8/8/8/3p4/8/8/Q3K3 w - - 0 1', targets: ['d4'] },
    { level: 3, fen: '4k3/8/8/8/8/2p5/8/Q3K3 w - - 0 1', targets: ['c3'] },
    { level: 4, fen: '4k3/8/8/p7/8/2p5/8/Q3K3 w - - 0 1', targets: ['a5', 'c3'] },
    { level: 5, fen: '4k3/8/8/p7/3p4/8/8/Q3K3 w - - 0 1', targets: ['a5', 'd4'] },
    { level: 6, fen: '4k3/8/8/p7/3p4/2p5/8/Q3K3 w - - 0 1', targets: ['c3', 'd4', 'a5'] },
    { level: 7, fen: '4k3/p7/8/8/3p4/8/1p6/Q3K3 w - - 0 1', targets: ['b2', 'd4', 'a7'] },
    { level: 8, fen: '4k3/p7/8/p7/3p4/2p5/8/Q3K3 w - - 0 1', targets: ['c3', 'd4', 'a5', 'a7'] },
    { level: 9, fen: '4k3/p7/8/p7/3p4/2p5/1p6/Q3K3 w - - 0 1', targets: ['b2', 'c3', 'd4', 'a5', 'a7'] },
    { level: 10, fen: '4k3/p7/5p2/p7/3p4/2p5/1p6/Q3K3 w - - 0 1', targets: ['b2', 'c3', 'd4', 'a5', 'f6', 'a7'] },
  ]},
  { name: '马', piece: 'n', levels: [
    { level: 1, fen: '4k3/8/8/8/8/5p2/8/4K1N1 w - - 0 1', targets: ['f3'] },
    { level: 2, fen: '4k3/8/8/8/8/1p6/8/2N1K3 w - - 0 1', targets: ['b3'] },
    { level: 3, fen: '4k3/8/8/8/8/2p5/8/1N2K3 w - - 0 1', targets: ['c3'] },
    { level: 4, fen: '4k3/8/8/8/8/1p3p2/8/2N1K3 w - - 0 1', targets: ['b3', 'f3'] },
    { level: 5, fen: '4k3/8/8/8/2p5/1p6/8/2N1K3 w - - 0 1', targets: ['b3', 'c4'] },
    { level: 6, fen: '4k3/8/8/3p4/2p5/1p6/8/2N1K3 w - - 0 1', targets: ['b3', 'c4', 'd5'] },
    { level: 7, fen: '4k3/8/8/3p4/8/1p6/3p4/2N1K3 w - - 0 1', targets: ['b3', 'd2', 'd5'] },
    { level: 8, fen: '4k3/8/4p3/3p4/2p5/1p6/8/2N1K3 w - - 0 1', targets: ['b3', 'c4', 'd5', 'e6'] },
    { level: 9, fen: '4k3/8/4p3/3p4/2p5/1p3p2/8/2N1K3 w - - 0 1', targets: ['b3', 'c4', 'd5', 'e6', 'f3'] },
    { level: 10, fen: '4k3/8/4p3/3p4/2p5/1p3p2/3p4/2N1K3 w - - 0 1', targets: ['b3', 'c4', 'd2', 'd5', 'e6', 'f3'] },
  ]},
]

let passed = 0
let failed = 0

for (const group of CAPTURE_GROUPS) {
  for (const level of group.levels) {
    const label = `${group.name} L${String(level.level).padStart(2)}`

    // 1. FEN validity
    let chess
    try {
      chess = new Chess(level.fen)
    } catch (e) {
      console.log(`  FAIL ${label}: FEN非法 — ${e.message}`)
      failed++
      continue
    }

    // 2. Find white piece
    const board = chess.board()
    let pieceSquare = null
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = board[r][c]
        if (sq && sq.color === 'w' && sq.type === group.piece) {
          pieceSquare = `${'abcdefgh'[c]}${8 - r}`
        }
      }
    }

    if (!pieceSquare) {
      console.log(`  FAIL ${label}: 找不到白方${group.name}`)
      failed++
      continue
    }

    // 3. For single-target levels, verify first target reachable in one move
    // For multi-target, just verify all targets have black pieces and FEN is valid
    let allOk = true
    for (const target of level.targets) {
      const targetPiece = chess.get(target)
      if (!targetPiece || targetPiece.color !== 'b') {
        console.log(`  FAIL ${label}: ${target} 没有黑方棋子`)
        allOk = false
        failed++
      }
    }

    // For L1-3 (single target), verify one-move reachability
    if (level.targets.length === 1) {
      const moves = chess.moves({ square: pieceSquare, verbose: true })
      const reachable = moves.map(m => m.to)
      if (!reachable.includes(level.targets[0])) {
        console.log(`  FAIL ${label}: ${pieceSquare}→${level.targets[0]} 一步不可达（合法: ${reachable.join(',')})`)
        allOk = false
        failed++
      }
    }

    if (allOk) {
      console.log(`  OK   ${label}: ${pieceSquare} → [${level.targets.join(',')}] (${level.targets.length}目标)`)
      passed++
    }
  }
}

console.log(`\n${'='.repeat(50)}`)
console.log(`通过: ${passed}  失败: ${failed}  总计: ${passed + failed}`)
console.log(`${'='.repeat(50)}`)
process.exit(failed > 0 ? 1 : 0)
