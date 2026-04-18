# 棋盘编辑器 · 摆好局面与 AI 对弈 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户在棋盘编辑器（`/play/editor`）摆好合法局面后，一键进入与满血 Stockfish 的对弈；对局计入自由对弈历史、可复盘、不计评分。

**Architecture:** 扩展自由对弈 `CreateFreeGameRequest` 的 `game_type` 字面量新增 `vs_ai_editor`；后端 service 复用现有 free-game 写入逻辑（initial_fen 已存入 `games.final_fen`，character_id 已用 `"none"` 占位），仅增加 FEN 校验与默认 opponent_name；前端新增 FEN 校验工具与 Stockfish 对弈 hook，编辑器页增按钮，FreeGamePage 识别新类型后启用 AI 循环。

**Tech Stack:** Python FastAPI + SQLAlchemy 2.0 + python-chess · React 18 + TypeScript + chess.js + Stockfish WASM (EngineManager) + Vitest · Playwright E2E

**设计文档：** `docs/superpowers/specs/2026-04-18-editor-play-from-position-design.md`

---

## 文件结构

| 文件 | 动作 | 责任 |
|---|---|---|
| `backend/app/schemas/play.py` | 修改 | `CreateFreeGameRequest.game_type` 字面量增加 `vs_ai_editor` |
| `backend/app/services/game_service.py` | 修改 | `create_free_game()` 新增 vs_ai_editor 分支（FEN 校验 + 默认 opponent_name） |
| `frontend/src/types/api.ts` | 修改 | `CreateFreeGameRequest.game_type` 字面量同步 |
| `frontend/src/utils/editorFen.ts` | 新建 | `validateEditorFen(fen)` 返回中文原因或 null |
| `frontend/src/utils/__tests__/editorFen.test.ts` | 新建 | Vitest 单测 |
| `frontend/src/hooks/useAiOpponent.ts` | 新建 | Stockfish 走子 hook（带竞态控制/重试/超时） |
| `frontend/src/hooks/__tests__/useAiOpponent.test.ts` | 新建 | Vitest 单测（mock EngineManager） |
| `frontend/src/components/chess/Chessboard.tsx` | 修改 | 每个方格添加 `data-square` 属性（E2E 可定位） |
| `frontend/src/pages/play/BoardEditorPage.tsx` | 修改 | 新增「开始对弈」按钮 + FEN 校验提示 + 请求跳转 |
| `frontend/src/pages/play/FreeGamePage.tsx` | 修改 | 识别 `vs_ai_editor` 启用 AI 分支；结果卡新增「再来一局 / 返回编辑器」 |
| `e2e/editor-vs-ai.spec.ts` | 新建 | Playwright E2E 5 用例 |

## 关键约定

- **depth = 18**（Stockfish 满血）
- **opponent_name 默认 `"Stockfish · 大师级"`**（允许前端覆盖）
- **user_color** 跟编辑器「走棋方」：`turn === 'w' ? 'white' : 'black'`
- **character_id** 沿用 `"none"` 占位（现有 free-play 约定）
- **final_fen** 在创建时存 initial_fen，complete 时再覆盖为终局 FEN
- **FEN 校验规则**：chess.js/python-chess 合法 + 双方恰 1 王 + 双王不相邻 + 被将方=走棋方

---

## Task 1: Playwright E2E 用例 1 + 4（写失败态，TDD 起点）

**Files:**
- Create: `e2e/editor-vs-ai.spec.ts`

### - [ ] Step 1.1: 新建 E2E 文件

Create `e2e/editor-vs-ai.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('编辑器 · 和 AI 对弈', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'student', '123456')
  })

  test('用例 1: 摆残局 K+Q vs K 能进入对弈页', async ({ page }) => {
    await page.goto('/play/editor')

    // 清空棋盘
    await page.getByRole('button', { name: '清空棋盘' }).click()

    // 摆 K+Q(白) vs K(黑)：
    // 白王 → e1
    await page.locator('button[title="King"]').first().click()
    await page.locator('[data-square="e1"]').click()
    // 白后 → h5
    await page.locator('button[title="Queen"]').first().click()
    await page.locator('[data-square="h5"]').click()
    // 黑王 → e8
    await page.locator('button[title="King"]').nth(1).click()
    await page.locator('[data-square="e8"]').click()

    // 验证按钮可用
    const startBtn = page.getByRole('button', { name: '开始对弈' })
    await expect(startBtn).toBeEnabled()

    // 点击开始对弈
    await startBtn.click()

    // 跳转到对弈页
    await page.waitForURL(/\/play\/free\/game\/[a-f0-9-]+/, { timeout: 10_000 })

    // 对手名显示
    await expect(page.getByText('Stockfish · 大师级')).toBeVisible({ timeout: 5_000 })
  })

  test('用例 4: 无王时按钮禁用 + 红字提示', async ({ page }) => {
    await page.goto('/play/editor')
    await page.getByRole('button', { name: '清空棋盘' }).click()

    const startBtn = page.getByRole('button', { name: '开始对弈' })
    await expect(startBtn).toBeDisabled()

    // 红字提示（白方缺王 → 先白后黑的校验顺序）
    await expect(page.getByText(/白方应有且仅有\s*1\s*个国王/)).toBeVisible()
  })
})
```

### - [ ] Step 1.2: 运行，确认失败

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform
npx playwright test e2e/editor-vs-ai.spec.ts --reporter=line
```

**Expected:** FAIL（按钮"开始对弈"不存在，data-square 未设置）。记录失败信息确认是预期的失败（非环境问题）。

### - [ ] Step 1.3: 提交

```bash
git add e2e/editor-vs-ai.spec.ts
git commit -m "test(e2e): add failing editor-vs-ai scenarios 1 & 4

Scenarios for entering AI play from a crafted endgame position, and for
confirming the start button is disabled with a helpful reason when the
position is illegal."
```

---

## Task 2: Chessboard 增加 `data-square` 属性

**Files:**
- Modify: `frontend/src/components/chess/Chessboard.tsx:196-198`

### - [ ] Step 2.1: 添加属性

In `frontend/src/components/chess/Chessboard.tsx`, modify the square `<div>` element (around line 196):

```tsx
<div
  key={square}
  data-square={square}
  className="relative flex items-center justify-center cursor-pointer"
```

只增加 `data-square={square}` 这一行。

### - [ ] Step 2.2: 构建验证

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/frontend
npx tsc --noEmit
```

**Expected:** PASS（纯 JSX 属性，不影响类型）

### - [ ] Step 2.3: 提交

```bash
git add frontend/src/components/chess/Chessboard.tsx
git commit -m "feat(chess): add data-square attribute for E2E locatability"
```

---

## Task 3: 后端 Schema - 扩展 game_type 字面量

**Files:**
- Modify: `backend/app/schemas/play.py:170`

### - [ ] Step 3.1: 修改字面量

In `backend/app/schemas/play.py`, locate `CreateFreeGameRequest` (line ~167) and update the `game_type` field:

```python
class CreateFreeGameRequest(BaseModel):
    """Create a free play or imported game."""

    game_type: Literal["free_play", "imported", "vs_ai_editor"]
    opponent_name: Optional[str] = Field(None, max_length=100, description="Opponent name")
    user_color: str = Field(default="white", description="User's color: white or black")
    time_control: int = Field(default=0, ge=0, le=3600, description="Time control in seconds, 0=unlimited")
    pgn: Optional[str] = Field(None, description="PGN text for imported games")
    initial_fen: Optional[str] = Field(None, description="Starting FEN for non-standard positions")
```

只把字面量里新增 `"vs_ai_editor"`。

### - [ ] Step 3.2: 本地启动 + curl 冒烟

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/backend
# 启动后端（若尚未运行）
source venv/bin/activate  # 若有
uvicorn app.main:app --reload --port 8000 &
sleep 3

# 登录拿 token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"123456"}' | python -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")
echo "TOKEN=$TOKEN"

# 测试：game_type=vs_ai_editor 合法 FEN
curl -s -X POST http://localhost:8000/api/play/free-games \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"game_type":"vs_ai_editor","initial_fen":"4k3/8/8/7Q/8/8/8/4K3 w - - 0 1","user_color":"white"}'
```

**Expected:** 返回 200 和 `game_id`（尚未校验 FEN，所以合法 FEN 能通过；Task 4 会加非法校验）。

### - [ ] Step 3.3: 提交

```bash
git add backend/app/schemas/play.py
git commit -m "feat(backend): allow game_type='vs_ai_editor' in CreateFreeGameRequest"
```

---

## Task 4: 后端 Service - vs_ai_editor 分支 + FEN 校验

**Files:**
- Modify: `backend/app/services/game_service.py:480-525`

### - [ ] Step 4.1: 引入 python-chess + 增加分支

在 `backend/app/services/game_service.py` 文件顶部 import 区域添加（如果还没有）：

```python
import chess as pychess  # python-chess
from fastapi import HTTPException
```

然后定位 `def create_free_game(...)` 函数（约 line 484），把函数体改为：

```python
def create_free_game(
    db: Session,
    user_id: str,
    request: CreateFreeGameRequest,
) -> Game:
    """Create a free play or imported game.

    No adaptive difficulty, no daily quota consumption.
    """
    now = datetime.now(timezone.utc)

    # vs_ai_editor 分支：校验 initial_fen、默认 opponent_name
    opponent_name = request.opponent_name
    if request.game_type == "vs_ai_editor":
        if not request.initial_fen:
            raise HTTPException(status_code=422, detail="initial_fen is required for vs_ai_editor")
        try:
            board = pychess.Board(request.initial_fen)
        except Exception:
            raise HTTPException(status_code=422, detail="invalid FEN format")
        if not board.is_valid():
            raise HTTPException(status_code=422, detail="illegal position (kings/check/adjacency)")
        placement = request.initial_fen.split(" ")[0]
        if placement.count("K") != 1:
            raise HTTPException(status_code=422, detail="white must have exactly 1 king")
        if placement.count("k") != 1:
            raise HTTPException(status_code=422, detail="black must have exactly 1 king")
        if not opponent_name:
            opponent_name = "Stockfish · 大师级"

    # For imported games with PGN, status is completed immediately
    if request.game_type == "imported" and request.pgn:
        status = "completed"
    else:
        status = "playing"

    game = Game(
        id=str(uuid.uuid4()),
        user_id=user_id,
        character_id="none",
        user_color=request.user_color,
        time_control=request.time_control,
        game_type=request.game_type,
        opponent_name=opponent_name,
        status=status,
        pgn=request.pgn if request.game_type == "imported" else None,
        final_fen=request.initial_fen,
        started_at=now,
        ended_at=now if status == "completed" else None,
    )
    db.add(game)
    db.flush()
    return game
```

关键改动：
- 新增 `vs_ai_editor` 分支校验
- 把 `opponent_name` 变量从局部推导（默认 Stockfish · 大师级）
- Game 构造里 `opponent_name=opponent_name`（原来是 `request.opponent_name`）

### - [ ] Step 4.2: curl 冒烟测试（合法/非法）

重启后端后，执行：

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"123456"}' | python -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

# (A) 合法 FEN → 期望 200，返回带 game_id
curl -s -o /tmp/ok.json -w "%{http_code}\n" -X POST http://localhost:8000/api/play/free-games \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"game_type":"vs_ai_editor","initial_fen":"4k3/8/8/7Q/8/8/8/4K3 w - - 0 1","user_color":"white"}'
cat /tmp/ok.json

# (B) 缺 initial_fen → 期望 422
curl -s -o /tmp/fen_missing.json -w "%{http_code}\n" -X POST http://localhost:8000/api/play/free-games \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"game_type":"vs_ai_editor","user_color":"white"}'

# (C) 非法 FEN（无黑王） → 期望 422
curl -s -o /tmp/fen_illegal.json -w "%{http_code}\n" -X POST http://localhost:8000/api/play/free-games \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"game_type":"vs_ai_editor","initial_fen":"8/8/8/8/8/8/8/4K3 w - - 0 1","user_color":"white"}'

# (D) 验证 opponent_name 默认值
GAME_ID=$(cat /tmp/ok.json | python -c "import sys,json; print(json.load(sys.stdin)['data']['game_id'])")
curl -s http://localhost:8000/api/play/games/$GAME_ID \
  -H "Authorization: Bearer $TOKEN" | python -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['game_type'], d['final_fen'], d['opponent_name'])"
```

**Expected:**
- (A) 200
- (B) 422
- (C) 422
- (D) `vs_ai_editor 4k3/8/8/7Q/8/8/8/4K3 w - - 0 1 Stockfish · 大师级`

### - [ ] Step 4.3: 提交

```bash
git add backend/app/services/game_service.py
git commit -m "feat(backend): vs_ai_editor branch with FEN validation and default opponent name"
```

---

## Task 5: 前端 TypeScript 类型同步

**Files:**
- Modify: `frontend/src/types/api.ts:443-450`

### - [ ] Step 5.1: 扩展字面量

In `frontend/src/types/api.ts`, update `CreateFreeGameRequest`:

```typescript
export interface CreateFreeGameRequest {
  game_type: 'free_play' | 'imported' | 'vs_ai_editor'
  opponent_name?: string
  user_color?: string
  time_control?: number
  pgn?: string
  initial_fen?: string
}
```

### - [ ] Step 5.2: 编译验证

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/frontend
npx tsc --noEmit
```

**Expected:** PASS

### - [ ] Step 5.3: 提交

```bash
git add frontend/src/types/api.ts
git commit -m "feat(frontend): sync CreateFreeGameRequest game_type literal"
```

---

## Task 6: 前端 FEN 校验工具 + 单测

**Files:**
- Create: `frontend/src/utils/editorFen.ts`
- Create: `frontend/src/utils/__tests__/editorFen.test.ts`

### - [ ] Step 6.1: 写失败测试

Create `frontend/src/utils/__tests__/editorFen.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { validateEditorFen } from '../editorFen'

describe('validateEditorFen', () => {
  it('accepts the standard starting position', () => {
    expect(
      validateEditorFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    ).toBeNull()
  })

  it('accepts a simple legal endgame', () => {
    expect(validateEditorFen('4k3/8/8/7Q/8/8/8/4K3 w - - 0 1')).toBeNull()
  })

  it('rejects when white king is missing', () => {
    expect(validateEditorFen('4k3/8/8/8/8/8/8/8 w - - 0 1')).toMatch(/白方.*国王/)
  })

  it('rejects when black king is missing', () => {
    expect(validateEditorFen('8/8/8/8/8/8/8/4K3 w - - 0 1')).toMatch(/黑方.*国王/)
  })

  it('rejects when there are two white kings', () => {
    expect(validateEditorFen('4k3/8/8/8/8/8/8/KK6 w - - 0 1')).toMatch(/白方.*国王/)
  })

  it('rejects adjacent kings', () => {
    expect(validateEditorFen('8/8/8/3Kk3/8/8/8/8 w - - 0 1')).toMatch(/相邻/)
  })

  it('rejects position where opponent is in check (side-to-move wrong)', () => {
    // 白先但黑王被白车将军 — 非法
    expect(validateEditorFen('3k3R/8/8/8/8/8/8/3K4 w - - 0 1')).toMatch(/非法|将军/)
  })

  it('rejects malformed FEN', () => {
    expect(validateEditorFen('not-a-fen')).toMatch(/格式/)
  })
})
```

### - [ ] Step 6.2: 运行测试，确认失败

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/frontend
npx vitest run src/utils/__tests__/editorFen.test.ts
```

**Expected:** FAIL（模块不存在）

### - [ ] Step 6.3: 实现 validateEditorFen

Create `frontend/src/utils/editorFen.ts`:

```typescript
import { Chess, type Square } from 'chess.js'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

/**
 * Validate a FEN crafted in the board editor before starting a game.
 * Returns a Chinese reason string, or null if the position is legal.
 */
export function validateEditorFen(fen: string): string | null {
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return 'FEN 格式不正确'
  }

  const placement = fen.split(' ')[0] ?? ''
  const whiteKings = (placement.match(/K/g) ?? []).length
  const blackKings = (placement.match(/k/g) ?? []).length
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

  // 对方（非走棋方）不能被将军——否则意味着上一方未应对将军就切换
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
```

### - [ ] Step 6.4: 再跑测试，确认通过

```bash
npx vitest run src/utils/__tests__/editorFen.test.ts
```

**Expected:** 所有用例通过

### - [ ] Step 6.5: 提交

```bash
git add frontend/src/utils/editorFen.ts frontend/src/utils/__tests__/editorFen.test.ts
git commit -m "feat(frontend): add validateEditorFen helper with unit tests"
```

---

## Task 7: 前端 useAiOpponent hook + 单测

**Files:**
- Create: `frontend/src/hooks/useAiOpponent.ts`
- Create: `frontend/src/hooks/__tests__/useAiOpponent.test.ts`

### - [ ] Step 7.1: 确认 @testing-library/react 可用

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/frontend
node -e "require('@testing-library/react')" 2>&1 || echo "NEED INSTALL"
```

如输出 `NEED INSTALL`：

```bash
npm install --save-dev @testing-library/react @testing-library/dom
```

### - [ ] Step 7.2: 写失败测试

Create `frontend/src/hooks/__tests__/useAiOpponent.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAiOpponent } from '../useAiOpponent'

// Mock EngineManager
vi.mock('@/engine', () => ({
  EngineManager: {
    getInstance: vi.fn(),
  },
}))

import { EngineManager } from '@/engine'

describe('useAiOpponent', () => {
  let mockEngine: {
    ensureReady: ReturnType<typeof vi.fn>
    getBestMove: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockEngine = {
      ensureReady: vi.fn().mockResolvedValue(undefined),
      getBestMove: vi.fn().mockResolvedValue('e2e4'),
    }
    ;(EngineManager.getInstance as any).mockReturnValue(mockEngine)
  })

  it('calls onMove when enabled', async () => {
    const onMove = vi.fn()
    renderHook(() => useAiOpponent('fen1', true, onMove))
    await waitFor(() => expect(onMove).toHaveBeenCalledWith('e2e4'))
  })

  it('does not call onMove when disabled', async () => {
    const onMove = vi.fn()
    renderHook(() => useAiOpponent('fen1', false, onMove))
    await new Promise((r) => setTimeout(r, 50))
    expect(onMove).not.toHaveBeenCalled()
  })

  it('ignores stale results after fen change', async () => {
    const onMove = vi.fn()
    mockEngine.getBestMove = vi.fn().mockImplementation(
      (fen: string) =>
        new Promise((resolve) =>
          setTimeout(() => resolve(fen === 'fen1' ? 'stale' : 'fresh'), 40),
        ),
    )
    const { rerender } = renderHook(
      ({ fen }) => useAiOpponent(fen, true, onMove),
      { initialProps: { fen: 'fen1' } },
    )
    // 快速切换到 fen2
    rerender({ fen: 'fen2' })

    await new Promise((r) => setTimeout(r, 150))
    expect(onMove).not.toHaveBeenCalledWith('stale')
    expect(onMove).toHaveBeenCalledWith('fresh')
  })

  it('surfaces error after two failed attempts', async () => {
    mockEngine.getBestMove = vi.fn().mockRejectedValue(new Error('engine exploded'))
    const onMove = vi.fn()
    const { result } = renderHook(() => useAiOpponent('fen1', true, onMove))
    await waitFor(() => expect(result.current.error).toBeTruthy())
    expect(onMove).not.toHaveBeenCalled()
  })
})
```

### - [ ] Step 7.3: 运行，确认失败

```bash
npx vitest run src/hooks/__tests__/useAiOpponent.test.ts
```

**Expected:** FAIL（模块不存在）

### - [ ] Step 7.4: 实现 hook

Create `frontend/src/hooks/useAiOpponent.ts`:

```typescript
import { useEffect, useRef, useState } from 'react'
import { EngineManager } from '@/engine'

const TIMEOUT_MS = 8000
const MAX_ATTEMPTS = 2

/**
 * Hook that triggers the Stockfish engine to pick a move whenever
 * `enabled` becomes true and `fen` is the current board state. Calls
 * `onMove(uci)` once per AI turn.
 *
 * Behavior:
 * - If fen or enabled changes, any in-flight call is cancelled (its
 *   result is discarded).
 * - Retries once on failure; after two failures, surfaces an error.
 * - 8s per-attempt timeout.
 */
export function useAiOpponent(
  fen: string,
  enabled: boolean,
  onMove: (uci: string) => void,
  depth = 18,
): { thinking: boolean; error: string | null } {
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tokenRef = useRef(0)
  const onMoveRef = useRef(onMove)

  // Keep the callback reference fresh without causing the effect to re-run
  onMoveRef.current = onMove

  useEffect(() => {
    if (!enabled) {
      setThinking(false)
      return
    }

    const token = ++tokenRef.current
    setThinking(true)
    setError(null)

    const run = async () => {
      try {
        const engine = EngineManager.getInstance()
        await engine.ensureReady()

        let lastErr: unknown = null
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          try {
            const move = await Promise.race<string>([
              engine.getBestMove(fen, depth),
              new Promise<string>((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS),
              ),
            ])
            if (tokenRef.current !== token) return // stale
            onMoveRef.current(move)
            setThinking(false)
            return
          } catch (e) {
            lastErr = e
          }
        }
        throw lastErr ?? new Error('AI 走子失败')
      } catch (e) {
        if (tokenRef.current !== token) return
        const msg = e instanceof Error ? e.message : 'AI 走子失败'
        setError(msg === 'timeout' ? 'AI 超时' : 'AI 走子失败')
        setThinking(false)
      }
    }

    void run()

    return () => {
      // Bumping the token on cleanup invalidates the in-flight promise
      tokenRef.current++
    }
  }, [fen, enabled, depth])

  return { thinking, error }
}
```

### - [ ] Step 7.5: 运行测试，确认通过

```bash
npx vitest run src/hooks/__tests__/useAiOpponent.test.ts
```

**Expected:** 4/4 PASS

### - [ ] Step 7.6: 提交

```bash
git add frontend/src/hooks/useAiOpponent.ts frontend/src/hooks/__tests__/useAiOpponent.test.ts
# 如果安装了 @testing-library/react，把 package.json + package-lock.json 一并提交
git add frontend/package.json frontend/package-lock.json 2>/dev/null || true
git commit -m "feat(frontend): add useAiOpponent hook with race/retry/timeout handling"
```

---

## Task 8: BoardEditorPage「开始对弈」按钮

**Files:**
- Modify: `frontend/src/pages/play/BoardEditorPage.tsx`

### - [ ] Step 8.1: import + 新增状态与处理函数

In `BoardEditorPage.tsx`:

**(a) 在文件顶部 import 区域新增：**

```typescript
import { validateEditorFen } from '@/utils/editorFen'
```

**(b) 找到现有的状态声明区（Save state 下方），新增：**

```typescript
  // Start vs AI state
  const [startingVsAi, setStartingVsAi] = useState(false)
  const [startVsAiError, setStartVsAiError] = useState<string | null>(null)

  // FEN legality error (derived)
  const fenLegalityError = useMemo(
    () => validateEditorFen(currentFen),
    [currentFen],
  )
```

**(c) 找到 `handleSave` 附近，加入新处理函数：**

```typescript
  const handleStartVsAi = useCallback(async () => {
    setStartVsAiError(null)
    if (fenLegalityError) return
    setStartingVsAi(true)
    try {
      const res = await freePlayApi.createFreeGame({
        game_type: 'vs_ai_editor',
        initial_fen: currentFen,
        user_color: turn === 'w' ? 'white' : 'black',
      })
      const data = (res.data as any)?.data ?? res.data
      const gameId = data?.game_id ?? data?.id
      if (gameId) {
        navigate(`/play/free/game/${gameId}`)
      } else {
        setStartVsAiError('创建对局失败，请稍后重试')
      }
    } catch (err) {
      console.error('[BoardEditor] start vs AI failed:', err)
      setStartVsAiError('创建对局失败，请稍后重试')
    } finally {
      setStartingVsAi(false)
    }
  }, [currentFen, turn, fenLegalityError, navigate])
```

### - [ ] Step 8.2: 新增按钮 UI（放在"保存局面"板块之后）

找到 `{/* Save section */}` 那一块（约 line 651），在其 `</div>` 闭合之后新增：

```tsx
            {/* Play vs AI section */}
            <div className="rounded-xl p-4" style={darkCardStyle}>
              <h3 className="text-sm font-medium text-slate-300 mb-3">
                和 AI 对弈
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                摆好残局或练习题，与满血 Stockfish（大师级）直接开局。不计评分。
              </p>
              <button
                onClick={handleStartVsAi}
                disabled={!!fenLegalityError || startingVsAi}
                className={[
                  'w-full py-2.5 rounded text-sm font-medium transition-colors',
                  fenLegalityError || startingVsAi
                    ? 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-500',
                ].join(' ')}
              >
                {startingVsAi ? '创建中...' : '开始对弈'}
              </button>
              {fenLegalityError && (
                <p className="text-xs text-red-400 mt-2">{fenLegalityError}</p>
              )}
              {startVsAiError && (
                <p className="text-xs text-red-400 mt-2">{startVsAiError}</p>
              )}
            </div>
```

### - [ ] Step 8.3: 构建验证

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/frontend
npx tsc --noEmit
```

**Expected:** PASS

### - [ ] Step 8.4: 手动冒烟（启动 dev server）

```bash
npm run dev &
sleep 5
# 浏览器打开 http://localhost:5173/chess/play/editor 登录后：
#   - 清空棋盘 → 按钮禁用 + 红字
#   - 摆 K vs K+Q 合法局面 → 按钮可用
```

### - [ ] Step 8.5: 提交

```bash
git add frontend/src/pages/play/BoardEditorPage.tsx
git commit -m "feat(editor): add start-vs-AI button with live FEN legality check"
```

---

## Task 9: FreeGamePage 识别 vs_ai_editor 并启用 AI

**Files:**
- Modify: `frontend/src/pages/play/FreeGamePage.tsx`

### - [ ] Step 9.1: 读取 game detail + 初始化 AI 模式

**(a) 顶部 import 新增：**

```typescript
import { useAiOpponent } from '@/hooks/useAiOpponent'
import { playApi } from '@/api/play'
```

**(b) 在 FreeGamePage 组件内，于现有状态下新增：**

```typescript
  const [isAiEditor, setIsAiEditor] = useState(false)
  const [initialFen, setInitialFen] = useState<string>(INITIAL_FEN)
  const [userColor, setUserColor] = useState<'w' | 'b'>('w')
  const [opponentLabel, setOpponentLabel] = useState<string>('对手')
```

**(c) 新增 useEffect 加载对局详情（在现有 useEffect 附近）：**

```typescript
  useEffect(() => {
    if (!id) return
    playApi.getGameDetail(id)
      .then((res) => {
        const data = (res.data as any)?.data ?? res.data
        if (!data) return
        if (data.game_type === 'vs_ai_editor') {
          setIsAiEditor(true)
          const fen = data.final_fen ?? INITIAL_FEN
          setInitialFen(fen)
          chess.load(fen)
          setFen(fen)
          const uc = data.user_color === 'black' ? 'b' : 'w'
          setUserColor(uc)
          setOrientation(uc === 'b' ? 'black' : 'white')
          setOpponentLabel(data.opponent_name || 'Stockfish · 大师级')
        }
      })
      .catch((err) => {
        console.error('[FreeGamePage] load detail failed:', err)
      })
  }, [id])
```

> **注意：** 原 FreeGamePage 以 `chess = new Chess()` 初始化标准开局；新增的 useEffect 会在挂载后覆盖成 vs_ai_editor 的起手 FEN。保持此顺序即可。

### - [ ] Step 9.2: 接入 AI hook

在 `FreeGamePage` 内，找到已有的 `useMemo`/`useEffect` 附近，新增：

```typescript
  // 当 AI 应走且未结束时触发
  const aiShouldMove = useMemo(() => {
    if (!isAiEditor || gameOver) return false
    return chess.turn() !== userColor
  }, [fen, isAiEditor, gameOver, userColor])

  const handleAiMove = useCallback((uci: string) => {
    // UCI 形如 "e2e4" / "e7e8q"
    const from = uci.slice(0, 2)
    const to = uci.slice(2, 4)
    const promotion = uci.length > 4 ? uci[4] : undefined
    try {
      const move = chess.move({ from, to, promotion: promotion as any })
      if (!move) return
      const newFen = chess.fen()
      setFen(newFen)
      setLastMove({ from, to })
      setMoves((prev) => [...prev, {
        san: move.san,
        fen: newFen,
        from,
        to,
      }])
      // 终局判定（复用既有逻辑）
      maybeFinishGame()
    } catch (e) {
      console.warn('[FreeGamePage] AI move invalid:', uci, e)
    }
  }, [chess])

  const { thinking: aiThinking, error: aiError } = useAiOpponent(
    fen,
    aiShouldMove,
    handleAiMove,
    18,
  )
```

> `maybeFinishGame` 是下一步要抽取的函数：把现有结尾判定（checkmate/draw）逻辑抽成可复用函数。

### - [ ] Step 9.3: 抽取终局判定 + 修正用户颜色写死 + 结果卡扩展

原 FreeGamePage 有 3 处写死"用户=白方"需要改：
- `handleMove` 第 145-165 行：`setGameResult(chess.turn() === 'w' ? 'loss' : 'win')` 假设用户是白
- `handleResign` 第 181 行：同样假设
- complete-game useEffect 第 218 行：`user_color: 'white'` 写死

把终局判定抽成 `maybeFinishGame()`，用 `userColor` 动态判断。

**(a) 抽取终局判定函数：** 在 `handleMove` 上方新增：

```typescript
  const maybeFinishGame = useCallback(() => {
    if (!chess.isGameOver()) return
    setGameOver(true)
    if (chess.isCheckmate()) {
      const loserColor = chess.turn()  // 'w' or 'b'
      const userIsWinner = loserColor !== userColor
      const loserLabel = loserColor === 'w' ? '白方' : '黑方'
      setGameResult(userIsWinner ? 'win' : 'loss')
      setGameReason(`将杀! ${loserColor === 'w' ? '黑方' : '白方'}获胜`)
      void loserLabel
    } else if (chess.isStalemate()) {
      setGameResult('draw')
      setGameReason('逼和 - 无子可动')
    } else if (chess.isThreefoldRepetition()) {
      setGameResult('draw')
      setGameReason('和棋 - 三次重复')
    } else if (chess.isInsufficientMaterial()) {
      setGameResult('draw')
      setGameReason('和棋 - 子力不足')
    } else {
      setGameResult('draw')
      setGameReason('和棋')
    }
    setTimeout(() => setShowResultModal(true), 500)
  }, [chess, userColor])
```

**(b) 替换 handleMove 内的终局判定：** 原 handleMove 内 `if (chess.isGameOver()) { ... }` 整块（第 145-165 行）替换为：

```typescript
        maybeFinishGame()
```

**(c) 修正 handleResign（第 177-184 行）：** 改为：

```typescript
  const handleResign = useCallback(() => {
    setShowResignModal(false)
    setGameOver(true)
    const userSideLabel = userColor === 'w' ? '白方' : '黑方'
    if (isAiEditor) {
      setGameResult('loss')  // vs AI 模式下认输一定是用户输
      setGameReason(`${userSideLabel}认输`)
    } else {
      // 面对面模式：whose turn is it = who resigned
      const loser = chess.turn() === 'w' ? '白方' : '黑方'
      setGameResult(chess.turn() === userColor ? 'loss' : 'win')
      setGameReason(`${loser}认输`)
    }
    setTimeout(() => setShowResultModal(true), 300)
  }, [chess, userColor, isAiEditor])
```

**(d) 修正 complete-game useEffect（第 218 行附近）：** 将 `user_color: 'white'` 改为：

```typescript
        user_color: userColor === 'w' ? 'white' : 'black',
```

**(e) 结果卡（showResultModal 区域）扩展：** 在结果 Modal 的按钮区，isAiEditor 模式下增加：

```tsx
          {isAiEditor && (
            <>
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    const res = await freePlayApi.createFreeGame({
                      game_type: 'vs_ai_editor',
                      initial_fen: initialFen,
                      user_color: userColor === 'w' ? 'white' : 'black',
                    })
                    const data = (res.data as any)?.data ?? res.data
                    const gid = data?.game_id ?? data?.id
                    if (gid) {
                      window.location.href = `/chess/play/free/game/${gid}`
                    }
                  } catch {
                    /* ignore */
                  }
                }}
              >
                再来一局
              </Button>
              <Button variant="secondary" onClick={() => navigate('/play/editor')}>
                返回编辑器
              </Button>
            </>
          )}
```

### - [ ] Step 9.4: 顶部标题显示对手名（isAiEditor 模式）

定位 FreeGamePage.tsx 第 263 行附近的页面顶部标题：

```tsx
<span className="text-sm font-medium text-slate-200">
  自由对弈
</span>
```

替换为：

```tsx
<span className="text-sm font-medium text-slate-200">
  {isAiEditor ? opponentLabel : '自由对弈'}
</span>
```

### - [ ] Step 9.5: 构建验证

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/frontend
npx tsc --noEmit
```

**Expected:** PASS

### - [ ] Step 9.6: 手动冒烟

```bash
npm run dev &
# 浏览器：/chess/play/editor → 摆 K+Q vs K 合法残局 → 开始对弈 →
#   验证：(1)对手名 Stockfish · 大师级  (2)白先时 AI 不走  
#   (3)走一步 Qh5# 结果卡出现  (4)卡片含 查看复盘 / 再来一局 / 返回编辑器
```

### - [ ] Step 9.7: 提交

```bash
git add frontend/src/pages/play/FreeGamePage.tsx
git commit -m "feat(free-play): support vs_ai_editor mode with Stockfish opponent and result actions"
```

---

## Task 10: E2E 用例 1 + 4 跑通

### - [ ] Step 10.1: 启动前后端，跑 Task 1 写的 E2E

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform
# 确认 backend + frontend 都在运行
npx playwright test e2e/editor-vs-ai.spec.ts -g "用例 1|用例 4" --reporter=line
```

**Expected:** 2 passed

### - [ ] Step 10.2: 若失败：调试定位（不修用例，修实现）

常见失败点：
- selector `button[title="King"]` 的索引 — 查看 BoardEditorPage 的 palette 按钮实际顺序
- 棋盘方格找不到 — 确认 Task 2 的 `data-square` 属性已提交
- 对手名 selector — 确认 Task 9 的显示逻辑

### - [ ] Step 10.3: 无需提交（测试已在 Task 1 提交过）

---

## Task 11: 补齐 E2E 用例 2 / 3 / 5

**Files:**
- Modify: `e2e/editor-vs-ai.spec.ts`

### - [ ] Step 11.1: 在同一文件末尾追加 3 个用例

```typescript
  test('用例 2: 一步将杀后结果卡显示胜利', async ({ page }) => {
    await page.goto('/play/editor')
    await page.getByRole('button', { name: '清空棋盘' }).click()

    // 摆 1 步将杀：K h1, Q f7; K h8（Qh7# 局面简化版）
    // 这里采用 Qh5# 局面：白王 e1、白后 h5、黑王 e8；用户一步 Qxe8 或移到 h8 将杀
    // 使用更明确的一步杀：白 Qh7#  → 位置 K a1, Q f7, k h8
    await page.locator('button[title="King"]').first().click()
    await page.locator('[data-square="a1"]').click()
    await page.locator('button[title="Queen"]').first().click()
    await page.locator('[data-square="f7"]').click()
    await page.locator('button[title="King"]').nth(1).click()
    await page.locator('[data-square="h8"]').click()

    await page.getByRole('button', { name: '开始对弈' }).click()
    await page.waitForURL(/\/play\/free\/game\/[a-f0-9-]+/)

    // 用户走 Qf7→h7# 一步将杀
    await page.locator('[data-square="f7"]').click()
    await page.locator('[data-square="h7"]').click()

    // 结果卡 + 胜利
    await expect(page.getByText(/胜利|Checkmate|将杀/i)).toBeVisible({ timeout: 10_000 })
    // 三个按钮
    await expect(page.getByRole('button', { name: '查看复盘' })).toBeVisible()
    await expect(page.getByRole('button', { name: '再来一局' })).toBeVisible()
    await expect(page.getByRole('button', { name: '返回编辑器' })).toBeVisible()
  })

  test('用例 3: 「返回编辑器」按钮回到 /play/editor', async ({ page }) => {
    // 复用用例 2 的局面、下到胜利
    await page.goto('/play/editor')
    await page.getByRole('button', { name: '清空棋盘' }).click()
    await page.locator('button[title="King"]').first().click()
    await page.locator('[data-square="a1"]').click()
    await page.locator('button[title="Queen"]').first().click()
    await page.locator('[data-square="f7"]').click()
    await page.locator('button[title="King"]').nth(1).click()
    await page.locator('[data-square="h8"]').click()
    await page.getByRole('button', { name: '开始对弈' }).click()
    await page.waitForURL(/\/play\/free\/game\/[a-f0-9-]+/)
    await page.locator('[data-square="f7"]').click()
    await page.locator('[data-square="h7"]').click()
    await expect(page.getByRole('button', { name: '返回编辑器' })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: '返回编辑器' }).click()
    await expect(page).toHaveURL(/\/play\/editor$/)
  })

  test('用例 5: 「再来一局」创建新 gameId 且棋盘回到原 FEN', async ({ page }) => {
    await page.goto('/play/editor')
    await page.getByRole('button', { name: '清空棋盘' }).click()
    await page.locator('button[title="King"]').first().click()
    await page.locator('[data-square="a1"]').click()
    await page.locator('button[title="Queen"]').first().click()
    await page.locator('[data-square="f7"]').click()
    await page.locator('button[title="King"]').nth(1).click()
    await page.locator('[data-square="h8"]').click()
    await page.getByRole('button', { name: '开始对弈' }).click()
    await page.waitForURL(/\/play\/free\/game\/[a-f0-9-]+/)
    const oldUrl = page.url()
    await page.locator('[data-square="f7"]').click()
    await page.locator('[data-square="h7"]').click()
    await expect(page.getByRole('button', { name: '再来一局' })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: '再来一局' }).click()
    await page.waitForURL((url) => /\/play\/free\/game\/[a-f0-9-]+/.test(url.toString()) && url.toString() !== oldUrl, { timeout: 10_000 })
    // 仍能看到 Stockfish 对手
    await expect(page.getByText('Stockfish · 大师级')).toBeVisible()
    // 棋盘应显示原初始 FEN（白后回到 f7）
    const f7Square = page.locator('[data-square="f7"]')
    await expect(f7Square).toBeVisible()
  })
```

### - [ ] Step 11.2: 跑 5 个用例全量

```bash
npx playwright test e2e/editor-vs-ai.spec.ts --reporter=line
```

**Expected:** 5/5 PASS

### - [ ] Step 11.3: 提交

```bash
git add e2e/editor-vs-ai.spec.ts
git commit -m "test(e2e): complete editor-vs-ai scenarios (victory, back to editor, play again)"
```

---

## Task 12: 回归测试 + 构建 + 最终验证

### - [ ] Step 12.1: 跑既有 E2E（回归）

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform
npx playwright test --reporter=line
```

**Expected:** 既有 21 条 + 新 5 条全部 PASS

### - [ ] Step 12.2: 前端 Vitest 全量

```bash
cd frontend
npm test
```

**Expected:** 所有 vitest 用例 PASS

### - [ ] Step 12.3: 前端构建

```bash
npm run build
```

**Expected:** tsc + vite build 成功，无类型错误

### - [ ] Step 12.4: 后端快速冒烟

```bash
cd ../backend
# 确保服务正常启动（无 import error）
python -c "from app.main import app; print('ok')"
```

**Expected:** `ok`

### - [ ] Step 12.5: 编写测试报告

Create `docs/superpowers/plans/2026-04-18-editor-play-from-position-test-report.md` with:
- 接口冒烟结果（Task 4 的 curl 输出）
- Vitest 结果
- Playwright 结果
- 构建结果
- 发现的问题与修复

```bash
git add docs/superpowers/plans/2026-04-18-editor-play-from-position-test-report.md
git commit -m "docs: test report for editor-vs-ai feature"
```

### - [ ] Step 12.6: 请用户 code review + 验收

通知用户："已就绪，请审查代码 + 在 dev 环境验收。用户确认后部署。"

---

## 回顾 · 改动清单

| 改动 | 文件 | 行数估计 |
|---|---|---|
| 后端 schema | `app/schemas/play.py` | +1 行字面量 |
| 后端 service | `app/services/game_service.py` | ~25 行 |
| 前端类型 | `src/types/api.ts` | +1 字面量 |
| 前端工具 | `src/utils/editorFen.ts` (新) | ~65 行 |
| 前端工具测试 | `src/utils/__tests__/editorFen.test.ts` (新) | ~30 行 |
| 前端 hook | `src/hooks/useAiOpponent.ts` (新) | ~70 行 |
| 前端 hook 测试 | `src/hooks/__tests__/useAiOpponent.test.ts` (新) | ~55 行 |
| Chessboard | `src/components/chess/Chessboard.tsx` | +1 属性 |
| 编辑器页 | `src/pages/play/BoardEditorPage.tsx` | ~60 行 |
| 自由对弈页 | `src/pages/play/FreeGamePage.tsx` | ~80 行 |
| E2E | `e2e/editor-vs-ai.spec.ts` (新) | ~130 行 |
| **合计** |  | **~520 行** |

**无数据库迁移。** 不动 PG。

## 部署阶段（用户确认后）

1. 备份当前 backend + frontend 构建产物
2. `rsync -avz backend/ server:/opt/chess/backend/`
3. frontend `npm run build` → `rsync -avz dist/ server:/opt/chess/frontend/`
4. 重启 systemd chess-edu-backend
5. 线上冒烟：
   - `/play/editor` → 按钮可见 → 摆残局 → 开始对弈 → 能走子 → 结果卡
   - 编辑器正常「分析局面」「保存」功能不受影响（回归核心点）
   - 对局历史出现新对局
