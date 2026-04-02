# 自由对弈 + 空白棋盘摆题 -- 架构设计

> 日期: 2026-03-30
> 作者: architect-agent
> 状态: 待评审

---

## 1. 数据库变更

### 1.1 games 表新增字段

```sql
-- game_type: 区分对局来源
-- 值域: 'ai_character'(默认,现有) | 'free_play'(自由对弈) | 'imported'(PGN导入)
ALTER TABLE games ADD COLUMN game_type VARCHAR(20) NOT NULL DEFAULT 'ai_character';

-- opponent_name: 自由对弈时的对手名字(可选)
ALTER TABLE games ADD COLUMN opponent_name VARCHAR(100) NULL;
```

**设计说明:**

- `game_type` 默认值 `ai_character`，所有历史数据自动兼容，无需回填。
- `character_id` 保持 NOT NULL。对于 `free_play` / `imported` 类型，写入固定值 `"none"`。这避免修改外键约束，但要求 characters 表中存在 id="none" 的占位记录（见下方）。
- `opponent_name` 仅 `free_play` 时有意义，其余类型为 NULL。

### 1.2 characters 表插入占位记录

```sql
INSERT INTO characters (id, slug, name, tier, region, avatar_key, personality,
    play_style, base_rating, rating_range_min, rating_range_max,
    engine_depth_min, engine_depth_max, mistake_rate, is_free, sort_order)
VALUES ('none', 'none', '无', 'none', 'none', 'none', '占位',
    'none', 0, 0, 0, 0, 0, 0, false, 9999);
```

这条记录不会出现在角色大厅（`is_free=false` 且 `sort_order=9999`，前端可按 `slug != 'none'` 过滤）。

### 1.3 不变更

- `game_moves` 表无变化，自由对弈的走子仍然正常写入。
- `character_id` 的外键约束和 NOT NULL 不变。
- 不新增表。

---

## 2. API 契约变更

### 2.1 新增 Schema

```python
# backend/app/schemas/play.py 新增

class CreateFreeGameRequest(BaseModel):
    """创建自由对弈/导入对局的请求"""
    game_type: Literal["free_play", "imported"]  # 必填
    opponent_name: Optional[str] = Field(None, max_length=100, description="对手名字")
    user_color: str = Field(default="white", description="用户执棋颜色")
    time_control: int = Field(default=0, ge=0, le=3600, description="时间控制,0=无限制")
    # 仅 imported 类型使用:
    pgn: Optional[str] = Field(None, description="导入的PGN文本")
    initial_fen: Optional[str] = Field(None, description="起始FEN(非标准开局时)")

class SavePositionRequest(BaseModel):
    """保存棋盘局面(功能B)"""
    fen: str = Field(..., description="FEN字符串")
    title: Optional[str] = Field(None, max_length=200, description="局面标题")
    notes: Optional[str] = Field(None, description="用户备注")

class SavePositionResponse(BaseModel):
    """保存局面的响应"""
    game_id: str
    fen: str
```

### 2.2 修改 Schema

```python
# GameListItem 新增字段
class GameListItem(BaseModel):
    # ... 现有字段不变 ...
    game_type: str = "ai_character"          # 新增
    opponent_name: Optional[str] = None      # 新增

# GameDetail 新增字段
class GameDetail(BaseModel):
    # ... 现有字段不变 ...
    game_type: str = "ai_character"          # 新增
    opponent_name: Optional[str] = None      # 新增
```

### 2.3 新增 API 端点

| 方法 | 路径 | 说明 | 请求 | 响应 |
|------|------|------|------|------|
| POST | `/api/v1/play/free-games` | 创建自由对弈/导入对局 | `CreateFreeGameRequest` | `APIResponse[CreateGameResponse]` |
| PUT | `/api/v1/play/free-games/{game_id}/complete` | 完成自由对弈 | `CompleteGameRequest` | `APIResponse[GameDetail]` |
| POST | `/api/v1/play/positions` | 保存摆题局面 | `SavePositionRequest` | `APIResponse[SavePositionResponse]` |

### 2.4 现有端点行为变更

| 端点 | 变更 |
|------|------|
| `GET /api/v1/play/games` | 响应新增 `game_type`、`opponent_name` 字段；支持 `?game_type=free_play` 查询参数过滤 |
| `GET /api/v1/play/games/{id}` | 响应新增 `game_type`、`opponent_name` 字段 |
| `GET /api/v1/play/games/{id}/review` | 无变更，free_play/imported 对局也能复盘 |
| `POST /api/v1/play/games` | **不变**，仍然只接受 `character_id` 的 AI 角色对弈 |
| `PUT /api/v1/play/games/{id}/complete` | **不变**，仍然只处理 AI 角色对弈的完成 |

### 2.5 服务层分支逻辑

```
create_free_game(db, user_id, request):
    1. character_id = "none"（固定）
    2. 不查 adaptive_params
    3. 不消耗每日配额（free_play不计配额）
    4. 如果 game_type == "imported" 且有 pgn:
       - 解析 PGN 提取 moves，直接写入 game_moves
       - status 设为 "completed"
       - 自动填充 total_moves、final_fen
    5. 如果 game_type == "free_play":
       - status 设为 "playing"
       - 前端走子时逐步提交或结束时批量提交

complete_free_game(db, game_id, user_id, request):
    1. 不调用 update_rating_after_game（不计ELO）
    2. 不调用 _update_character_stats（不计角色统计）
    3. 不调用 update_after_game（不触发自适应难度）
    4. 不调用 analyze（不触发弱点诊断）
    5. 不调用 auto_complete_item（不触发训练计划）
    6. 仅更新: result, pgn, total_moves, final_fen, status, ended_at

save_position(db, user_id, request):
    1. 创建 Game 记录:
       - game_type = "imported"
       - character_id = "none"
       - status = "completed"
       - pgn = None
       - final_fen = request.fen
       - review_data = {"title": request.title, "notes": request.notes}
    2. 返回 game_id + fen
```

---

## 3. 前端页面和路由

### 3.1 新增页面

| 页面组件 | 路由 | 布局 | 说明 |
|---------|------|------|------|
| `FreePlayPage` | `/play/free` | AppLayout 内 | 自由对弈入口：选择模式（面对面/自己摆棋/PGN导入） |
| `FreeGamePage` | `/play/free/game/:id` | AppLayout 内 | 自由对弈棋盘（双人轮流走子） |
| `BoardEditorPage` | `/play/editor` | 全屏（无 AppLayout） | 空白棋盘摆题 + Stockfish 分析 |

### 3.2 路由注册（App.tsx）

```tsx
// 在 {/* Play */} 区块内新增:

// 自由对弈入口
<Route path="/play/free" element={<SuspenseWrapper><FreePlayPage /></SuspenseWrapper>} />
// 自由对弈棋盘
<Route path="/play/free/game/:id" element={<SuspenseWrapper><FreeGamePage /></SuspenseWrapper>} />

// 棋盘编辑器（全屏，与 ReviewPage 同级别，在 AppLayout 外）
<Route element={<ProtectedRoute />}>
  <Route path="/play/editor" element={<SuspenseWrapper><BoardEditorPage /></SuspenseWrapper>} />
</Route>
```

### 3.3 页面职责

#### FreePlayPage (`/play/free`)

- 三个入口卡片：
  - "面对面对弈" -- 调 `POST /play/free-games` (game_type=free_play) 后跳转 FreeGamePage
  - "自己摆棋" -- 直接跳转 BoardEditorPage
  - "导入PGN" -- 弹出文本框粘贴 PGN，调 `POST /play/free-games` (game_type=imported) 后跳转 ReviewPage
- 可选填对手名字（面对面对弈时）
- 导航入口：角色大厅页面增加"自由对弈"按钮

#### FreeGamePage (`/play/free/game/:id`)

- 复用现有棋盘组件（chess.js + 棋盘渲染）
- 关键区别：
  - 不调 Stockfish AI（双方都是人）
  - 棋盘不翻转（白方在下）或可手动翻转
  - 无计时器（time_control=0 时）或可选计时
  - 无角色对话、无提示按钮
  - 顶部显示对手名字（而非角色信息）
- 对局结束：
  - 手动认输 / 手动和棋 / 将杀自动判定
  - 调 `PUT /play/free-games/{id}/complete` 保存
  - 结束后显示"查看复盘"按钮，跳转 `/play/review/{id}`

#### BoardEditorPage (`/play/editor`)

- 纯前端为主，不需要后端交互（除非用户选择保存）
- 功能：
  - 空白棋盘（或标准开局）
  - 拖拽棋子到棋盘/从棋盘移除
  - 棋子选择器（侧边栏列出所有棋子类型）
  - FEN 输入框：粘贴 FEN 直接加载局面
  - FEN 导出：复制当前局面 FEN
  - Stockfish 分析面板：显示最佳走法、评估分数、变化线
  - "保存局面"按钮：调 `POST /play/positions` 保存到后端
- Stockfish 交互：
  - 使用前端 Stockfish WASM（与 ReviewPage 复盘用同一个引擎实例管理器）
  - 用户摆完棋子后点"分析"或自动分析
  - 显示引擎评估（cp/mate）、最佳走法前 3 行变化线

### 3.4 现有页面修改

| 页面 | 修改 |
|------|------|
| `CharacterHallPage` | 顶部或底部新增"自由对弈"入口按钮，跳转 `/play/free` |
| `GameHistoryPage` | 列表增加 `game_type` 标签显示（AI角色 / 自由对弈 / 导入）；增加筛选 Tab |
| `ReviewPage` | 兼容 `game_type != ai_character` 的对局：隐藏角色信息区域，显示对手名字或"导入对局" |

### 3.5 前端类型定义

```typescript
// frontend/src/types/api.ts 新增

interface CreateFreeGameRequest {
  game_type: 'free_play' | 'imported'
  opponent_name?: string
  user_color?: string
  time_control?: number
  pgn?: string
  initial_fen?: string
}

interface SavePositionRequest {
  fen: string
  title?: string
  notes?: string
}

interface SavePositionResponse {
  game_id: string
  fen: string
}

// GameListItem / GameDetail 扩展:
// + game_type: string
// + opponent_name?: string
```

### 3.6 前端 API 层

```typescript
// frontend/src/api/play.ts 新增方法

createFreeGame(data: CreateFreeGameRequest): Promise<APIResponse<{ game_id: string }>>
completeFreeGame(gameId: string, data: CompleteGameRequest): Promise<APIResponse<GameDetail>>
savePosition(data: SavePositionRequest): Promise<APIResponse<SavePositionResponse>>
```

---

## 4. 风险和注意事项

### 4.1 数据库风险

| 风险 | 严重度 | 应对方案 |
|------|--------|---------|
| SQLite 不支持 ADD COLUMN 带外键约束 | 中 | `game_type` 和 `opponent_name` 都是简单类型，无外键，SQLite `ALTER TABLE ADD COLUMN` 可正常执行 |
| characters 表缺少 id="none" 记录导致外键报错 | 高 | 必须在 ALTER TABLE 之后、创建第一条 free_play 记录之前插入占位 character；建议写入 init_db 流程 |
| 线上 data.db 需要手动执行 ALTER TABLE | 中 | 部署时 SSH 执行 SQL 或写一个迁移脚本放 `backend/migrations/` |

### 4.2 前端风险

| 风险 | 严重度 | 应对方案 |
|------|--------|---------|
| GamePage 和 FreeGamePage 大量重复代码 | 中 | 提取 `ChessBoard` + `GameControls` 公共组件，两个页面组合使用 |
| BoardEditorPage 的 Stockfish WASM 加载时间长 | 低 | 复用 ReviewPage 的引擎管理器（engine/stockfish.ts），懒加载 |
| PGN 导入解析失败（格式不规范） | 中 | 使用 chess.js 的 `loadPgn()` 做校验，失败时提示用户修正 |
| 棋盘编辑器的棋子拖拽交互复杂度 | 中 | 可先实现 FEN 输入/输出，拖拽摆棋作为增强功能分阶段实现 |

### 4.3 业务风险

| 风险 | 严重度 | 应对方案 |
|------|--------|---------|
| free_play 数据量大，拖慢对局历史查询 | 低 | `game_type` 字段加索引；前端默认筛选 `ai_character` |
| 用户混淆"自由对弈"和"AI对弈"入口 | 低 | UI 上明确区分，角色大厅仍是 AI 对弈主入口 |
| 导入 PGN 含作弊局，影响复盘参考价值 | 无 | 导入对局不计入任何评分/统计，仅供复盘分析 |

### 4.4 向后兼容

- 所有现有 API 的请求/响应格式不变（新增字段有默认值）。
- 前端现有的 `GamePage`、`ReviewPage`、`GameHistoryPage` 对 `game_type` 字段容错（undefined 视为 `ai_character`）。
- `POST /play/games` 和 `PUT /play/games/{id}/complete` 行为完全不变。

---

## 5. 实现优先级建议

| 阶段 | 内容 | 工作量估算 |
|------|------|-----------|
| P0 | 数据库 ALTER + 占位 character + 后端 free-games API | 后端 0.5 天 |
| P1 | FreePlayPage 入口 + FreeGamePage 双人对弈 | 前端 1 天 |
| P2 | PGN 导入（前端解析 + 后端保存 + 跳转复盘） | 前端 0.5 天 + 后端 0.5 天 |
| P3 | BoardEditorPage 空白棋盘 + FEN 导入导出 | 前端 1 天 |
| P4 | BoardEditorPage Stockfish 分析面板 | 前端 0.5 天（复用引擎管理器） |
| P5 | GameHistoryPage 筛选 + ReviewPage 兼容 | 前端 0.5 天 |
