# 专项训练 + 闯关改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 谜题模块新增专项训练（按主题做题）+ 闯关挑战改为10关x20题 + 修复星星标题重叠

**Architecture:** 后端注册已有的 theme API 路由 + 闯关改为10关逻辑 + 前端新增2个页面 + 谜题首页加tab

**Tech Stack:** FastAPI, SQLAlchemy, React, TailwindCSS

**Spec:** `docs/superpowers/specs/2026-04-07-theme-training-design.md`

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `backend/app/routers/puzzles.py` | 修改 | 注册 themes 和 theme/{theme} 路由，challenge level 范围改 1-10 |
| `backend/app/services/puzzle_service.py` | 修改 | get_challenge_progress 改 10 关，get_available_themes 增加 category+用户进度 |
| `frontend/src/pages/puzzles/PuzzlesHomePage.tsx` | 修改 | 新增"专项训练" tab |
| `frontend/src/pages/puzzles/PuzzleChallengePage.tsx` | 修改 | 改为 10 关，修复星星重叠 |
| `frontend/src/pages/puzzles/ThemeTrainingPage.tsx` | 新建 | 专项训练主题列表（4大类分组） |
| `frontend/src/pages/puzzles/ThemePracticePage.tsx` | 新建 | 某主题连续做题 |
| `frontend/src/api/puzzles.ts` | 修改 | 新增 getThemes(), getThemePuzzles() |
| `frontend/src/types/api.ts` | 修改 | 新增 ThemeItem 等类型 |
| `frontend/src/App.tsx` | 修改 | 注册新路由 |

---

### Task 1: 后端 — 注册 themes API + 闯关改 10 关

**Files:**
- Modify: `backend/app/routers/puzzles.py`
- Modify: `backend/app/services/puzzle_service.py`

- [ ] **Step 1: 在 puzzles.py 路由中注册 themes 端点**

在 puzzles router 中新增两个路由（放在 `/challenge` 路由之前避免路径冲突）：

```python
@router.get("/themes")
def get_themes(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all available puzzle themes with user progress."""
    user_id = current_user["user_id"]
    data = puzzle_service.get_available_themes_with_progress(db, user_id)
    return APIResponse.success(data=data)


@router.get("/theme/{theme}")
def get_theme_puzzles_route(
    theme: str,
    count: int = 10,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get puzzles for a specific theme, matched to user rating."""
    user_id = current_user["user_id"]
    puzzles = puzzle_service.get_theme_puzzles(db, user_id, theme, count)
    return APIResponse.success(data=puzzles)
```

- [ ] **Step 2: 修改 get_available_themes 增加 category 和用户进度**

在 puzzle_service.py 中新增 `get_available_themes_with_progress`：

```python
THEME_CATEGORIES = {
    "basic_tactics": {
        "name": "基础战术",
        "themes": ["fork", "pin", "skewer", "discoveredAttack", "doubleCheck", "hangingPiece", "trappedPiece"],
    },
    "checkmate": {
        "name": "将杀训练",
        "themes": ["mateIn1", "mateIn2", "mateIn3", "backRankMate", "smotheredMate", "hookMate", "mate"],
    },
    "advanced_tactics": {
        "name": "高级战术",
        "themes": ["sacrifice", "deflection", "decoy", "intermezzo", "quietMove", "xRayAttack", "capturingDefender"],
    },
    "endgame": {
        "name": "残局训练",
        "themes": ["pawnEndgame", "rookEndgame", "queenEndgame", "bishopEndgame", "knightEndgame", "endgame"],
    },
}

def get_available_themes_with_progress(db: Session, user_id: str) -> list[dict]:
    # 1. 获取所有主题和题数（复用已有逻辑）
    themes = get_available_themes(db)
    theme_map = {t["theme"]: t for t in themes}

    # 2. 批量查询用户在各主题的做题数和正确数
    attempts = db.execute(
        select(
            Puzzle.themes,
            func.count(PuzzleAttempt.id).label("attempted"),
            func.sum(case((PuzzleAttempt.is_correct == True, 1), else_=0)).label("correct"),
        )
        .join(Puzzle, Puzzle.id == PuzzleAttempt.puzzle_id)
        .where(PuzzleAttempt.user_id == user_id)
        .group_by(Puzzle.themes)
    ).all()

    # 聚合每个主题的统计（一题可能有多个 theme 标签）
    theme_stats = {}
    for row in attempts:
        if not row.themes:
            continue
        for t in row.themes.split(","):
            t = t.strip()
            if t not in theme_stats:
                theme_stats[t] = {"attempted": 0, "correct": 0}
            theme_stats[t]["attempted"] += row.attempted or 0
            theme_stats[t]["correct"] += row.correct or 0

    # 3. 合并，加 category
    theme_to_category = {}
    for cat_key, cat_info in THEME_CATEGORIES.items():
        for t in cat_info["themes"]:
            theme_to_category[t] = cat_key

    results = []
    for t in themes:
        stats = theme_stats.get(t["theme"], {})
        attempted = stats.get("attempted", 0)
        correct = stats.get("correct", 0)
        results.append({
            **t,
            "category": theme_to_category.get(t["theme"], "other"),
            "attempted": attempted,
            "correct": correct,
            "accuracy": round(correct / attempted * 100) if attempted > 0 else 0,
        })

    return results
```

- [ ] **Step 3: 修改闯关从 5 关改为 10 关**

在 `get_challenge_progress` 中将 `range(1, 6)` 改为 `range(1, 11)`。

在路由中将 level 校验从 `1-5` 改为 `1-10`：
```python
if level < 1 or level > 10:
    raise HTTPException(status_code=400, detail="Level must be between 1 and 10")
```

- [ ] **Step 4: 验证后端**

```bash
cd backend && python3 -m uvicorn app.main:app --port 8000 &
sleep 5
TOKEN=$(curl -s http://localhost:8000/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['tokens']['access_token'])")
curl -s http://localhost:8000/api/v1/puzzles/themes -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'themes={len(d[\"data\"])}')"
curl -s "http://localhost:8000/api/v1/puzzles/theme/fork?count=5" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'puzzles={len(d[\"data\"])}')"
curl -s http://localhost:8000/api/v1/puzzles/challenge -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'levels={len(d[\"data\"][\"levels\"])}')"
```

Expected: themes=25+, puzzles=5, levels=10

- [ ] **Step 5: 提交**

```bash
git add backend/app/routers/puzzles.py backend/app/services/puzzle_service.py
git commit -m "feat: themes API路由 + 闯关改10关"
```

---

### Task 2: 前端 — 类型 + API + 路由注册

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/api/puzzles.ts`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 新增类型定义**

在 types/api.ts 中新增：
```typescript
export interface ThemeItem {
  theme: string
  name: string
  category: string
  count: number
  attempted: number
  correct: number
  accuracy: number
}
```

- [ ] **Step 2: 新增 API 调用**

在 api/puzzles.ts 中新增：
```typescript
getThemes: () =>
  apiClient.get<APIResponse<ThemeItem[]>>('/puzzles/themes'),

getThemePuzzles: (theme: string, count: number = 10) =>
  apiClient.get<APIResponse<PuzzleItem[]>>(`/puzzles/theme/${theme}?count=${count}`),
```

- [ ] **Step 3: 注册路由**

在 App.tsx 中新增 lazy import 和路由（AppLayout 内）：
```tsx
const ThemeTrainingPage = React.lazy(() => import('@/pages/puzzles/ThemeTrainingPage'))
const ThemePracticePage = React.lazy(() => import('@/pages/puzzles/ThemePracticePage'))

// 在 puzzles 路由组内
<Route path="/puzzles/themes" element={<SuspenseWrapper><ThemeTrainingPage /></SuspenseWrapper>} />
<Route path="/puzzles/theme/:theme" element={<SuspenseWrapper><ThemePracticePage /></SuspenseWrapper>} />
```

- [ ] **Step 4: 提交**

```bash
git add frontend/src/types/api.ts frontend/src/api/puzzles.ts frontend/src/App.tsx
git commit -m "feat: theme training 类型+API+路由注册"
```

---

### Task 3: 前端 — 谜题首页加 tab + 闯关修复

**Files:**
- Modify: `frontend/src/pages/puzzles/PuzzlesHomePage.tsx`
- Modify: `frontend/src/pages/puzzles/PuzzleChallengePage.tsx`

- [ ] **Step 1: PuzzlesHomePage 新增"专项训练"入口卡片**

在现有的闯关挑战卡片后新增专项训练入口：
- 卡片标题"专项训练"
- 描述"按战术主题针对性练习"
- 点击跳转 `/puzzles/themes`

- [ ] **Step 2: PuzzleChallengePage 从 5 关改为 10 关**

修改 LEVEL_INFO 从 5 级扩展到 10 级（添加 6-10 级的 label/emoji/color）。

- [ ] **Step 3: 修复星星和标题重叠**

检查 PuzzleChallengePage 中星星 emoji 和标题的 flex 布局，添加 `gap-2` 或调整 `items-center`。

- [ ] **Step 4: TypeScript 编译验证**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v test.ts
```

- [ ] **Step 5: 提交**

```bash
git add frontend/src/pages/puzzles/PuzzlesHomePage.tsx frontend/src/pages/puzzles/PuzzleChallengePage.tsx
git commit -m "feat: 谜题首页专项训练入口 + 闯关改10关 + 修复星星重叠"
```

---

### Task 4: 前端 — ThemeTrainingPage 主题列表

**Files:**
- Create: `frontend/src/pages/puzzles/ThemeTrainingPage.tsx`

- [ ] **Step 1: 创建主题列表页面**

页面结构：
- 标题"专项训练" + 返回按钮
- 4 个大类卡片（基础战术/将杀训练/高级战术/残局训练），可折叠
- 每个大类内列出主题，每行显示：中文名 + 题数 + 已做/正确率 + 进度条
- 点击主题跳转 `/puzzles/theme/{theme}`
- 调用 `puzzlesApi.getThemes()` 获取数据
- 按 `category` 字段分组到 4 大类
- 使用 Card, Button, Badge, ProgressBar 组件

大类配置：
```typescript
const CATEGORIES = [
  { key: 'basic_tactics', title: '基础战术', emoji: '⚔️', description: '双攻、牵制、串击等基本战术' },
  { key: 'checkmate', title: '将杀训练', emoji: '👑', description: '各种将杀模式' },
  { key: 'advanced_tactics', title: '高级战术', emoji: '🎯', description: '弃子、引离、中间着等进阶战术' },
  { key: 'endgame', title: '残局训练', emoji: '♟️', description: '各类残局技巧' },
]
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/pages/puzzles/ThemeTrainingPage.tsx
git commit -m "feat: ThemeTrainingPage 专项训练主题列表"
```

---

### Task 5: 前端 — ThemePracticePage 连续做题

**Files:**
- Create: `frontend/src/pages/puzzles/ThemePracticePage.tsx`

- [ ] **Step 1: 创建连续做题页面**

页面结构：
- 从 URL params 获取 theme
- 调用 `puzzlesApi.getThemePuzzles(theme, 10)` 获取 10 题
- 棋盘 + 做题逻辑（复用 PuzzleSolvePage 的 handleMove 逻辑，或直接内嵌 Chessboard）
- 每题做完显示对/错反馈 + "下一题"按钮
- 做完 10 题自动加载下一批
- 顶部显示：主题名 + 本次进度（第 X 题）+ 正确率
- 退出按钮 → 显示本次统计弹窗（做了几题、正确几题、正确率）→ 返回主题列表
- 使用 chess.js 处理走子逻辑
- 调用 puzzlesApi.submitAttempt 记录做题结果

- [ ] **Step 2: 提交**

```bash
git add frontend/src/pages/puzzles/ThemePracticePage.tsx
git commit -m "feat: ThemePracticePage 专项训练连续做题"
```

---

### Task 6: 验证 + 构建 + 部署

- [ ] **Step 1: TypeScript 编译**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v test.ts
```
Expected: 无错误

- [ ] **Step 2: Vite 构建**

```bash
VITE_BASE=/chess/ npm run build
```
Expected: 构建成功

- [ ] **Step 3: API 验证**

测试 themes API 和 challenge 10 关。

- [ ] **Step 4: 部署**

```bash
ssh root@118.31.237.111 "/opt/chess-edu/backup.sh"
ssh root@118.31.237.111 "rm -rf /opt/chess-edu/www/chess/assets"
scp -r frontend/dist/* root@118.31.237.111:/opt/chess-edu/www/chess/
rsync -av --exclude='__pycache__' --exclude='*.pyc' --exclude='data.db' backend/ root@118.31.237.111:/opt/chess-edu/backend/
ssh root@118.31.237.111 "systemctl restart chess-edu"
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 专项训练模块 + 闯关挑战10关改造"
```
