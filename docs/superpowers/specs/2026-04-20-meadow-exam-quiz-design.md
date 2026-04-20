# 冒险 · 草原小考（Quiz 功能）· 设计文档

- 状态：已评审（设计阶段）
- 日期：2026-04-20
- 来源：用户修 bug 时发现"草原小考"点进去报「谜题加载失败」——实际是功能未做完（type='quiz' 的 challenge 没对应页面）。上一个 commit `91f6b5b` 先把按钮禁用、显示"开发中"占位。本 spec 正式实现该功能。

## 1. 背景与目标

### 现状
- `adventure_service.py` REGIONS 里有 `meadow_exam`（type=quiz）challenge，但前端把它路由到 `/puzzles/solve/...` 而 puzzle API 找不到 `meadow_exam` → 404 → 报错
- `PromotionChallenge` 表里已有 `quiz_answers` / `quiz_score` 字段，说明后端早先已考虑 quiz，但没下发题目、没判分、没有专门 UI

### 目标
- 用户在启蒙草原点「草原小考」能做一份 5 道棋类基础单选题
- 答对 ≥3 题算通过，奖励 100 XP + 成就「启蒙草原毕业」+ 50 金币
- 通过即封存，不可重做（Q8B）

### 非目标
- 不做森林/高原/深渊等其他 region 的 quiz（留到后续 sprint 扩展；但数据结构要支持）
- 不做题库随机抽选、多套题
- 不做时间限制、难度动态调整

## 2. 需求决策摘要

| 维度 | 决策 |
|---|---|
| 题库位置 | 新建 `content/quizzes/meadow_exam.json`（可扩展，命名按 challenge_id）|
| 题目数量/类型 | 5 道单选 4 选 1 |
| 及格线 | 3/5（60%，儿童鼓励）|
| 答题交互 | 一次 1 题，**前端本地判对错**，立即展示解析，答完 5 题统一提交 |
| 题目 DTO | 含 answer + explanation（接受前端看到答案的作弊风险；儿童产品不值防作弊复杂度）|
| 服务端判分 | **后端独立判分，不信前端送的 quiz_score**（权威性）|
| 路由 | 新增 `/adventure/quiz/:challengeId` |
| 后端 endpoint | **不新增** — 题目随 `/adventure/regions` 下发；提交用既有 `start_challenge` + `update_challenge`（补 `quiz_answers` 入参）|
| 重考 | 通过前无限次重来；通过后封存（按钮禁用）|
| 奖励 | 100 XP（现有 `reward_xp`）+ 新成就 `meadow_exam_passed`（+50 金币）|

## 3. 架构

### 3.1 改动列表

| 文件 | 动作 | 责任 |
|---|---|---|
| `content/quizzes/meadow_exam.json` | 新建 | 5 道题 + 及格线 + 奖励关联 |
| `backend/app/services/adventure_service.py` | 修改 | `_load_quiz()` JSON lazy 加载 + cache；列 regions 时 quiz 类型附 `quiz` 字段（题目+答案+解析都下发）；`update_challenge` 接 `quiz_answers` 参数，服务端判分、奖励发放、passed 状态更新 |
| `backend/app/routers/adventure.py` | 修改 | `update_challenge` POST body 新增 `quiz_answers: dict` 字段（schema 层）|
| `backend/app/schemas/adventure.py` | 修改或新建 | `UpdateChallengeRequest` 加 `quiz_answers` 字段 |
| `backend/app/services/gamification_service.py` | 修改 | 复用 `award_xp(db, user_id, amount, reason)`；新增 `grant_achievement_by_slug(db, user_id, slug)` 手动解锁成就并发奖（当前 `check_achievements` 是被动扫描，不适合事件触发）|
| `backend/scripts/import_content.py` 或 SQL seed | 修改 | 新增 `meadow_exam_passed` achievement 一行：`slug='meadow_exam_passed'`, `name='启蒙草原毕业'`, `icon_key='🌿'`, `category='adventure'`, `condition_type='meadow_exam_pass'`（自定义 type，保证 `check_achievements` 被动扫描不会匹配）, `condition_value=1`, `xp_reward=0`, `coin_reward=50` |
| `frontend/src/pages/adventure/QuizPage.tsx` | 新建 | 答题 UI + 逐题反馈 + 结果页 |
| `frontend/src/pages/adventure/AdventureMapPage.tsx` | 修改 | 恢复 quiz 类型 navigate `/adventure/quiz/:id`（撤销 91f6b5b 的禁用）；若 challenge 已 passed 显示"已通过"按钮禁用 |
| `frontend/src/App.tsx` | 修改 | 加 Route `/adventure/quiz/:id` → QuizPage |
| `frontend/src/api/adventure.ts` | 修改 | `updateChallenge(id, body)` 支持 `quiz_answers` |
| `frontend/src/types/api.ts` | 修改 | Challenge 类型加 `quiz?: {...}` 结构 |
| `backend/tests/test_adventure_quiz.py` | 新建 | 8 个单测（见 § 7）|
| `frontend/src/pages/adventure/__tests__/QuizPage.test.tsx` | 新建 | 6 个 Vitest |
| `e2e/adventure-quiz.spec.ts` | 新建 | 3 个 Playwright 用例 |

### 3.2 无 DB 迁移

复用 `promotion_challenges` 表（`quiz_answers` / `quiz_score` / `passed_at` 已存在）。新成就走 `achievements` 表现有结构，只加一行 seed。

## 4. 组件细节

### 4.1 `content/quizzes/meadow_exam.json`

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

### 4.2 后端 `adventure_service.py`

```python
import json
from pathlib import Path

_QUIZ_BANK_CACHE: dict[str, dict] = {}

def _load_quiz(challenge_id: str) -> Optional[dict]:
    """Lazy-load quiz bank JSON; cache in process."""
    if challenge_id in _QUIZ_BANK_CACHE:
        return _QUIZ_BANK_CACHE[challenge_id]
    # content/quizzes/<challenge_id>.json
    path = Path(__file__).resolve().parents[3] / 'content' / 'quizzes' / f'{challenge_id}.json'
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        _QUIZ_BANK_CACHE[challenge_id] = data
        return data
    except Exception as e:
        logger.warning(f"load quiz {challenge_id} failed: {e}")
        return None
```

**列 regions 响应**（现有 `get_regions_with_status` 或类似）：对 `ch['type'] == 'quiz'` 的 challenge，追加 `quiz` 字段：

```python
if ch['type'] == 'quiz':
    bank = _load_quiz(ch['id'])
    if bank:
        challenge_dto['quiz'] = {
            'pass_threshold': bank['pass_threshold'],
            'total_questions': bank['total_questions'],
            'questions': bank['questions'],  # 含 answer + explanation（Q5A 决策）
        }
    else:
        challenge_dto['quiz'] = None  # 前端据此禁用按钮显示"题库加载失败"
```

**`update_challenge` 扩展**（`quiz_answers` 入参优先级最高）：

```python
def update_challenge(
    db: Session,
    record_id: str,
    user_id: str,
    game_id: Optional[str] = None,
    quiz_answers: Optional[dict] = None,
    quiz_score: Optional[int] = None,  # 保留旧签名但忽略，服务端独立判分
) -> Optional[ChallengeRecord]:
    record = db.execute(
        select(PromotionChallenge).where(
            PromotionChallenge.id == record_id,
            PromotionChallenge.user_id == user_id,
        )
    ).scalar_one_or_none()
    if record is None:
        return None

    # ... existing game_id logic ...

    if quiz_answers is not None:
        bank = _load_quiz(record.challenge_type)
        if bank:
            # 服务端判分
            score = sum(
                1 for q in bank['questions']
                if quiz_answers.get(q['id']) == q['answer']
            )
            record.quiz_answers = quiz_answers
            record.quiz_score = score
            # 首次通过
            if (
                score >= bank['pass_threshold']
                and record.status != 'passed'
            ):
                record.status = 'passed'
                record.passed_at = datetime.now(timezone.utc)
                # 奖励发放（try/except 吞错，不影响主流程）
                try:
                    from app.services.gamification_service import award_xp
                    award_xp(db, user_id, bank['reward_xp'], reason='meadow_exam_passed')
                except Exception as e:
                    logger.warning(f"award_xp failed for {user_id}: {e}")
                try:
                    from app.services.gamification_service import grant_achievement_by_slug
                    grant_achievement_by_slug(db, user_id, bank['passed_achievement_slug'])
                except Exception as e:
                    logger.warning(f"grant_achievement failed: {e}")

    db.commit()
    return _to_challenge_record(record)
```

### 4.3 `gamification_service.py` 新增 `grant_achievement_by_slug`

项目里已有被动扫描式 `check_achievements(db, user_id)`，但不适合"事件触发解锁"场景。新增事件触发版本：

```python
def grant_achievement_by_slug(db: Session, user_id: str, slug: str) -> bool:
    """Grant a specific achievement by slug (event-triggered).

    Idempotent: returns False if already unlocked or slug not found.
    Awards both xp_reward (via award_xp) and coin_reward (directly
    onto user_ratings.coins, matching existing check_achievements
    convention at gamification_service.py:467-469).
    """
    from app.models.achievement import Achievement, UserAchievement
    from app.models.user_rating import UserRating

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

**奖励分工**（避免重复发）：
- Quiz 通过一次性 XP 奖励（100）→ 来自 JSON 的 `reward_xp`，由 `update_challenge` 直接调 `award_xp(100, reason='meadow_exam_passed')`
- Quiz 通过触发的成就奖励（50 金币）→ 来自成就的 `coin_reward=50`，成就的 `xp_reward=0`（避免和上面重复）

### 4.4 前端 `QuizPage.tsx`

```tsx
const QuizPage: React.FC = () => {
  const { challengeId } = useParams<{ challengeId: string }>()
  const navigate = useNavigate()
  const [recordId, setRecordId] = useState<string>('')
  const [quizData, setQuizData] = useState<QuizBank | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [feedback, setFeedback] = useState<{correct: boolean; explanation: string; answer: string} | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{score: number; passed: boolean} | null>(null)

  // 1) 挂载：startChallenge 拿 record_id + 从 regions 取 quiz 数据
  useEffect(() => {
    if (!challengeId) return
    (async () => {
      const startRes = await adventureApi.startChallenge(challengeId)
      const record = startRes.data?.data ?? startRes.data
      setRecordId(record.id)
      // 从 regions 取 quiz
      const regionsRes = await adventureApi.getRegions()
      const regions = regionsRes.data?.data ?? regionsRes.data ?? []
      let quiz = null
      for (const r of regions) {
        for (const ch of (r.challenges ?? [])) {
          if (ch.id === challengeId) { quiz = ch.quiz; break }
        }
      }
      if (!quiz) {
        toast('题库加载失败，请稍后再试')
        navigate('/adventure')
        return
      }
      setQuizData(quiz)
      // 断点恢复：sessionStorage 读 answers
      const saved = sessionStorage.getItem(`quiz_${record.id}`)
      if (saved) setAnswers(JSON.parse(saved))
    })()
  }, [challengeId])

  const handleSelect = useCallback((key: string) => {
    if (!quizData || feedback) return  // 已反馈后不能改
    const q = quizData.questions[currentIdx]
    const correct = key === q.answer
    const newAnswers = { ...answers, [q.id]: key }
    setAnswers(newAnswers)
    sessionStorage.setItem(`quiz_${recordId}`, JSON.stringify(newAnswers))
    setFeedback({ correct, explanation: q.explanation, answer: q.answer })
  }, [quizData, currentIdx, answers, feedback, recordId])

  const handleNext = useCallback(async () => {
    if (!quizData) return
    setFeedback(null)
    if (currentIdx < quizData.questions.length - 1) {
      setCurrentIdx(currentIdx + 1)
    } else {
      // 提交
      setSubmitting(true)
      try {
        const res = await adventureApi.updateChallenge(recordId, { quiz_answers: answers })
        const record = res.data?.data ?? res.data
        setResult({
          score: record.quiz_score,
          passed: record.status === 'passed',
        })
        sessionStorage.removeItem(`quiz_${recordId}`)
      } catch {
        toast('提交失败，请重试')
      } finally {
        setSubmitting(false)
      }
    }
  }, [quizData, currentIdx, recordId, answers])

  // ... render: 题目 / 选项 / feedback / 结果页
}
```

### 4.5 `AdventureMapPage.tsx` 恢复 quiz 路由

撤销 commit `91f6b5b` 里对 quiz 的禁用（保留 quiz→`/adventure/quiz/` navigate）。但对已 passed 的 challenge，Modal 仍显示"已通过"+按钮禁用（从 `selectedChallenge.is_completed` 判断）。

实际代码：
```tsx
const handleStartChallenge = useCallback(async () => {
  if (!selectedChallenge) return
  if (selectedChallenge.is_completed && selectedChallenge.type === 'quiz') {
    // Q8B: 通过后封存
    return
  }
  setStarting(true)
  try {
    // ...
    if (selectedChallenge.type === 'quiz') {
      navigate(`/adventure/quiz/${selectedChallenge.id}`)
    } else if (selectedChallenge.type === 'puzzle') {
      // ...
    }
  }
}, [...])
```

Modal 按钮文案：
- `is_completed && type=='quiz'` → "已通过" + 禁用
- `!is_completed && type=='quiz'` → "开始答题"
- 其他 type 保持不变

## 5. 数据流

```
用户点「草原小考」
  AdventureMapPage.handleStartChallenge
    if is_completed → 按钮禁用不动
    else → navigate('/adventure/quiz/meadow_exam')

QuizPage 挂载
  POST /adventure/challenges/meadow_exam/start → { record_id }
  GET /adventure/regions → 取 challenge.quiz
  render 第 1 题

用户选 A → feedback 显示 ✓/✗ + 解析
用户点"下一题" → idx+1 → render 第 2 题
... 第 5 题 ...
用户选完 → 点"提交"
  POST /adventure/challenges/{record_id}/update { quiz_answers: {q1:..,q5:..} }
    服务端判分 → quiz_score=X
    if X >= 3 and status != 'passed':
      status='passed'
      passed_at=now
      add_xp(100)
      grant_achievement('meadow_exam_passed') → +50 coin
  ← { quiz_score: 4, status: 'passed', passed_at: '...' }

result 页
  通过：🎉 "启蒙草原毕业" + 4/5 + 奖励列表 + 返回按钮
  未通过：😅 + 2/5 + "重新挑战"（navigate(0) 刷新） / "返回"
```

## 6. 错误处理

| 场景 | 行为 |
|---|---|
| `content/quizzes/meadow_exam.json` 缺失 | `_load_quiz` 返 None → regions 响应里 `quiz: null` → 前端 Modal "题库加载失败"禁用按钮 |
| `update_challenge` 传 `quiz_answers` 但 bank 为 null | 记 warning；不判分；return 原 record |
| `quiz_answers` key 不在 A-D 或 q.id 不存在 | 该题视为错答（不加分）；不抛错 |
| 已 passed 重提交 | 不再次更新 passed_at，不再发奖励；前端 Modal 已禁用按钮 |
| `add_xp` / `grant_achievement` 抛错 | try/except + log；**不回滚 status/score**（避免用户通过却没拿奖却又不能重考的死锁）|
| 刷新中途 | sessionStorage 恢复 answers，current idx 不保留从 0 开始（可接受——答案已记录，重新翻到已答的题会有 feedback）|
| 前端作弊直接 POST 答案 | 接受（Q5A 决策）；服务端判分不信前端送的 score |

## 7. 测试策略

### 7.1 后端 pytest（`test_adventure_quiz.py`，8 用例）

1. `_load_quiz('meadow_exam')` 返回含 5 题 + pass_threshold=3
2. `update_challenge` 传 5 全对 → score=5, status='passed', passed_at 有值
3. 传 3 对 2 错 → score=3, status='passed'（恰好及格）
4. 传 2 对 3 错 → score=2, status='pending'，不发奖励
5. 已 passed 再提交（且分数更高）→ passed_at **不覆盖**，不再次发奖（幂等）
6. `quiz_answers = {q1:'A', q3:'C'}` 缺 q2/q4/q5 → score=2（只算答了的）
7. quiz bank 不存在时 → record.quiz_score 保持原值（不崩）
8. `add_xp` 抛错 → score/status 仍正确保存，log 有 warning

### 7.2 前端 Vitest（`QuizPage.test.tsx`，6 用例）

1. 渲染第一题 + 4 选项
2. 点对 → 显示 ✓ + 解析 + "下一题"
3. 点错 → 显示 ✗ + 正确答案 + 解析
4. 5 题答完 → 自动 POST `updateChallenge` with 5 个 answers
5. mock 服务端返 `passed=true, score=4` → 显示「启蒙草原毕业」庆祝 + 返回按钮
6. mock 返 `passed=false, score=2` → 显示重新挑战 + 返回

### 7.3 Playwright E2E（`adventure-quiz.spec.ts`，3 用例）

1. 登录 → `/adventure` → 启蒙草原 → 点「草原小考」→ Modal "开始挑战" → 跳 `/adventure/quiz/meadow_exam`
2. 选 A(q1正确) → D(q2正确) → C(q3正确) → B(q4正确) → A(q5正确) → 结果 "5/5 毕业" + 返回按钮 → 点返回 → `/adventure`
3. 回到冒险地图 → 再点「草原小考」→ Modal "已通过" 按钮禁用

### 7.4 回归

- 既有 editor-vs-ai 5/5 E2E
- Vitest editorFen 9/9 + useAiOpponent 4/4 + streak_service 8/8
- tsc + vite build

### 7.5 TDD 顺序

1. 题库 JSON（无测试，纯内容）
2. 后端单测（失败）→ 后端实现 → 单测通过
3. 前端 Vitest（失败）→ QuizPage 实现 → 通过
4. AdventureMapPage quiz 恢复 navigate
5. Playwright E2E 失败 → 整合测试通过
6. 回归 + 构建
7. Code review
8. 部署

## 8. 部署

- **无 DB migration**（复用既有 `promotion_challenges` + `achievements` 表）
- **有 seed 数据**：`meadow_exam_passed` 成就记录。部署时要确认线上 `achievements` 表有这行，可以通过运行 `python scripts/import_content.py` 或者单独 SQL INSERT
- rsync backend + frontend/dist
- `systemctl restart chess-edu`
- 冒烟：登录 → `/adventure` → 草原小考 → 答题 → 提交 → 查 PG `promotion_challenges` + `user_achievements` 有记录

## 9. 风险

- 题目含 answer + explanation 下发 → 前端可作弊（接受风险，Q5A）
- `achievement_service` / `add_xp` 若项目里命名/签名不一致，实现时需现场调整，可能增加工时
- 后端`update_challenge` 原有签名加入 `quiz_answers` 可能影响既有调用者——需审阅所有调用点
- 前端 `/adventure/regions` 响应体变大（quiz 题目 5 题 × 4 region 可扩展）——目前 1 region × 5 题 ~2KB，可忽略
