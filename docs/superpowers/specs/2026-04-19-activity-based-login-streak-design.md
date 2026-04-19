# 按活跃日维护 Login Streak · 设计文档

- 状态：已评审（设计阶段）
- 日期：2026-04-19
- 来源：用户反馈"隔天不退出不新增记录"—— 现有 streak 只在 login 接口更新，但用户靠 refresh_token 续期（30 天不必重新登录），导致 login_streak 几乎永远停在 1。

## 1. 背景与目标

### 现状
`update_login_info()`（`backend/app/services/auth_service.py:106`）只在 `POST /api/v1/auth/login` 和 `POST /api/v1/auth/register` 调用。刷新 token（`/token/refresh`）不触发。

access_token 2h、refresh_token 30 天（`config.py:22-23`）。前端 access 过期自动 refresh，用户 30 天内不会再进 login 接口。

**结果**：`user_streaks.login_streak` 只有用户主动登出再登入才涨，普通连续使用场景 streak 永远停在 1，失去激励意义。

### 目标
让 `user_streaks.login_streak` 真实反映"用户连续活跃天数"（每天有至少一次已鉴权请求即算活跃）。

### 非目标
- 不改 `users.login_count` 语义（仍只记重新登录次数）
- 不加用户侧时区传输
- 不加失败登录锁定等安全相关功能
- 不改 JWT TTL

## 2. 需求决策摘要

| 维度 | 决策 |
|---|---|
| 实现位置 | 在 `get_current_user` 依赖里调 `touch_activity(db, user_id)` |
| 去重策略 | 进程内 dict `{user_id: last_touched_date}` 内存缓存，同日 skip |
| `login_count` 字段 | 保持现状（只记重新登录次数）|
| 覆盖范围 | 所有经 `get_current_user` 的接口都算活跃，无白名单 |
| 时区 | 维持服务器本地时区 `date.today()`（阿里云 ECS 东 8 区）|
| 错误处理 | `try/except` 吞异常 + log warning + 不更新缓存，主业务 100% 可用 |
| 双写 | `/auth/login` 的 `update_login_info` 保留不动，与新路径共存 |

## 3. 架构

### 3.1 新增/修改文件

| 文件 | 动作 | 责任 |
|---|---|---|
| `backend/app/services/streak_service.py` | 新建 | `touch_activity(db, user_id)`：内存缓存去重 + DB 写入 |
| `backend/app/dependencies.py` | 修改 | `get_current_user`（line 26-58）在 `_check_user_status` 之后、return dict 之前调 `touch_activity(db, user_id)` |
| `backend/app/services/auth_service.py` | 不改 | `update_login_info` 保留不动，与 touch_activity 共存 |
| `backend/tests/test_streak_service.py` | 新建 | 单测覆盖同日/跨日/断日/异常 4 个核心分支 |

### 3.2 无数据库迁移

复用已有 `user_streaks` 表字段（`login_streak / login_streak_max / last_login_date / user_id`）。不新增列、不改索引。

## 4. 组件细节

### 4.1 `streak_service.py`

```python
"""Daily activity streak maintenance with in-process cache."""
import logging
import uuid
from datetime import date, timedelta
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.gamification import UserStreak

logger = logging.getLogger(__name__)

# Module-level in-process cache: user_id -> last touched date
_touch_cache: dict[str, date] = {}


def touch_activity(db: Session, user_id: str) -> None:
    """Mark a user active today; advance login streak if appropriate.

    Called on every authenticated request via get_current_user. Uses
    an in-process cache to skip same-day writes. Never raises — any
    error is logged and swallowed so the caller's request is not
    affected.
    """
    today = date.today()
    cached = _touch_cache.get(user_id)
    if cached == today:
        return  # same-day fast path

    try:
        streak = db.execute(
            select(UserStreak).where(UserStreak.user_id == user_id)
        ).scalar_one_or_none()

        if streak is None:
            streak = UserStreak(
                id=str(uuid.uuid4()),
                user_id=user_id,
                login_streak=1,
                login_streak_max=1,
                last_login_date=today,
            )
            db.add(streak)
        elif streak.last_login_date == today:
            # DB already has today — cache was just stale
            pass
        elif streak.last_login_date == today - timedelta(days=1):
            streak.login_streak += 1
            if streak.login_streak > streak.login_streak_max:
                streak.login_streak_max = streak.login_streak
            streak.last_login_date = today
        else:
            # Gap of ≥2 days — reset
            streak.login_streak = 1
            streak.last_login_date = today

        db.commit()
        _touch_cache[user_id] = today
    except Exception as e:
        logger.warning("touch_activity failed for user %s: %s", user_id, e)
        # Do NOT update _touch_cache — next request retries
```

### 4.2 `get_current_user` 接入

`get_current_user`（`backend/app/dependencies.py:26-58`）当前返回 **dict**（不是 User 对象）。在 `_check_user_status(db, user_id)`（line 52）之后、`return {...}`（line 54）之前加一行：

```python
from app.services.streak_service import touch_activity

# line 51-52 (existing):
user_id = payload.get("sub")
_check_user_status(db, user_id)

# NEW:
touch_activity(db, user_id)  # fire and forget — never raises

# line 54-58 (existing):
return {
    "user_id": user_id,
    "username": payload.get("username"),
    "role": payload.get("role", "student"),
}
```

单行新增 + 1 行 import；不动签名或 return 结构。

**`get_optional_user`（line 61-85）不加**。该依赖用于可选鉴权接口（未登录也 200），如果用户已登录走这里 streak 不会更新——影响面极小（这类接口通常是 public dashboard/landing），不在本次范围。

### 4.3 双写冲突保护

`/auth/login` 仍走 `update_login_info` 写 streak。登录瞬间两条路径都可能触发：
- login handler → `update_login_info` 写 streak + commit（**不碰 `_touch_cache`**）
- 紧接着的 `/auth/me` 或下一个请求 → `get_current_user` → `touch_activity` → 缓存未命中 → SELECT 发现 `last_login_date == today` → pass → 设 `_touch_cache[user_id] = today`

等价路径，无重复 +1。第一次触发多一次 SELECT + no-op，可接受。

**注意 session 交互**：`update_login_info` 当前没显式 `db.commit()`（检查显示它调用 `db.add`，由 FastAPI 依赖层 session 关闭时隐式提交）。`touch_activity` **显式 `db.commit()`**，避免依赖隐式行为。两者都通过相同 `db` session，不会冲突；但若实现发现 `get_current_user` 被依赖调用时 session 尚未完全准备好（极罕见），会由 try/except 兜底。

### 4.4 内存缓存的局限

- **单进程单实例**：目前 systemd 启动 `uvicorn` 默认 `--workers 1`，一个进程一份 cache。未来如果加 workers，每个 worker 各有一份 dict，最多每个 worker 同日多写 1 次，语义不变。
- **进程重启**：cache 清空，当日第一次请求会走一次 SELECT，同日 no-op 后填回 cache。最多多写 1 次。
- **内存占用**：用户数约数千级；`dict[str, date]` 估算 ~200 bytes/项 × 10k = 2 MB，可忽略。
- **不清理**：长时间运行后 dict 会包含离线用户。考虑在某次请求中增加 LRU 裁剪？—— YAGNI，用户量数千级，进程生命周期一般不会超过 2 周（每次部署都重启），暂不做。

## 5. 数据流

```
任意已鉴权请求进来
   └── get_current_user 解析 JWT → 得到 user
       └── touch_activity(db, user.id)
           ├── 查 _touch_cache
           │     ├── 命中当日 → return（无 DB 查询）
           │     └── 未命中 →
           ├── SELECT user_streaks WHERE user_id=?
           │     ├── 不存在 → INSERT streak=1, max=1, date=today
           │     ├── date == today → pass
           │     ├── date == today-1 → streak+=1, max=max(streak, max), date=today
           │     └── date < today-1 → streak=1, date=today
           ├── db.commit()
           └── _touch_cache[user_id] = today
   └── return user
接口业务逻辑正常执行
```

## 6. 错误处理

| 场景 | 行为 |
|---|---|
| DB SELECT 抛错 | catch → log warning → `_touch_cache` 不更新 → 主接口照常返 200 |
| DB commit 抛错 | 同上；SQLAlchemy session 可能需 rollback，交给既有 session 管理 |
| `db` session 不可用（极端）| catch → log warning → return |
| `user_id` 为空/None | `cached = None != today` → 走 DB → SELECT 空 → INSERT 会失败（user_id NOT NULL）→ catch → 记 log |

**绝对不让 `touch_activity` 的异常冒到 `get_current_user` 返回路径上。** 测试会强制验证。

## 7. 测试策略

### 7.1 单元测试 `backend/tests/test_streak_service.py`

1. **首次调用**：清空 cache 和 DB → `touch_activity` → 断言创建 UserStreak(streak=1, max=1, date=today) + cache 命中
2. **同日第二次调用**：复用 1 的状态 → 第二次 `touch_activity` → 断言未发起 DB query（mock session 或 spy `execute`）+ cache 仍为 today
3. **跨 1 天（连续）**：预置 streak=3, date=yesterday → 清空 cache → `touch_activity` → 断言 streak=4, max=max(4, old_max), date=today
4. **连续最大值**：预置 streak=5, max=5, date=yesterday → `touch_activity` → streak=6, max=6
5. **断开 ≥2 天**：预置 streak=10, max=10, date=today-3 → `touch_activity` → streak=1, max=10（不降）, date=today
6. **DB SELECT 抛错**：monkeypatch `db.execute` raise → `touch_activity` **不抛** + cache 不更新 + log warning 有
7. **DB commit 抛错**：mock `db.commit` raise → 同 6
8. **空 user_id**：`touch_activity(db, "")` 或 `None` → 不抛

### 7.2 集成测试（可选）

`get_current_user` 依赖 mock `touch_activity` raise → 任意一个已鉴权接口请求 → 返 200。验证"错误不影响业务"的契约。

### 7.3 手动冒烟（部署后）

1. 当日首次登录：`GET /api/v1/auth/me` → `user_streaks.login_streak` 为 1 或已被 login 路径写过的值
2. 当日再请求任意鉴权接口 → streak 不变（DB 查询可用 `EXPLAIN` 或 log 验证走了缓存）
3. 跨天冷启动（第二天服务器日期变了）：首次鉴权请求 → streak+1、max 更新

## 8. 部署

- **无 DB 迁移**
- rsync backend → `/opt/chess-edu/backend/`
- `systemctl restart chess-edu`
- 注意：重启后 `_touch_cache` 清空属正常

## 9. 风险与约束

- 多 worker 场景下 cache 每 worker 一份（目前 workers=1，影响为零）
- 进程重启当日 DB 多 1 次 SELECT，可接受
- 异常被静默吞掉 → 依赖 log 监控发现问题；建议 `warning` 级别，运维有现成告警
- 若未来引入多实例（如 Nginx + 多 uvicorn 实例），需改成 Redis 或合并 UPDATE 条件 SQL —— 不在本次范围
