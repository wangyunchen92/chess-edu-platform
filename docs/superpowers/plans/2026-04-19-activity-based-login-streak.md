# 按活跃日维护 Login Streak · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `user_streaks.login_streak` 真实反映用户连续活跃天数（每天任何一个已鉴权请求都算）。

**Architecture:** 新建 `streak_service.py` 暴露 `touch_activity(db, user_id)`，用进程内 `dict` 缓存同日去重；改 `dependencies.py` 的 `get_current_user` 在成功解析用户后调一次；异常全吞只 log，绝不影响业务接口；`/auth/login` 的 `update_login_info` 保留不动（双写安全）。

**Tech Stack:** Python 3.11 · FastAPI · SQLAlchemy 2.0 (Sync Session) · pytest + pytest-mock · python-chess 不涉及

**设计文档：** [`docs/superpowers/specs/2026-04-19-activity-based-login-streak-design.md`](../specs/2026-04-19-activity-based-login-streak-design.md)

---

## 文件结构

| 文件 | 动作 | 责任 |
|---|---|---|
| `backend/app/services/streak_service.py` | 新建 | 导出 `touch_activity(db, user_id)`，维护 module-level `_touch_cache: dict[str, date]` |
| `backend/app/dependencies.py:52` | 修改 | `get_current_user` 在 `_check_user_status` 之后、`return` 之前加一行 `touch_activity(db, user_id)`（不动 `get_optional_user`）|
| `backend/tests/test_streak_service.py` | 新建 | 7 个单测覆盖：首次 / 同日缓存 / 同日 DB 已写 / 跨 1 天 / 断日 / DB SELECT 异常 / DB commit 异常 |

**不动：**
- `backend/app/services/auth_service.py:106 update_login_info` — 保留双写
- `backend/app/models/gamification.py UserStreak` — 字段完全复用
- DB Schema — 无迁移

---

## 前置确认（非任务步骤）

- Python 虚拟环境在 `backend/venv`（线上 `/opt/chess-edu/backend/venv`）
- 本地跑 pytest：`cd backend && python3 -m pytest backend/tests/test_streak_service.py -v`
- 测试不依赖 `conftest.py` 的 async fixtures（用 mock + SQLite in-memory 自包含）

---

## Task 1: 新建 streak_service.py（骨架 + 最小实现）

**Files:**
- Create: `backend/app/services/streak_service.py`

### - [ ] Step 1.1: 创建模块

Create `backend/app/services/streak_service.py`:

```python
"""Daily activity streak maintenance with in-process cache.

Called from get_current_user on every authenticated request.
Uses a module-level dict to skip same-day writes. Never raises —
any error is logged and swallowed so the caller's request is not
affected.
"""
import logging
import uuid
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.gamification import UserStreak

logger = logging.getLogger(__name__)

# Module-level in-process cache: user_id -> last touched date.
# Cleared on process restart (that's fine — worst case one extra
# SELECT + no-op per user on the first post-restart request).
_touch_cache: dict[str, date] = {}


def touch_activity(db: Session, user_id: Optional[str]) -> None:
    """Mark a user active today; advance login streak if appropriate.

    Behavior:
    - Same-day cache hit: instant return, no DB access.
    - Cache miss: SELECT, apply streak rules (new/same/consecutive/gap), commit.
    - On any exception: log warning and return. Do NOT update cache
      on failure so the next request retries.

    Args:
        db: SQLAlchemy Session (sync).
        user_id: The authenticated user's id (from JWT sub). May be None/empty
                 in pathological cases — we handle that defensively.
    """
    if not user_id:
        return

    today = date.today()
    cached = _touch_cache.get(user_id)
    if cached == today:
        return  # same-day fast path, no DB access

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
            # DB already has today — the cache was just stale
            pass
        elif streak.last_login_date == today - timedelta(days=1):
            streak.login_streak += 1
            if streak.login_streak > streak.login_streak_max:
                streak.login_streak_max = streak.login_streak
            streak.last_login_date = today
        else:
            # gap of ≥2 days OR last_login_date is None — reset
            streak.login_streak = 1
            streak.last_login_date = today

        db.commit()
        _touch_cache[user_id] = today
    except Exception as e:
        logger.warning("touch_activity failed for user %s: %s", user_id, e)
        # Do NOT update _touch_cache so the next request retries
```

### - [ ] Step 1.2: 语法 & import 校验

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/backend
python3 -c "from app.services.streak_service import touch_activity, _touch_cache; print('ok')"
```

Expected: `ok`（无 ImportError）

### - [ ] Step 1.3: 提交

```bash
git add backend/app/services/streak_service.py
git commit -m "feat(backend): add streak_service with touch_activity for daily activity tracking"
```

---

## Task 2: 写 7 个单测（TDD - 先失败）

**Files:**
- Create: `backend/tests/test_streak_service.py`

### - [ ] Step 2.1: 新建测试文件

Create `backend/tests/test_streak_service.py`:

```python
"""Unit tests for streak_service.touch_activity."""
import uuid
from datetime import date, timedelta
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base
from app.models.gamification import UserStreak
from app.models.user import User
from app.services import streak_service


@pytest.fixture(autouse=True)
def clear_cache():
    """Reset the module-level cache before each test."""
    streak_service._touch_cache.clear()
    yield
    streak_service._touch_cache.clear()


@pytest.fixture
def db() -> Session:
    """Fresh in-memory SQLite DB per test, with all tables created."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, expire_on_commit=False)
    session = TestSession()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def user_id(db: Session) -> str:
    """Seed a user row so UserStreak.user_id FK passes."""
    uid = str(uuid.uuid4())
    user = User(
        id=uid,
        username=f"test_{uid[:8]}",
        password_hash="x",
        role="student",
        status="active",
    )
    db.add(user)
    db.commit()
    return uid


def _get_streak(db: Session, uid: str) -> UserStreak | None:
    from sqlalchemy import select
    return db.execute(
        select(UserStreak).where(UserStreak.user_id == uid)
    ).scalar_one_or_none()


def test_first_call_creates_streak_and_populates_cache(db, user_id):
    assert _get_streak(db, user_id) is None

    streak_service.touch_activity(db, user_id)

    s = _get_streak(db, user_id)
    assert s is not None
    assert s.login_streak == 1
    assert s.login_streak_max == 1
    assert s.last_login_date == date.today()
    assert streak_service._touch_cache[user_id] == date.today()


def test_same_day_second_call_uses_cache(db, user_id):
    streak_service.touch_activity(db, user_id)

    # Spy on db.execute after the first call
    original_execute = db.execute
    db.execute = MagicMock(side_effect=original_execute)

    streak_service.touch_activity(db, user_id)

    db.execute.assert_not_called()  # cache short-circuit


def test_consecutive_day_increments_streak(db, user_id):
    yesterday = date.today() - timedelta(days=1)
    db.add(UserStreak(
        id=str(uuid.uuid4()),
        user_id=user_id,
        login_streak=3,
        login_streak_max=5,
        last_login_date=yesterday,
    ))
    db.commit()

    streak_service.touch_activity(db, user_id)

    s = _get_streak(db, user_id)
    assert s.login_streak == 4
    assert s.login_streak_max == 5  # not beaten
    assert s.last_login_date == date.today()


def test_consecutive_day_updates_max(db, user_id):
    yesterday = date.today() - timedelta(days=1)
    db.add(UserStreak(
        id=str(uuid.uuid4()),
        user_id=user_id,
        login_streak=5,
        login_streak_max=5,
        last_login_date=yesterday,
    ))
    db.commit()

    streak_service.touch_activity(db, user_id)

    s = _get_streak(db, user_id)
    assert s.login_streak == 6
    assert s.login_streak_max == 6  # new record


def test_gap_of_two_days_resets_streak(db, user_id):
    two_days_ago = date.today() - timedelta(days=2)
    db.add(UserStreak(
        id=str(uuid.uuid4()),
        user_id=user_id,
        login_streak=10,
        login_streak_max=10,
        last_login_date=two_days_ago,
    ))
    db.commit()

    streak_service.touch_activity(db, user_id)

    s = _get_streak(db, user_id)
    assert s.login_streak == 1
    assert s.login_streak_max == 10  # preserved
    assert s.last_login_date == date.today()


def test_same_day_in_db_but_cache_empty_is_noop(db, user_id):
    """Cache cleared (e.g. after restart) but DB already has today."""
    db.add(UserStreak(
        id=str(uuid.uuid4()),
        user_id=user_id,
        login_streak=7,
        login_streak_max=7,
        last_login_date=date.today(),
    ))
    db.commit()

    streak_service.touch_activity(db, user_id)

    s = _get_streak(db, user_id)
    assert s.login_streak == 7  # unchanged
    assert streak_service._touch_cache[user_id] == date.today()  # filled


def test_db_error_is_swallowed_and_cache_not_updated(db, user_id, caplog):
    """SELECT raises -> touch_activity does not raise, cache stays empty."""
    db.execute = MagicMock(side_effect=RuntimeError("db down"))

    streak_service.touch_activity(db, user_id)  # must not raise

    assert user_id not in streak_service._touch_cache
    assert any("touch_activity failed" in rec.message for rec in caplog.records)


def test_empty_user_id_is_noop(db):
    """Defensive: None or empty user_id should no-op without DB access."""
    db.execute = MagicMock()

    streak_service.touch_activity(db, None)
    streak_service.touch_activity(db, "")

    db.execute.assert_not_called()
```

### - [ ] Step 2.2: 跑测试确认**全部通过**

实现已经在 Task 1 完成，所以这些测试应该**直接通过**（不是 TDD 的标准红→绿，这里是"实现先、测试后"验证实现的正确性）。

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/backend
python3 -m pytest tests/test_streak_service.py -v 2>&1 | tail -30
```

Expected: **8 passed**（7 个场景测试 + `test_empty_user_id_is_noop`）

### - [ ] Step 2.3: 若有失败，诊断

常见问题：
- `Base.metadata.create_all` 时依赖的外键表缺失 → 检查 `User` 模型 import 是否导致其他 model 的循环 import
- `caplog` 抓不到 log → 确认 `logger` 是 module-level
- SQLite 不支持某些字段 → 检查 `timezone=True` datetime 在 SQLite 下行为

若是实现 bug（不是测试问题），修 `streak_service.py`，不改测试断言。

### - [ ] Step 2.4: 提交

```bash
git add backend/tests/test_streak_service.py
git commit -m "test(backend): unit tests for streak_service touch_activity"
```

---

## Task 3: 集成到 `get_current_user`

**Files:**
- Modify: `backend/app/dependencies.py:51-58`

### - [ ] Step 3.1: 修改 `get_current_user`

在 `backend/app/dependencies.py` 里：

**(a) 顶部 import 区新增：**

```python
from app.services.streak_service import touch_activity
```

**(b) `get_current_user` 函数内，line 52 `_check_user_status(db, user_id)` 之后、line 54 `return {...}` 之前插入一行：**

```python
    user_id = payload.get("sub")
    _check_user_status(db, user_id)

    # Track daily activity (fire-and-forget, never raises)
    touch_activity(db, user_id)

    return {
        "user_id": user_id,
        "username": payload.get("username"),
        "role": payload.get("role", "student"),
    }
```

**不要**修改 `get_optional_user`（line 61-85）。

### - [ ] Step 3.2: 启动冒烟

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/backend
python3 -c "from app.main import app; print('ok')"
```

Expected: `ok`

### - [ ] Step 3.3: 提交

```bash
git add backend/app/dependencies.py
git commit -m "feat(backend): touch user activity on every authenticated request"
```

---

## Task 4: 集成冒烟（本地后端 + curl）

### - [ ] Step 4.1: 启动后端

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/backend
# 确认 venv
ls venv/bin/python3 2>/dev/null || echo "NO VENV — use system python"

# 启动（后台）
uvicorn app.main:app --reload --port 8000 > /tmp/uvicorn-streak.log 2>&1 &
sleep 4
tail -5 /tmp/uvicorn-streak.log
```

Expected: 看到 `Uvicorn running on http://...8000`

### - [ ] Step 4.2: 登录 + 活跃追踪验证

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"123456"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['tokens']['access_token'])")
echo "TOKEN len=${#TOKEN}"

# 请求一个已鉴权接口（/auth/me 最干净）
curl -s http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" > /tmp/me1.json
cat /tmp/me1.json | python3 -m json.tool | head -10
```

Expected: HTTP 200 + user info。

### - [ ] Step 4.3: 查 DB 确认 streak 写入

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/backend
python3 <<'EOF'
from app.database import SessionLocal
from app.models.gamification import UserStreak
from app.models.user import User
from sqlalchemy import select

db = SessionLocal()
student = db.execute(select(User).where(User.username == 'student')).scalar_one_or_none()
streak = db.execute(select(UserStreak).where(UserStreak.user_id == student.id)).scalar_one_or_none()
print(f"user={student.username}  login_streak={streak.login_streak}  max={streak.login_streak_max}  last_date={streak.last_login_date}")
db.close()
EOF
```

Expected: 输出非空，`last_date` 等于今天，`login_streak >= 1`。

### - [ ] Step 4.4: 同日再请求验证缓存命中

```bash
# 打开一个新 terminal 或同进程里：
curl -s -w "HTTP %{http_code}\n" -o /dev/null \
  http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 看 log 没有 SELECT user_streaks 新记录（缓存命中）
grep -c "SELECT.*user_streaks" /tmp/uvicorn-streak.log
```

Expected: 第二次 `HTTP 200`；`grep -c` 计数不增（缓存命中）。

### - [ ] Step 4.5: 异常路径验证（可选）

在 Python REPL 里 import `streak_service` 然后把 `_touch_cache` 清空，再配合 monkeypatch 模拟 DB down——属于运行时手动测。若不便省略。

### - [ ] Step 4.6: 关闭后端

```bash
pkill -f "uvicorn app.main" 2>/dev/null; sleep 1
```

---

## Task 5: 代码审查 + 部署

按[研发流程规范](../../../../.claude/projects/-Users-wangyunchen-agents-----/memory/shared/feedback_dev_process.md)：

### - [ ] Step 5.1: code-review 子agent

controller 负责派发（子agent prompt 示例）：
> 审查 commit `<sha1>..<sha2>`（本次 streak 功能）。重点：
> 1. 内存缓存的多 worker/进程场景影响（当前 workers=1 可接受）
> 2. DB 异常被吞的可观测性（log level warning 是否够）
> 3. `get_current_user` 每次增加一次 SELECT 的性能边际（缓存命中后 0 次；未命中每 user 每日 1 次）
> 4. `touch_activity` 签名对空/非法 user_id 的防御是否足够

### - [ ] Step 5.2: 部署（用户批准后）

```bash
# 从本地 rsync
rsync -avz --exclude='data.db*' --exclude='__pycache__' --exclude='.venv' --exclude='venv' --exclude='.env' --exclude='.pytest_cache' \
  /Users/wangyunchen/agents/教育教学/chess-edu-platform/backend/ \
  root@118.31.237.111:/opt/chess-edu/backend/

# 重启
ssh root@118.31.237.111 'systemctl restart chess-edu && sleep 2 && systemctl is-active chess-edu'
```

Expected: `active`

### - [ ] Step 5.3: 线上冒烟

```bash
ssh root@118.31.237.111 "bash -s" <<'EOF'
TOKEN=$(curl -s -X POST http://127.0.0.1:8001/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"student","password":"123456"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['access_token'])")

# 访问一个已鉴权接口
curl -s -w "HTTP %{http_code}\n" -o /dev/null http://127.0.0.1:8001/api/v1/auth/me -H "Authorization: Bearer $TOKEN"

# 查 streak
/opt/chess-edu/backend/venv/bin/python3 <<'PY'
import sys
sys.path.insert(0, '/opt/chess-edu/backend')
from app.database import SessionLocal
from app.models.gamification import UserStreak
from app.models.user import User
from sqlalchemy import select
db = SessionLocal()
s = db.execute(select(User).where(User.username == 'student')).scalar_one_or_none()
st = db.execute(select(UserStreak).where(UserStreak.user_id == s.id)).scalar_one_or_none()
print(f"streak={st.login_streak} max={st.login_streak_max} date={st.last_login_date}")
PY
EOF
```

Expected: HTTP 200 + streak 信息含今天日期。

---

## 回顾 · 改动清单

| 文件 | 行数 |
|---|---|
| `backend/app/services/streak_service.py`（新）| ~90 行 |
| `backend/tests/test_streak_service.py`（新）| ~140 行 |
| `backend/app/dependencies.py`（改）| +2 行（1 import + 1 调用）|
| **合计** | **~232 行** |

**无数据库迁移。** 不动表结构。

---

## 风险清单

- 多 worker / 多实例部署场景下内存缓存每进程一份（当前 workers=1，影响零）
- 进程重启当日首请求多一次 SELECT + no-op（可接受）
- 异常静默吞掉依赖 log 监控发现 — 用 `warning` 级别，运维有现成告警
- `date.today()` 服务器本地时区（东 8 区，和目标用户群一致）

## 回滚预案

```bash
# 如有问题：回滚 dependencies.py 的一行 + 重启
ssh root@118.31.237.111 'cd /opt/chess-edu/backend && git diff app/dependencies.py | tail -10 && systemctl restart chess-edu'
```

或直接回滚到上一个部署的备份目录。
