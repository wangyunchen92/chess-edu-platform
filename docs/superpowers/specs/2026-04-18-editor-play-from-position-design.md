# 棋盘编辑器 · 摆好局面与 AI 对弈

- 状态：已评审（设计阶段）
- 日期：2026-04-18
- 来源：用户反馈 `https://chess.ccwu.cc/play/editor` 缺少「摆好后与 AI 对弈」入口

## 1. 背景与目标

当前编辑器（`BoardEditorPage`，路由 `/play/editor`）允许用户摆棋、导入/导出 FEN、调用引擎分析、保存局面到云端，但**没有「从当前局面开始对弈」的入口**。用户反馈：摆好棋后（通常是残局或杀王练习题）无法立刻验证自己的思路。

本设计补齐这一入口，让用户在摆完任意合法局面后直接与一个稳定强度的 AI 开始对弈，对局可复盘、可重来。

### 目标
- 编辑器新增「开始对弈」按钮，点击即跳转到对弈页
- AI 为满血 Stockfish（depth=18、不放水），适合残局验算场景
- 对局归入「自由对弈」体系，不计评分，但保留复盘
- 非法局面可感知（按钮禁用 + 原因）
- 改动面集中、不污染现有正式对弈（角色 AI 对弈）路径

### 非目标
- 不引入新的角色体系或 AI 对手选择
- 不支持时间控制（无限思考）
- 不消耗积分
- 不做多次分析缓存、残局题库、挑战评分等扩展

## 2. 需求决策摘要

| 维度 | 决策 |
|---|---|
| 入口形式 | 编辑器页底部一个「开始对弈」按钮，无弹窗，直接跳对弈页 |
| AI 强度 | 固定 Stockfish 满血，depth 18，失误率 0 |
| 执子颜色 | 跟随编辑器的「走棋方」（白先 → 用户执白） |
| 时间控制 | 不计时 |
| 对局归属 | 自由对弈（`/play/free-games`），新增 `game_type='vs_ai_editor'` |
| 对局历史 | 显示在对局历史，可复盘，不计评分 |
| 结束形态 | 停留在对弈页 + 结果卡；三个动作：查看复盘 / 再来一局 / 返回编辑器 |
| 非法局面 | 按钮禁用 + 下方红字显示具体原因 |
| 再来一局 | 创建新 game_id（原局保留在历史） |
| 主动结束 | 沿用对弈页已有的「认输」按钮 |
| 积分消耗 | 免费 |

## 3. 架构

### 3.1 改动位置一览

| 文件 | 改动 |
|---|---|
| `backend/app/schemas/play.py` | `CreateFreeGameRequest.game_type` 字面量扩展为 `Literal["free_play", "imported", "vs_ai_editor"]` |
| `backend/app/services/game_service.py` | `create_free_game()` 新增 `vs_ai_editor` 分支：默认 `opponent_name='Stockfish · 大师级'`，存 `initial_fen` 到 `final_fen` |
| `frontend/src/types/api.ts` | `CreateFreeGameRequest.game_type` 字面量同步扩展 |
| `frontend/src/pages/play/BoardEditorPage.tsx` | 新增 FEN 合法性校验 + 「开始对弈」按钮 + 请求/跳转逻辑 |
| `frontend/src/pages/play/FreeGamePage.tsx` | 识别 `game_type='vs_ai_editor'`，启用 AI 对手分支，补结果卡「返回编辑器」按钮 |
| **新建** `frontend/src/hooks/useAiOpponent.ts` | 封装 Stockfish 调用 + 竞态控制 |

### 3.2 不新增数据库字段

`games` 表已有 `final_fen`。**当前 `create_free_game` service 已经把 `request.initial_fen` 存入 `final_fen` 字段**（`game_service.py:519`），走子过程中不回写，仅在 `complete` 时更新为真正的终局 FEN。本次直接复用此数据流。

`games.character_id` 字段是 NOT NULL，现有自由对弈实现使用字符串 `"none"` 作为占位值（`game_service.py:512`），本次沿用同样做法。**不需要 DDL**。

## 4. 组件细节

### 4.1 BoardEditorPage 改造

**新增状态：**
```ts
const fenLegalityError = useMemo<string | null>(() => validateEditorFen(currentFen), [currentFen])
const [starting, setStarting] = useState(false)
```

**校验函数 `validateEditorFen(fen)`：** 依次检查
1. `new Chess(fen)` 不抛错
2. 白方恰有 1 个 K、黑方恰有 1 个 K
3. 双王不相邻
4. 若某方被将军，则该方必须是走棋方（否则是"轮到走方没走但被将"的非法态）

返回人类可读的中文原因或 `null`。

**UI：** 在"保存局面"板块下方新增一块：
```
[ 开始对弈 ]
└── disabled 时：红字 "当前局面不合法：{原因}"
```

**交互：**
```ts
const handleStartVsAi = async () => {
  setStarting(true)
  try {
    const res = await freePlayApi.createFreeGame({
      game_type: 'vs_ai_editor',
      initial_fen: currentFen,
      user_color: turn === 'w' ? 'white' : 'black',
    })
    const data = (res.data as any)?.data ?? res.data
    const gameId = data?.game_id ?? data?.id
    if (gameId) navigate(`/play/free/game/${gameId}`)
  } catch (e) {
    toast('创建对局失败，请稍后重试')
  } finally {
    setStarting(false)
  }
}
```

### 4.2 FreeGamePage 改造

加载对局后增加分支：
```ts
const enableAi = gameDetail.game_type === 'vs_ai_editor'
if (enableAi) {
  chess.load(gameDetail.final_fen)   // initial_fen 存在 final_fen 里
  setInitialFen(gameDetail.final_fen)
  setOrientation(gameDetail.user_color === 'black' ? 'black' : 'white')
  setOpponentLabel('Stockfish · 大师级')
}
```

AI 循环：
```ts
useAiOpponent(
  fen,
  enableAi && !gameOver && chess.turn() !== userColor,
  (uci) => makeMoveFromUci(uci),
  18,
)
```

结果卡（已有"查看复盘"按钮）补两个按钮：
- 「再来一局」：`POST /play/free-games` 用同一 `initial_fen` 创建新对局 → `navigate('/play/free/game/{newId}')`
- 「返回编辑器」：`navigate('/play/editor')`

两个按钮仅在 `enableAi` 时显示，不影响现有面对面/PGN 模式。

### 4.3 useAiOpponent hook

```ts
export function useAiOpponent(
  fen: string,
  enabled: boolean,
  onMove: (uci: string) => void,
  depth = 18,
): { thinking: boolean; error: string | null }
```

- `fen` 变化或 `enabled` 切换时触发
- 内部维护 `AbortController`：新一次调用前 abort 上一次，避免 stale move
- 超时 8s，失败重试 1 次，再失败则 `error='AI 走子失败'` 并停止

### 4.4 后端 service 分支

`create_free_game()` 现有实现已经把 `initial_fen` 存到 `final_fen`、用 `character_id="none"` 占位，只需扩展 `game_type` 字面量 + 新增 `vs_ai_editor` 分支的必填字段校验：

```python
# app/services/game_service.py - create_free_game()
if request.game_type == 'vs_ai_editor':
    if not request.initial_fen:
        raise HTTPException(422, 'initial_fen 必填')
    try:
        chess.Board(request.initial_fen)  # python-chess 校验
    except Exception:
        raise HTTPException(422, 'FEN 非法')
    # 补全默认对手名
    if not request.opponent_name:
        request = request.model_copy(update={'opponent_name': 'Stockfish · 大师级'})
```

其余字段走已有逻辑（character_id="none"、final_fen=initial_fen、time_control=0、status='playing'）。

### 4.5 FEN 校验职责

| 层 | 工具 | 目的 |
|---|---|---|
| 前端（编辑器 `validateEditorFen`） | chess.js + 自定义规则 | UX：按钮禁用 + 红字提示 |
| 后端（`create_free_game`） | python-chess | 安全边界：防止绕过前端校验（直接调 API）的非法请求，返回 422 |

两层校验规则保持一致：FEN 合法、双方恰 1 王、双王不相邻、被将方为走棋方。

## 5. 数据流

```
1. 编辑器
   FEN 合法 → 点「开始对弈」
   POST /play/free-games
     { game_type:'vs_ai_editor', initial_fen:x, user_color:'white' }
   ← { game_id: g1 }
   navigate('/play/free/game/g1')

2. 对弈页挂载
   GET /play/games/g1
   ← { game_type:'vs_ai_editor', final_fen:x, user_color:'white', ... }
   chess.load(x); enableAi = true

3. AI 循环
   turn === user_color ? 等待用户 : useAiOpponent→getBestMove(fen,18)→onMove(uci)→chess.move

4. 终局
   chess.isCheckmate()/isDraw()/用户认输
   PUT /play/free-games/g1/complete
     { result, pgn, final_fen, user_color }
   显示结果卡

5. 结果卡
   ├ 查看复盘 → /play/review/g1
   ├ 再来一局 → POST /play/free-games (同 initial_fen) → /play/free/game/:newId
   └ 返回编辑器 → /play/editor (编辑器 state 不受影响)
```

## 6. 错误处理

| 场景 | 处理 |
|---|---|
| FEN 非法 | 按钮 disabled + 红字具体原因；不发请求 |
| 创建 free-game 失败（网络/5xx） | 保留在编辑器；Toast「创建对局失败，请稍后重试」；按钮恢复 |
| Stockfish 加载失败 | 对弈页顶部警告条「引擎加载失败，点击刷新重试」；认输/返回编辑器按钮仍可用 |
| AI 计算超时 (>8s) | 自动重试 1 次；仍超时 → Toast「AI 走子失败」+ 停止 AI 循环 |
| 用户快速连续走子导致竞态 | `useAiOpponent` 内部 AbortController：fen 变化 → abort 前一次调用 |
| URL 直接访问不存在的 game | 沿用 FreeGamePage 既有 404 处理 |
| `game_type` 字段未知（老数据） | fallback 到面对面模式（enableAi=false），不崩溃 |
| complete 请求失败 | 结果卡仍显示；3 个按钮可用；复盘时若 PGN 为空给友好提示 |

## 7. 测试策略

### 7.1 接口测试（`backend/tests/test_editor_vs_ai.py`，新增）

1. POST `/play/free-games` 合法 FEN → 201，DB 中 `game_type='vs_ai_editor'`、`final_fen` 正确
2. POST 非法 FEN（无王）→ 422
3. POST 缺 `initial_fen` → 422
4. GET `/play/games/:id` → 返回 `game_type`、`final_fen`、`user_color`、`opponent_name='Stockfish · 大师级'`
5. PUT `/play/free-games/:id/complete` 合法结果 → 成功存 PGN，status='completed'

### 7.2 Playwright E2E（`e2e/editor-vs-ai.spec.ts`，新增）

1. 登录 → `/play/editor` → 清空 → 摆 K+Q(白) vs K(黑) 1 步将杀局 → 白先 → 按钮可用 → 点击 → 跳 `/play/free/game/:id` → 棋盘 FEN 正确 → 对手名 "Stockfish · 大师级"
2. 用户走 Qh5# → 结果卡显示「胜利」→ 3 按钮存在
3. 点「返回编辑器」→ 回到 `/play/editor`
4. 非法局面：清空棋盘（无王）→ 按钮禁用 + 红字「白方缺少国王」
5. 「再来一局」→ URL game_id 变化 → 棋盘回到原始 FEN

### 7.3 回归测试（复用 `e2e/e2e-deep-test.mjs`）

- 现有 FreeGamePage 面对面 + PGN 导入不受影响
- 现有 GamePage（角色 AI 对弈）不受影响
- 现有 BoardEditorPage 分析局面 + 保存局面功能不受影响

### 7.4 构建验证

`npm run build`（tsc 严格模式 + vite build）必须通过。

### 7.5 TDD 顺序

1. 写接口测试 7.1（1-5）+ E2E 用例 7.2（1、4）
2. 实现后端（schema + service 分支）
3. 实现前端（编辑器按钮、FreeGamePage 分支、useAiOpponent hook）
4. 跑 7.1、7.2（1、4）
5. 补齐 E2E 用例 7.2（2、3、5）
6. 跑回归 + 构建
7. 代码审查 → 测试报告 → 用户验收 → 部署

## 8. 部署注意

- **无数据库迁移**：`games` 表字段复用，不执行 DDL
- 部署步骤沿用现有规范：rsync 整目录 backend + frontend 构建产物
- 线上 PG 无需 ALTER
- 部署后线上验证路径：
  1. `/play/editor` → 摆棋 → 按钮可见
  2. 点击 → 进入对弈页 → 能对弈
  3. 完成对弈 → 对局历史里能看到

## 9. 风险与约束

- Stockfish 满血 depth=18 在性能较弱的设备上单步思考可能达 3-5s，属预期
- 引擎为前端 WASM，断网不影响 AI 对弈
- 「再来一局」每次都创建新 game_id，若用户反复刷残局，对局历史会积累大量短对局——可接受，历史页已支持分页
- `games.character_id` 为 NOT NULL，现有自由对弈用字符串 `"none"` 占位，本次沿用（已确认，无需 DDL）
