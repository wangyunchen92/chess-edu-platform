# 积分计费系统设计

> 日期：2026-04-07 | 状态：已确认

## 核心模型

每个账号有积分余额（credits），消耗型功能扣积分，积分通过充值/奖励/老师分发获得。

### 积分消耗

| 功能 | 消耗 | 说明 |
|------|------|------|
| 专项训练 | 20 积分/题 | AI 匹配难度 |
| AI 复盘分析 | 50 积分/次 | Stockfish 深度分析 |
| 引擎分析（摆题） | 20 积分/次 | 引擎计算 |
| 弱点诊断 | 30 积分/次 | 数据分析 |
| AI 互动教学 | 10 积分/次 | LLM 对话 |

### 免费功能（不消耗积分）

每日谜题、闯关挑战、课程学习、课后练习、每日训练、AI 对弈、自由对弈、摆题（不含引擎分析）

### 初始积分

每个新账号注册赠送 **500 积分**。

## 积分获取

### 1. 充值购买

**自由充值**：0.05 元/积分，用户输入任意金额，自动换算积分。

**套餐包**（优惠价）：

| 套餐 | 积分 | 价格 | 折扣 |
|------|------|------|------|
| 体验包 | 500 | 9.9 元 | 6 折 |
| 标准包 | 2000 | 29.9 元 | 7 折 |
| 畅学包 | 5000 | 59.9 元 | 76 折 |
| 年度包 | 20000 | 199 元 | 8 折 |

### 2. 日常任务奖励

| 任务 | 奖励 |
|------|------|
| 每日登录 | +5 积分 |
| 完成每日训练 | +10 积分 |
| 每日谜题全对 | +15 积分 |
| 连续登录 7 天 | +50 积分 |

### 3. 老师分发

老师账号有独立积分池，可向名下学生转赠积分：
- 老师选择学生 + 输入数量 → 从老师积分扣除 → 加到学生积分
- 支持批量分发（选多个学生，每人 X 积分）

## 数据模型

### 新增表

**credit_balances** — 积分余额（每用户一行）
- user_id (FK, unique)
- balance (integer, default 500)
- total_earned (integer) — 累计获得
- total_spent (integer) — 累计消耗
- updated_at

**credit_transactions** — 积分流水
- id (UUID)
- user_id (FK)
- amount (integer, 正数=收入, 负数=支出)
- balance_after (integer) — 交易后余额
- type (enum: recharge/reward/transfer_in/transfer_out/consume)
- description (string) — "AI复盘分析" / "每日登录奖励" / "老师转赠"
- related_id (string, nullable) — 关联的 game_id / puzzle_id 等
- created_at

**credit_packages** — 充值套餐定义
- id
- name ("体验包" / "标准包" 等)
- credits (integer)
- price_cents (integer)
- is_active (boolean)
- sort_order

### 不改现有表

users 表不加字段，积分余额独立存储在 credit_balances。

## API

### 积分查询
- `GET /api/v1/credits/balance` — 当前余额 + 累计获得/消耗

### 积分消耗（内部调用）
- 不单独暴露 API，在各功能 API 内部调用 `consume_credits(user_id, amount, description)`
- 余额不足时返回 402 + `{"code": 402, "message": "积分不足", "data": {"required": 50, "balance": 30}}`

### 积分充值
- `GET /api/v1/credits/packages` — 充值套餐列表
- `POST /api/v1/credits/recharge` — 充值（Phase 2 对接支付，当前先做管理员手动充值）

### 老师分发
- `POST /api/v1/teacher/credits/transfer` — 老师向学生转赠积分
  - body: `{ student_ids: [id1, id2], amount: 100 }`

### 管理员
- `POST /api/v1/admin/credits/grant` — 管理员给任意用户加积分

### 流水查询
- `GET /api/v1/credits/transactions?page=1&page_size=20` — 积分流水

## 前端变更

### 顶部导航/侧边栏
- 显示积分余额（小图标 + 数字）

### "我的"页面
- 积分卡片：余额 + 充值按钮
- 积分流水列表

### 消耗点改造
- 专项训练 ThemePracticePage：做题前检查积分，不足弹窗提示充值
- 复盘 ReviewPage：点"分析对局"前检查积分
- 摆题 BoardEditorPage：点"分析局面"前检查积分
- 弱点诊断 DiagnosisPage：点"重新分析"前检查积分
- AI教学 InteractiveTeachPage：发送前检查积分

### 老师工作台
- "分发积分"按钮：选学生 + 输入数量

### 充值页面（Phase 2 对接支付，当前展示套餐）
- `/credits/recharge` — 套餐列表 + 自由充值输入框

## 实现分期

### Phase 1（本次）
- 积分余额 + 流水表
- 各功能消耗扣积分
- 日常奖励发积分
- 老师分发
- 管理员手动充值
- 前端余额显示 + 不足提示

### Phase 2（对接支付后）
- 充值套餐购买（微信/支付宝）
- 自由充值
- 支付回调 → 自动加积分

## 验收标准

1. 新用户注册获得 500 积分
2. AI 复盘消耗 50 积分，余额正确扣减
3. 积分不足时提示"积分不足"而非直接报错
4. 老师可向学生转赠积分
5. 管理员可给任意用户加积分
6. 每日登录/训练/谜题全对获得奖励积分
7. 积分流水可查询
8. 顶部显示积分余额
