# 师生账号管理系统 - 技术架构设计

> 版本: v1.0 | 日期: 2026-03-30 | 作者: architect-agent

---

## 1. 需求摘要

在现有 admin/student 角色体系基础上，新增 teacher 角色，支持：

- 管理员创建老师账号
- 老师通过邀请码绑定学生
- 老师查看名下学生的学习数据汇总与详情
- 学生可绑定多个老师，绑定关系可解除

---

## 2. 数据库设计

### 2.1 新增表（不修改现有表）

现有 `users.role` 字段已支持 `"teacher"` 值（`CreateUserRequest.role` 和 `AdminUpdateUserRequest.role` 的 pattern 已包含 teacher），无需改表。

#### invite_codes 表

| 列名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | String(36) | PK, default uuid4 | 主键 |
| teacher_id | String(36) | FK → users.id, NOT NULL, INDEX | 生成邀请码的老师 |
| code | String(6) | UNIQUE, NOT NULL, INDEX | 6位邀请码（大写字母+数字） |
| max_uses | Integer | NOT NULL, default 30 | 最大使用次数 |
| used_count | Integer | NOT NULL, default 0 | 已使用次数 |
| status | String(20) | NOT NULL, default 'active' | active / expired / revoked |
| expires_at | DateTime(tz) | NOT NULL | 过期时间（生成后72小时） |
| created_at | DateTime(tz) | NOT NULL, server_default now() | 创建时间 |

生成策略：`random.choices(string.ascii_uppercase + string.digits, k=6)`，碰撞时重试（6位36进制 = 2,176,782,336 种组合，碰撞概率极低）。

#### teacher_students 表

| 列名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | String(36) | PK, default uuid4 | 主键 |
| teacher_id | String(36) | FK → users.id, NOT NULL, INDEX | 老师 |
| student_id | String(36) | FK → users.id, NOT NULL, INDEX | 学生 |
| invite_code_id | String(36) | FK → invite_codes.id, NULL | 通过哪个邀请码绑定的（审计用） |
| status | String(20) | NOT NULL, default 'active' | active / removed |
| created_at | DateTime(tz) | NOT NULL, server_default now() | 绑定时间 |
| removed_at | DateTime(tz) | NULL | 解绑时间 |

**唯一约束**: `UNIQUE(teacher_id, student_id)` — 同一对师生只能有一条记录。解绑后 status 改为 removed，重新绑定时更新同一行回 active。

### 2.2 索引策略

```
invite_codes:
  - idx_invite_codes_teacher_id ON (teacher_id)
  - idx_invite_codes_code ON (code)  -- 学生输入邀请码时查询
  - idx_invite_codes_expires ON (expires_at) WHERE status='active'  -- 过期清理

teacher_students:
  - idx_ts_teacher_id ON (teacher_id) WHERE status='active'  -- 老师查学生列表
  - idx_ts_student_id ON (student_id) WHERE status='active'  -- 学生查绑定老师
  - uq_ts_teacher_student ON (teacher_id, student_id)  -- 唯一约束
```

### 2.3 ER 关系

```
users (role=teacher) ──1:N──> invite_codes
users (role=teacher) ──M:N──> users (role=student)  [通过 teacher_students]
invite_codes ──1:N──> teacher_students (审计关联)
```

---

## 3. API 契约设计

所有接口遵循项目统一响应格式：`{ code: 0, message: "success", data: T }`

### 3.1 老师端 API

路由前缀: `/api/v1/teacher`

#### POST /teacher/invite-codes — 生成邀请码

权限: role=teacher

```
Request:
{
  "max_uses": 30          // 可选，默认30
}

Response.data:
{
  "id": "uuid",
  "code": "A3X7K9",
  "max_uses": 30,
  "used_count": 0,
  "status": "active",
  "expires_at": "2026-04-02T10:00:00Z",
  "created_at": "2026-03-30T10:00:00Z"
}
```

业务规则:
- 每个老师同时只能有 **3个** active 状态的邀请码（防滥用）
- 超过限制返回 400: "Active invite code limit reached (max 3)"

#### GET /teacher/invite-codes — 查看我的邀请码列表

权限: role=teacher

```
Response.data:
[
  {
    "id": "uuid",
    "code": "A3X7K9",
    "max_uses": 30,
    "used_count": 12,
    "status": "active",
    "expires_at": "2026-04-02T10:00:00Z",
    "created_at": "2026-03-30T10:00:00Z"
  }
]
```

#### DELETE /teacher/invite-codes/{code_id} — 撤销邀请码

权限: role=teacher（只能撤销自己的）

将 status 置为 `revoked`，已绑定的关系不受影响。

#### GET /teacher/students — 我的学生列表（含汇总数据）

权限: role=teacher

```
Query: ?page=1&page_size=20&search=xxx

Response.data:
{
  "items": [
    {
      "student_id": "uuid",
      "username": "xiaoming",
      "nickname": "小明",
      "avatar_url": null,
      "bindtime": "2026-03-25T10:00:00Z",
      "summary": {
        "total_games": 42,
        "win_rate": 0.57,
        "total_puzzles": 128,
        "puzzle_accuracy": 0.73,
        "course_completion": 0.40,
        "game_rating": 520,
        "puzzle_rating": 480,
        "rank_title": "apprentice_3",
        "last_active_at": "2026-03-29T18:30:00Z"
      }
    }
  ],
  "total": 12,
  "page": 1,
  "page_size": 20,
  "total_pages": 1
}
```

汇总数据来源（均为聚合查询，不存冗余字段）:
| 字段 | 来源表 | 聚合方式 |
|---|---|---|
| total_games | games | COUNT WHERE user_id=student |
| win_rate | games | AVG(result='win') |
| total_puzzles | puzzle_attempts | COUNT WHERE user_id=student |
| puzzle_accuracy | puzzle_attempts | AVG(is_correct) |
| course_completion | lesson_progresses | completed / total lessons |
| game_rating | user_ratings | 直接读 |
| puzzle_rating | user_ratings | 直接读 |
| rank_title | user_ratings | 直接读 |
| last_active_at | users.last_login_at | 直接读 |

**性能考量**: 学生列表的汇总数据涉及多表聚合。当学生数量较大时（>50），采用以下策略:
- 分页查询，每页默认20条
- 先查 teacher_students 获取学生 ID 列表，再批量聚合（避免 N+1）
- 如后续性能不足，可引入 Redis 缓存或物化视图（当前阶段不需要）

#### GET /teacher/students/{student_id} — 单个学生详情

权限: role=teacher（只能查看自己绑定的学生）

```
Response.data:
{
  "student_id": "uuid",
  "username": "xiaoming",
  "nickname": "小明",
  "avatar_url": null,
  "bindtime": "2026-03-25T10:00:00Z",
  "profile": {
    "birth_year": 2018,
    "chess_experience": "beginner",
    "assessment_done": true,
    "initial_rating": 350
  },
  "ratings": {
    "game_rating": 520,
    "puzzle_rating": 480,
    "rank_title": "apprentice_3",
    "rank_tier": 3,
    "rank_region": "meadow",
    "xp_total": 2400,
    "coins": 350
  },
  "game_stats": {
    "total_games": 42,
    "wins": 24,
    "losses": 15,
    "draws": 3,
    "win_rate": 0.57,
    "recent_games": [
      {
        "id": "uuid",
        "character_name": "豆丁",
        "result": "win",
        "rating_change": +12,
        "played_at": "2026-03-29T14:00:00Z"
      }
    ]
  },
  "puzzle_stats": {
    "total_attempts": 128,
    "correct_count": 93,
    "accuracy": 0.73,
    "current_streak": 5
  },
  "course_stats": {
    "total_lessons": 25,
    "completed_lessons": 10,
    "completion_rate": 0.40,
    "courses": [
      {
        "course_id": "uuid",
        "title": "零基础启蒙",
        "total_lessons": 10,
        "completed": 8,
        "progress": 0.80
      }
    ]
  },
  "streak": {
    "current_login_streak": 7,
    "max_login_streak": 14,
    "current_train_streak": 3
  },
  "last_active_at": "2026-03-29T18:30:00Z"
}
```

#### DELETE /teacher/students/{student_id} — 解除绑定

权限: role=teacher

将 teacher_students.status 置为 `removed`，设置 removed_at。

### 3.2 学生端 API

路由前缀: `/api/v1/student`

#### POST /student/join-teacher — 输入邀请码加入老师

权限: role=student

```
Request:
{
  "invite_code": "A3X7K9"
}

Response.data:
{
  "teacher_id": "uuid",
  "teacher_nickname": "李老师",
  "bindtime": "2026-03-30T10:00:00Z"
}
```

校验流程（按顺序）:
1. 查 invite_codes WHERE code=? AND status='active' — 不存在或非active → 400 "Invalid invite code"
2. expires_at > now() — 已过期 → 400 "Invite code has expired"
3. used_count < max_uses — 已满员 → 400 "Invite code has reached max uses"
4. 查 teacher_students WHERE teacher_id=? AND student_id=? — 已存在且 active → 400 "Already joined this teacher"
5. 校验通过 → 创建/恢复绑定关系，invite_codes.used_count += 1

如果 teacher_students 存在但 status=removed（之前解绑过），更新为 active 并清空 removed_at。

#### GET /student/my-teachers — 查看我的老师列表

权限: role=student

```
Response.data:
[
  {
    "teacher_id": "uuid",
    "teacher_nickname": "李老师",
    "teacher_avatar_url": null,
    "bindtime": "2026-03-25T10:00:00Z"
  }
]
```

#### DELETE /student/leave-teacher/{teacher_id} — 学生主动解绑老师

权限: role=student

将 teacher_students.status 置为 `removed`。

### 3.3 管理员端 API

**无需新增接口**。现有 `POST /api/v1/admin/users` 已支持 `role: "teacher"`，`CreateUserRequest` schema 已包含 teacher 选项。

管理员可通过现有的用户列表接口（`GET /admin/users?role=teacher`）筛选查看所有老师账号。

---

## 4. Pydantic Schema 设计

### 4.1 新增文件: `backend/app/schemas/teacher.py`

```python
# InviteCode 相关
class CreateInviteCodeRequest(BaseModel):
    max_uses: int = Field(default=30, ge=1, le=200)

class InviteCodeResponse(BaseModel):
    id: str
    code: str
    max_uses: int
    used_count: int
    status: str
    expires_at: datetime
    created_at: datetime
    model_config = {"from_attributes": True}

# 学生汇总
class StudentSummary(BaseModel):
    total_games: int = 0
    win_rate: float = 0.0
    total_puzzles: int = 0
    puzzle_accuracy: float = 0.0
    course_completion: float = 0.0
    game_rating: int = 300
    puzzle_rating: int = 300
    rank_title: str = "apprentice_1"
    last_active_at: Optional[datetime] = None

class TeacherStudentItem(BaseModel):
    student_id: str
    username: str
    nickname: str
    avatar_url: Optional[str] = None
    bindtime: datetime
    summary: StudentSummary

class TeacherStudentListResponse(BaseModel):
    items: list[TeacherStudentItem]
    total: int
    page: int
    page_size: int
    total_pages: int

# 学生详情（字段参考 3.1 节 API 契约）
class StudentDetailResponse(BaseModel):
    student_id: str
    username: str
    nickname: str
    avatar_url: Optional[str] = None
    bindtime: datetime
    profile: dict      # StudentProfile 子结构
    ratings: dict      # 评分详情
    game_stats: dict   # 对弈统计
    puzzle_stats: dict # 谜题统计
    course_stats: dict # 课程统计
    streak: dict       # 连续天数
    last_active_at: Optional[datetime] = None
```

### 4.2 新增文件: `backend/app/schemas/student.py`

```python
class JoinTeacherRequest(BaseModel):
    invite_code: str = Field(..., min_length=6, max_length=6, pattern="^[A-Z0-9]{6}$")

class JoinTeacherResponse(BaseModel):
    teacher_id: str
    teacher_nickname: str
    bindtime: datetime

class MyTeacherItem(BaseModel):
    teacher_id: str
    teacher_nickname: str
    teacher_avatar_url: Optional[str] = None
    bindtime: datetime
```

---

## 5. ORM Model 设计

### 5.1 新增文件: `backend/app/models/teacher.py`

```python
class InviteCode(Base):
    __tablename__ = "invite_codes"
    # 字段与 2.1 节表结构一致
    # relationship: teacher = relationship("User", backref=...)

class TeacherStudent(Base):
    __tablename__ = "teacher_students"
    # 字段与 2.1 节表结构一致
    # __table_args__ = (UniqueConstraint("teacher_id", "student_id"),)
    # relationship: teacher, student = relationship("User", ...)
```

注意事项:
- 不在 User 模型上添加 relationship（避免侵入现有代码），查询通过 Service 层直接 JOIN
- `__init__.py` 中导入新 model，确保 `create_all()` 能创建表

### 5.2 models/__init__.py 更新

在现有导入列表中追加:
```python
from app.models.teacher import InviteCode, TeacherStudent  # noqa: F401
```

---

## 6. Service 层设计

### 6.1 新增文件: `backend/app/services/teacher_service.py`

| 函数 | 说明 |
|---|---|
| `create_invite_code(db, teacher_id, max_uses)` | 生成邀请码，检查active数量限制 |
| `list_invite_codes(db, teacher_id)` | 查询老师的所有邀请码 |
| `revoke_invite_code(db, teacher_id, code_id)` | 撤销邀请码 |
| `list_students(db, teacher_id, page, page_size, search)` | 查询学生列表+汇总数据 |
| `get_student_detail(db, teacher_id, student_id)` | 查询单个学生详情 |
| `remove_student(db, teacher_id, student_id)` | 解除绑定 |

### 6.2 新增文件: `backend/app/services/student_service.py`

| 函数 | 说明 |
|---|---|
| `join_teacher(db, student_id, invite_code)` | 校验邀请码+创建绑定 |
| `list_my_teachers(db, student_id)` | 查询我的老师 |
| `leave_teacher(db, student_id, teacher_id)` | 学生主动解绑 |

---

## 7. Router 层设计

### 7.1 新增文件: `backend/app/routers/teacher.py`

```python
router = APIRouter()

def require_teacher(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Teacher privileges required")
    return current_user
```

路由注册（参照 admin.py 模式）:
- 在 `backend/app/routers/__init__.py` 中添加:
  ```python
  from app.routers.teacher import router as teacher_router
  router.include_router(teacher_router, prefix="/teacher", tags=["teacher"])
  ```

### 7.2 新增文件: `backend/app/routers/student_extra.py`

```python
router = APIRouter()

def require_student(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Student role required")
    return current_user
```

路由注册:
- 在 `backend/app/routers/__init__.py` 中添加:
  ```python
  from app.routers.student_extra import router as student_extra_router
  router.include_router(student_extra_router, prefix="/student", tags=["student"])
  ```

---

## 8. 前端设计

### 8.1 新增页面

| 路由 | 页面文件 | 说明 |
|---|---|---|
| `/teacher` | `pages/teacher/TeacherDashboardPage.tsx` | 老师工作台（学生列表+数据卡片） |
| `/teacher/student/:id` | `pages/teacher/StudentDetailPage.tsx` | 单个学生详情页 |
| `/teacher/invite-codes` | `pages/teacher/InviteCodesPage.tsx` | 邀请码管理（可合并到工作台） |

### 8.2 现有页面修改

| 页面 | 修改 |
|---|---|
| `pages/settings/SettingsPage.tsx` | 学生角色新增"加入老师"卡片（输入邀请码 + 已绑定老师列表） |
| `pages/auth/LoginPage.tsx` | 无需修改（teacher 登录后根据 role 跳转） |

### 8.3 路由守卫

```typescript
// 在 App.tsx 或路由配置中
<Route path="/teacher/*" element={<RoleGuard role="teacher"><TeacherLayout /></RoleGuard>} />
```

`RoleGuard` 组件: 检查 authStore 中的 user.role，不匹配则 redirect 到 `/dashboard`。

### 8.4 新增 API 层

新增 `frontend/src/api/teacher.ts`:
```typescript
export const teacherApi = {
  createInviteCode: (data) => apiClient.post<...>('/teacher/invite-codes', data),
  getInviteCodes: () => apiClient.get<...>('/teacher/invite-codes'),
  revokeInviteCode: (id) => apiClient.delete<...>(`/teacher/invite-codes/${id}`),
  getStudents: (params) => apiClient.get<...>('/teacher/students', { params }),
  getStudentDetail: (id) => apiClient.get<...>(`/teacher/students/${id}`),
  removeStudent: (id) => apiClient.delete<...>(`/teacher/students/${id}`),
}
```

新增 `frontend/src/api/student.ts`（追加到已有文件或新建）:
```typescript
export const studentApi = {
  joinTeacher: (data) => apiClient.post<...>('/student/join-teacher', data),
  getMyTeachers: () => apiClient.get<...>('/student/my-teachers'),
  leaveTeacher: (teacherId) => apiClient.delete<...>(`/student/leave-teacher/${teacherId}`),
}
```

### 8.5 类型定义

在 `frontend/src/types/api.ts` 中追加 teacher/student 相关类型，与后端 Schema 对齐。

---

## 9. 权限矩阵

| API | admin | teacher | student | 未认证 |
|---|---|---|---|---|
| POST /admin/users (role=teacher) | Y | - | - | - |
| POST /teacher/invite-codes | - | Y | - | - |
| GET /teacher/invite-codes | - | Y | - | - |
| DELETE /teacher/invite-codes/:id | - | Y(own) | - | - |
| GET /teacher/students | - | Y | - | - |
| GET /teacher/students/:id | - | Y(own) | - | - |
| DELETE /teacher/students/:id | - | Y(own) | - | - |
| POST /student/join-teacher | - | - | Y | - |
| GET /student/my-teachers | - | - | Y | - |
| DELETE /student/leave-teacher/:id | - | - | Y | - |

---

## 10. 邀请码过期处理

两种策略结合:

1. **查询时校验**: 每次查询邀请码时检查 expires_at，过期的视为无效（零成本）
2. **定期清理（可选）**: 后台任务将过期的 active 码批量置为 expired（保持数据干净）

当前阶段只做策略1，不引入定时任务复杂度。

---

## 11. 部署注意事项

### 11.1 数据库迁移

新增两张表，通过 `init_db()` 的 `Base.metadata.create_all()` 自动创建（SQLite 开发 + 生产均适用）。

**不修改任何现有表结构**，零风险。

### 11.2 测试账号建议

在 admin 后台手动创建:
- teacher/teacher123 (role=teacher) — 老师测试账号
- 用已有 student/123456 测试绑定流程

---

## 12. 新增文件清单

| 层 | 文件路径 | 说明 |
|---|---|---|
| Model | `backend/app/models/teacher.py` | InviteCode, TeacherStudent |
| Schema | `backend/app/schemas/teacher.py` | 老师端请求/响应 |
| Schema | `backend/app/schemas/student.py` | 学生端请求/响应 |
| Service | `backend/app/services/teacher_service.py` | 老师业务逻辑 |
| Service | `backend/app/services/student_service.py` | 学生绑定逻辑 |
| Router | `backend/app/routers/teacher.py` | 老师端路由 |
| Router | `backend/app/routers/student_extra.py` | 学生端路由 |
| Page | `frontend/src/pages/teacher/TeacherDashboardPage.tsx` | 老师工作台 |
| Page | `frontend/src/pages/teacher/StudentDetailPage.tsx` | 学生详情 |
| API | `frontend/src/api/teacher.ts` | 老师端API |

修改文件:
- `backend/app/models/__init__.py` — 导入新 model
- `backend/app/routers/__init__.py` — 注册新 router
- `frontend/src/pages/settings/SettingsPage.tsx` — 加入老师入口
- `frontend/src/types/api.ts` — 新增类型定义
- `frontend/src/App.tsx`（或路由配置文件）— 新增 /teacher 路由

---

## 13. 实现优先级建议

| 阶段 | 范围 | 可独立交付 |
|---|---|---|
| P0 | Model + Schema + 邀请码生成/校验 + 绑定API | 后端可测 |
| P1 | 老师学生列表 + 汇总数据聚合 | 后端可测 |
| P2 | 老师工作台前端页面 + 路由守卫 | 前后端联调 |
| P3 | 学生设置页"加入老师"入口 | 完整流程可走通 |
| P4 | 学生详情页 | 完善功能 |
