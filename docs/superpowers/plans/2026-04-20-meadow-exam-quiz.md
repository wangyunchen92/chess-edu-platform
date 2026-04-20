# 冒险 · 草原小考 Quiz · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户在启蒙草原点「草原小考」做 5 题棋类基础单选题，答对 ≥3 题通过并获得 100 XP + 「启蒙草原毕业」成就（+50 金币）。

**Architecture:** 题库 JSON 外置在 `content/quizzes/<challenge_id>.json`；新增 GET `/adventure/quiz/{challenge_id}` endpoint 下发题库；答题全在前端 QuizPage 本地判对错 + 展示解析；答完调 PUT `/adventure/promotion-challenge/{id}/complete`，**服务端独立判分**（不信前端送的 `quiz_score`）并触发奖励发放。

**Tech Stack:** Python FastAPI · SQLAlchemy 2.0 · React 18 · TypeScript · Vitest · Playwright E2E

**设计文档：** [`docs/superpowers/specs/2026-04-20-meadow-exam-quiz-design.md`](../specs/2026-04-20-meadow-exam-quiz-design.md)

> **Spec 对齐说明**：Spec 草稿里提到 "update_challenge"，实际代码里对应函数是 `complete_challenge`（`adventure_service.py:294`），签名：`(db, user_id, challenge_id, result, game_id, quiz_answers, quiz_score)`。CompleteChallengeRequest schema 已经有 `quiz_answers` + `quiz_score`（`adventure.py:90-91`），无需新增字段。Plan 按实际代码走。
>
> Spec 原说"题目随 `/adventure/regions` 下发"——但实际有 `/adventure/map` 和 `/adventure/regions/{id}` 两个 endpoint，不适合塞题库。Plan 改为**新建 GET `/adventure/quiz/{challenge_id}`** 独立 endpoint（更正交、响应更小、前端逻辑简单）。

---

## 文件结构

| 文件 | 动作 | 责任 |
|---|---|---|
| `content/quizzes/meadow_exam.json` | 新建 | 5 道题 + 及格线 3 + reward_xp 100 + passed_achievement_slug |
| `backend/app/services/gamification_service.py` | 修改 | 新增 `grant_achievement_by_slug(db, user_id, slug)` 事件触发式解锁 + 发 XP/金币 |
| `backend/app/services/adventure_service.py` | 修改 | 新增 `_QUIZ_BANK_CACHE` + `_load_quiz(id)` + `get_quiz_bank(id)`；改造 `complete_challenge` 在 quiz_answers 非空时**服务端独立判分** + 通过后调 `award_xp(bank.reward_xp)` + `grant_achievement_by_slug(bank.passed_achievement_slug)`；幂等处理已 passed 记录 |
| `backend/app/routers/adventure.py` | 修改 | 新增 GET `/quiz/{challenge_id}` → `get_quiz_bank` |
| `backend/app/schemas/adventure.py` | 修改 | 新增 `QuizBankResponse`（包含含 answer+explanation 的题目列表，Q5A 决策）|
| `backend/tests/test_adventure_quiz.py` | 新建 | 8 个 pytest 用例（SQLite in-memory）|
| `backend/tests/test_grant_achievement.py` | 新建 | 3 个 `grant_achievement_by_slug` 单测 |
| `frontend/src/types/api.ts` | 修改 | `QuizOption`、`QuizQuestion`、`QuizBank` 类型 |
| `frontend/src/api/adventure.ts` | 修改 | 新增 `getQuiz(challengeId)` 方法 |
| `frontend/src/pages/adventure/QuizPage.tsx` | 新建 | 答题 UI（逐题反馈 + 结果页 + sessionStorage 断点续答）|
| `frontend/src/pages/adventure/__tests__/QuizPage.test.tsx` | 新建 | 6 个 Vitest 用例 |
| `frontend/src/pages/adventure/AdventureMapPage.tsx` | 修改 | quiz 类型恢复 `navigate('/adventure/quiz/:id')`（撤销 commit `91f6b5b` 的"开发中"占位）；`is_completed` 的 quiz 禁用按钮显示"已通过" |
| `frontend/src/App.tsx` | 修改 | 加 Route `/adventure/quiz/:challengeId` → `QuizPage` |
| `e2e/adventure-quiz.spec.ts` | 新建 | 3 个 Playwright 用例 |

**DB 数据**（非代码）：
- PG `achievements` 表插入 `meadow_exam_passed` 一行（Task 11 部署时执行）

---

## 前置确认（非任务步骤）

- 后端启动：`cd backend && python3 -m uvicorn app.main:app --reload --port 8000`
- 前端：`cd frontend && npm run dev`（已跑着）
- pytest：`cd backend && python3 -m pytest tests/<test_file>.py -v`
- vitest：`cd frontend && npx vitest run src/pages/adventure/__tests__/<test_file>.test.tsx`
- 分支：当前在 `master`（两个功能已合并），本次直接在 master 上提交小功能（参考 streak 同分支模式）

---

## Task 1: 新建题库 JSON

**Files:**
- Create: `content/quizzes/meadow_exam.json`

### - [ ] Step 1.1: 创建目录 + 文件

```bash
mkdir -p /Users/wangyunchen/agents/教育教学/chess-edu-platform/content/quizzes
```

Create `content/quizzes/meadow_exam.json` with **exact content**:

```json
{
  "challenge_id": "meadow_exam",
  "pass_threshold": 3,
  "total_questions": 5,
  "reward_xp": 100,
  "passed_achievement_slug": "meadow_exam_passed",
  "questions": [
    {
      "id": "q1",
      "text": "国王一次能走几步？",
      "options": [
        {"key": "A", "text": "1 步（任意方向）"},
        {"key": "B", "text": "2 步"},
        {"key": "C", "text": "8 步"},
        {"key": "D", "text": "想走多远走多远"}
      ],
      "answer": "A",
      "explanation": "国王很威严但行动慢，一次只能走到相邻的 8 个格子之一。"
    },
    {
      "id": "q2",
      "text": "棋局里哪个子最重要，被将死就输？",
      "options": [
        {"key": "A", "text": "皇后"},
        {"key": "B", "text": "车"},
        {"key": "C", "text": "主教"},
        {"key": "D", "text": "国王"}
      ],
      "answer": "D",
      "explanation": "国王棋力不强，但被将死就输了——它是整个棋局的核心。"
    },
    {
      "id": "q3",
      "text": "皇后可以怎么走？",
      "options": [
        {"key": "A", "text": "只能横竖走"},
        {"key": "B", "text": "只能斜着走"},
        {"key": "C", "text": "横竖 + 斜着都行，想走多远走多远"},
        {"key": "D", "text": "像马一样跳日"}
      ],
      "answer": "C",
      "explanation": "皇后是最强的子，既有车的能力又有象的能力。"
    },
    {
      "id": "q4",
      "text": "兵第一次走的时候，可以走几步？",
      "options": [
        {"key": "A", "text": "只能 1 步"},
        {"key": "B", "text": "1 步或 2 步"},
        {"key": "C", "text": "必须 2 步"},
        {"key": "D", "text": "想走多远走多远"}
      ],
      "answer": "B",
      "explanation": "每个兵「第一次走」可以选 1 或 2 步，之后每次只能走 1 步。"
    },
    {
      "id": "q5",
      "text": "什么叫「将军」（check）？",
      "options": [
        {"key": "A", "text": "国王被对方子力攻击到，必须逃开"},
        {"key": "B", "text": "对方认输了"},
        {"key": "C", "text": "棋盘上只剩国王"},
        {"key": "D", "text": "所有兵都被吃掉"}
      ],
      "answer": "A",
      "explanation": "将军是对方发出的警告——你的国王下一步会被吃掉，必须立刻化解。"
    }
  ]
}
```

### - [ ] Step 1.2: JSON 合法性冒烟

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform
python3 -c "import json; d=json.load(open('content/quizzes/meadow_exam.json')); assert len(d['questions'])==5; assert d['pass_threshold']==3; print('ok')"
```

Expected: `ok`

### - [ ] Step 1.3: 提交

```bash
git add content/quizzes/meadow_exam.json
git commit -m "content: add meadow_exam quiz bank (5 basic chess questions)"
```

---

## Task 2: `grant_achievement_by_slug` 新增

**Files:**
- Modify: `backend/app/services/gamification_service.py`
- Create: `backend/tests/test_grant_achievement.py`

### - [ ] Step 2.1: 写失败测试

Create `backend/tests/test_grant_achievement.py`:

```python
"""Unit tests for gamification_service.grant_achievement_by_slug."""
import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base
from app.models.achievement import Achievement, UserAchievement
from app.models.user import User
from app.models.user_rating import UserRating
from app.services import gamification_service


@pytest.fixture
def db() -> Session:
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, expire_on_commit=False)
    s = TestSession()
    try:
        yield s
    finally:
        s.close()
        engine.dispose()


@pytest.fixture
def user_id(db: Session) -> str:
    uid = str(uuid.uuid4())
    db.add(User(
        id=uid, username=f"u_{uid[:8]}", nickname=f"n_{uid[:8]}",
        password_hash="x", role="student", status="active",
    ))
    db.add(UserRating(
        id=str(uuid.uuid4()),
        user_id=uid,
        game_rating=400, puzzle_rating=400, xp=0, coins=10,
    ))
    db.commit()
    return uid


@pytest.fixture
def achievement(db: Session) -> Achievement:
    a = Achievement(
        id=str(uuid.uuid4()),
        slug="meadow_exam_passed",
        name="启蒙草原毕业",
        description="通过「草原小考」",
        icon_key="🌿",
        category="adventure",
        condition_type="meadow_exam_pass",
        condition_value=1,
        xp_reward=0,
        coin_reward=50,
    )
    db.add(a)
    db.commit()
    return a


def test_grant_new_achievement_adds_row_and_coins(db, user_id, achievement):
    granted = gamification_service.grant_achievement_by_slug(
        db, user_id, "meadow_exam_passed"
    )
    assert granted is True

    ua = db.execute(
        select(UserAchievement).where(UserAchievement.user_id == user_id)
    ).scalar_one_or_none()
    assert ua is not None
    assert ua.achievement_id == achievement.id

    ur = db.execute(
        select(UserRating).where(UserRating.user_id == user_id)
    ).scalar_one_or_none()
    assert ur.coins == 60  # 10 + 50


def test_grant_is_idempotent(db, user_id, achievement):
    gamification_service.grant_achievement_by_slug(db, user_id, "meadow_exam_passed")
    granted_second = gamification_service.grant_achievement_by_slug(
        db, user_id, "meadow_exam_passed"
    )
    assert granted_second is False

    ur = db.execute(
        select(UserRating).where(UserRating.user_id == user_id)
    ).scalar_one_or_none()
    assert ur.coins == 60  # not doubled


def test_grant_unknown_slug_returns_false(db, user_id):
    granted = gamification_service.grant_achievement_by_slug(
        db, user_id, "nonexistent_slug"
    )
    assert granted is False
```

### - [ ] Step 2.2: 跑测试确认失败

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/backend
python3 -m pytest tests/test_grant_achievement.py -v 2>&1 | tail -10
```

Expected: **FAIL** — `AttributeError: module 'gamification_service' has no attribute 'grant_achievement_by_slug'`

### - [ ] Step 2.3: 实现 `grant_achievement_by_slug`

在 `backend/app/services/gamification_service.py` 里，找到 `check_achievements` 函数所在位置（约 line 416），**在其前面**（和 `award_xp` 后面）追加：

```python
def grant_achievement_by_slug(db: Session, user_id: str, slug: str) -> bool:
    """Grant a specific achievement by slug (event-triggered).

    Idempotent: returns False if already unlocked or slug not found.
    Awards xp_reward (via award_xp) and coin_reward (directly onto
    user_ratings.coins, matching check_achievements convention).

    Args:
        db: SQLAlchemy Session.
        user_id: The user to grant the achievement to.
        slug: Achievement.slug (e.g. 'meadow_exam_passed').

    Returns:
        True if newly granted; False if already unlocked or slug unknown.
    """
    ach = db.execute(
        select(Achievement).where(Achievement.slug == slug)
    ).scalar_one_or_none()
    if ach is None:
        return False

    existing = db.execute(
        select(UserAchievement).where(
            UserAchievement.user_id == user_id,
            UserAchievement.achievement_id == ach.id,
        )
    ).scalar_one_or_none()
    if existing:
        return False  # idempotent

    db.add(UserAchievement(
        id=str(uuid.uuid4()),
        user_id=user_id,
        achievement_id=ach.id,
    ))

    if ach.xp_reward > 0:
        award_xp(db, user_id, ach.xp_reward, reason=f"achievement:{slug}")

    if ach.coin_reward > 0:
        ur = db.execute(
            select(UserRating).where(UserRating.user_id == user_id)
        ).scalar_one_or_none()
        if ur:
            ur.coins += ach.coin_reward
            db.add(ur)

    return True
```

确保文件顶部已有 `from app.models.achievement import Achievement, UserAchievement` 和 `from app.models.user_rating import UserRating`，以及 `import uuid`（应已存在）。若缺则按需补 import。

### - [ ] Step 2.4: 跑测试确认通过

```bash
python3 -m pytest tests/test_grant_achievement.py -v 2>&1 | tail -10
```

Expected: **3 passed**

### - [ ] Step 2.5: 提交

```bash
git add backend/app/services/gamification_service.py backend/tests/test_grant_achievement.py
git commit -m "feat(backend): add grant_achievement_by_slug for event-triggered unlock"
```

---

## Task 3: 题库加载 + `get_quiz_bank` 服务方法

**Files:**
- Modify: `backend/app/services/adventure_service.py`

### - [ ] Step 3.1: 在 adventure_service.py 顶部 import 区补

```python
import json
from pathlib import Path
```

（如已有则跳过）

### - [ ] Step 3.2: 在 `REGIONS` 定义**之后**、`_get_region_by_id` 之前追加：

```python
# ── Quiz bank (lazy-loaded from content/quizzes/<id>.json) ──────

_QUIZ_BANK_CACHE: dict[str, dict] = {}


def _load_quiz(challenge_id: str) -> Optional[dict]:
    """Lazy-load quiz bank JSON into process-level cache."""
    if challenge_id in _QUIZ_BANK_CACHE:
        return _QUIZ_BANK_CACHE[challenge_id]
    # content/quizzes/<id>.json, relative to project root
    path = Path(__file__).resolve().parents[3] / "content" / "quizzes" / f"{challenge_id}.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        _QUIZ_BANK_CACHE[challenge_id] = data
        return data
    except Exception:
        return None


def get_quiz_bank(challenge_id: str) -> Optional[dict]:
    """Get the full quiz bank (including answers + explanations) for a
    challenge. Returns None if not found. Callers (router) are
    responsible for mapping to QuizBankResponse schema.
    """
    return _load_quiz(challenge_id)
```

### - [ ] Step 3.3: 冒烟

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/backend
python3 -c "
from app.services.adventure_service import get_quiz_bank
b = get_quiz_bank('meadow_exam')
assert b is not None
assert len(b['questions']) == 5
assert b['pass_threshold'] == 3
print('ok')
"
```

Expected: `ok`

### - [ ] Step 3.4: 提交

```bash
git add backend/app/services/adventure_service.py
git commit -m "feat(backend): lazy-load quiz bank from content/quizzes/*.json"
```

---

## Task 4: Schema + Router 的 `/adventure/quiz/{id}` endpoint

**Files:**
- Modify: `backend/app/schemas/adventure.py`
- Modify: `backend/app/routers/adventure.py`

### - [ ] Step 4.1: 扩展 schema

在 `backend/app/schemas/adventure.py` 末尾追加：

```python
class QuizOptionDTO(BaseModel):
    key: str
    text: str


class QuizQuestionDTO(BaseModel):
    id: str
    text: str
    options: list[QuizOptionDTO]
    answer: str  # Q5A: 下发正确答案给前端做即时反馈
    explanation: str


class QuizBankResponse(BaseModel):
    challenge_id: str
    pass_threshold: int
    total_questions: int
    reward_xp: int
    questions: list[QuizQuestionDTO]
```

### - [ ] Step 4.2: Router 新增 endpoint

在 `backend/app/routers/adventure.py`（`start_challenge` 和 `complete_challenge` 之间，或文件末尾）追加：

```python
# ── Quiz endpoint ────────────────────────────────────────────────


@router.get(
    "/quiz/{challenge_id}",
    response_model=APIResponse[QuizBankResponse],
)
def get_quiz(
    challenge_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[QuizBankResponse]:
    """Return the quiz bank (questions + answers + explanations) for
    a challenge. Requires auth but no record ownership check — a user
    can peek at any quiz before starting.
    """
    bank = adventure_service.get_quiz_bank(challenge_id)
    if bank is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz bank not found",
        )
    return APIResponse.success(data=QuizBankResponse(**bank))
```

并在 `from app.schemas.adventure import ...` 里追加 `QuizBankResponse`：

```python
from app.schemas.adventure import (
    AdventureMapResponse,
    ChallengeRecord,
    CompleteChallengeRequest,
    QuizBankResponse,
    RegionDetail,
)
```

### - [ ] Step 4.3: 冒烟

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/backend
# 确保后端重启（--reload 会自动）
sleep 2

TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"123456"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['access_token'])")

# (A) 合法 quiz id
curl -s -w "\nHTTP %{http_code}\n" http://localhost:8000/api/v1/adventure/quiz/meadow_exam \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('pass_threshold=', d['data']['pass_threshold']); print('question_count=', len(d['data']['questions'])); print('q1_answer=', d['data']['questions'][0]['answer'])"

# (B) 不存在的 quiz → 404
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:8000/api/v1/adventure/quiz/unknown \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
- (A) `pass_threshold= 3`、`question_count= 5`、`q1_answer= A`
- (B) `HTTP 404`

### - [ ] Step 4.4: 提交

```bash
git add backend/app/schemas/adventure.py backend/app/routers/adventure.py
git commit -m "feat(backend): GET /adventure/quiz/{id} endpoint with answers + explanations"
```

---

## Task 5: `complete_challenge` 服务端判分 + 奖励触发

**Files:**
- Modify: `backend/app/services/adventure_service.py:294-370`（`complete_challenge` 函数）
- Create: `backend/tests/test_adventure_quiz.py`

### - [ ] Step 5.1: 写失败测试

Create `backend/tests/test_adventure_quiz.py`:

```python
"""Unit tests for adventure_service.complete_challenge with quiz scoring."""
import uuid

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base
from app.models.achievement import Achievement, UserAchievement
from app.models.adventure import PromotionChallenge
from app.models.user import User
from app.models.user_rating import UserRating
from app.services import adventure_service


@pytest.fixture(autouse=True)
def clear_quiz_cache():
    adventure_service._QUIZ_BANK_CACHE.clear()
    yield
    adventure_service._QUIZ_BANK_CACHE.clear()


@pytest.fixture
def db() -> Session:
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, expire_on_commit=False)
    s = TestSession()
    try:
        yield s
    finally:
        s.close()
        engine.dispose()


@pytest.fixture
def user_id(db: Session) -> str:
    uid = str(uuid.uuid4())
    db.add(User(
        id=uid, username=f"u_{uid[:8]}", nickname=f"n_{uid[:8]}",
        password_hash="x", role="student", status="active",
    ))
    db.add(UserRating(
        id=str(uuid.uuid4()),
        user_id=uid,
        game_rating=400, puzzle_rating=400, xp=0, coins=0,
    ))
    db.commit()
    return uid


@pytest.fixture
def pending_record(db: Session, user_id: str) -> PromotionChallenge:
    rec = PromotionChallenge(
        id=str(uuid.uuid4()),
        user_id=user_id,
        challenge_type="meadow_exam",
        target_rank="meadow",
        status="pending",
        attempt_count=1,
    )
    db.add(rec)
    db.commit()
    return rec


@pytest.fixture
def achievement(db: Session) -> Achievement:
    a = Achievement(
        id=str(uuid.uuid4()),
        slug="meadow_exam_passed",
        name="启蒙草原毕业",
        description="通过「草原小考」",
        icon_key="🌿",
        category="adventure",
        condition_type="meadow_exam_pass",
        condition_value=1,
        xp_reward=0,
        coin_reward=50,
    )
    db.add(a)
    db.commit()
    return a


def test_all_correct_passes_and_grants_rewards(db, user_id, pending_record, achievement):
    # All 5 correct: q1=A q2=D q3=C q4=B q5=A
    answers = {"q1": "A", "q2": "D", "q3": "C", "q4": "B", "q5": "A"}
    record = adventure_service.complete_challenge(
        db=db,
        user_id=user_id,
        challenge_id="meadow_exam",
        result="pass",  # result is still required by signature but server judges
        quiz_answers=answers,
    )
    assert record is not None
    assert record.quiz_score == 5
    assert record.status == "passed"
    assert record.passed_at is not None

    # Achievement granted
    ua = db.execute(select(UserAchievement).where(
        UserAchievement.user_id == user_id
    )).scalar_one_or_none()
    assert ua is not None

    # Coins = 50 (achievement) + 0 (quiz XP doesn't touch coins)
    ur = db.execute(select(UserRating).where(
        UserRating.user_id == user_id
    )).scalar_one_or_none()
    assert ur.coins == 50
    # XP awarded 100 from quiz
    assert ur.xp >= 100


def test_three_correct_passes(db, user_id, pending_record, achievement):
    # q1=A ✓ q2=D ✓ q3=C ✓ q4=A ✗ q5=B ✗  → 3/5 = just passing
    answers = {"q1": "A", "q2": "D", "q3": "C", "q4": "A", "q5": "B"}
    record = adventure_service.complete_challenge(
        db=db, user_id=user_id, challenge_id="meadow_exam",
        result="pass", quiz_answers=answers,
    )
    assert record.quiz_score == 3
    assert record.status == "passed"


def test_two_correct_does_not_pass(db, user_id, pending_record, achievement):
    # q1=A ✓ q2=A ✗ q3=A ✗ q4=A ✗ q5=A ✓  → 2/5
    answers = {"q1": "A", "q2": "A", "q3": "A", "q4": "A", "q5": "A"}
    record = adventure_service.complete_challenge(
        db=db, user_id=user_id, challenge_id="meadow_exam",
        result="fail", quiz_answers=answers,
    )
    assert record.quiz_score == 2
    assert record.status == "failed"
    assert record.passed_at is None

    # No achievement
    ua = db.execute(select(UserAchievement)).scalar_one_or_none()
    assert ua is None


def test_missing_answers_counted_as_wrong(db, user_id, pending_record, achievement):
    # Only q1 + q3 answered, both correct → score=2, fail
    answers = {"q1": "A", "q3": "C"}
    record = adventure_service.complete_challenge(
        db=db, user_id=user_id, challenge_id="meadow_exam",
        result="fail", quiz_answers=answers,
    )
    assert record.quiz_score == 2
    assert record.status == "failed"


def test_server_score_ignores_client_quiz_score(db, user_id, pending_record, achievement):
    # Client claims 5 but actually 2 correct → server says 2
    answers = {"q1": "A", "q2": "A", "q3": "A", "q4": "A", "q5": "A"}
    record = adventure_service.complete_challenge(
        db=db, user_id=user_id, challenge_id="meadow_exam",
        result="pass", quiz_answers=answers, quiz_score=5,
    )
    assert record.quiz_score == 2  # server's count, not client's 5
    assert record.status == "failed"


def test_already_passed_is_idempotent(db, user_id, achievement):
    # Seed a passed record
    from datetime import datetime, timezone
    prior_time = datetime(2026, 4, 1, tzinfo=timezone.utc)
    rec = PromotionChallenge(
        id=str(uuid.uuid4()),
        user_id=user_id,
        challenge_type="meadow_exam",
        target_rank="meadow",
        status="passed",
        attempt_count=1,
        quiz_score=4,
        passed_at=prior_time,
    )
    db.add(rec)
    # Also seed achievement already granted
    db.add(UserAchievement(
        id=str(uuid.uuid4()),
        user_id=user_id,
        achievement_id=achievement.id,
    ))
    db.commit()

    # complete_challenge finds no "pending" record → returns None
    record = adventure_service.complete_challenge(
        db=db, user_id=user_id, challenge_id="meadow_exam",
        result="pass", quiz_answers={"q1": "A", "q2": "D", "q3": "C", "q4": "B", "q5": "A"},
    )
    assert record is None  # no pending to update

    # passed_at unchanged
    reloaded = db.execute(select(PromotionChallenge).where(
        PromotionChallenge.user_id == user_id
    )).scalar_one_or_none()
    assert reloaded.passed_at == prior_time


def test_quiz_bank_missing_does_not_crash(db, user_id, pending_record, monkeypatch):
    # Simulate missing quiz bank
    monkeypatch.setattr(adventure_service, "_load_quiz", lambda cid: None)
    record = adventure_service.complete_challenge(
        db=db, user_id=user_id, challenge_id="meadow_exam",
        result="pass", quiz_answers={"q1": "A"},
    )
    # Without bank, server can't judge → quiz_score stays 0 (default),
    # status falls back to client-provided result
    assert record is not None


def test_reward_failure_does_not_abort(db, user_id, pending_record, achievement, monkeypatch):
    # Make award_xp throw
    from app.services import gamification_service
    def boom(*args, **kwargs):
        raise RuntimeError("xp service down")
    monkeypatch.setattr(gamification_service, "award_xp", boom)

    answers = {"q1": "A", "q2": "D", "q3": "C", "q4": "B", "q5": "A"}
    record = adventure_service.complete_challenge(
        db=db, user_id=user_id, challenge_id="meadow_exam",
        result="pass", quiz_answers=answers,
    )
    # Even with reward failure, score is saved and status is passed
    assert record.quiz_score == 5
    assert record.status == "passed"
```

### - [ ] Step 5.2: 跑测试确认失败（6-8 个失败）

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/backend
python3 -m pytest tests/test_adventure_quiz.py -v 2>&1 | tail -20
```

Expected: 多数 FAIL（服务端判分逻辑还没实现；幂等和奖励断言会失败）

### - [ ] Step 5.3: 改造 `complete_challenge`

在 `backend/app/services/adventure_service.py` 替换 `complete_challenge` 整个函数（约 line 294-370）：

```python
def complete_challenge(
    db: Session,
    user_id: str,
    challenge_id: str,
    result: str,
    game_id: Optional[str] = None,
    quiz_answers: Optional[dict] = None,
    quiz_score: Optional[int] = None,  # accepted for backward compat, ignored if bank exists
) -> Optional[ChallengeRecord]:
    """Complete a promotion challenge.

    For quiz-type challenges with quiz_answers: the server independently
    computes quiz_score from the loaded bank and overrides the client's
    result/quiz_score. Rewards (XP + achievement) fire on first pass.
    """
    # Find pending challenge
    stmt = select(PromotionChallenge).where(
        PromotionChallenge.user_id == user_id,
        PromotionChallenge.challenge_type == challenge_id,
        PromotionChallenge.status == "pending",
    )
    record = db.execute(stmt).scalar_one_or_none()
    if record is None:
        return None

    # Look up challenge data for type info
    challenge_data = None
    for r in REGIONS:
        for ch in r["challenges"]:
            if ch["id"] == challenge_id:
                challenge_data = ch
                break
        if challenge_data:
            break

    # ── Quiz branch: server-side scoring ─────────────────────
    bank = _load_quiz(challenge_id) if quiz_answers else None
    if bank and quiz_answers is not None:
        score = sum(
            1 for q in bank["questions"]
            if quiz_answers.get(q["id"]) == q["answer"]
        )
        record.quiz_answers = quiz_answers
        record.quiz_score = score

        if score >= bank["pass_threshold"]:
            record.status = "passed"
            record.passed_at = datetime.now(timezone.utc)
            # Reward: quiz XP + achievement (idempotent)
            try:
                from app.services.gamification_service import award_xp
                award_xp(db, user_id, bank["reward_xp"], reason="meadow_exam_passed")
            except Exception as e:
                logger.warning("award_xp failed for user %s: %s", user_id, e)
            try:
                from app.services.gamification_service import grant_achievement_by_slug
                grant_achievement_by_slug(
                    db, user_id, bank["passed_achievement_slug"]
                )
            except Exception as e:
                logger.warning("grant_achievement failed for user %s: %s", user_id, e)
        else:
            record.status = "failed"
    else:
        # ── Non-quiz (battle) branch or quiz with no bank: trust client ──
        if result == "pass":
            record.status = "passed"
            record.passed_at = datetime.now(timezone.utc)
            if challenge_data:
                _award_challenge_xp(db, user_id, challenge_data["reward_xp"])
        else:
            record.status = "failed"

        if quiz_answers:
            record.quiz_answers = quiz_answers
        if quiz_score is not None:
            record.quiz_score = quiz_score

    if game_id:
        record.game_id = game_id

    db.add(record)
    db.flush()

    return ChallengeRecord(
        id=record.id,
        user_id=record.user_id,
        challenge_id=record.challenge_type,
        challenge_type=challenge_data["type"] if challenge_data else record.challenge_type,
        target_rank=record.target_rank,
        status=record.status,
        game_id=record.game_id,
        quiz_score=record.quiz_score,
        attempt_count=record.attempt_count,
        passed_at=record.passed_at,
        created_at=record.created_at,
    )
```

确保 `logger` 在文件顶部已有 `logger = logging.getLogger(__name__)`；若缺则补 `import logging`。

### - [ ] Step 5.4: 跑测试确认 8/8 通过

```bash
python3 -m pytest tests/test_adventure_quiz.py -v 2>&1 | tail -20
```

Expected: **8 passed**

### - [ ] Step 5.5: 回归既有 adventure 测试（如果有的话）

```bash
python3 -m pytest tests/ -v 2>&1 | tail -20
```

Expected: 全部既有测试继续 pass（streak_service 8 + grant_achievement 3 + adventure_quiz 8 = 19 个通过）

### - [ ] Step 5.6: 提交

```bash
git add backend/app/services/adventure_service.py backend/tests/test_adventure_quiz.py
git commit -m "feat(backend): server-side quiz scoring in complete_challenge with reward triggers"
```

---

## Task 6: 前端类型 + API 方法

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/api/adventure.ts`

### - [ ] Step 6.1: 新增类型

在 `frontend/src/types/api.ts` 末尾追加：

```typescript
// ── Adventure Quiz ──────────────────────────────────────────

export interface QuizOption {
  key: string
  text: string
}

export interface QuizQuestion {
  id: string
  text: string
  options: QuizOption[]
  answer: string
  explanation: string
}

export interface QuizBank {
  challenge_id: string
  pass_threshold: number
  total_questions: number
  reward_xp: number
  questions: QuizQuestion[]
}
```

### - [ ] Step 6.2: 扩展 API 客户端

在 `frontend/src/api/adventure.ts` 修改：

```typescript
import apiClient from './client'
import type {
  APIResponse,
  AdventureMapResponse,
  RegionDetail,
  ChallengeRecord,
  CompleteChallengeRequest,
  QuizBank,
} from '@/types/api'

export const adventureApi = {
  getAdventureMap: () =>
    apiClient.get<APIResponse<AdventureMapResponse>>('/adventure/map'),

  getRegionDetail: (regionId: string) =>
    apiClient.get<APIResponse<RegionDetail>>(`/adventure/regions/${regionId}`),

  startChallenge: (challengeId: string) =>
    apiClient.post<APIResponse<ChallengeRecord>>(`/adventure/promotion-challenge/${challengeId}/start`),

  completeChallenge: (challengeId: string, data: CompleteChallengeRequest) =>
    apiClient.put<APIResponse<ChallengeRecord>>(`/adventure/promotion-challenge/${challengeId}/complete`, data),

  getQuiz: (challengeId: string) =>
    apiClient.get<APIResponse<QuizBank>>(`/adventure/quiz/${challengeId}`),
}
```

### - [ ] Step 6.3: 编译验证

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/frontend
npx tsc --noEmit 2>&1 | tail -5
```

Expected: 无错

### - [ ] Step 6.4: 提交

```bash
git add frontend/src/types/api.ts frontend/src/api/adventure.ts
git commit -m "feat(frontend): QuizBank type and getQuiz API method"
```

---

## Task 7: QuizPage 组件 + Vitest

**Files:**
- Create: `frontend/src/pages/adventure/QuizPage.tsx`
- Create: `frontend/src/pages/adventure/__tests__/QuizPage.test.tsx`

### - [ ] Step 7.1: 写失败测试

Create `frontend/src/pages/adventure/__tests__/QuizPage.test.tsx`:

```tsx
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import QuizPage from '../QuizPage'

// Mock adventure API
vi.mock('@/api/adventure', () => ({
  adventureApi: {
    startChallenge: vi.fn(),
    getQuiz: vi.fn(),
    completeChallenge: vi.fn(),
  },
}))

import { adventureApi } from '@/api/adventure'

const MOCK_BANK = {
  challenge_id: 'meadow_exam',
  pass_threshold: 3,
  total_questions: 5,
  reward_xp: 100,
  questions: [
    {
      id: 'q1', text: '国王一次能走几步？', answer: 'A',
      options: [{ key: 'A', text: '1 步（任意方向）' }, { key: 'B', text: '2 步' },
                { key: 'C', text: '8 步' }, { key: 'D', text: '想走多远走多远' }],
      explanation: '国王行动慢。',
    },
    {
      id: 'q2', text: 'Q2?', answer: 'D',
      options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' },
                { key: 'C', text: 'c' }, { key: 'D', text: 'd' }],
      explanation: 'E2.',
    },
    {
      id: 'q3', text: 'Q3?', answer: 'C',
      options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' },
                { key: 'C', text: 'c' }, { key: 'D', text: 'd' }],
      explanation: 'E3.',
    },
    {
      id: 'q4', text: 'Q4?', answer: 'B',
      options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' },
                { key: 'C', text: 'c' }, { key: 'D', text: 'd' }],
      explanation: 'E4.',
    },
    {
      id: 'q5', text: 'Q5?', answer: 'A',
      options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' },
                { key: 'C', text: 'c' }, { key: 'D', text: 'd' }],
      explanation: 'E5.',
    },
  ],
}

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/adventure/quiz/meadow_exam']}>
      <Routes>
        <Route path="/adventure/quiz/:challengeId" element={<QuizPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('QuizPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    ;(adventureApi.startChallenge as any).mockResolvedValue({
      data: { data: { id: 'rec-1', status: 'pending', challenge_type: 'meadow_exam' } },
    })
    ;(adventureApi.getQuiz as any).mockResolvedValue({
      data: { data: MOCK_BANK },
    })
  })

  it('renders first question with 4 options after loading', async () => {
    renderWithRouter()
    await waitFor(() => {
      expect(screen.getByText('国王一次能走几步？')).toBeInTheDocument()
    })
    expect(screen.getByText('1 步（任意方向）')).toBeInTheDocument()
    expect(screen.getByText('2 步')).toBeInTheDocument()
    expect(screen.getByText('8 步')).toBeInTheDocument()
    expect(screen.getByText('想走多远走多远')).toBeInTheDocument()
  })

  it('shows correct feedback and next button when user picks right answer', async () => {
    renderWithRouter()
    await waitFor(() => screen.getByText('国王一次能走几步？'))
    fireEvent.click(screen.getByText('1 步（任意方向）'))
    expect(await screen.findByText(/国王行动慢/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /下一题/ })).toBeInTheDocument()
  })

  it('shows wrong feedback with correct answer when user picks wrong', async () => {
    renderWithRouter()
    await waitFor(() => screen.getByText('国王一次能走几步？'))
    fireEvent.click(screen.getByText('2 步'))
    // Explanation still shown
    expect(await screen.findByText(/国王行动慢/)).toBeInTheDocument()
    // Some indicator of wrong + correct answer reference
    expect(screen.getByText(/正确答案/)).toBeInTheDocument()
  })

  it('submits answers and shows pass result when server confirms passed', async () => {
    ;(adventureApi.completeChallenge as any).mockResolvedValue({
      data: { data: { id: 'rec-1', status: 'passed', quiz_score: 4, passed_at: '2026-04-20T12:00:00Z' } },
    })

    renderWithRouter()
    await waitFor(() => screen.getByText('国王一次能走几步？'))

    // Answer all 5 questions (keys don't matter; we advance via "下一题")
    for (let i = 0; i < 5; i++) {
      // pick A every time
      const aBtn = screen.getAllByText(/^A/)[0] ?? screen.getAllByText('1 步（任意方向）')[0]
      fireEvent.click(aBtn)
      const nextBtn = await screen.findByRole('button', { name: /下一题|提交/ })
      fireEvent.click(nextBtn)
    }

    await waitFor(() => {
      expect(adventureApi.completeChallenge).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByText(/毕业|通过/)).toBeInTheDocument()
    })
  })

  it('shows retry result when server confirms failed', async () => {
    ;(adventureApi.completeChallenge as any).mockResolvedValue({
      data: { data: { id: 'rec-1', status: 'failed', quiz_score: 2 } },
    })

    renderWithRouter()
    await waitFor(() => screen.getByText('国王一次能走几步？'))

    for (let i = 0; i < 5; i++) {
      const aBtn = screen.getAllByText(/^A/)[0] ?? screen.getAllByText('1 步（任意方向）')[0]
      fireEvent.click(aBtn)
      const nextBtn = await screen.findByRole('button', { name: /下一题|提交/ })
      fireEvent.click(nextBtn)
    }

    await waitFor(() => {
      expect(screen.getByText(/再接再厉|未通过/)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /重新挑战/ })).toBeInTheDocument()
  })

  it('persists answers to sessionStorage on each selection', async () => {
    renderWithRouter()
    await waitFor(() => screen.getByText('国王一次能走几步？'))
    fireEvent.click(screen.getByText('1 步（任意方向）'))
    await waitFor(() => {
      const saved = sessionStorage.getItem('quiz_rec-1')
      expect(saved).toContain('"q1":"A"')
    })
  })
})
```

### - [ ] Step 7.2: 跑测试确认失败

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/frontend
npx vitest run src/pages/adventure/__tests__/QuizPage.test.tsx 2>&1 | tail -15
```

Expected: FAIL — `Cannot find module '../QuizPage'`

### - [ ] Step 7.3: 实现 QuizPage

Create `frontend/src/pages/adventure/QuizPage.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adventureApi } from '@/api/adventure'
import type { QuizBank, ChallengeRecord } from '@/types/api'
import Card from '@/components/common/Card'
import Button from '@/components/common/Button'

interface Feedback {
  correct: boolean
  answer: string
  explanation: string
}

interface QuizResult {
  score: number
  passed: boolean
  total: number
  passThreshold: number
}

const QuizPage: React.FC = () => {
  const { challengeId } = useParams<{ challengeId: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [recordId, setRecordId] = useState<string>('')
  const [bank, setBank] = useState<QuizBank | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<QuizResult | null>(null)

  // 1) 挂载：startChallenge + getQuiz
  useEffect(() => {
    if (!challengeId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErrorMsg(null)
      try {
        const [startRes, quizRes] = await Promise.all([
          adventureApi.startChallenge(challengeId),
          adventureApi.getQuiz(challengeId),
        ])
        if (cancelled) return
        const record = (startRes.data as any)?.data ?? startRes.data
        const quiz = (quizRes.data as any)?.data ?? quizRes.data
        if (!record?.id || !quiz?.questions?.length) {
          setErrorMsg('题库加载失败')
          setLoading(false)
          return
        }
        setRecordId(record.id)
        setBank(quiz)

        // Restore answers from sessionStorage if any
        const saved = sessionStorage.getItem(`quiz_${record.id}`)
        if (saved) {
          try {
            setAnswers(JSON.parse(saved))
          } catch { /* ignore corrupt */ }
        }
      } catch (err: any) {
        console.error('[QuizPage] init failed', err)
        setErrorMsg('加载失败，请返回重试')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [challengeId])

  const currentQuestion = bank?.questions[currentIdx]

  const handleSelect = useCallback((key: string) => {
    if (!currentQuestion || feedback) return  // no changes after feedback
    const correct = key === currentQuestion.answer
    const newAnswers = { ...answers, [currentQuestion.id]: key }
    setAnswers(newAnswers)
    if (recordId) sessionStorage.setItem(`quiz_${recordId}`, JSON.stringify(newAnswers))
    setFeedback({
      correct,
      answer: currentQuestion.answer,
      explanation: currentQuestion.explanation,
    })
  }, [currentQuestion, feedback, answers, recordId])

  const handleNext = useCallback(async () => {
    if (!bank) return
    setFeedback(null)
    const isLast = currentIdx >= bank.questions.length - 1
    if (!isLast) {
      setCurrentIdx(currentIdx + 1)
      return
    }
    // Submit
    setSubmitting(true)
    try {
      const res = await adventureApi.completeChallenge(challengeId!, {
        result: 'pass',  // server decides; value here is ignored
        quiz_answers: answers,
      })
      const record: ChallengeRecord = (res.data as any)?.data ?? res.data
      const passed = record.status === 'passed'
      const score = record.quiz_score ?? 0
      setResult({
        score,
        passed,
        total: bank.total_questions,
        passThreshold: bank.pass_threshold,
      })
      sessionStorage.removeItem(`quiz_${recordId}`)
    } catch (err) {
      console.error('[QuizPage] submit failed', err)
      setErrorMsg('提交失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }, [bank, currentIdx, answers, challengeId, recordId])

  const handleRetry = useCallback(() => {
    // Full retry = fresh page
    window.location.reload()
  }, [])

  const handleReturn = useCallback(() => {
    navigate('/adventure')
  }, [navigate])

  // ── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <div className="text-2xl animate-bounce mb-3">{'\u265E'}</div>
        <p className="text-[var(--text-muted)]">加载中...</p>
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-4">
        <p className="text-[var(--text-sub)]">{errorMsg}</p>
        <Button variant="secondary" onClick={handleReturn}>返回</Button>
      </div>
    )
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <Card padding="lg" hoverable={false}>
          <div className="text-center space-y-4">
            <div className="text-5xl">{result.passed ? '\uD83C\uDF89' : '\uD83D\uDE05'}</div>
            <h2 className="text-[var(--text-2xl)] font-bold text-[var(--text)]">
              {result.passed ? '启蒙草原毕业！' : '再接再厉！'}
            </h2>
            <p className="text-[var(--text-md)] text-[var(--text-sub)]">
              答对 {result.score} / {result.total} 题
              {result.passed ? '' : `（需要 ${result.passThreshold} 题才能通过）`}
            </p>
            {result.passed && (
              <div className="flex flex-col items-center gap-1 text-[var(--text-sm)] text-[var(--text-muted)]">
                <span>奖励获得：</span>
                <span>+{bank?.reward_xp ?? 0} XP · +50 金币 · 🌿 启蒙草原毕业徽章</span>
              </div>
            )}
          </div>
        </Card>
        <div className="flex gap-3">
          {!result.passed && (
            <Button variant="primary" className="flex-1" onClick={handleRetry}>
              重新挑战
            </Button>
          )}
          <Button variant={result.passed ? 'primary' : 'secondary'} className="flex-1" onClick={handleReturn}>
            返回冒险地图
          </Button>
        </div>
      </div>
    )
  }

  if (!bank || !currentQuestion) return null

  const isLast = currentIdx >= bank.questions.length - 1

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Progress */}
      <div className="flex items-center justify-between text-[var(--text-xs)] text-[var(--text-muted)]">
        <span>第 {currentIdx + 1} / {bank.total_questions} 题</span>
        <span>及格线：{bank.pass_threshold} 题</span>
      </div>

      {/* Question */}
      <Card padding="lg" hoverable={false}>
        <h3 className="text-[var(--text-lg)] font-semibold text-[var(--text)] mb-5 leading-relaxed">
          {currentQuestion.text}
        </h3>

        <div className="space-y-2">
          {currentQuestion.options.map((opt) => {
            const selected = answers[currentQuestion.id] === opt.key
            const isCorrectOpt = feedback && opt.key === feedback.answer
            const isWrongSelected = feedback && selected && !feedback.correct
            let bg = 'var(--bg)'
            let border = 'var(--border)'
            if (feedback) {
              if (isCorrectOpt) {
                bg = 'rgba(16,185,129,0.12)'
                border = 'var(--success)'
              } else if (isWrongSelected) {
                bg = 'rgba(239,68,68,0.12)'
                border = 'var(--danger)'
              }
            } else if (selected) {
              bg = 'var(--accent-light)'
              border = 'var(--accent)'
            }
            return (
              <button
                key={opt.key}
                disabled={!!feedback}
                onClick={() => handleSelect(opt.key)}
                className="w-full text-left px-4 py-3 rounded-lg transition-colors disabled:cursor-default"
                style={{
                  background: bg,
                  border: `1.5px solid ${border}`,
                }}
              >
                <span className="font-bold mr-2">{opt.key}.</span>
                {opt.text}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Feedback */}
      {feedback && (
        <Card
          padding="md"
          hoverable={false}
          style={{
            background: feedback.correct ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
          }}
        >
          <div className="space-y-2">
            <div className="font-semibold text-[var(--text)]">
              {feedback.correct ? '\u2705 答对了！' : `\u274C 答错了，正确答案是 ${feedback.answer}`}
            </div>
            <p className="text-[var(--text-sm)] text-[var(--text-sub)] leading-relaxed">
              {feedback.explanation}
            </p>
          </div>
        </Card>
      )}

      {/* Next button */}
      {feedback && (
        <Button
          variant="primary"
          className="w-full"
          loading={submitting}
          onClick={handleNext}
        >
          {isLast ? '提交' : '下一题'}
        </Button>
      )}
    </div>
  )
}

export default QuizPage
```

### - [ ] Step 7.4: 跑测试确认通过

```bash
npx vitest run src/pages/adventure/__tests__/QuizPage.test.tsx 2>&1 | tail -15
```

Expected: **6 passed**

若某些测试不稳（timing 问题），加 `await waitFor(..., { timeout: 3000 })`。

### - [ ] Step 7.5: tsc 验证

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: 无错

### - [ ] Step 7.6: 提交

```bash
git add frontend/src/pages/adventure/QuizPage.tsx frontend/src/pages/adventure/__tests__/
git commit -m "feat(frontend): QuizPage with per-question feedback and result screen"
```

---

## Task 8: 路由 + AdventureMapPage 恢复

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/adventure/AdventureMapPage.tsx`

### - [ ] Step 8.1: 加路由

在 `frontend/src/App.tsx` 的 lazy import 区加：

```tsx
const QuizPage = React.lazy(() => import('@/pages/adventure/QuizPage'))
```

然后在 Routes 里找到 adventure 相关的 Route（约 AdventureMapPage），在其后加：

```tsx
<Route path="/adventure/quiz/:challengeId" element={<SuspenseWrapper><QuizPage /></SuspenseWrapper>} />
```

### - [ ] Step 8.2: 恢复 AdventureMapPage 的 quiz 路径（撤销 commit `91f6b5b`）

在 `frontend/src/pages/adventure/AdventureMapPage.tsx` 的 `handleStartChallenge`（约 line 185）改为：

```tsx
  const handleStartChallenge = useCallback(async () => {
    if (!selectedChallenge) return
    // Already-passed quiz: button disabled in Modal, don't navigate
    if (selectedChallenge.type === 'quiz' && selectedChallenge.is_completed) return

    setStarting(true)
    try {
      if (selectedChallenge.type === 'quiz') {
        // QuizPage will call startChallenge itself — just navigate
        navigate(`/adventure/quiz/${selectedChallenge.id}`)
        return
      }
      const res = await adventureApi.startChallenge(selectedChallenge.id)
      const record = res.data?.data ?? res.data
      const gameId = record?.game_id ?? selectedChallenge.id
      if (selectedChallenge.type === 'puzzle') {
        navigate(`/puzzles/solve/${gameId}`)
      } else {
        navigate(`/play/game/${gameId}`)
      }
    } catch {
      if (selectedChallenge.type === 'puzzle') {
        navigate(`/puzzles/solve/${selectedChallenge.id}`)
      } else {
        navigate(`/play/game/local?character=douding&time=600`)
      }
    } finally {
      setStarting(false)
      setShowModal(false)
    }
  }, [selectedChallenge, navigate])
```

然后在 Modal 按钮区域（约 line 511-528）改为：

```tsx
            {/* Quiz already-passed or ready-to-attempt hint */}
            {selectedChallenge.type === 'quiz' && selectedChallenge.is_completed && (
              <div
                className="text-center text-[var(--text-xs)] rounded-lg py-2 px-3"
                style={{
                  background: 'rgba(16,185,129,0.08)',
                  color: 'var(--success)',
                }}
              >
                🌿 已通过，无需重考
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowModal(false)}
              >
                返回
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                loading={starting}
                disabled={selectedChallenge.type === 'quiz' && selectedChallenge.is_completed}
                onClick={handleStartChallenge}
              >
                {selectedChallenge.type === 'quiz' && selectedChallenge.is_completed
                  ? '已通过'
                  : selectedChallenge.type === 'quiz'
                    ? '开始答题'
                    : selectedChallenge.is_completed
                      ? '再次挑战'
                      : '开始挑战'}
              </Button>
            </div>
```

（撤销之前的"开发中"占位——那段 `type === 'quiz'` 的不带 is_completed 的 coming-soon 提示去掉）

### - [ ] Step 8.3: tsc 验证

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/frontend
npx tsc --noEmit 2>&1 | tail -5
```

Expected: 无错

### - [ ] Step 8.4: 手动 dev 冒烟（可选）

Vite 已跑着，浏览器 `/adventure` → 启蒙草原 → 草原小考 → 应能打开 Modal 看到「开始答题」按钮 → 点击跳转 `/adventure/quiz/meadow_exam` → 能看到第 1 题。

### - [ ] Step 8.5: 提交

```bash
git add frontend/src/App.tsx frontend/src/pages/adventure/AdventureMapPage.tsx
git commit -m "feat(frontend): wire /adventure/quiz/:id route and restore quiz navigation"
```

---

## Task 9: Achievement seed（线上 PG + 本地 SQLite）

**Files:**
- Modify: `backend/scripts/seed_meadow_achievement.py` (新建)

### - [ ] Step 9.1: 写 seed 脚本

Create `backend/scripts/seed_meadow_achievement.py`:

```python
"""Seed the meadow_exam_passed achievement row.

Idempotent: safe to run multiple times.
"""
import os
import sys
import uuid

# Ensure we can import from backend/app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.database import SessionLocal
from app.models.achievement import Achievement


ACHIEVEMENT = {
    "slug": "meadow_exam_passed",
    "name": "启蒙草原毕业",
    "description": "通过「草原小考」",
    "icon_key": "🌿",
    "category": "adventure",
    "condition_type": "meadow_exam_pass",
    "condition_value": 1,
    "xp_reward": 0,
    "coin_reward": 50,
    "rarity": "common",
    "sort_order": 100,
}


def main() -> None:
    db = SessionLocal()
    try:
        existing = db.execute(
            select(Achievement).where(Achievement.slug == ACHIEVEMENT["slug"])
        ).scalar_one_or_none()
        if existing:
            print(f"[seed] already exists: {existing.slug}")
            return
        row = Achievement(id=str(uuid.uuid4()), **ACHIEVEMENT)
        db.add(row)
        db.commit()
        print(f"[seed] inserted achievement: {row.slug}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
```

### - [ ] Step 9.2: 本地运行

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/backend
python3 scripts/seed_meadow_achievement.py
```

Expected: `[seed] inserted achievement: meadow_exam_passed` （或 `already exists`）

### - [ ] Step 9.3: 提交

```bash
git add backend/scripts/seed_meadow_achievement.py
git commit -m "chore(backend): seed script for meadow_exam_passed achievement"
```

---

## Task 10: Playwright E2E

**Files:**
- Create: `e2e/adventure-quiz.spec.ts`

### - [ ] Step 10.1: 先确认 student 的 meadow_exam record 状态

若 student 已有 passed record，E2E 用例 2 会失败（Modal 会显示"已通过"）。可以：
- 方案 A：重置 student 的 meadow_exam record（本地 + 线上前手动清）
- 方案 B：E2E 用 `tester/test123`（独立账号）

**本 Task 使用方案 B**：用 tester 账号，避免污染 student。

先确认 tester 存在：

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/backend
python3 -c "
from app.database import SessionLocal
from app.models.user import User
from sqlalchemy import select
db = SessionLocal()
u = db.execute(select(User).where(User.username == 'tester')).scalar_one_or_none()
print('tester exists' if u else 'tester missing')
"
```

Expected: `tester exists`

若缺，按 CLAUDE.md 的 fixture 创建（不在本 task 范围）。

### - [ ] Step 10.2: 写 E2E

Create `e2e/adventure-quiz.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'
import { login } from './helpers'

// Reset the tester's meadow_exam state once per test run (via API delete if
// available; otherwise this test assumes fresh tester)
async function resetTesterQuizState(): Promise<void> {
  // Intentionally no-op: this plan does not expose a reset endpoint.
  // If tests accumulate state between runs, manually clear tester's
  // promotion_challenges row with PG.
}

test.describe('冒险 · 草原小考', () => {
  test.beforeAll(async () => {
    await resetTesterQuizState()
  })

  test.beforeEach(async ({ page }) => {
    await login(page, 'tester', 'test123')
  })

  test('用例 1: 点进草原小考能看到第一题', async ({ page }) => {
    await page.goto('/adventure')
    // Click into meadow region (启蒙草原) if collapsed, or directly find challenge
    await page.getByRole('button', { name: /草原小考/ }).click()
    // Modal opens
    await expect(page.getByText('草原小考')).toBeVisible()
    const startBtn = page.getByRole('button', { name: /开始答题|开始挑战/ })
    await expect(startBtn).toBeEnabled()
    await startBtn.click()

    await page.waitForURL(/\/adventure\/quiz\/meadow_exam/, { timeout: 10_000 })
    await expect(page.getByText('国王一次能走几步？')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/第\s*1\s*\/\s*5\s*题/)).toBeVisible()
  })

  test('用例 2: 全对通过，结果页显示毕业', async ({ page }) => {
    await page.goto('/adventure/quiz/meadow_exam')
    await expect(page.getByText('国王一次能走几步？')).toBeVisible({ timeout: 10_000 })

    // Correct sequence: q1=A q2=D q3=C q4=B q5=A
    const answers = ['A', 'D', 'C', 'B', 'A']
    for (const ans of answers) {
      await page.locator(`button:has-text("${ans}.")`).first().click()
      const next = page.getByRole('button', { name: /下一题|提交/ })
      await expect(next).toBeVisible({ timeout: 5_000 })
      await next.click()
    }

    await expect(page.getByText(/毕业|通过/)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/5\s*\/\s*5/)).toBeVisible()
    await expect(page.getByRole('button', { name: /返回冒险地图/ })).toBeVisible()
  })

  test('用例 3: 通过后再次访问 /adventure 显示已通过', async ({ page }) => {
    // 用例 2 通过后，tester 的 record 应该是 passed
    await page.goto('/adventure')
    await page.getByRole('button', { name: /草原小考/ }).click()
    await expect(page.getByText(/已通过/)).toBeVisible({ timeout: 5_000 })
    const btn = page.getByRole('button', { name: '已通过' })
    await expect(btn).toBeDisabled()
  })
})
```

### - [ ] Step 10.3: 注册 project（参考 editor-vs-ai 模式）

在 `playwright.config.ts` 的 projects 数组末尾加：

```typescript
{
  name: 'adventure-quiz',
  testMatch: 'adventure-quiz.spec.ts',
  use: {
    ...devices['Desktop Chrome'],
    storageState: undefined,
  },
},
```

### - [ ] Step 10.4: 跑 E2E

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform
npx playwright test e2e/adventure-quiz.spec.ts --project=adventure-quiz --reporter=line
```

Expected: **3 passed**（允许 flaky retry）

**若用例 2、3 因 tester 已有 passed 记录失败**：
```bash
ssh root@118.31.237.111 "docker exec chess_edu_postgres psql -U chess -d chess_edu -c \"DELETE FROM user_achievements WHERE user_id = (SELECT id FROM users WHERE username='tester'); DELETE FROM promotion_challenges WHERE user_id = (SELECT id FROM users WHERE username='tester') AND challenge_type = 'meadow_exam';\""
# 或本地：python3 -c "... 类似 SQL ..."
```
然后重跑。

### - [ ] Step 10.5: 提交

```bash
git add e2e/adventure-quiz.spec.ts playwright.config.ts
git commit -m "test(e2e): meadow_exam quiz scenarios (entry, pass, post-pass lock)"
```

---

## Task 11: 回归 + 构建 + 部署

### - [ ] Step 11.1: 跑全量后端测试

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/backend
python3 -m pytest tests/ -v 2>&1 | tail -15
```

Expected: 新增 11 个通过（3 grant_achievement + 8 adventure_quiz）+ 原有 8 个 streak 通过 = 19 passed

### - [ ] Step 11.2: 跑全量前端 Vitest

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/frontend
npm test 2>&1 | tail -15
```

Expected: 原有 81 + 新 6 = 87 pass（加上 2 个 pre-existing 失败）

### - [ ] Step 11.3: 构建

```bash
npm run build 2>&1 | tail -5
```

Expected: vite build 成功

### - [ ] Step 11.4: 跑全量 Playwright（关注 editor-vs-ai 不破坏）

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform
npx playwright test --reporter=line 2>&1 | tail -15
```

Expected: editor-vs-ai 5 + adventure-quiz 3 + auth/pages/teacher-student（如前次已知 pre-existing failures）都应维持或更好。

### - [ ] Step 11.5: 部署前备份

```bash
TS=$(date +%Y%m%d-%H%M%S)
ssh root@118.31.237.111 "mkdir -p /opt/chess-edu/backups/deploy-$TS && cp -r /opt/chess-edu/www/domain /opt/chess-edu/backups/deploy-$TS/www-domain && rsync -a --exclude='data.db*' --exclude='__pycache__' --exclude='venv' /opt/chess-edu/backend/ /opt/chess-edu/backups/deploy-$TS/backend/ && echo backup_at=$TS"
```

### - [ ] Step 11.6: 部署前端 + 后端 + 内容（quiz JSON）

```bash
# 前端（已 build）
rsync -avz --delete /Users/wangyunchen/agents/教育教学/chess-edu-platform/frontend/dist/ root@118.31.237.111:/opt/chess-edu/www/domain/ 2>&1 | tail -5

# 后端代码
rsync -avz --exclude='data.db*' --exclude='__pycache__' --exclude='venv' --exclude='.venv' --exclude='.env' --exclude='tests' --exclude='.claude' \
  /Users/wangyunchen/agents/教育教学/chess-edu-platform/backend/ root@118.31.237.111:/opt/chess-edu/backend/ 2>&1 | tail -5

# 题库 JSON（content/quizzes/）
rsync -avz /Users/wangyunchen/agents/教育教学/chess-edu-platform/content/quizzes/ root@118.31.237.111:/opt/chess-edu/content/quizzes/ 2>&1 | tail -5
```

### - [ ] Step 11.7: 线上 seed achievement

```bash
ssh root@118.31.237.111 "cd /opt/chess-edu/backend && /opt/chess-edu/backend/venv/bin/python3 scripts/seed_meadow_achievement.py"
```

Expected: `[seed] inserted achievement: meadow_exam_passed` 或 `already exists`

### - [ ] Step 11.8: 重启 + 冒烟

```bash
ssh root@118.31.237.111 "systemctl restart chess-edu && sleep 3 && systemctl is-active chess-edu"
```

Expected: `active`

```bash
ssh root@118.31.237.111 "bash -s" <<'EOF'
TOKEN=$(curl -s -X POST http://127.0.0.1:8001/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"student","password":"123456"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['access_token'])")

echo "--- GET /adventure/quiz/meadow_exam ---"
curl -s http://127.0.0.1:8001/api/v1/adventure/quiz/meadow_exam -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('pt=', d['pass_threshold'], 'qn=', len(d['questions']), 'a1=', d['questions'][0]['answer'])"
EOF
```

Expected: `pt= 3 qn= 5 a1= A`

### - [ ] Step 11.9: UI 冒烟（用户实机）

通知用户：
1. 登录 https://chess.ccwu.cc
2. 进 `/adventure` → 启蒙草原 → 草原小考
3. 点开 Modal → 按钮「开始答题」
4. 答 5 题 → 看结果

### - [ ] Step 11.10: 写测试报告 + 提交

Create `docs/superpowers/plans/2026-04-20-meadow-exam-quiz-test-report.md`:

按 editor-vs-ai 测试报告格式写（commit list、各层测试结果、bug 列表、已知问题、部署记录）。

```bash
git add docs/superpowers/plans/2026-04-20-meadow-exam-quiz-test-report.md
git commit -m "docs: test report for meadow_exam quiz feature"
```

---

## 回顾 · 改动清单

| 文件 | 行数 |
|---|---|
| `content/quizzes/meadow_exam.json` | ~60 |
| `backend/app/services/gamification_service.py` | ~45 |
| `backend/app/services/adventure_service.py` | ~60（新增 quiz 分支 + helper）|
| `backend/app/schemas/adventure.py` | ~20 |
| `backend/app/routers/adventure.py` | ~20 |
| `backend/scripts/seed_meadow_achievement.py` | ~40 |
| `backend/tests/test_grant_achievement.py` | ~90 |
| `backend/tests/test_adventure_quiz.py` | ~180 |
| `frontend/src/types/api.ts` | ~20 |
| `frontend/src/api/adventure.ts` | ~3 |
| `frontend/src/pages/adventure/QuizPage.tsx` | ~240 |
| `frontend/src/pages/adventure/__tests__/QuizPage.test.tsx` | ~150 |
| `frontend/src/pages/adventure/AdventureMapPage.tsx` | ~35（修改）|
| `frontend/src/App.tsx` | ~2 |
| `e2e/adventure-quiz.spec.ts` | ~70 |
| `playwright.config.ts` | ~7 |
| **合计** | **~1042 行** |

**无 DB migration**；有 1 行 achievement seed。

---

## 风险清单

- 服务端判分有效但**前端知道答案**（Q5A）— 接受
- `tester` 账号若已通过会导致 E2E 失败，需手动清 DB（Task 10.4 脚本）
- `_QUIZ_BANK_CACHE` 进程级缓存，题库更新后需重启才生效（OK，部署时必然重启）
- AdventureMapPage Modal 按钮文案多种分支，容易漏改——已在 Task 8 写出完整文案表
- achievement seed 是独立脚本，未纳入 `import_content.py`——后续如有类似成就可考虑合并

---

## 回滚预案

- 后端：恢复 `/opt/chess-edu/backups/deploy-<ts>/backend`
- 前端：恢复 `www-domain`
- 题库：保留 `content/quizzes/`（即使回滚 service 代码，JSON 不执行无害）
- 成就 seed：可以留着，不依赖 service 代码
