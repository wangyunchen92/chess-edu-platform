# 后台管理系统 - 技术方案设计

**版本**: v1.0
**日期**: 2026-03-28
**作者**: Architect Agent
**状态**: 评审完成
**关联 PRD**: [admin-console-prd.md](./admin-console-prd.md)

---

## 1. PM 问题回复

### 1.1 PUT /admin/users/{user_id} 合并还是拆分？

**决定：合并为一个接口，所有字段 Optional。** 同意 PRD 方案。

理由：
- 修改的字段（nickname、role、status）同属 `users` 表，不涉及跨表操作
- 拆分为 3 个接口会增加前端调用复杂度，收益极低
- Optional 字段的 Pydantic 校验天然支持部分更新（传什么改什么）
- 后续如果需要更细粒度的权限控制（如只允许 teacher 改 nickname 不能改 role），可以在 service 层加逻辑判断，不需要拆接口

补充：`status` 字段虽然也在这个接口中，但前端 **禁用/启用** 操作走独立的 `PUT /admin/users/{user_id}/status` 接口，以保持语义清晰和操作审计的独立性。`PUT /admin/users/{user_id}` 中的 status 字段仅作为编辑弹窗的备用通道，前端实际不在编辑弹窗中暴露 status 修改。

### 1.2 积分调整的事务原子性

**决定：必须保证事务原子性。** 同意 PRD 建议。

实现方案：
- SQLAlchemy Session 默认在同一个请求中共享事务（FastAPI 的 `Depends(get_db)` 通过 yield 管理）
- `admin_service.adjust_points()` 在同一个 session 中完成 `user_ratings` 更新 + 多条 `rating_histories` 插入
- 只在 router 层最终 `db.commit()`（现有 `get_db` 的 yield 机制已保证这一点）
- 任何一步失败，整个事务自动 rollback
- 无需额外引入分布式事务或显式锁

注意：积分调整可能涉及多个 rating_type（xp、coins、game_rating、puzzle_rating），每个变更对应一条 `rating_histories` 记录，全部在同一事务中。

### 1.3 禁用用户后 JWT 处理

**决定：Phase 1 不引入 Token 黑名单，但在 `get_current_user` 中增加 status 校验。**

PRD 建议等 token 自然过期，但这意味着被禁用的用户在 token 有效期内（最长 120 分钟）仍可正常使用系统，这在管理场景中是不可接受的（禁用操作的目的就是立即阻止访问）。

实现方案（轻量级，不引入 Redis 黑名单）：
- 修改 `backend/app/dependencies.py` 的 `get_current_user` 函数
- 在 JWT 解析成功后，增加一次数据库查询验证用户 status
- 如果 `status == "disabled"`，返回 401
- 性能影响：每次请求多一次主键查询，在当前用户量下可忽略
- 后续如果性能成为瓶颈，可引入 Redis 缓存用户状态（TTL 60s）

```python
# dependencies.py get_current_user 中增加:
user = db.execute(select(User).where(User.id == payload.get("sub"))).scalar_one_or_none()
if user is None or user.status == "disabled":
    raise HTTPException(status_code=401, detail="Account is disabled")
```

### 1.4 前端路由方案

**决定：嵌套路由。** 同意 PRD 建议。

方案：
```
/admin              -> AdminLayout（包含 Tab 导航）
/admin              -> AdminDashboard（默认，index route）
/admin/users        -> AdminUsers
/admin/membership   -> AdminMembership
/admin/points       -> AdminPoints
```

理由：
- URL 可分享、可书签
- 浏览器前进后退自然工作
- React Router v6 的 `<Outlet />` 天然支持嵌套路由
- Tab 高亮状态通过 `useLocation` 匹配当前路径

现有 `App.tsx` 中 `/admin/users` 指向 `UserManagePage`，需要改为嵌套路由结构。

---

## 2. 数据库变更评审

**结论：确认无需新增表或字段。**

逐项核对：

| 需求 | 依赖字段 | 所在表 | 状态 |
|---|---|---|---|
| 修改昵称 | `users.nickname` | users | 已有 |
| 修改角色 | `users.role` | users | 已有 |
| 修改状态 | `users.status` | users | 已有 |
| 重置密码 | `users.password_hash` | users | 已有 |
| 统计今日注册 | `users.created_at` | users | 已有 |
| 统计今日活跃 | `users.last_login_at` | users | 已有 |
| 会员分布 | `users.membership_tier` | users | 已有 |
| 角色分布 | `users.role` | users | 已有 |
| 积分/经验 | `user_ratings.*` | user_ratings | 已有 |
| 积分变更记录 | `rating_histories.*` | rating_histories | 已有 |
| admin_adjust source_type | `rating_histories.source_type` | rating_histories | 已有（varchar(20)，"admin_adjust" 长度=12） |

关于索引：PRD 问到是否需要为 role/status/membership_tier 加索引。当前用户量 < 1000，全表扫描无性能问题。当用户量超过 10000 后可考虑，记为 Tech Debt。

---

## 3. API 契约定义

### 3.1 新增 Pydantic Schema

以下 Schema 全部定义在 `backend/app/schemas/admin.py` 中。

#### 3.1.1 AdminUpdateUserRequest

```python
class AdminUpdateUserRequest(BaseModel):
    """修改用户信息（所有字段 Optional，传什么改什么）"""
    nickname: Optional[str] = Field(None, min_length=1, max_length=50)
    role: Optional[str] = Field(None, pattern="^(student|teacher|admin)$")
```

注意：不包含 status 字段。禁用/启用走独立接口。

#### 3.1.2 ResetPasswordRequest

```python
class ResetPasswordRequest(BaseModel):
    """重置用户密码"""
    new_password: str = Field(..., min_length=6, max_length=128)
```

#### 3.1.3 UpdateStatusRequest

```python
class UpdateStatusRequest(BaseModel):
    """禁用/启用用户"""
    status: str = Field(..., pattern="^(active|disabled)$")
```

#### 3.1.4 BatchUpdateMembershipRequest

```python
class BatchUpdateMembershipRequest(BaseModel):
    """批量授权会员"""
    user_ids: list[str] = Field(..., min_length=1, max_length=100)
    membership_tier: str = Field(..., pattern="^(free|basic|premium)$")
    membership_expires_at: Optional[datetime] = None
```

#### 3.1.5 BatchMembershipResult

```python
class BatchMembershipResult(BaseModel):
    """批量授权会员结果"""
    success_count: int
    failed: list[dict] = Field(default_factory=list, description="List of {user_id, reason}")
```

#### 3.1.6 AdminStatsResponse

```python
class RecentUserItem(BaseModel):
    """最近注册用户简要信息"""
    id: str
    username: str
    nickname: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminStatsResponse(BaseModel):
    """数据概览统计"""
    total_users: int
    today_registered: int
    today_active: int
    membership_distribution: dict[str, int]  # {"free": N, "basic": N, "premium": N}
    role_distribution: dict[str, int]  # {"student": N, "teacher": N, "admin": N}
    recent_users: list[RecentUserItem]
```

#### 3.1.7 UserPointsDetail

```python
class UserPointsDetail(BaseModel):
    """用户积分/经验详情"""
    user_id: str
    username: str
    nickname: str
    game_rating: int
    puzzle_rating: int
    rank_title: str
    rank_tier: int
    rank_region: str
    xp_total: int
    xp_today: int
    coins: int
```

#### 3.1.8 AdjustPointsRequest

```python
class AdjustPointsRequest(BaseModel):
    """手动调整积分/经验/金币"""
    xp_change: int = Field(default=0, description="经验值变动，正增负减")
    coins_change: int = Field(default=0, description="金币变动，正增负减")
    game_rating_change: int = Field(default=0, description="对弈评分变动")
    puzzle_rating_change: int = Field(default=0, description="谜题评分变动")
    reason: str = Field(..., min_length=1, max_length=200, description="调整原因（必填，用于审计）")
```

### 3.2 API 接口详细定义

#### 3.2.1 GET /api/v1/admin/stats

数据概览统计。

- **权限**: admin only (`require_admin`)
- **请求**: 无参数
- **响应**: `APIResponse[AdminStatsResponse]`

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total_users": 150,
    "today_registered": 5,
    "today_active": 42,
    "membership_distribution": {"free": 120, "basic": 20, "premium": 10},
    "role_distribution": {"student": 140, "teacher": 8, "admin": 2},
    "recent_users": [
      {"id": "uuid-string", "username": "xxx", "nickname": "xxx", "role": "student", "created_at": "2026-03-28T10:00:00+00:00"}
    ]
  }
}
```

**Service 实现要点**:
- `total_users`: `SELECT COUNT(*) FROM users`
- `today_registered`: `SELECT COUNT(*) FROM users WHERE created_at >= today_start_utc`
- `today_active`: `SELECT COUNT(*) FROM users WHERE last_login_at >= today_start_utc`
- `membership_distribution`: `SELECT membership_tier, COUNT(*) FROM users GROUP BY membership_tier`
- `role_distribution`: `SELECT role, COUNT(*) FROM users GROUP BY role`
- `recent_users`: `SELECT * FROM users ORDER BY created_at DESC LIMIT 10`
- today_start_utc = 当天 UTC 00:00:00（注意时区处理，用 `datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)`）

#### 3.2.2 PUT /api/v1/admin/users/{user_id}

修改用户信息。

- **权限**: admin only
- **路径参数**: `user_id: str`
- **请求体**: `AdminUpdateUserRequest`

```json
{"nickname": "新昵称", "role": "teacher"}
```

- **响应**: `APIResponse[UserListItem]`
- **错误**:
  - 404: 用户不存在
  - 400: 字段校验失败（Pydantic 自动处理）

**Service 实现要点**:
- 查询用户，不存在则 raise ValueError
- 仅更新请求中非 None 的字段（`if data.nickname is not None: user.nickname = data.nickname`）
- flush + 返回更新后的 User 对象

#### 3.2.3 PUT /api/v1/admin/users/{user_id}/password

重置用户密码。

- **权限**: admin only
- **路径参数**: `user_id: str`
- **请求体**: `ResetPasswordRequest`

```json
{"new_password": "newpass123"}
```

- **响应**: `APIResponse[dict]`

```json
{"code": 0, "message": "success", "data": {"message": "Password reset successfully"}}
```

- **错误**: 404 用户不存在

**Service 实现要点**:
- 查询用户
- `user.password_hash = hash_password(data.new_password)`
- flush

#### 3.2.4 PUT /api/v1/admin/users/{user_id}/status

禁用/启用用户。

- **权限**: admin only
- **路径参数**: `user_id: str`
- **请求体**: `UpdateStatusRequest`

```json
{"status": "disabled"}
```

- **响应**: `APIResponse[UserListItem]`
- **错误**: 404 用户不存在
- **业务规则**: 不允许禁用自己（`if user_id == admin_user["user_id"]: raise 400`）

**Service 实现要点**:
- 查询用户
- `user.status = data.status`
- flush + 返回更新后的 User

#### 3.2.5 PUT /api/v1/admin/users/batch/membership

批量授权会员。

- **权限**: admin only
- **请求体**: `BatchUpdateMembershipRequest`

```json
{
  "user_ids": ["uuid1", "uuid2"],
  "membership_tier": "premium",
  "membership_expires_at": "2026-12-31T23:59:59+00:00"
}
```

- **响应**: `APIResponse[BatchMembershipResult]`

```json
{"code": 0, "message": "success", "data": {"success_count": 2, "failed": []}}
```

**路由注册注意事项**:
此路由的路径是 `/users/batch/membership`，与 `PUT /users/{user_id}/membership` 存在路径冲突风险。FastAPI 按注册顺序匹配，**必须在 `{user_id}` 路由之前注册此路由**，否则 "batch" 会被解析为 user_id。

**Service 实现要点**:
- 批量查询用户 `WHERE id IN (user_ids)`
- 对比找出不存在的 user_id -> failed
- 循环更新 membership_tier 和 membership_expires_at
- 默认到期时间逻辑与现有 `update_membership` 保持一致

#### 3.2.6 GET /api/v1/admin/users/{user_id}/points

获取用户积分详情。

- **权限**: admin only
- **路径参数**: `user_id: str`
- **响应**: `APIResponse[UserPointsDetail]`

```json
{
  "code": 0, "message": "success",
  "data": {
    "user_id": "uuid", "username": "xxx", "nickname": "xxx",
    "game_rating": 450, "puzzle_rating": 380,
    "rank_title": "apprentice_2", "rank_tier": 2, "rank_region": "meadow",
    "xp_total": 1200, "xp_today": 50, "coins": 300
  }
}
```

- **错误**: 404 用户不存在或无 rating 记录

**Service 实现要点**:
- JOIN users + user_ratings（`User.rating` relationship 已是 selectin，直接访问 `user.rating`）
- 如果 user.rating 为 None，返回全 0 默认值（新用户可能还没有 rating 记录）

#### 3.2.7 PUT /api/v1/admin/users/{user_id}/points

调整用户积分/经验/金币。

- **权限**: admin only
- **路径参数**: `user_id: str`
- **请求体**: `AdjustPointsRequest`

```json
{
  "xp_change": 100,
  "coins_change": 50,
  "game_rating_change": 0,
  "puzzle_rating_change": 0,
  "reason": "活动奖励"
}
```

- **响应**: `APIResponse[UserPointsDetail]`（返回调整后的最新数据）
- **错误**: 404 用户不存在; 400 调整后数值为负

**Service 实现要点**:
- 查询用户和 user_rating
- 如果 user_rating 不存在，先创建默认记录
- 计算新值，校验下限（xp_total 和 coins 不允许为负，game_rating 和 puzzle_rating 最低 100）
- 更新 user_ratings 的各字段
- 为每个非零变动写入一条 `rating_histories` 记录：

```python
# 示例：xp_change != 0 时
RatingHistory(
    user_id=user_id,
    rating_type="xp",         # "xp" / "coins" / "game" / "puzzle"
    old_rating=old_xp,
    new_rating=new_xp,
    change_amount=xp_change,
    source_type="admin_adjust",
    source_id=admin_user_id,   # 记录操作管理员
)
```

- 所有更新在同一个 session 事务中，保证原子性

### 3.3 修改现有接口

#### GET /api/v1/admin/users - 新增筛选参数

**新增 Query 参数**:

| 参数 | 类型 | 默认值 | 校验 |
|---|---|---|---|
| `role` | `Optional[str]` | `None` | `^(student\|teacher\|admin)$` |
| `status` | `Optional[str]` | `None` | `^(active\|disabled)$` |
| `membership_tier` | `Optional[str]` | `None` | `^(free\|basic\|premium)$` |

**Router 签名变更**:

```python
@router.get("/users", response_model=APIResponse[UserListResponse])
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    membership_tier: Optional[str] = Query(None),
    admin_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> APIResponse[UserListResponse]:
```

**Service 签名变更**:

```python
def list_users(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    membership_tier: Optional[str] = None,
) -> UserListResponse:
```

新增筛选条件在查询中追加 WHERE 子句：
```python
if role:
    base_stmt = base_stmt.where(User.role == role)
    count_stmt = count_stmt.where(User.role == role)
if status:
    base_stmt = base_stmt.where(User.status == status)
    count_stmt = count_stmt.where(User.status == status)
if membership_tier:
    base_stmt = base_stmt.where(User.membership_tier == membership_tier)
    count_stmt = count_stmt.where(User.membership_tier == membership_tier)
```

---

## 4. 权限校验方案

所有新增接口复用现有 `require_admin` 依赖（`backend/app/routers/admin.py` 已定义）。

额外安全校验：
- `PUT /admin/users/{user_id}/status`: 禁止管理员禁用自己
- `PUT /admin/users/{user_id}`: 禁止管理员将自己降级为非 admin 角色
- `dependencies.py` 增加 disabled 用户拦截（见 1.3 节）

---

## 5. 前端技术方案

### 5.1 新增文件清单

```
frontend/src/
  api/
    admin.ts                    -- 新增: Admin 全部 API 封装
  pages/admin/
    AdminLayout.tsx             -- 新增: Tab 导航布局容器 + <Outlet />
    AdminDashboard.tsx          -- 新增: 数据概览
    AdminUsers.tsx              -- 新增: 账号管理（替代 UserManagePage）
    AdminMembership.tsx         -- 新增: 会员管理
    AdminPoints.tsx             -- 新增: 积分管理
```

### 5.2 路由改造

`App.tsx` 中将现有 admin 路由：

```tsx
// 删除:
<Route path="/admin/users" element={<SuspenseWrapper><UserManagePage /></SuspenseWrapper>} />

// 替换为:
<Route path="/admin" element={<SuspenseWrapper><AdminLayout /></SuspenseWrapper>}>
  <Route index element={<AdminDashboard />} />
  <Route path="users" element={<AdminUsers />} />
  <Route path="membership" element={<AdminMembership />} />
  <Route path="points" element={<AdminPoints />} />
</Route>
```

`TopNav.tsx` 中 `/admin/users` 的标签改为 `/admin`，显示名改为 "后台管理"。

### 5.3 api/admin.ts 完整定义

```typescript
import apiClient from './client';
import type { APIResponse, PaginatedResponse } from '@/types/api';

// ---------- Types ----------

export interface UserListItem {
  id: string;
  username: string;
  nickname: string;
  avatar_url: string | null;
  role: string;
  status: string;
  membership_tier: string;
  membership_expires_at: string | null;
  created_at: string;
  last_login_at: string | null;
  login_count: number;
}

export interface AdminStats {
  total_users: number;
  today_registered: number;
  today_active: number;
  membership_distribution: Record<string, number>;
  role_distribution: Record<string, number>;
  recent_users: Array<{
    id: string;
    username: string;
    nickname: string;
    role: string;
    created_at: string;
  }>;
}

export interface UserPointsDetail {
  user_id: string;
  username: string;
  nickname: string;
  game_rating: number;
  puzzle_rating: number;
  rank_title: string;
  rank_tier: number;
  rank_region: string;
  xp_total: number;
  xp_today: number;
  coins: number;
}

export interface BatchMembershipResult {
  success_count: number;
  failed: Array<{ user_id: string; reason: string }>;
}

// ---------- Query Params ----------

export interface UserListParams {
  page?: number;
  page_size?: number;
  search?: string;
  role?: string;
  status?: string;
  membership_tier?: string;
}

// ---------- API Functions ----------

/** 数据概览统计 */
export const getAdminStats = () =>
  apiClient.get<APIResponse<AdminStats>>('/admin/stats');

/** 用户列表（带筛选） */
export const getUsers = (params: UserListParams) =>
  apiClient.get<APIResponse<PaginatedResponse<UserListItem>>>('/admin/users', { params });

/** 创建用户 */
export const createUser = (data: {
  username: string;
  password: string;
  nickname: string;
  role?: string;
}) => apiClient.post<APIResponse<UserListItem>>('/admin/users', data);

/** 修改用户信息 */
export const updateUser = (userId: string, data: {
  nickname?: string;
  role?: string;
}) => apiClient.put<APIResponse<UserListItem>>(`/admin/users/${userId}`, data);

/** 重置密码 */
export const resetPassword = (userId: string, newPassword: string) =>
  apiClient.put<APIResponse<{ message: string }>>(`/admin/users/${userId}/password`, {
    new_password: newPassword,
  });

/** 禁用/启用用户 */
export const updateUserStatus = (userId: string, status: 'active' | 'disabled') =>
  apiClient.put<APIResponse<UserListItem>>(`/admin/users/${userId}/status`, { status });

/** 单个授权会员 */
export const updateMembership = (userId: string, data: {
  membership_tier: string;
  membership_expires_at?: string;
}) => apiClient.put<APIResponse<UserListItem>>(`/admin/users/${userId}/membership`, data);

/** 批量授权会员 */
export const batchUpdateMembership = (data: {
  user_ids: string[];
  membership_tier: string;
  membership_expires_at?: string;
}) => apiClient.put<APIResponse<BatchMembershipResult>>('/admin/users/batch/membership', data);

/** 获取用户积分详情 */
export const getUserPoints = (userId: string) =>
  apiClient.get<APIResponse<UserPointsDetail>>(`/admin/users/${userId}/points`);

/** 调整用户积分 */
export const adjustUserPoints = (userId: string, data: {
  xp_change?: number;
  coins_change?: number;
  game_rating_change?: number;
  puzzle_rating_change?: number;
  reason: string;
}) => apiClient.put<APIResponse<UserPointsDetail>>(`/admin/users/${userId}/points`, data);
```

### 5.4 AdminLayout 组件结构

```tsx
// 使用 React Router 的 <Outlet /> + useLocation 实现 Tab 高亮
const tabs = [
  { label: '数据概览', path: '/admin' },
  { label: '账号管理', path: '/admin/users' },
  { label: '会员管理', path: '/admin/membership' },
  { label: '积分经验', path: '/admin/points' },
];

// Tab 高亮逻辑:
// /admin (exact) -> 数据概览
// /admin/users -> 账号管理
// 以此类推，用 useLocation().pathname 匹配
```

---

## 6. 给后端工程师的开发指令

### 任务清单（按顺序执行）

**B1. 修改 `backend/app/dependencies.py`**

在 `get_current_user` 函数中，JWT 验证通过后增加用户状态校验：
- 从 DB 查询 `User.status`（按主键查，用 `select(User.id, User.status).where(User.id == user_id)`，只查两列，不加载 relationship）
- 如果用户不存在或 status == "disabled"，raise 401
- 同步修改 `get_optional_user`，disabled 用户返回 None

**B2. 新增 Schema 到 `backend/app/schemas/admin.py`**

新增以下 8 个 Schema（完整定义见第 3.1 节）：
- `AdminUpdateUserRequest`
- `ResetPasswordRequest`
- `UpdateStatusRequest`
- `BatchUpdateMembershipRequest`
- `BatchMembershipResult`
- `AdminStatsResponse` + `RecentUserItem`
- `UserPointsDetail`
- `AdjustPointsRequest`

**B3. 扩展 `backend/app/services/admin_service.py`**

新增以下 service 函数：

| 函数 | 说明 |
|---|---|
| `get_admin_stats(db) -> AdminStatsResponse` | 6 个 COUNT/GROUP BY 查询 |
| `update_user(db, user_id, data) -> User` | 部分更新 nickname/role |
| `reset_password(db, user_id, new_password) -> None` | 更新 password_hash |
| `update_user_status(db, user_id, status, admin_user_id) -> User` | 更新 status，禁止自我禁用 |
| `batch_update_membership(db, data) -> BatchMembershipResult` | 批量更新会员 |
| `get_user_points(db, user_id) -> UserPointsDetail` | 查询 user + user_ratings |
| `adjust_user_points(db, user_id, data, admin_user_id) -> UserPointsDetail` | 更新 ratings + 写 histories |

修改现有函数：
| 函数 | 变更 |
|---|---|
| `list_users(db, ...)` | 新增 role/status/membership_tier 参数和对应 WHERE 条件 |

**B4. 新增路由到 `backend/app/routers/admin.py`**

新增 7 个路由端点。**重要**: `PUT /users/batch/membership` 必须在 `PUT /users/{user_id}/membership` 之前注册，避免路径冲突。

每个路由的实现模式一致：
1. `require_admin` 权限校验
2. 调用 service 函数
3. 包装为 `APIResponse.success(data=...)`
4. 异常映射: `ValueError -> 404/400`

### 自测检查项

- [ ] `GET /api/v1/admin/stats` 返回正确统计数
- [ ] `GET /api/v1/admin/users?role=student&status=active` 筛选正确
- [ ] `PUT /api/v1/admin/users/{id}` 只更新传入字段
- [ ] `PUT /api/v1/admin/users/{id}/password` 后可用新密码登录
- [ ] `PUT /api/v1/admin/users/{id}/status` 禁用后该用户 API 调用返回 401
- [ ] `PUT /api/v1/admin/users/{id}/status` 禁用自己返回 400
- [ ] `PUT /api/v1/admin/users/batch/membership` 批量更新正确
- [ ] `GET /api/v1/admin/users/{id}/points` 返回积分详情
- [ ] `PUT /api/v1/admin/users/{id}/points` 调整后数值正确，rating_histories 有记录
- [ ] `PUT /api/v1/admin/users/{id}/points` xp/coins 调整后不为负
- [ ] 非 admin 用户调用所有接口返回 403

---

## 7. 给前端工程师的开发指令

### 任务清单（按顺序执行）

**F1. 新建 `frontend/src/api/admin.ts`**

按第 5.3 节的完整定义创建。所有 API 调用必须带泛型，字段名保持 snake_case。

**F2. 新建 `frontend/src/pages/admin/AdminLayout.tsx`**

- 顶部 Tab 栏，4 个 Tab（数据概览/账号管理/会员管理/积分经验）
- 使用 `<Outlet />` 渲染子路由
- Tab 高亮用 `useLocation().pathname` 判断
- 样式与现有页面风格一致（TailwindCSS）

**F3. 修改 `frontend/src/App.tsx` 路由**

- 删除 `<Route path="/admin/users" element={<UserManagePage />} />`
- 新增嵌套路由结构（见 5.2 节）
- lazy import 所有新页面组件

**F4. 修改 `frontend/src/components/layout/TopNav.tsx`**

- 导航项 `/admin/users` 改为 `/admin`，标签改为 "后台管理"

**F5. 新建 `AdminDashboard.tsx`**

- 调用 `getAdminStats()`
- 展示 6 个统计卡片 + 最近注册用户表格
- 加载态用 Skeleton 或 Spin

**F6. 新建 `AdminUsers.tsx`**（替代 `UserManagePage.tsx`）

- 顶部筛选栏：搜索框 + 角色下拉 + 状态下拉 + 会员等级下拉
- 用户表格 + 分页
- 操作列：编辑按钮、重置密码按钮、禁用/启用按钮
- 创建用户按钮 + 模态框
- 编辑用户模态框（nickname + role）
- 重置密码确认模态框
- 禁用/启用二次确认弹窗

**F7. 新建 `AdminMembership.tsx`**

- 筛选栏：搜索 + 会员等级
- 用户表格（侧重会员字段）
- 单个授权会员模态框（复用现有逻辑）
- 批量选择 + 批量授权模态框

**F8. 新建 `AdminPoints.tsx`**

- 筛选栏：搜索
- 用户表格（侧重积分字段，需要额外请求 user_ratings 数据）
- 调整积分模态框

**F9. 清理 `UserManagePage.tsx`**

功能全部迁移到新组件后，可保留文件但标记为 deprecated，或直接删除（路由已不指向它）。

### 前端注意事项

1. 积分管理 Tab 的用户列表需要展示 user_ratings 数据，但 `GET /admin/users` 不返回这些字段。方案：列表仍用 `GET /admin/users` 获取基础信息，点击"调整"时调用 `GET /admin/users/{id}/points` 获取完整积分数据填入模态框。如果需要在列表中直接展示积分数据，后续可以扩展 `UserListItem` Schema。
2. 所有模态框操作成功后刷新当前列表数据。
3. 批量操作的 checkbox 状态管理建议用 `Set<string>` 存储选中的 user_id。
4. 日期选择器（会员到期时间）使用原生 `<input type="datetime-local" />` 或已有的日期组件。

---

## 8. 风险与 Tech Debt

| 项目 | 说明 | 优先级 |
|---|---|---|
| 用户状态校验性能 | 每次请求多一次 DB 查询，用户量大时考虑 Redis 缓存 | 低（当前 <1000 用户） |
| 筛选索引 | role/status/membership_tier 无索引 | 低（当前数据量小） |
| 操作审计日志 | 管理员操作仅积分变更有 rating_histories 记录，其他操作无审计 | 中（Phase 2 考虑） |
| 并发安全 | 积分调整无乐观锁，并发调整可能导致数据不一致 | 低（admin 操作频率低） |
| 前端旧代码 | UserManagePage.tsx 废弃后需清理 | 低 |
