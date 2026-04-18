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
| 荣誉记录 | `/honor` | HonorPage | 光荣榜（公开赛事荣誉）+ 我的荣誉（赛事+成长里程碑24个） |
| 积分 | `/credits` | - | 积分余额/流水/消耗/奖励/老师分发/管理员充值 |
| 弱点诊断 | `/diagnosis` | DiagnosisPage | 雷达图+推荐训练+Dashboard摘要 |
| 后台管理 | `/admin` | AdminDashboard, AdminUserListPage, AdminUserDetailPage | 用户管理、会员管理、积分管理、数据概览 |
| 儿童乐园 | `/learn/kids` | KidsPlayground + 5个游戏页 | 找朋友/贪吃棋手/棋子迷宫/安全格子/数一数 |
| 通知 | `/notifications` | - | 系统通知 |

## 数据模型 (37张表)

### 用户域
- **users** — 账号、角色(student/teacher/admin)、会员等级、登录信息、referral_code、referred_by
- **user_profiles** — 昵称、出生年、棋龄、评估状态、初始评分
- **user_ratings** — 对弈评分、谜题评分、段位(rank_title/tier/region)、经验值、金币
- **user_streaks** — 登录连续天数、训练连续天数、最高纪录
- **user_daily_quotas** — 每日配额（对弈/谜题/AI问答/经验值上限）
- **user_remarks** — 备注名（老师/管理员为学生设置的别名）

### 对弈域
- **characters** — AI角色（名称、性格、棋风、基础评分、失误率）
- **character_dialogues** — 角色在不同场景的台词（开场/胜利/失败等）
- **user_character_relations** — 用户与角色的解锁状态、好感度、对战记录
- **games** — 对局记录（用户/角色/颜色/结果/PGN/评分变化）
- **game_moves** — 每步棋记录（SAN/UCI/FEN/是否最佳/失误/漏着）

### 谜题域
- **puzzles** — 谜题库（FEN/解法/难度/评分/标签/每日池/挑战池）
- **daily_puzzles** — 每日谜题分配（按用户个性化，含user_id）
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

### 积分域
- **credit_balances** — 用户积分余额（balance/total_earned/total_spent）
- **credit_transactions** — 积分流水（金额/类型/描述/关联ID）
- **credit_packages** — 积分套餐

### 诊断域
- **user_weakness_profiles** — 用户弱点画像
- **weakness_recommendations** — 弱点推荐训练

### 荣誉域
- **honor_records** — 荣誉记录（赛事荣誉+系统里程碑，type区分，milestone_key去重）

### 师生域
- **invite_codes** — 老师邀请码（6位码/72h过期/max_uses）
- **teacher_students** — 师生绑定关系

### 儿童域
- **kids_game_progress** — 儿童乐园游戏进度（5个游戏×多关卡）

### 自适应域
- **adaptive_difficulty_configs** — AI对弈自适应难度配置

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

测试分四层:
1. **接口测试** — curl/httpx 验证 API 请求响应格式和数据正确性
2. **页面实操测试（Playwright E2E）** — 用 Playwright 自动化测试，真正打开浏览器:
   - 页面是否正常渲染（不是空白/mock数据）
   - 点击是否跳转到正确页面
   - 数据是否正确展示（不是 undefined/null）
   - 交互流程是否完整可走通（登录→操作→验证）
   - 运行: `npx playwright test`
3. **回归测试** — 确认修改未破坏其他已有功能
4. **构建验证** — TypeScript 编译 + Vite 构建

### Playwright E2E 测试

```bash
# 运行所有 E2E 测试
npx playwright test

# 运行指定测试文件
npx playwright test e2e/auth.spec.ts

# 带UI模式调试
npx playwright test --ui
```

测试文件位于 `e2e/` 目录:
- `e2e/helpers.ts` — 公共辅助函数（login、waitForApi）
- `e2e/auth.spec.ts` — 认证流程（登录、权限、角色路由）
- `e2e/teacher-student.spec.ts` — 师生管理（邀请码、绑定、复制）
- `e2e/pages.spec.ts` — 页面渲染检查 + 关键交互流程

**编写测试用例时必须同时包含 Playwright E2E 用例**，不能只写接口测试。

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
- **域名**: chess.ccwu.cc（HTTPS，Let's Encrypt）
- **SSH**: `ssh root@118.31.237.111`
- **棋育路径**: `http://118.31.237.111/chess/` 或 `https://chess.ccwu.cc/`
- **后端端口**: :8001（建筑ERP用:8000）
- **服务目录**: `/opt/chess-edu/`
- **systemd**: `chess-edu.service`
- **数据库**: PostgreSQL 15（Docker容器 `chess_edu_postgres`，端口5432）

```
Nginx(:80/:443)
  ├── chess.ccwu.cc  → 棋育域名前端(/opt/chess-edu/www/domain/) + /api/ → :8001
  ├── /              → 建筑ERP 前端 + /api/ → :8000
  └── /chess/        → 棋育IP前端(/opt/chess-edu/www/chess/)   + /chess/api/ → :8001
```

### 数据库架构（重要）

**本地开发**: SQLite（backend/data.db），.env 中 `DATABASE_URL=sqlite:///./data.db`
**线上生产**: PostgreSQL 15，systemd Environment 覆盖为 `DATABASE_URL=postgresql://chess:chess_edu_2026@localhost:5432/chess_edu`

⚠️ **关键区别**：.env文件写的是SQLite，但线上通过systemd环境变量覆盖为PostgreSQL。

**线上PG操作命令**：
```bash
# 进入PG命令行
docker exec -it chess_edu_postgres psql -U chess -d chess_edu

# 执行单条SQL
docker exec chess_edu_postgres psql -U chess -d chess_edu -c "SQL语句"

# 备份
docker exec chess_edu_postgres pg_dump -U chess -d chess_edu > backup.sql
```

**数据库迁移规则**：
- 新增表/字段时，必须同时在本地SQLite和线上PostgreSQL执行DDL
- 本地：SQLite迁移脚本 `scripts/add_xxx.py` 或 SQLAlchemy `create_all()`
- 线上：`docker exec chess_edu_postgres psql -U chess -d chess_edu -c "ALTER TABLE / CREATE TABLE ..."`
- **部署检查清单**：新增了model字段？→ 线上PG执行了对应DDL吗？

### 部署步骤

```bash
# 1. 本地构建前端（两套：IP路径 + 域名）
cd frontend
VITE_BASE=/chess/ npm run build
# 部署IP版本
ssh root@118.31.237.111 "rm -rf /opt/chess-edu/www/chess/assets"
scp -r dist/* root@118.31.237.111:/opt/chess-edu/www/chess/
# 构建+部署域名版本
npm run build
ssh root@118.31.237.111 "rm -rf /opt/chess-edu/www/domain/assets"
scp -r dist/* root@118.31.237.111:/opt/chess-edu/www/domain/

# 2. 部署后端代码
rsync -av --exclude='__pycache__' --exclude='*.pyc' --exclude='data.db' --exclude='venv' \
  backend/ root@118.31.237.111:/opt/chess-edu/backend/

# 3. 如有新表/新字段，在线上PG执行DDL（重要！）
ssh root@118.31.237.111 "docker exec chess_edu_postgres psql -U chess -d chess_edu -c '你的DDL'"

# 4. 重启后端
ssh root@118.31.237.111 "systemctl restart chess-edu"

# 5. 验证
curl -s http://118.31.237.111/chess/api/v1/honor/wall | python3 -m json.tool
```

### 部署注意事项（重要）

- **线上数据库是PostgreSQL**，不是SQLite，新增model字段必须手动在PG执行DDL
- 前端有两套构建：`VITE_BASE=/chess/`（IP访问）和默认（域名访问），都要部署
- 前端目录：IP版 `/opt/chess-edu/www/chess/`，域名版 `/opt/chess-edu/www/domain/`
- 后端部署用 rsync 整目录，不挑单个文件（避免漏传）
- 部署前建议备份：`ssh root@118.31.237.111 "/opt/chess-edu/backup.sh"`

### 数据备份

#### SQLite 优化
- **WAL 模式**：已开启（database.py 自动设置），提升并发读性能
- **busy_timeout=5000**：写入冲突时等 5 秒而非立即报错

#### 多层备份策略
- **每日备份**：cron 凌晨 3 点 + 下午 3 点（每12小时），保留 7 天
- **每周备份**：周日自动归档，保留 4 周
- **每月备份**：1 号自动归档，保留 6 个月
- **部署前备份**：部署步骤自动触发
- **完整性检查**：每次备份后自动执行 `PRAGMA integrity_check`
- **备份目录**：`/opt/chess-edu/backups/{daily,weekly,monthly}/`
- **备份日志**：`/opt/chess-edu/backups/backup.log`

#### 异地备份（本地下载）
```bash
# 下载最新备份到本地
./scripts/backup-download.sh

# 从备份恢复（交互式，含回滚）
./scripts/backup-restore.sh
```

#### 恢复流程
```bash
# 1. 列出可用备份
./scripts/backup-restore.sh

# 2. 选择备份恢复（自动停服→恢复→验证→重启，失败自动回滚）
./scripts/backup-restore.sh daily/data_20260407_030001.db.gz
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
| 移动端适配基础 | useBreakpoint Hook、AppLayout响应式(Sidebar↔BottomNav)、Modal底部弹出、Button/Toast触摸优化、棋盘vw自适应 | ✅ 完成 |
| 谜题库扩充 | Lichess精选14,767道谜题(rating 399~2799)，5级难度均匀分布，69种战术标签 | ✅ 完成 |
| 每日谜题个性化 | 按用户puzzle_rating±200匹配出题，每人不同题，优先未做过的题(daily_puzzles加user_id) | ✅ 完成 |
| 专题训练预留 | get_theme_puzzles/get_available_themes API已实现，待前端页面 | ✅ 后端就绪 |
| **Phase 2a 完成** | | |
| AI角色扩展 | 6个新角色（冬冬/狸花花/铁墩墩/银鬃/咕噜/云朵师父），角色大厅按区域分组，解锁机制+剧情弹窗 | ✅ 完成 |
| 课程扩展 | Level 2 基础战术（15课）+ Level 3 中级战略（5课），课后练习中心（tab切换+进度概览） | ✅ 完成 |
| 课程FEN修复 | Level 1 全部15课FEN替换为经过验证的真实局面（修复牵制/串击/闪击等棋理错误） | ✅ 完成 |
| 弱点诊断 | 诊断API+雷达图+推荐训练+Dashboard摘要，3新表(user_weakness_profiles等) | ✅ 完成 |
| 自适应难度 | PlayStyleController棋风差异化+AdaptiveDifficulty动态调参，9角色引擎全部接入 | ✅ 完成 |
| 冒险模式 | 晋级挑战页面+冒险地图扩展（4区域+角色+挑战入口）+侧边栏入口 | ✅ 完成 |
| 复盘分析 | Stockfish逐步分析+走法标注(brilliant~blunder)+评估条+局面小贴士+最佳走法箭头+统计卡片 | ✅ 完成 |
| 复盘沉浸式 | 全屏深色布局，无侧边栏/顶导航，桌面左右/移动上下响应式 | ✅ 完成 |
| 自由对弈 | 面对面对弈+自己摆棋+PGN导入，games表新增game_type/opponent_name | ✅ 完成 |
| 空白棋盘摆题 | 棋子面板+FEN导入导出+Stockfish分析+保存局面 | ✅ 完成 |
| 师生管理 | 邀请码绑定(6位码+72h过期)+老师工作台(学生列表+数据聚合)+学生详情+权限守卫 | ✅ 完成 |
| 研发流程升级 | CLAUDE.md集成Superpowers Skills工作流，测试规范四层(接口+Playwright E2E+回归+构建) | ✅ 完成 |
| Playwright E2E | 21个自动化测试用例（认证+页面渲染+师生管理），globalSetup+storageState | ✅ 完成 |
| 数据库迁移 | SQLite→PostgreSQL 15（Docker），31表+15798行数据完整迁移，双数据库兼容 | ✅ 完成 |
| 数据备份增强 | WAL模式+多层备份(日/周/月)+pg_dump+异地下载脚本+恢复脚本(含自动回滚) | ✅ 完成 |
| Bug修复集 | 登录页中文化、paywall管理员免限、谜题棋盘翻面、错题本、unicode转义、Rating→评分、clipboard HTTP兼容、dashboard 500、/chess重定向、Nginx缓存策略 | ✅ 完成 |
| **第一阶段完成** | **线上全面测试 34/34 通过，PostgreSQL生产环境稳定运行** | **✅ 2026-04-07** |
| **第二阶段** | | |
| 专项训练 | 69个主题按4大类分组，5级难度tab，题目网格+分页，做对标记绿色✓，积分消耗20/题 | ✅ 完成 |
| 闯关挑战改造 | 5关→10关x20题，按rating分段难度递增，emoji单图标，上一关完成自动解锁下一关 | ✅ 完成 |
| 积分计费系统 | credit_balances/transactions/packages 3新表，消耗(专项20/复盘50/引擎20/AI教学10/诊断30)+奖励(登录5/训练10/谜题全对15/7天连续50)+老师分发+管理员充值 | ✅ 完成 |
| 积分提示标签 | 8个页面添加消耗型(琥珀)和奖励型(绿色)积分说明标签 | ✅ 完成 |
| 会员系统重构 | 前端paywall改为空实现，后端TIER_FEATURES全部-1放开，积分制替代次数限制 | ✅ 完成 |
| 登录提示优化 | 401→"用户名或密码错误"中文提示，深色背景red-400可见 | ✅ 完成 |
| 儿童乐园 | 5个游戏（找朋友6关/贪吃棋手40关/棋子迷宫30关/安全格子30关/数一数30关），卡通emoji棋子，进度保存 | ✅ 完成 |
| 分享有礼 | 用户推荐码(6位)+邀请链接，注册带ref双方各得100积分，ProfilePage邀请卡片 | ✅ 完成 |
| 荣誉记录 | 光荣榜（公开赛事荣誉）+我的荣誉（赛事+24个系统里程碑），老师/管理员录入表单，里程碑自动检查 | ✅ 完成 |
| 备注名 | 老师/管理员为学生设置备注名，学生列表+详情页显示备注，useRemarks hook | ✅ 完成 |
| 侧边栏分组 | 5组（首页/学习/实战/成长/管理）+分隔线，可配置 | ✅ 完成 |
| 域名配置 | chess.ccwu.cc HTTPS（Let's Encrypt），双前端构建（IP+域名） | ✅ 完成 |
| 数据库修复 | SQLite schema损坏修复（dump→rebuild），PG迁移DDL补执行 | ✅ 完成 |

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
- 棋盘格子大小用 `min(vh, vw)` 计算，避免手机竖屏溢出
- LessonPage/GamePage 用 `fixed inset-0` 全屏覆盖，绕过 AppLayout padding
- 移动端新组件必须 Mobile First（先写无前缀样式，再用 md:/lg: 扩展），见 docs/frontend-style-guide.md 第13节
- 每日谜题是按用户 puzzle_rating 个性化匹配的，不是全站统一题目
- 谜题库约15,000道（Lichess精选），rating 399~2799，themes字段含69种战术标签（逗号分隔）
- 导入新题用 `backend/scripts/import_lichess_puzzles.py`（采样）+ `backend/scripts/load_puzzles_to_db.py`（入库）
- **线上是PostgreSQL，不是SQLite**！.env写的sqlite是默认值，被systemd覆盖为PG。新增表/字段必须在PG执行DDL
- 前端Toast用法：`addToast(type, message)` 不是 `addToast(message, type)`，type在前
- 前端有两套构建（IP版base=/chess/，域名版base=/），部署时都要更新
- `honor_records` 表的 `milestone_key` 有唯一约束 `(user_id, milestone_key)`，同一里程碑不会重复记录
- `user_remarks` 有唯一约束 `(user_id, target_user_id)`，一个人只能给另一个人设一个备注
