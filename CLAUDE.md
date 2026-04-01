# Chess Education Platform - 项目规范

## 项目概述

儿童国际象棋在线教育平台（棋育），面向4-12岁儿童，通过角色化AI对弈、互动式课程、谜题训练、冒险闯关等模块，让孩子在趣味中系统学习国际象棋。

## 功能模块

| 模块 | 路由前缀 | 前端页面 | 说明 |
|---|---|---|---|
| 认证 | `/auth` | LoginPage, AssessmentPage | 登录、初始棋力评估 |
| 仪表盘 | `/dashboard` | DashboardPage | 首页聚合数据（今日任务、进度、推荐） |
| 对弈 | `/play` | CharacterHallPage, GamePage, GameHistoryPage, ReviewPage | 选角色→AI对弈→复盘，3个角色（豆丁/桂桂/棉花糖） |
| 谜题 | `/puzzles` | PuzzlesHomePage, DailyPuzzlePage, PuzzleChallengePage, PuzzleSolvePage, MistakeBookPage | 每日3题、分级挑战(5级)、错题本 |
| 课程学习 | `/learn` | CourseListPage, LessonPage, ExercisePage, InteractiveTeachPage | 2个课程(L0入门10课/L1初级15课)、互动教学、AI问答 |
| 每日训练 | `/train` | DailyPlanPage, TrainStatsPage | 每日训练计划、连续打卡统计 |
| 冒险模式 | `/adventure` | AdventureMapPage | 地图探索、晋级挑战 |
| 成长体系 | `/gamification` | AchievementsPage, ProfilePage | 经验值/金币/段位/成就徽章 |
| 设置 | `/user` | SettingsPage | 个人资料、主题、通知偏好 |
| 后台管理 | `/admin` | UserManagePage | 用户管理（管理员） |
| 通知 | `/notifications` | - | 系统通知 |

## 数据模型 (25张表)

### 用户域
- **users** — 账号、角色(student/teacher/admin)、会员等级、登录信息
- **user_profiles** — 昵称、出生年、棋龄、评估状态、初始评分
- **user_ratings** — 对弈评分、谜题评分、段位(rank_title/tier/region)、经验值、金币
- **user_streaks** — 登录连续天数、训练连续天数、最高纪录
- **user_daily_quotas** — 每日配额（对弈/谜题/AI问答/经验值上限）

### 对弈域
- **characters** — AI角色（名称、性格、棋风、基础评分、失误率）
- **character_dialogues** — 角色在不同场景的台词（开场/胜利/失败等）
- **user_character_relations** — 用户与角色的解锁状态、好感度、对战记录
- **games** — 对局记录（用户/角色/颜色/结果/PGN/评分变化）
- **game_moves** — 每步棋记录（SAN/UCI/FEN/是否最佳/失误/漏着）

### 谜题域
- **puzzles** — 谜题库（FEN/解法/难度/评分/标签/每日池/挑战池）
- **daily_puzzles** — 每日谜题分配
- **puzzle_attempts** — 解题记录（正确性/用时/提示/评分变化）

### 学习域
- **courses** — 课程（等级/前置条件/是否免费/会员要求）
- **lessons** — 课时（所属课程/顺序/内容类型/JSON内容/经验奖励）
- **exercises** — 练习题（所属课时/题型/FEN/正确答案）
- **lesson_progresses** — 学习进度（状态/百分比/练习得分）
- **exercise_attempts** — 练习提交记录

### 训练域
- **daily_train_plans** — 每日训练计划（模板类型/项目JSON/完成度）
- **daily_train_records** — 训练执行记录

### 成长域
- **achievements** — 成就定义（条件类型/条件值/奖励）
- **user_achievements** — 用户成就解锁记录
- **rating_histories** — 评分变化历史

### 会员域
- **membership_plans** — 会员套餐（月/季/年/价格/功能）

### 冒险域
- **promotion_challenges** — 晋级挑战记录（类型/目标段位/对局/答题/通过状态）

### 系统域
- **notifications** — 通知（类型/标题/内容/已读状态）

## 静态内容 (`content/` 目录)

| 目录 | 内容 |
|---|---|
| `courses/level_0/` | 零基础启蒙 10 课 + meta.json |
| `courses/level_1/` | 初级提高 15 课 + meta.json |
| `characters/` | 3 个角色 (douding/guigui/mianhuatang) 元数据 + 对话 |
| `puzzles/daily/` | 每日谜题池 pool.json |
| `puzzles/challenge/` | 挑战谜题 3 级 (level_1~3.json) |
| `achievements/` | 成就定义 achievements.json |
| `assessment/` | 4 个等级评估题库 (beginner~advanced.json) |
| `templates/` | 每日训练计划模板 |
| `guides/` | 新手引导 onboarding.json |

## 技术栈

### 前端
- React 18 + TypeScript (strict mode)
- Vite 构建，开发端口 **5173**
- 状态管理: Zustand
- HTTP: Axios，baseURL = `/api/v1`
- 路由: React Router v6
- 样式: TailwindCSS + CSS Variables
- 棋盘: chess.js

### 后端
- Python FastAPI，运行端口 **8000**
- ORM: SQLAlchemy 2.0+ (开发环境 SQLite `data.db`，生产 PostgreSQL)
- 验证: Pydantic 2.5+
- 认证: JWT (HS256)，access_token 120min，refresh_token 30天
- AI: 火山引擎 doubao 模型

### 基础设施
- Docker Compose: PostgreSQL 15 (5432) + Redis 7 (6379)
- Vite 代理: `/api` → `http://localhost:8000`

## 关键约定

### API 协议
- 统一响应: `{ code: 0, message: "success", data: T }`
- 分页响应: `{ code: 0, data: { items: T[], total, page, page_size, total_pages } }`
- 错误响应: `{ code: <status>, message: "<error>", data: null }`
- 路由前缀: `/api/v1/{module}/...`

### 命名规范
- **后端 Schema 是唯一真相来源**，前端类型必须对齐后端 Pydantic Schema
- 前后端字段统一 **snake_case**，不做驼峰转换
- 前端类型集中定义在 `frontend/src/types/api.ts`
- 前端 API 调用必须带泛型: `apiClient.get<APIResponse<T>>(...)`

### 前端规范
- 路径别名: `@/` → `src/`
- API 层: `frontend/src/api/`，每模块一个文件
- 页面: `frontend/src/pages/{module}/`
- 公共组件: `frontend/src/components/common/`
- Store: `frontend/src/stores/`

### 后端规范
- 分层: routers → services → models
- Schema: `backend/app/schemas/`
- Model: `backend/app/models/`
- Pydantic `from_attributes=True` 时，Schema 字段名不要与 ORM relationship 名冲突

### 数据库
- 开发: SQLite (`backend/data.db`)
- 迁移: `make db-migrate` / `make db-rollback`
- 测试账号: admin/admin123, student/123456

---

## 研发流程

### 需求到上线全流程（集成 Superpowers Skills）

每个步骤标注了对应的 superpowers skill（通过 `Skill` 工具调用），skill 会自动引导执行规范化流程。

```
用户/PM提需求
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  1. PM 需求分析与任务拆解                              │
│  - 明确需求范围和验收标准                              │
│  - 拆解为可执行的子任务                                │
│  - 创建任务清单                                       │
│  🔧 skill: superpowers:brainstorming（探索需求和设计）  │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  2. 架构师 技术方案评审                                │
│  - 设计 Schema / API 契约 / 技术方案文档               │
│  🔧 skill: superpowers:writing-plans（写实现计划）      │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  3. PM 确认方案                                       │
│  - 审核技术方案是否满足需求                            │
│  - 确认后通知研发和测试                                │
└──────┬───────────────┬───────────────────────────────┘
       │               │
       ▼               ▼
┌──────────────┐ ┌──────────────────────────────────────┐
│ 4a. 研发执行 │ │ 4b. 测试准备（TDD）                    │
│ 前端+后端    │ │ 编写测试用例+验收标准                   │
│ 并行开发     │ │ 🔧 skill: superpowers:test-driven-     │
│              │ │    development（先写测试再实现）         │
└──────┬───────┘ └────────┬────────────────────────────┘
       │                  │
       │  🔧 skill: superpowers:dispatching-parallel-agents
       │     （2+独立任务时并行派发 agent）
       │  🔧 skill: superpowers:executing-plans
       │     （按计划逐步执行+检查点）
       │                  │
       ▼                  │
┌──────────────────────────┤
│ 5. 研发完成，验证通过     │
│ 🔧 skill: superpowers:   │
│    verification-before-  │
│    completion            │
│ （必须跑验证命令，        │
│   有证据才能声称完成）     │
└──────────────┬───────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  6. 代码审查                                          │
│  🔧 skill: superpowers:requesting-code-review         │
│  （审查代码质量、安全性、是否符合架构设计）              │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  7. 测试执行                                          │
│  - 接口测试: curl/httpx 验证响应                       │
│  - 页面实操测试: 启动项目，实际点击页面验证              │
│  - 回归测试: 确认未破坏其他功能                        │
│  - 有 bug → 🔧 skill: superpowers:systematic-debugging │
│    （系统化排查，不猜测不盲试）                         │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  8. 测试报告                                          │
│  - 输出测试报告到 docs/ 目录                           │
│  - 反馈给 PM 和用户                                   │
│  - 有 bug → 打回研发修复 → 重测                        │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  9. PM + 用户确认验收                                  │
│  - 确认功能符合需求                                    │
│  - 确认测试报告无遗留问题                              │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  10. 完成分支                                         │
│  🔧 skill: superpowers:finishing-a-development-branch  │
│  （验证测试 → 选择合并/PR/保留 → 清理）                │
│  - commit 到主分支                                    │
│  - 更新 RELEASE_NOTES.md                              │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  11. 部署                                             │
│  - 服务器部署流程                                     │
└──────────────────────────────────────────────────────┘
```

### Superpowers Skills 速查

| Skill | 触发时机 | 核心规则 |
|---|---|---|
| `superpowers:brainstorming` | 创建功能、修改行为之前 | 先探索需求和设计，再动手 |
| `superpowers:writing-plans` | 有需求要写实现计划时 | 输出结构化计划文档，含任务分解 |
| `superpowers:executing-plans` | 有计划要执行时 | 逐步执行+检查点，遇阻停下来问 |
| `superpowers:test-driven-development` | 实现功能或修bug之前 | 先写测试用例，再写实现代码 |
| `superpowers:dispatching-parallel-agents` | 2+独立任务可并行时 | 每个agent一个独立问题域，互不干扰 |
| `superpowers:verification-before-completion` | 声称完成之前 | 必须跑验证命令，有证据才能声称通过 |
| `superpowers:requesting-code-review` | 完成实现后、测试前 | 审查代码质量和架构一致性 |
| `superpowers:systematic-debugging` | 遇到bug或测试失败时 | 系统化排查根因，不猜测不盲试 |
| `superpowers:finishing-a-development-branch` | 实现完成+测试通过后 | 验证→选择合并方式→清理 |
| `superpowers:receiving-code-review` | 收到审查反馈时 | 技术严谨验证，不盲目同意 |

### 角色协作规则

| 阶段 | 主导角色 | 配合角色 | 输出物 | Skill |
|---|---|---|---|---|
| 需求分析 | PM | 用户 | 任务清单 + 验收标准 | brainstorming |
| 技术方案 | 架构师 | PM | Schema + API 契约 + 技术方案 | writing-plans |
| 方案确认 | PM | 用户 | 确认通知 | — |
| 测试用例 | 测试 | PM | 测试用例文档 | test-driven-development |
| 研发执行 | 前端+后端 | 架构师 | 代码实现 | executing-plans, dispatching-parallel-agents |
| 研发验证 | 前端+后端 | — | 验证通过证据 | verification-before-completion |
| 代码审查 | code-reviewer | 研发 | 审查报告 | requesting-code-review |
| 测试执行 | 测试 | 研发(修bug) | 测试报告 (docs/) | systematic-debugging（修bug时） |
| 验收确认 | PM + 用户 | 测试 | 验收通过/打回 | — |
| 代码提交 | PM | — | Git commit + Release Notes | finishing-a-development-branch |

### 测试规范（重要）

**测试工程师(qa-agent)必须进行页面实操测试**，不能仅做接口测试或代码审查。

测试分三层:
1. **接口测试** — curl/httpx 验证 API 请求响应格式和数据正确性
2. **页面实操测试** — 启动前后端服务，实际点击页面元素，验证:
   - 页面是否正常渲染（不是空白/mock数据）
   - 点击是否跳转到正确页面
   - 数据是否正确展示（不是 undefined/null）
   - 交互流程是否完整可走通
3. **回归测试** — 确认修改未破坏其他已有功能

历史教训:
- 接口返回正常 ≠ 页面正常（数据绑定错误、字段名不一致、mock数据覆盖）
- Vite 代理端口错误 → 全部 API 失败 → 静默 fallback 到 mock → 看起来"正常"
- ORM relationship 和 Schema 字段名冲突 → 500 错误只在运行时暴露
- **任何 bug 修复完成后，必须实际验证通过才能报告完成**

---

## AgentTeam 成员

| 角色 | Agent | 职责 |
|---|---|---|
| PM | pm-agent | 需求管理、任务拆解、团队协调、部署审批、质量把关 |
| 架构师 | architect-agent | 系统架构、数据库建模、API契约、CI/CD |
| 前端工程师 | frontend-agent | React + TypeScript 页面、组件、交互、样式 |
| 后端工程师 | backend-agent | FastAPI 接口、业务逻辑、数据库 |
| 棋盘引擎师 | chess-engine-agent | Stockfish、AI 对弈、走法验证、棋力系统 |
| AI 对话师 | ai-dialog-agent | 火山引擎 LLM、角色对话、Prompt Engineering |
| 内容制作师 | content-agent | 课程、谜题、角色对话脚本 |
| 测试工程师 | qa-agent | 接口测试 + **页面实操测试** + 回归测试 |
| 支付工程师 | payment-agent | 微信/支付宝、会员计费 (Phase 2) |

---

## 启动项目

```bash
# Make
make backend-dev   # 后端 :8000
make frontend-dev  # 前端 :5173

# 手动
cd backend && python3 -m uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev
```

## 部署

### 生产服务器

与建筑ERP共用同一台阿里云服务器，按路径分发：

- **IP**: 118.31.237.111
- **SSH**: `ssh root@118.31.237.111`
- **棋育路径**: `http://118.31.237.111/chess/`
- **后端端口**: :8001（建筑ERP用:8000）
- **服务目录**: `/opt/chess-edu/`
- **systemd**: `chess-edu.service`

```
Nginx(:80)
  ├── /          → 建筑ERP 前端 + /api/ → :8000
  └── /chess/    → 棋育 前端   + /chess/api/ → :8001
```

### 部署步骤

```bash
# 1. 本地构建前端（设置 base 路径）
cd frontend && VITE_BASE=/chess/ npm run build

# 2. 清理旧文件+上传（重要：先删旧assets再传新的，避免缓存问题）
ssh root@118.31.237.111 "rm -rf /opt/chess-edu/www/chess/assets"
scp -r frontend/dist/* root@118.31.237.111:/opt/chess-edu/www/chess/
rsync -av --exclude='__pycache__' --exclude='*.pyc' --exclude='data.db' backend/ root@118.31.237.111:/opt/chess-edu/backend/
rsync -av content/ root@118.31.237.111:/opt/chess-edu/content/

# 3. 重启后端
ssh root@118.31.237.111 "systemctl restart chess-edu"
```

### Nginx 缓存策略

前端采用 **hash-based cache busting** + **分层缓存**，用户无需手动清缓存：

| 文件类型 | 缓存策略 | 原因 |
|----------|---------|------|
| `index.html` | `no-cache, no-store` | 入口文件永不缓存，确保每次拿到最新版 |
| `assets/*.js/css` | `1年 + immutable` | 文件名含 content hash，内容变则文件名变 |
| 图片/字体/音效 | `7天` | 静态资源适度缓存 |

**部署后无需用户清缓存**：index.html 永远最新 → 引用新 hash 的 JS → 浏览器自动下载新文件。

### 注意事项
- **前端目录是 `/opt/chess-edu/www/chess/`**（Nginx root），不是 `/opt/chess-edu/frontend/`
- 每次部署前必须 `rm -rf assets` 清理旧 JS，否则残留旧文件占磁盘
- 后端 venv 路径：`/opt/chess-edu/backend/venv/bin/python3`

## 项目进度

| 阶段 | 内容 | 状态 |
|---|---|---|
| Sprint 1 | 全栈基础功能（12模块API + 22页面 + 25表） | ✅ 完成 |
| Sprint 1 修复 | 前后端协议对齐 + 页面数据绑定修复 | ✅ 完成 |
| 学习模块打磨 | 卡通课堂改造（双角色对话+聊天布局+音效+升变） | ✅ 完成 |
| 数据联通 | 对弈结果提交+谜题状态跟踪+Dashboard刷新 | ✅ 完成 |
| 后台管理 | 管理员控制台（账号/会员/积分/数据概览） | ✅ 完成 |
| 谜题库替换 | Lichess 真实谜题160道，chess.js 100%验证 | ✅ 完成 |
| 段位系统 | 去掉XP等级，统一用对弈/谜题双评分段位制 | ✅ 完成 |
| 训练自动完成 | 做完谜题/课程/对弈自动标记训练计划 | ✅ 完成 |
| 数据清洁 | 清除所有MOCK假数据，API失败显示错误不显示假数据 | ✅ 完成 |
| 部署上线 | 阿里云服务器 http://118.31.237.111/chess/ | ✅ 已上线 |

## 常见陷阱

- Vite 代理目标必须是 `http://localhost:8000`（本地开发），不是 8001
- `UserResponse.rating` 与 User ORM `rating` relationship 冲突，已用 model_validator 处理
- `GET /learn/courses` 不返回 lessons 数组，需调 `GET /learn/courses/{id}` 获取
- 前端 fallback 到 mock 数据时不报错，排查时必须确认真实 API 被调用
- Assessment 提交用 `selected_key` 不是 `answer`
- Adventure 模块前端字段用 `icon`/`is_unlocked`/`is_completed`/`reward_xp`/`rating_range`
- 对弈结束后必须调 `playApi.completeGame()` 才会记录到后端
- 每日谜题 `attempted` 状态从原始 wrapper 读，不是解包后的 puzzle 对象
- 兵升变需要 promotion 参数，Chessboard 组件弹选择框
- Dashboard 需要 window.focus 监听，返回时自动刷新数据
- rank_title 后端返回 code（如 `apprentice_1`），前端需用 `translateRankTitle` 翻译
- SQLAlchemy JSON 字段修改后必须 `flag_modified(obj, "field")` 才能持久化
- 谜题走子匹配要处理 promotion 后缀（`e7f8q`），`handleMove(from,to,promotion?)`
- 训练计划 auto_complete_item 用 puzzle_attempts 计数触发，不依赖 quota（premium 用户 limit=-1）
- useCallback 依赖列表不要包含会被 callback 内部修改的 store（会导致无限循环）
- 所有 MOCK 默认值必须是 0/空，不能用假数据（1200分、42局等）
- 静态资源路径（棋子SVG/音效/Stockfish）必须用 `import.meta.env.BASE_URL` 前缀
