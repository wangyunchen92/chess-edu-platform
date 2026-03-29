# 后台管理系统 - 产品需求文档 (PRD)

**版本**: v1.0
**日期**: 2026-03-28
**作者**: PM Agent
**状态**: 待架构师评审

---

## 1. 需求概述

### 1.1 背景

当前后台管理只有一个简单的 `UserManagePage`，功能仅限于：
- 查看用户列表（前端搜索，无服务端筛选）
- 创建新用户
- 分配会员等级

管理员需要一个完整的后台管理控制台，覆盖账号管理、会员管理、积分/经验管理、数据概览四大模块。

### 1.2 现状分析

**已有后端 API**:
| 接口 | 方法 | 功能 |
|---|---|---|
| `POST /admin/users` | 创建用户 | 已有 |
| `POST /admin/users/batch` | 批量创建 | 已有 |
| `GET /admin/users` | 用户列表（分页+搜索） | 已有 |
| `PUT /admin/users/{id}/membership` | 更新会员 | 已有 |

**已有前端页面**:
- `UserManagePage.tsx` — 用户列表+创建+会员分配（单页面，无独立 API 层文件）

**缺失部分**:
- 前端无 `api/admin.ts`，API 调用直接内联在页面中
- 无修改用户信息接口
- 无重置密码接口
- 无禁用/启用账号接口
- 无积分/经验/金币管理接口
- 无数据概览统计接口
- 无角色筛选、状态筛选等服务端筛选
- 前端无 Tab 导航布局

### 1.3 影响范围

| 模块 | 影响 | 涉及 Agent |
|---|---|---|
| 后端 admin router | 新增 6+ 接口 | backend-agent |
| 后端 admin schema | 新增 Schema | backend-agent |
| 后端 admin service | 新增 service 逻辑 | backend-agent |
| 前端 admin 页面 | 重构为多 Tab 布局 | frontend-agent |
| 前端 API 层 | 新增 `api/admin.ts` | frontend-agent |
| 数据库 | 无变更（字段已齐） | - |

---

## 2. 功能详细设计

### 2.1 整体页面结构

```
/admin
  +-- 数据概览 (Dashboard Tab)     -- 默认 Tab
  +-- 账号管理 (Users Tab)         -- 替代现有 UserManagePage
  +-- 会员管理 (Membership Tab)
  +-- 积分经验管理 (Points Tab)
```

布局：左侧或顶部 Tab 导航，右侧内容区。建议采用顶部 Tab 栏，与现有页面风格一致。

---

### 2.2 数据概览 (Dashboard Tab)

#### 展示内容

| 统计项 | 数据来源 | 展示形式 |
|---|---|---|
| 总用户数 | `count(users)` | 数字卡片 |
| 今日新注册 | `count(users where created_at >= today)` | 数字卡片 |
| 今日活跃用户 | `count(users where last_login_at >= today)` | 数字卡片 |
| 会员分布 | `group by membership_tier` | 数字卡片组(free/basic/premium) |
| 角色分布 | `group by role` | 数字卡片组(student/teacher/admin) |
| 最近注册用户 | `top 10 order by created_at desc` | 简表(用户名/昵称/角色/注册时间) |

#### 验收标准
- 页面加载时一次请求获取全部统计数据
- 数字正确反映数据库真实数据
- 有加载态展示

---

### 2.3 账号管理 (Users Tab)

#### 2.3.1 用户列表

**筛选条件**（服务端）:
| 筛选 | 类型 | 选项 |
|---|---|---|
| 搜索 | 文本输入 | 用户名/昵称模糊匹配 |
| 角色 | 下拉选择 | 全部/student/teacher/admin |
| 状态 | 下拉选择 | 全部/active/disabled |
| 会员等级 | 下拉选择 | 全部/free/basic/premium |

**列表字段**:
| 列 | 字段 | 说明 |
|---|---|---|
| 用户名 | username | |
| 昵称 | nickname | |
| 角色 | role | 标签展示 |
| 会员 | membership_tier | 标签展示 |
| 状态 | status | active=正常(绿)，disabled=已禁用(灰) |
| 注册时间 | created_at | |
| 最近登录 | last_login_at | 未登录显示"--" |
| 操作 | - | 编辑/重置密码/禁用(启用) |

**分页**: 服务端分页，每页 20 条，显示总数和页码。

#### 2.3.2 创建用户

沿用现有模态框，字段：
- 用户名（必填，2-50字符）
- 密码（必填，6-128字符）
- 昵称（选填，默认=用户名）
- 角色（student/teacher）

#### 2.3.3 编辑用户

弹窗模态框，可修改：
| 字段 | 可修改 | 说明 |
|---|---|---|
| 昵称 | 是 | |
| 角色 | 是 | student/teacher/admin |
| 状态 | 是 | active/disabled |

提交后刷新列表。

#### 2.3.4 重置密码

弹窗确认，输入新密码（6-128字符），提交后生效。

#### 2.3.5 禁用/启用账号

列表行内操作按钮：
- active 用户 -> 显示"禁用"按钮（红色）
- disabled 用户 -> 显示"启用"按钮（绿色）

点击后二次确认弹窗，确认后调接口。

#### 验收标准
- 服务端筛选+分页正确工作
- 编辑后数据即时更新
- 重置密码后可用新密码登录
- 禁用后用户无法登录，启用后恢复

---

### 2.4 会员管理 (Membership Tab)

#### 展示

用户列表（与 Users Tab 相同的列表组件，但默认展示会员相关列）:
| 列 | 字段 |
|---|---|
| 用户名 | username |
| 昵称 | nickname |
| 当前会员 | membership_tier |
| 到期时间 | membership_expires_at |
| 操作 | 授权会员 |

**筛选**: 搜索 + 会员等级筛选

#### 授权会员（单个）

沿用现有模态框设计，选择等级+到期时间。

#### 批量授权会员

- 多选用户（checkbox）
- 点击"批量授权"按钮
- 弹窗选择会员等级+到期时间
- 确认后批量调接口

#### 验收标准
- 单个授权即时生效
- 批量授权正确处理，返回成功/失败数
- 到期时间正确存储

---

### 2.5 积分/经验管理 (Points Tab)

#### 展示

用户列表（带积分相关列）:
| 列 | 字段 | 来源 |
|---|---|---|
| 用户名 | username | users |
| 昵称 | nickname | users |
| 对弈评分 | game_rating | user_ratings |
| 谜题评分 | puzzle_rating | user_ratings |
| 段位 | rank_title | user_ratings |
| 总经验 | xp_total | user_ratings |
| 金币 | coins | user_ratings |
| 操作 | 调整 | |

**筛选**: 搜索

#### 手动调整

弹窗模态框：
| 字段 | 类型 | 说明 |
|---|---|---|
| 经验值变动 | 数字输入 | 正数=增加，负数=扣除 |
| 金币变动 | 数字输入 | 正数=增加，负数=扣除 |
| 对弈评分变动 | 数字输入 | 选填 |
| 谜题评分变动 | 数字输入 | 选填 |
| 调整原因 | 文本输入 | 必填，用于审计 |

提交后：
1. 更新 `user_ratings` 表
2. 写入 `rating_histories` 表记录变更（source_type = "admin_adjust"）

#### 验收标准
- 调整后数值正确更新
- rating_histories 有记录
- 不允许经验值/金币为负（下限为0）

---

## 3. API 接口清单

### 3.1 新增接口

| # | 方法 | 路径 | 说明 |
|---|---|---|---|
| 1 | `GET` | `/admin/stats` | 数据概览统计 |
| 2 | `PUT` | `/admin/users/{user_id}` | 修改用户信息 |
| 3 | `PUT` | `/admin/users/{user_id}/password` | 重置密码 |
| 4 | `PUT` | `/admin/users/{user_id}/status` | 禁用/启用账号 |
| 5 | `PUT` | `/admin/users/batch/membership` | 批量授权会员 |
| 6 | `GET` | `/admin/users/{user_id}/points` | 获取用户积分详情 |
| 7 | `PUT` | `/admin/users/{user_id}/points` | 调整用户积分/经验/金币 |

### 3.2 修改现有接口

| # | 接口 | 变更 |
|---|---|---|
| 1 | `GET /admin/users` | 新增 query 参数: role, status, membership_tier |

### 3.3 接口详细设计

#### 3.3.1 GET /admin/stats

**响应体**:
```json
{
  "code": 0,
  "data": {
    "total_users": 150,
    "today_registered": 5,
    "today_active": 42,
    "membership_distribution": {
      "free": 120,
      "basic": 20,
      "premium": 10
    },
    "role_distribution": {
      "student": 140,
      "teacher": 8,
      "admin": 2
    },
    "recent_users": [
      {
        "id": "uuid",
        "username": "xxx",
        "nickname": "xxx",
        "role": "student",
        "created_at": "2026-03-28T10:00:00Z"
      }
    ]
  }
}
```

#### 3.3.2 PUT /admin/users/{user_id}

**请求体**:
```json
{
  "nickname": "新昵称",
  "role": "teacher",
  "status": "active"
}
```
所有字段 Optional，仅传需要修改的字段。

**响应**: `APIResponse[UserListItem]`

#### 3.3.3 PUT /admin/users/{user_id}/password

**请求体**:
```json
{
  "new_password": "newpass123"
}
```
密码 6-128 字符。

**响应**: `APIResponse[dict]` -> `{"message": "Password reset successfully"}`

#### 3.3.4 PUT /admin/users/{user_id}/status

**请求体**:
```json
{
  "status": "disabled"
}
```
`status` 枚举: active, disabled

**响应**: `APIResponse[UserListItem]`

#### 3.3.5 PUT /admin/users/batch/membership

**请求体**:
```json
{
  "user_ids": ["uuid1", "uuid2"],
  "membership_tier": "premium",
  "membership_expires_at": "2026-12-31T23:59:59Z"
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "success_count": 2,
    "failed": []
  }
}
```

#### 3.3.6 GET /admin/users/{user_id}/points

**响应**:
```json
{
  "code": 0,
  "data": {
    "user_id": "uuid",
    "username": "xxx",
    "nickname": "xxx",
    "game_rating": 450,
    "puzzle_rating": 380,
    "rank_title": "apprentice_2",
    "rank_tier": 2,
    "rank_region": "meadow",
    "xp_total": 1200,
    "xp_today": 50,
    "coins": 300
  }
}
```

#### 3.3.7 PUT /admin/users/{user_id}/points

**请求体**:
```json
{
  "xp_change": 100,
  "coins_change": 50,
  "game_rating_change": 0,
  "puzzle_rating_change": 0,
  "reason": "活动奖励"
}
```
所有 change 字段可为正或负。`reason` 必填。

**响应**: 返回更新后的积分详情，格式同 3.3.6。

### 3.4 修改 GET /admin/users

新增 Query 参数:
| 参数 | 类型 | 说明 |
|---|---|---|
| role | Optional[str] | 筛选角色 |
| status | Optional[str] | 筛选状态 |
| membership_tier | Optional[str] | 筛选会员等级 |

---

## 4. 数据库变更

**无需新增表或字段。**

现有数据模型已完全覆盖：
- `users` 表: username, nickname, role, status, membership_tier, membership_expires_at, created_at, last_login_at, login_count
- `user_ratings` 表: game_rating, puzzle_rating, rank_title, rank_tier, rank_region, xp_total, xp_today, coins
- `rating_histories` 表: rating_type, old_rating, new_rating, change_amount, source_type, source_id

积分调整记录写入 `rating_histories`，source_type 使用 `"admin_adjust"`。

---

## 5. 前端页面设计

### 5.1 文件结构

```
frontend/src/
  api/
    admin.ts                    -- 新增: Admin API 封装
  pages/admin/
    AdminLayout.tsx             -- 新增: Tab 布局容器
    AdminDashboard.tsx          -- 新增: 数据概览
    AdminUsers.tsx              -- 重构: 账号管理（替代 UserManagePage）
    AdminMembership.tsx         -- 新增: 会员管理
    AdminPoints.tsx             -- 新增: 积分经验管理
  types/
    api.ts                      -- 补充 Admin 相关类型
```

### 5.2 路由设计

```
/admin              -> AdminLayout (Tab 容器)
  /admin            -> AdminDashboard (默认)
  /admin/users      -> AdminUsers
  /admin/membership -> AdminMembership
  /admin/points     -> AdminPoints
```

现有 `/admin` 路由指向 `UserManagePage`，需要改为指向 `AdminLayout`。

### 5.3 组件复用

- 用户列表表格在 Users/Membership/Points 三个 Tab 中复用核心表格组件
- Modal 弹窗统一封装（编辑用户、重置密码、调整积分、授权会员）
- 搜索+筛选栏可抽取为公共组件
- 分页器组件复用

### 5.4 AdminLayout 结构

```
+------------------------------------------------+
| 后台管理                                        |
| [数据概览] [账号管理] [会员管理] [积分经验]       |
+------------------------------------------------+
|                                                  |
|  {当前 Tab 内容}                                 |
|                                                  |
+------------------------------------------------+
```

---

## 6. 技术方案确认清单（给架构师）

以下问题需要架构师评审确认：

### 6.1 接口设计
- [ ] `PUT /admin/users/{user_id}` 是否用一个接口统一修改 nickname/role/status，还是拆成独立接口？（本文档方案：合并为一个，所有字段 Optional）
- [ ] 积分调整是否需要事务保证 user_ratings 更新和 rating_histories 写入的原子性？（建议：是）
- [ ] 批量授权会员接口的并发问题：是否需要加锁？（建议：不需要，admin 操作频率低）

### 6.2 查询性能
- [ ] `GET /admin/stats` 涉及多个 count 查询，是否需要缓存？（建议：暂不需要，用户量小）
- [ ] 用户列表新增多个筛选条件，是否需要索引？（建议：role、status、membership_tier 列已有少量枚举值，暂不加索引）

### 6.3 安全
- [ ] 重置密码接口是否需要二次确认（如输入管理员密码）？（建议：Phase 1 不需要，仅 admin 角色可调用）
- [ ] 积分调整的审计日志（rating_histories）是否足够？是否需要额外的管理员操作日志表？（建议：Phase 1 用 rating_histories 足够）
- [ ] 禁用用户后，其已签发的 JWT 是否需要立即失效？（建议：Phase 1 等 token 自然过期即可，无需黑名单机制）

### 6.4 前端
- [ ] AdminLayout 的路由方案：嵌套路由（/admin/users）还是 Tab 切换（/admin?tab=users）？（建议：嵌套路由，URL 可分享）
- [ ] 是否需要新建公共 Modal 组件，还是继续内联？（建议：新建 `components/common/Modal.tsx`）

---

## 7. 任务拆解与排期

### Phase 1: 后端接口（backend-agent）

| 任务 | 优先级 | 预估 |
|---|---|---|
| B1. 新增 admin schema（UpdateUser/ResetPassword/UpdateStatus/BatchMembership/AdminStats/PointsDetail/AdjustPoints） | P0 | 小 |
| B2. 扩展 `GET /admin/users` 支持 role/status/membership_tier 筛选 | P0 | 小 |
| B3. `PUT /admin/users/{user_id}` 修改用户信息 | P0 | 小 |
| B4. `PUT /admin/users/{user_id}/password` 重置密码 | P0 | 小 |
| B5. `PUT /admin/users/{user_id}/status` 禁用/启用 | P0 | 小 |
| B6. `GET /admin/stats` 数据概览 | P0 | 中 |
| B7. `PUT /admin/users/batch/membership` 批量会员 | P1 | 小 |
| B8. `GET/PUT /admin/users/{user_id}/points` 积分管理 | P0 | 中 |

### Phase 2: 前端页面（frontend-agent）

| 任务 | 优先级 | 依赖 |
|---|---|---|
| F1. 新增 `api/admin.ts` API 封装层 | P0 | - |
| F2. 新增 `AdminLayout.tsx` Tab 导航容器 | P0 | - |
| F3. 新增 `AdminDashboard.tsx` 数据概览 | P0 | B6 |
| F4. 重构 `AdminUsers.tsx` 账号管理（筛选+编辑+重置密码+禁用） | P0 | B2-B5 |
| F5. 新增 `AdminMembership.tsx` 会员管理（单个+批量） | P0 | B7 |
| F6. 新增 `AdminPoints.tsx` 积分经验管理 | P0 | B8 |
| F7. 更新路由配置 | P0 | F2 |
| F8. 补充 `types/api.ts` Admin 类型定义 | P0 | B1 |

### 并行策略

```
架构师评审 (Day 1)
    |
    v
后端 B1-B8  ------>  前端 F1-F8 (后端完成后启动)
    |                     |
    v                     v
        QA 测试 (接口+页面)
```

前端 F1、F2 可与后端并行开发（不依赖新接口）。F3-F6 待对应后端接口完成后联调。

---

## 8. 验收标准总结

1. 管理员登录后，进入 `/admin`，看到数据概览 Tab（数字准确）
2. 切换到账号管理，支持搜索+角色/状态/会员筛选，分页正确
3. 可创建用户、编辑用户信息、重置密码、禁用/启用账号
4. 切换到会员管理，可单个和批量授权会员
5. 切换到积分管理，可查看和调整用户积分/经验/金币
6. 所有操作有加载态、成功/失败反馈
7. 非 admin 角色访问 /admin 页面被拒绝
8. 测试账号 admin/admin123 可正常使用全部功能
