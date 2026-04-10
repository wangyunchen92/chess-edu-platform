#!/usr/bin/env node
/**
 * 验证儿童乐园吃子关卡的所有 FEN 合法性
 *
 * 检查项：
 * 1. FEN 能被 chess.js 解析（格式合法）
 * 2. 双方国王都存在
 * 3. 兵不在第1/8行
 * 4. 棋子在指定位置确实存在
 * 5. 所有 target 在棋子的合法走法范围内（一步可达）
 *
 * 用法: node scripts/verify-kids-fen.js
 * 返回: 0=全部通过, 1=有失败
 */

const { Chess } = require('../frontend/node_modules/chess.js')

// 从 KidsCapturePage.tsx 同步（手动维护或自动提取）
const CAPTURE_GROUPS = [
  {
    name: '车', piece: 'r',
    levels: [
      { level: 1, fen: '4k3/8/8/p7/8/8/8/R3K3 w - - 0 1', targets: ['a5'] },
      { level: 2, fen: '4k3/8/8/8/8/p7/8/R3K3 w - - 0 1', targets: ['a3'] },
      { level: 3, fen: '4k3/p7/8/8/8/8/8/R3K3 w - - 0 1', targets: ['a7'] },
    ],
  },
  {
    name: '象', piece: 'b',
    levels: [
      { level: 1, fen: '4k3/8/8/8/8/8/1p6/B3K3 w - - 0 1', targets: ['b2'] },
      { level: 2, fen: '4k3/8/8/8/4p3/8/8/1B2K3 w - - 0 1', targets: ['e4'] },
      { level: 3, fen: '4k3/8/5p2/8/8/8/8/B3K3 w - - 0 1', targets: ['f6'] },
    ],
  },
  {
    name: '后', piece: 'q',
    levels: [
      { level: 1, fen: '4k3/8/8/p7/8/8/8/Q3K3 w - - 0 1', targets: ['a5'] },
      { level: 2, fen: '4k3/8/8/8/3p4/8/8/Q3K3 w - - 0 1', targets: ['d4'] },
      { level: 3, fen: '4k3/8/8/8/8/2p5/8/Q3K3 w - - 0 1', targets: ['c3'] },
    ],
  },
  {
    name: '马', piece: 'n',
    levels: [
      { level: 1, fen: '4k3/8/8/8/8/5p2/8/4K1N1 w - - 0 1', targets: ['f3'] },
      { level: 2, fen: '4k3/8/8/8/8/1p6/8/2N1K3 w - - 0 1', targets: ['b3'] },
      { level: 3, fen: '4k3/8/8/8/8/2p5/8/1N2K3 w - - 0 1', targets: ['c3'] },
    ],
  },
]

let passed = 0
let failed = 0

for (const group of CAPTURE_GROUPS) {
  for (const level of group.levels) {
    const label = `${group.name} L${level.level}`

    // 1. FEN 合法性
    let chess
    try {
      chess = new Chess(level.fen)
    } catch (e) {
      console.log(`  FAIL ${label}: FEN非法 — ${e.message}`)
      failed++
      continue
    }

    // 2. 找到白方棋子位置
    const board = chess.board()
    let pieceSquare = null
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = board[r][c]
        if (sq && sq.color === 'w' && sq.type === group.piece) {
          const files = 'abcdefgh'
          pieceSquare = `${files[c]}${8 - r}`
        }
      }
    }

    if (!pieceSquare) {
      console.log(`  FAIL ${label}: 找不到白方${group.name}`)
      failed++
      continue
    }

    // 3. 验证所有 target 可达
    const moves = chess.moves({ square: pieceSquare, verbose: true })
    const reachable = moves.map(m => m.to)

    let allOk = true
    for (const target of level.targets) {
      if (reachable.includes(target)) {
        // OK
      } else {
        console.log(`  FAIL ${label}: ${pieceSquare}→${target} 不可达（合法走法: ${reachable.join(',')})`)
        allOk = false
        failed++
      }

      // 4. 验证 target 位置确实有对方棋子
      const targetPiece = chess.get(target)
      if (!targetPiece || targetPiece.color !== 'b') {
        console.log(`  FAIL ${label}: ${target} 没有黑方棋子`)
        allOk = false
        failed++
      }
    }

    if (allOk) {
      console.log(`  OK   ${label}: ${pieceSquare}→${level.targets.join(',')}`)
      passed++
    }
  }
}

console.log(`\n${'='.repeat(40)}`)
console.log(`通过: ${passed}  失败: ${failed}  总计: ${passed + failed}`)
console.log(`${'='.repeat(40)}`)

process.exit(failed > 0 ? 1 : 0)
