# 积分计费系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 积分余额+流水+消耗扣费+日常奖励+老师分发+管理员充值，前端余额显示+不足提示

**Architecture:** 3张新表（credit_balances/credit_transactions/credit_packages），积分服务层统一管理扣费/充值/奖励，各功能API内部调用consume_credits，前端显示余额并在消耗点做不足检查

**Tech Stack:** FastAPI, SQLAlchemy, PostgreSQL, React, TailwindCSS

**Spec:** `docs/superpowers/specs/2026-04-07-credits-system-design.md`

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `backend/app/models/credits.py` | 新建 | CreditBalance, CreditTransaction, CreditPackage ORM |
| `backend/app/models/__init__.py` | 修改 | 注册新模型 |
| `backend/app/schemas/credits.py` | 新建 | 积分相关 Pydantic Schema |
| `backend/app/services/credit_service.py` | 新建 | 积分核心逻辑（查余额/扣费/充值/奖励/转赠） |
| `backend/app/routers/credits.py` | 新建 | 积分 API 路由 |
| `backend/app/routers/__init__.py` | 修改 | 注册 credits_router |
| `backend/app/routers/puzzles.py` | 修改 | 专项训练扣积分 |
| `backend/app/routers/play.py` | 修改 | 复盘分析/引擎分析扣积分（预留） |
| `backend/app/routers/learn.py` | 修改 | AI教学扣积分 |
| `backend/app/routers/teacher.py` | 修改 | 老师分发积分 |
| `backend/scripts/import_content.py` | 修改 | 新用户赠送500积分 |
| `frontend/src/types/api.ts` | 修改 | 积分类型 |
| `frontend/src/api/credits.ts` | 新建 | 积分 API |
| `frontend/src/stores/creditStore.ts` | 新建 | 积分余额全局状态 |
| `frontend/src/components/common/CreditsBadge.tsx` | 新建 | 顶栏积分显示 |
| `frontend/src/components/common/InsufficientCreditsModal.tsx` | 新建 | 积分不足弹窗 |
| `frontend/src/pages/profile/ProfilePage.tsx` | 修改 | 积分卡片+流水 |
| `frontend/src/pages/puzzles/ThemePracticePage.tsx` | 修改 | 做题扣积分 |
| `frontend/src/pages/play/ReviewPage.tsx` | 修改 | 分析扣积分 |
| `frontend/src/pages/play/BoardEditorPage.tsx` | 修改 | 引擎分析扣积分 |
| `frontend/src/pages/teacher/TeacherDashboardPage.tsx` | 修改 | 分发积分 |
| `frontend/src/components/layout/TopNav.tsx` | 修改 | 显示积分 |

---

### Task 1: 后端 — Model + Schema + 积分服务

**Files:**
- Create: `backend/app/models/credits.py`
- Create: `backend/app/schemas/credits.py`
- Create: `backend/app/services/credit_service.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: 创建积分 ORM 模型**

`backend/app/models/credits.py`:
- CreditBalance: user_id(FK unique), balance(int default 500), total_earned, total_spent, updated_at
- CreditTransaction: id, user_id(FK), amount(int), balance_after(int), type(varchar: recharge/reward/transfer_in/transfer_out/consume), description(text), related_id(nullable), created_at
- CreditPackage: id, name, credits(int), price_cents(int), is_active(bool), sort_order

在 `__init__.py` 中注册。

- [ ] **Step 2: 创建 Schema**

`backend/app/schemas/credits.py`:
- CreditBalanceResponse: balance, total_earned, total_spent
- CreditTransactionItem: id, amount, balance_after, type, description, created_at
- ConsumeCreditsRequest: amount, description, related_id?
- GrantCreditsRequest: user_id, amount, description
- TransferCreditsRequest: student_ids(list), amount
- CreditPackageItem: id, name, credits, price_cents, is_active

- [ ] **Step 3: 创建积分服务**

`backend/app/services/credit_service.py`:
- `get_or_create_balance(db, user_id) -> CreditBalance` — 不存在则创建（初始500）
- `get_balance(db, user_id) -> int` — 返回余额
- `consume_credits(db, user_id, amount, description, related_id?) -> bool` — 扣积分，余额不足返回 False
- `add_credits(db, user_id, amount, type, description, related_id?)` — 加积分（充值/奖励/转入）
- `transfer_credits(db, teacher_id, student_ids, amount)` — 老师转赠
- `get_transactions(db, user_id, page, page_size) -> (list, total)` — 流水分页
- `grant_daily_reward(db, user_id, reward_type) -> int` — 日常奖励（防重复）

积分消耗常量：
```python
CREDIT_COSTS = {
    "theme_puzzle": 20,
    "ai_review": 50,
    "engine_analysis": 20,
    "weakness_diagnosis": 30,
    "ai_teaching": 10,
}
```

日常奖励常量：
```python
DAILY_REWARDS = {
    "login": 5,
    "training_complete": 10,
    "daily_puzzle_perfect": 15,
    "streak_7_days": 50,
}
```

- [ ] **Step 4: 提交**

```bash
git add backend/app/models/credits.py backend/app/models/__init__.py backend/app/schemas/credits.py backend/app/services/credit_service.py
git commit -m "feat: 积分系统 Model + Schema + Service"
```

---

### Task 2: 后端 — 积分 API 路由

**Files:**
- Create: `backend/app/routers/credits.py`
- Modify: `backend/app/routers/__init__.py`

- [ ] **Step 1: 创建积分路由**

`backend/app/routers/credits.py`:
- `GET /credits/balance` — 当前余额
- `GET /credits/transactions?page=1&page_size=20` — 流水分页
- `GET /credits/packages` — 充值套餐列表
- `POST /credits/consume` — 消耗积分（内部各模块调用，也可直接调）
- `POST /admin/credits/grant` — 管理员充值（require_admin）

在 `__init__.py` 注册 `credits_router` prefix="/credits"。

- [ ] **Step 2: 老师分发路由**

在 `backend/app/routers/teacher.py` 新增：
- `POST /teacher/credits/transfer` — body: { student_ids, amount }

- [ ] **Step 3: 提交**

```bash
git add backend/app/routers/credits.py backend/app/routers/__init__.py backend/app/routers/teacher.py
git commit -m "feat: 积分 API 路由 + 老师分发"
```

---

### Task 3: 后端 — 各功能消耗点接入

**Files:**
- Modify: `backend/app/routers/puzzles.py` — 专项训练
- Modify: `backend/app/routers/learn.py` — AI教学
- Modify: `backend/app/services/puzzle_service.py` — 主题做题返回时标记消耗
- Modify: `backend/scripts/import_content.py` — 新用户赠送500积分

- [ ] **Step 1: 专项训练扣积分**

在 `puzzles.py` 的 `submit_puzzle_attempt` 中，当 `source == "theme"` 时调用 `consume_credits(db, user_id, 20, "专项训练")`。余额不足返回 402。

- [ ] **Step 2: AI教学扣积分**

在 `learn.py` 的 AI 问答端点中调用 `consume_credits(db, user_id, 10, "AI互动教学")`。

- [ ] **Step 3: 新用户赠送积分**

在 `import_content.py` 的 `seed_users` 中，创建用户后调用 `credit_service.get_or_create_balance(db, user_id)` 确保有初始 500 积分。

- [ ] **Step 4: 提交**

```bash
git add backend/app/routers/puzzles.py backend/app/routers/learn.py backend/scripts/import_content.py
git commit -m "feat: 专项训练+AI教学消耗积分 + 新用户赠送500"
```

---

### Task 4: 前端 — 积分状态 + API + 组件

**Files:**
- Create: `frontend/src/api/credits.ts`
- Create: `frontend/src/stores/creditStore.ts`
- Create: `frontend/src/components/common/CreditsBadge.tsx`
- Create: `frontend/src/components/common/InsufficientCreditsModal.tsx`
- Modify: `frontend/src/types/api.ts`

- [ ] **Step 1: 类型定义**

types/api.ts 新增：
```typescript
interface CreditBalanceResponse { balance: number; total_earned: number; total_spent: number }
interface CreditTransactionItem { id: string; amount: number; balance_after: number; type: string; description: string; created_at: string }
interface CreditPackageItem { id: string; name: string; credits: number; price_cents: number }
```

- [ ] **Step 2: API 层**

`frontend/src/api/credits.ts`:
- getBalance()
- getTransactions(page, pageSize)
- getPackages()
- consumeCredits(amount, description, relatedId?)

- [ ] **Step 3: 积分 Store**

`frontend/src/stores/creditStore.ts` (Zustand):
- balance: number
- loading: boolean
- fetchBalance() — 调 API 更新
- deduct(amount) — 本地乐观更新

- [ ] **Step 4: CreditsBadge 组件**

顶栏显示：金币图标 + 余额数字，点击跳转"我的"页面。

- [ ] **Step 5: InsufficientCreditsModal 组件**

积分不足弹窗：显示"积分不足"+ 需要X积分/当前Y积分 + 充值按钮。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/api/credits.ts frontend/src/stores/creditStore.ts frontend/src/components/common/CreditsBadge.tsx frontend/src/components/common/InsufficientCreditsModal.tsx frontend/src/types/api.ts
git commit -m "feat: 积分前端状态+API+组件"
```

---

### Task 5: 前端 — 消耗点接入 + 页面改造

**Files:**
- Modify: `frontend/src/pages/puzzles/ThemePracticePage.tsx`
- Modify: `frontend/src/pages/play/ReviewPage.tsx`
- Modify: `frontend/src/pages/play/BoardEditorPage.tsx`
- Modify: `frontend/src/pages/profile/ProfilePage.tsx`
- Modify: `frontend/src/pages/teacher/TeacherDashboardPage.tsx`
- Modify: `frontend/src/components/layout/TopNav.tsx` (或 Sidebar)

- [ ] **Step 1: 顶栏显示积分**

在 TopNav 或 Sidebar 中加入 CreditsBadge。

- [ ] **Step 2: 专项训练扣积分**

ThemePracticePage：做题前检查余额，不足弹 InsufficientCreditsModal。

- [ ] **Step 3: 复盘分析扣积分**

ReviewPage：点"分析对局"前调 consume API，不足弹窗。

- [ ] **Step 4: 摆题引擎分析扣积分**

BoardEditorPage：点"分析局面"前调 consume API。

- [ ] **Step 5: ProfilePage 积分卡片**

"我的"页面新增积分卡片：余额 + 流水列表（最近10条）。

- [ ] **Step 6: 老师分发积分**

TeacherDashboardPage：新增"分发积分"按钮，选学生+输入数量。

- [ ] **Step 7: 提交**

```bash
git add frontend/src/pages/ frontend/src/components/
git commit -m "feat: 各消耗点扣积分 + 余额显示 + 老师分发"
```

---

### Task 6: 验证 + 部署

- [ ] **Step 1: TypeScript 编译**
- [ ] **Step 2: API 验证** — 余额/消耗/流水/老师分发
- [ ] **Step 3: Vite 构建**
- [ ] **Step 4: 部署**（备份 → 上传 → 重启，不删DB）
- [ ] **Step 5: 线上验证**
- [ ] **Step 6: 提交**
