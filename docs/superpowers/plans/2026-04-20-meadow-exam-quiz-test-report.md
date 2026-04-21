# 冒险 · 草原小考 · 测试报告

- 日期：2026-04-21
- 分支：`master`
- 设计：[docs/superpowers/specs/2026-04-20-meadow-exam-quiz-design.md](../specs/2026-04-20-meadow-exam-quiz-design.md)
- 计划：[docs/superpowers/plans/2026-04-20-meadow-exam-quiz.md](2026-04-20-meadow-exam-quiz.md)

## 1. 功能概述

冒险模块「启蒙草原 · 草原小考」新增答题功能：5 道国际象棋基础单选题（国王走法/棋子价值/皇后走法/兵走法/将军定义），答对 ≥3/5 通过。通过奖励 100 XP + 「启蒙草原毕业」成就（+50 金币）。答题过程逐题即时反馈对错 + 解析；通过后封存按钮显示「已通过」。

## 2. 本次交付 Commits

```
7cdee09 test(e2e): meadow_exam quiz scenarios (entry, pass, post-pass lock)
d85b816 chore(backend): seed script for meadow_exam_passed achievement
7f483c4 feat(frontend): wire /adventure/quiz/:id route and restore quiz navigation
ba34c89 feat(frontend): QuizPage with per-question feedback and result screen
dcc4405 feat(frontend): QuizBank type and getQuiz API method
6a3e502 feat(backend): server-side quiz scoring in complete_challenge with reward triggers
285c2cd feat(backend): GET /adventure/quiz/{id} endpoint with answers + explanations
2b423f3 feat(backend): lazy-load quiz bank from content/quizzes/*.json
021c444 feat(backend): add grant_achievement_by_slug for event-triggered unlock
efe3314 content: add meadow_exam quiz bank (5 basic chess questions)
e391ebd docs: implementation plan for meadow_exam quiz feature
eaa37a5 docs: design spec for meadow_exam quiz feature
```

12 个提交（2 docs + 10 实现）。

## 3. 测试结果

### 3.1 新增后端 pytest（2 个文件，11 个用例）

- `tests/test_grant_achievement.py`: **3/3 pass**
- `tests/test_adventure_quiz.py`: **8/8 pass**

### 3.2 全量后端 pytest

```
19 passed in 0.35s
  - 3 grant_achievement（新）
  - 8 adventure_quiz（新）
  - 8 streak_service（上次 PR）
```

### 3.3 新增前端 Vitest

- `QuizPage.test.tsx`: **6/6 pass**

### 3.4 全量前端 Vitest

```
Test Files  2 failed | 5 passed (7)
Tests  2 failed | 87 passed (89)
```

**新增贡献：** editorFen 9 + useAiOpponent 4 + QuizPage 6 = 19 新测试全部通过

**Pre-existing 失败（非本 PR 引入）：**
- `src/engine/__tests__/PlayStyleController.test.ts`
- `src/engine/__tests__/ReviewAnalyzer.test.ts`

### 3.5 E2E editor-vs-ai + adventure-quiz 单独跑

- `e2e/editor-vs-ai.spec.ts`: 5/5（16.4s，上次验证）
- `e2e/adventure-quiz.spec.ts`: **3/3 pass (18.6s)**

### 3.6 E2E 全量回归

```
20 passed, 9 failed (18.3m)
```

**失败分类**（0 个功能 bug）：

| 分类 | 数量 | 原因 |
|---|---|---|
| editor-vs-ai（用例 1/2/3/5） | 4 | Rate limit 累积（`default_rpm=100`，和 adventure-quiz 并行触发 429）。单独跑 5/5 pass。|
| adventure-quiz（用例 1） | 1 | 同 rate limit。单独跑 3/3 pass。|
| auth teacher、teacher-student 3 个 | 3 | teacher 账号 pre-existing（上次 PR 测试报告已记录）|
| pages 课后练习 tab | 1 | pre-existing |

**结论**：新增 E2E（5+3）在独立运行时全部 pass；全量回归的 5 条编辑器 + quiz 失败是 backend rate limit 累积问题，**非功能 bug**。

### 3.7 构建

```
✓ built in 1.64s
```

tsc 严格模式 + Vite 生产构建通过。`dist/assets/index-BhHPmj9Z.js` 296.86 kB (gzip 96.53 kB)。

### 3.8 后端冒烟

```
python3 -c "from app.main import app; print('ok')"
ok
```

## 4. 发现并修复的 Bug

### Bug 1：`scalar_one_or_none` MultipleResultsFound（pre-existing race）

- **症状**：E2E 跑用例 2 时后端返 500，trace 显示 `MultipleResultsFound`
- **根因**：`start_challenge` 和 `complete_challenge` 查找 pending record 时用 `scalar_one_or_none`，React StrictMode 下 `useEffect` 双挂载会让 QuizPage 调用两次 `startChallenge`，并发下各建一条 pending record，导致后续查找报错
- **修复**（commit `7cdee09`）：两处改为 `scalars().first()`，容忍多条重复 pending（取任一更新即可）
- **影响**：修前 quiz 无法在 strict mode 或任何高并发场景下正常工作；这也会影响 battle 类挑战的重复 start

### Bug 2（上次 PR 已修 · 本次 PR 前提）

对 `type=quiz` 的 challenge 之前直接 navigate `/puzzles/solve/:id` → puzzle API 404 → "谜题加载失败"。上次 commit `91f6b5b` 暂禁用按钮显示"开发中"。本次 Q8 commit `7f483c4` 正式恢复为 `/adventure/quiz/:id` 路由。

## 5. 未入 Git 的本地环境项

```
?? backend/data.db.local_backup
?? backend/data.db.local_backup-shm
?? backend/data.db.local_backup-wal
?? backend/.claude/
```

均为本地 SQLite 备份 + 工具配置，按约定不入库。

## 6. 待处理 follow-ups

### 部署前

- [x] 后端 bug 已修（`scalar_one_or_none` → `scalars().first()`）
- [ ] 线上 PG 执行 seed 脚本 `scripts/seed_meadow_achievement.py` 插入成就记录（Q11 Step 11.7）
- [ ] rsync content/quizzes/ 到线上（题库 JSON）

### 部署后可做

- 未来给森林/高原/深渊 region 加 quiz（题库扩展：再建 `content/quizzes/<region>_exam.json`，前端无需改动）
- PromotionChallenge 表可以加 unique partial index（`user_id + challenge_type` where `status='pending'`）从 DB 层防止重复 pending（更根治的修复）

## 7. 部署核对清单

### 数据
- **无 DB migration**（复用 `promotion_challenges` + `achievements` 表）
- **seed 数据**：需在线上 PG 执行一次 `python3 scripts/seed_meadow_achievement.py`

### 部署步骤
1. 备份 `/opt/chess-edu/www/domain` + `/opt/chess-edu/backend`
2. `cd frontend && npm run build`（dist 已 ready）
3. `rsync -avz --delete frontend/dist/ server:/opt/chess-edu/www/domain/`
4. `rsync -avz --exclude=... backend/ server:/opt/chess-edu/backend/`
5. `rsync -avz content/quizzes/ server:/opt/chess-edu/content/quizzes/`
6. `ssh server 'cd /opt/chess-edu/backend && venv/bin/python3 scripts/seed_meadow_achievement.py'`
7. `ssh server 'systemctl restart chess-edu'`

### 上线冒烟
1. 登录 https://chess.ccwu.cc
2. 进 `/adventure` → 启蒙草原 → 草原小考 → 按钮「开始答题」
3. 点击 → `/adventure/quiz/meadow_exam` → 第 1 题渲染
4. 逐题答对 → 结果页「启蒙草原毕业」
5. 查 PG：`user_achievements` 新增一行、`promotion_challenges` 有 passed 记录、`user_ratings` coins +50、xp +100

### 回滚预案
- 服务端 `git checkout <prev-sha>` + rebuild rsync
- 成就 seed 留着不回滚（独立数据，下次功能也会用）
