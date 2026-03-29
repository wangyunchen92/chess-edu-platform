# API Compatibility Report - Frontend vs Backend

**Date**: 2026-03-28
**Test Environment**: Backend at http://localhost:8001
**Test Account**: student / 123456

> All backend APIs return a standard wrapper: `{ code: 0, message: "success", data: ... }`
> Axios client returns full response, so frontend accesses `res.data` = the JSON body.
> Therefore `res.data.data` = the actual payload.

---

## 1. DashboardPage -> GET /api/v1/dashboard

- **Frontend file**: `src/pages/dashboard/DashboardPage.tsx`
- **Frontend take method**: `res.data` -> `parseDashboardResponse()` which checks for `res.data.data` wrapper and looks for `trainProgress`, `xp`, `weekStats` fields
- **API actual format**:
  ```json
  {
    "code": 0,
    "data": {
      "train_progress": { "total_items": 3, "completed_items": 0, "is_completed": false },
      "rating": { "game_rating": 300, "puzzle_rating": 300, "rank_title": "...", "rank_region": "..." },
      "xp_today": 0, "xp_total": 0, "level": 1, "streak": 0,
      "recent_games": [], "daily_puzzles_remaining": 3, "unread_notifications": 0
    }
  }
  ```
- **Frontend expected fields**: `trainProgress`, `xp { current, target, level }`, `streak`, `rating` (number), `recentGames`, `weekStats`, `recommendations`
- **Match status**: MISMATCH

### Issues:
1. `trainProgress` vs `train_progress` (camelCase vs snake_case) - `parseDashboardResponse` looks for `trainProgress`, API returns `train_progress`
2. `xp { current, target, level }` vs `{ xp_today, xp_total, level, ... }` - completely different structure
3. `rating` expected as number, API returns object `{ game_rating, puzzle_rating, rank_title, rank_region }`
4. `recentGames` with `{ id, opponent, result, ratingChange }` vs `recent_games` (snake_case, and field structure unknown for non-empty state)
5. `weekStats { games, winRate, puzzles, learnMinutes }` - NOT returned by API at all
6. `recommendations` array - NOT returned by API at all
7. **Result**: `parseDashboardResponse` returns `null`, falls back to MOCK with user rating - page works but shows fake data

---

## 2. CharacterHallPage -> GET /api/v1/play/characters

- **Frontend file**: `src/pages/play/CharacterHallPage.tsx`
- **Frontend take method**: Unwraps `res.data.data`, expects flat array
- **API actual format**:
  ```json
  {
    "code": 0,
    "data": [
      { "id": "douding", "slug": "douding", "name": "...", "tier": "beginner",
        "base_rating": 500, "is_free": true, "is_unlocked": true, "stats": null, ... }
    ]
  }
  ```
- **Frontend expected fields**: `id`, `slug`, `name`, `tier`, `base_rating`, `is_unlocked`, `stats.wins/losses/draws`, `styleWeights`
- **Match status**: MOSTLY OK (recently fixed)

### Issues:
1. `styleWeights` - API does NOT return this field. Frontend defaults to `{ attack: 0.25, defense: 0.25, tactics: 0.25, positional: 0.25 }` - OK fallback
2. `stats` is `null` from API - frontend safely uses `c.stats?.wins ?? 0` - OK
3. `tier` field: API returns `beginner`, `beginner_plus`, `intermediate` - frontend TIER_INFO only maps `beginner`, `intermediate`, `advanced`, `expert` - `beginner_plus` falls back to raw string display for title/subtitle. Minor issue.

---

## 3. GamePage -> POST /api/v1/play/games + PUT complete

- **Frontend file**: `src/pages/play/GamePage.tsx`
- **Frontend take method**: `res.data?.id` from createGame response
- **Match status**: OK (with caveats)

### Notes:
- Game is played locally with chess.js engine, not via API moves
- `createGame` response likely returns `{ code: 0, data: { id: "..." } }`, frontend accesses `res.data?.id` which would be undefined (should be `res.data?.data?.id` or `res.data.id`)
- However, fallback navigates with local params, so game still works
- `completeGame` sends data after game ends - format not verified but has try/catch

### Issue:
1. `res.data?.id` should be `res.data?.data?.id` to get game ID from standard wrapper - minor, has fallback

---

## 4. GameHistoryPage -> GET /api/v1/play/games

- **Frontend file**: `src/pages/play/GameHistoryPage.tsx`
- **Frontend take method**: `res.data?.data ?? res.data` -> expects array or `{ items: [...] }`
- **API actual format**:
  ```json
  {
    "code": 0,
    "data": {
      "items": [],
      "total": 0, "page": 1, "page_size": 20, "total_pages": 0
    }
  }
  ```
- **Match status**: OK

### Analysis:
- Frontend: `const payload = res.data?.data ?? res.data` -> gets `{ items: [], total: 0, ... }`
- Then: `const items = Array.isArray(payload) ? payload : (payload?.items ?? [])` -> gets `items` array
- Unwrap logic correctly handles the nested format.

### Potential Issue:
1. Frontend `GameRecord` interface expects `opponent`, `opponent_emoji`, `result`, `rating_change`, `date`, `total_moves`, `time_control` - cannot verify field names with empty data. If API uses snake_case for game records, `rating_change` matches; but `opponent_emoji` is uncertain.

---

## 5. ReviewPage -> GET /api/v1/play/games/{id}/review

- **Frontend file**: `src/pages/play/ReviewPage.tsx`
- **Frontend take method**: `res.data` directly (no unwrap of `.data.data`)
- **API actual format**: Returns `{ code: 0, data: { ... } }` (404 for non-existent game)
- **Match status**: MISMATCH

### Issues:
1. Frontend does `setReview(res.data)` - this sets review to `{ code: 0, message: "success", data: { ... } }` instead of the actual review data
2. Should be `setReview(res.data.data)` or `setReview(res.data?.data ?? res.data)`
3. Frontend expects `ReviewData { id, white, black, result, moves: ReviewMove[], summary }` - when data is `{ code: 0, ... }`, `review.moves` will be undefined, causing the page to show "no data" or crash
4. Falls back to mock data on error, so the page still works in development

---

## 6. PuzzlesHomePage -> GET /api/v1/puzzles/stats + GET /api/v1/puzzles/challenge/progress

- **Frontend file**: `src/pages/puzzles/PuzzlesHomePage.tsx`

### 6a. GET /api/v1/puzzles/stats
- **Frontend take method**: `res.data?.data ?? res.data` -> reads `puzzle_rating`, `total_correct`, `accuracy_pct`, `streak`
- **API actual format**:
  ```json
  {
    "code": 0,
    "data": {
      "puzzle_rating": 300, "total_attempted": 0, "total_correct": 0,
      "accuracy_pct": 0.0, "daily_attempted_today": 0,
      "challenge_progress": [...]
    }
  }
  ```
- **Match status**: OK
- Frontend correctly maps: `puzzle_rating` -> `puzzleRating`, `total_correct` -> `totalSolved`, `accuracy_pct` -> `accuracy`
- **Issue**: `streak` field NOT returned by API. Defaults to 0 - acceptable.

### 6b. GET /api/v1/puzzles/challenge/progress
- **Frontend API call**: `puzzlesApi.getChallengeProgress()` -> `GET /puzzles/challenge/progress`
- **API actual response**: 422 error - "Input should be a valid integer" - the server treats `progress` as a level parameter for `/puzzles/challenge/{level}`
- **Match status**: MISMATCH - ENDPOINT DOES NOT EXIST

### Issues:
1. `/puzzles/challenge/progress` does not exist as a separate endpoint. The backend interprets `progress` as a `{level}` path parameter, resulting in a 422 validation error.
2. Challenge progress data is actually embedded in `/puzzles/stats` response as `challenge_progress` array.
3. Frontend expects `{ levels: [...], dailyDone: N }` from this endpoint.
4. Falls back to mock data, so page still shows but with fake data.

---

## 7. DailyPuzzlePage -> GET /api/v1/puzzles/daily

- **Frontend file**: `src/pages/puzzles/DailyPuzzlePage.tsx`
- **Frontend take method**: `res.data?.data ?? res.data` -> looks for array or `{ puzzles: [...] }`
- **API actual format**:
  ```json
  {
    "code": 0,
    "data": {
      "date": "2026-03-28",
      "puzzles": [
        {
          "puzzle": {
            "id": "d_054", "puzzle_code": "d_054", "fen": "...",
            "solution_moves": "d3", "difficulty_level": 3, "rating": 600,
            "themes": "simple_capture", "hint_text": null, "explanation": "...",
            "side_to_move": "white", "move_count": 1
          },
          "sort_order": 1, "attempted": false, "is_correct": null
        }
      ],
      "total_puzzles": 3, "completed_puzzles": 0
    }
  }
  ```
- **Match status**: PARTIAL MATCH (works with normalization)

### Analysis:
- `payload = res.data?.data ?? res.data` -> gets `{ date, puzzles: [...], ... }`
- `puzzleList = payload.puzzles.map(p => p.puzzle ?? p)` - correctly unwraps nested `puzzle` object
- Normalization handles: `p.id ?? p.puzzle_code`, `p.fen`, `p.solution ?? (p.solution_moves ? p.solution_moves.split(',') : [])`

### Issues:
1. `solution_moves` is a SAN string like `"d3"` or `"Qxf7#"`, NOT UCI format. Frontend expects UCI like `"h5f7"`. The split by comma gives `["d3"]` which is SAN, not UCI `"d2d3"`. **Moves will never match user input** which is in UCI format (`from+to`). This is a critical mismatch.
2. `themes` is a string like `"simple_capture"`, frontend maps to `theme` (singular) - OK
3. `hint_text` is null, maps to `hint` - OK (undefined)
4. `difficulty_level` is a number, not a string label - frontend does `Level ${p.difficulty_level}` - acceptable

---

## 8. PuzzleChallengePage -> GET /api/v1/puzzles/challenge/{level}

- **Frontend file**: `src/pages/puzzles/PuzzleChallengePage.tsx`
- **Frontend take method**: `res.data` directly (no unwrap)
- **API actual format**:
  ```json
  {
    "code": 0,
    "data": [
      {
        "id": "p_l1_001", "puzzle_code": "...", "fen": "...",
        "solution_moves": "Qxf7#", "difficulty_level": 1, "rating": 300,
        "themes": "mate_in_1", "attempted": false, "is_correct": null, ...
      }
    ]
  }
  ```
- **Frontend expected**: `ChallengePuzzle[] = [{ id, theme, difficulty, solved }]`
- **Match status**: MISMATCH

### Issues:
1. `setPuzzles(res.data)` sets puzzles to `{ code: 0, data: [...] }` - should be `res.data.data`
2. Even if unwrapped, API puzzle objects have different field names: `themes` vs `theme`, `difficulty_level` vs `difficulty`, `is_correct` vs `solved`
3. Falls back to mock data on error, but the direct `.then` path will set invalid data
4. `puzzles.filter(p => p.solved)` will always be 0 since `solved` field doesn't exist on API objects

---

## 9. PuzzleSolvePage -> GET /api/v1/puzzles/{id} + POST attempt

- **Frontend file**: `src/pages/puzzles/PuzzleSolvePage.tsx`
- **Frontend take method**: `res.data` directly
- **API actual format**:
  ```json
  {
    "code": 0,
    "data": {
      "id": "d_054", "puzzle_code": "d_054", "fen": "...",
      "solution_moves": "d3", "difficulty_level": 3, "rating": 600,
      "themes": "simple_capture", "hint_text": null, "explanation": "...",
      "side_to_move": "white", "move_count": 1
    }
  }
  ```
- **Frontend expected**: `PuzzleData { id, fen, solution: string[], theme, difficulty, hint, explanation }`
- **Match status**: MISMATCH

### Issues:
1. `setPuzzle(res.data)` and `setCurrentFen(res.data.fen)` - `res.data` is `{ code: 0, data: {...} }`, so `res.data.fen` is undefined. Should use `res.data.data`
2. Even with correct unwrap, `solution` vs `solution_moves` - different name, and SAN vs UCI format mismatch (same as DailyPuzzlePage)
3. `theme` vs `themes`, `difficulty` vs `difficulty_level`, `hint` vs `hint_text`
4. Falls back to mock, so page works in development

---

## 10. CourseListPage -> GET /api/v1/learn/courses

- **Frontend file**: `src/pages/learn/CourseListPage.tsx`
- **Frontend take method**: Unwraps `res.data.data ?? res.data.courses ?? res.data`
- **API actual format**:
  ```json
  {
    "code": 0,
    "data": [
      {
        "id": "level_0", "slug": "level_0", "title": "...", "description": "...",
        "level": 0, "total_lessons": 10, "is_free": true,
        "completed_lessons": 0, "progress_pct": 0
      }
    ]
  }
  ```
- **Match status**: OK (recently fixed)

### Analysis:
- Unwrap: `data = res.data` -> `{ code: 0, data: [...] }` -> `data = data.data` -> array
- Normalization maps `progress_pct` -> `progress`, `total_lessons`, `completed_lessons`
- **Issue**: API does NOT return `lessons` array (individual lesson objects). Frontend defaults to `c.lessons ?? []`, so lesson list in course card will be empty. Only shows `completed_lessons / total_lessons` via the `(course as any)` cast.

---

## 11. LessonPage -> GET /api/v1/learn/lessons/{id}

- **Frontend file**: `src/pages/learn/LessonPage.tsx`
- **Frontend take method**: `res.data` directly
- **API actual format**:
  ```json
  {
    "code": 0,
    "data": {
      "id": "l0_01", "slug": "lesson_01", "title": "...",
      "course_id": "level_0", "content_type": "interactive",
      "content_data": {
        "steps": [
          { "type": "text", "content": "..." },
          { "type": "board_demo", "fen": "...", "description": "...", "highlights": [] },
          { "type": "interactive", "instruction": "...", "fen": "...", "correct_squares": ["e1"], "hint": "..." },
          { "type": "quiz", "question": "...", "options": [...], "correct_answer": 2 }
        ]
      }
    }
  }
  ```
- **Frontend expected**: `LessonData { id, title, courseId, blocks: ContentBlock[], nextLessonId, exerciseId }`
- **Match status**: MISMATCH

### Issues:
1. `setLesson(res.data)` - should be `res.data.data`
2. `blocks` vs `content_data.steps` - different nesting path and field name
3. `courseId` (camelCase) vs `course_id` (snake_case)
4. Interactive blocks: frontend expects `expectedMove` (UCI string), API returns `correct_squares` (array of squares) - fundamentally different interaction model
5. Quiz blocks: frontend expects `correctIndex`, API returns `correct_answer`
6. API has `image_text` type which frontend doesn't handle
7. No `nextLessonId` or `exerciseId` in API response
8. Falls back to MOCK_LESSON, so page works in development

---

## 12. DailyPlanPage -> GET /api/v1/train/today + GET /api/v1/train/streak

- **Frontend file**: `src/pages/train/DailyPlanPage.tsx`

### 12a. GET /api/v1/train/today
- **Frontend take method**: `res.data?.data ?? res.data` -> expects `{ tasks: [...] }` or array
- **API actual format**:
  ```json
  {
    "code": 0,
    "data": {
      "plan_id": "...", "plan_date": "2026-03-28",
      "items": [
        { "index": 0, "item_type": "puzzle", "title": "...", "description": "...",
          "estimated_minutes": 10, "is_completed": false, "link": "/puzzles/daily" }
      ],
      "total_items": 3, "completed_items": 0, "is_completed": false
    }
  }
  ```
- **Frontend expected**: `PlanTask[] = [{ id, type, title, description, emoji, link, completed }]`
- **Match status**: PARTIAL MISMATCH

### Issues:
1. Unwrap gets `{ plan_id, items: [...], ... }`. Frontend looks for `tasks` not `items`: `planPayload?.tasks ?? MOCK_TASKS` -> falls back to MOCK because there's no `tasks` field
2. Even if mapped: `id` vs `index`, `type` vs `item_type`, `completed` vs `is_completed`, no `emoji` field in API
3. Falls back to mock tasks, so page works but shows fake data

### 12b. GET /api/v1/train/streak
- **Frontend take method**: `res.data?.data ?? res.data` -> reads `days` or `login_streak`
- **API actual format**:
  ```json
  { "code": 0, "data": { "login_streak": 0, "train_streak": 0, ... } }
  ```
- **Match status**: OK
- Frontend: `streakPayload?.days ?? streakPayload?.login_streak ?? 0` - correctly falls back to `login_streak`

---

## 13. ProfilePage -> gamification APIs

- **Frontend file**: `src/pages/profile/ProfilePage.tsx`
- **Frontend take method**: Uses `res.data.data ?? res.data` for each API

### 13a. GET /api/v1/gamification/rank
- **API format**: `{ code: 0, data: { game_rating: 300, puzzle_rating: 300, rank_title: "..." } }`
- **Frontend reads**: `r.rating` -> undefined. API has `game_rating` not `rating`
- **Match status**: MISMATCH - rating field name mismatch

### 13b. GET /api/v1/gamification/xp
- **API format**: `{ code: 0, data: { xp_total: 0, xp_today: 0, level: 1, xp_to_next_level: 200, coins: 0 } }`
- **Frontend reads**: `x.current`, `x.target`, `x.level` -> `current` and `target` are undefined
- **Match status**: MISMATCH - should map `xp_today` -> `current`, `xp_to_next_level` -> `target`

### 13c. GET /api/v1/gamification/achievements
- **API format**: `{ code: 0, data: { achievements: [{ slug, name, achieved, achieved_at, ... }] } }`
- **Frontend reads**: `a.achievements` -> OK, then filters by `ac.unlockedAt`
- **Match status**: MISMATCH - API uses `achieved_at` not `unlockedAt`

### Note: Falls back to MOCK_PROFILE for most data since API fields don't match.

---

## 14. AchievementsPage -> GET /api/v1/gamification/achievements

- **Frontend file**: `src/pages/profile/AchievementsPage.tsx`
- **Frontend take method**: `res.data?.data ?? res.data` -> expects `{ achievements: [...] }`
- **API actual format**:
  ```json
  {
    "code": 0,
    "data": {
      "achievements": [
        {
          "id": "uuid", "slug": "first_game", "name": "...", "description": "...",
          "icon_key": "emoji", "category": "milestone",
          "condition_type": "game_count", "condition_value": 1,
          "xp_reward": 50, "achieved": false, "achieved_at": null
        }
      ]
    }
  }
  ```
- **Frontend expected**: merges with MOCK by matching `a.id` with `mock.id`
- **Match status**: MISMATCH

### Issues:
1. Frontend matches by `a.id` but API `id` is a UUID, while mock uses slug strings like `"first_game"`. They will never match.
2. Should match by `a.slug` instead of `a.id`
3. `unlockedAt` vs `achieved_at` - field name mismatch
4. Falls back to mock data since no matches are found

---

## 15. AdventureMapPage -> GET /api/v1/adventure/map

- **Frontend file**: `src/pages/adventure/AdventureMapPage.tsx`
- **Frontend take method**: `res.data` -> looks for `.regions` or treats as array
- **API actual format**:
  ```json
  {
    "code": 0,
    "data": {
      "regions": [
        {
          "id": "meadow", "name": "...", "description": "...",
          "rating_range": [0, 800], "icon": "emoji",
          "unlock_condition": { "type": "free" },
          "is_unlocked": true, "challenges_total": 2, "challenges_completed": 0
        }
      ]
    }
  }
  ```
- **Frontend expected (AdventureRegion)**: `{ id, name, emoji, description, theme, ratingMin, ratingMax, unlocked, current, challenges: AdventureChallenge[] }`
- **Match status**: MISMATCH

### Issues:
1. `res.data` = `{ code: 0, data: { regions: [...] } }`. Frontend does `(data as any).regions ?? data` which gets undefined because `data.regions` is not at `res.data.regions` but at `res.data.data.regions`. Should unwrap to `res.data.data`.
2. Even if unwrapped: `emoji` vs `icon`, `theme` field missing, `ratingMin/ratingMax` vs `rating_range` (array), `unlocked` vs `is_unlocked`, `current` field missing
3. No `challenges` array in region objects - API only returns `challenges_total` and `challenges_completed` counts
4. Falls back to MOCK_REGIONS since unwrap fails

---

## 16. UserManagePage -> GET /api/v1/admin/users

- **Frontend file**: `src/pages/admin/UserManagePage.tsx`
- **Frontend take method**: `res.data?.data ?? res.data` -> expects `{ users: [...] }` or array
- **API actual format**:
  ```json
  {
    "code": 0,
    "data": {
      "items": [
        {
          "id": "uuid", "username": "admin", "nickname": "...",
          "role": "admin", "status": "active",
          "membership_tier": "basic", "created_at": "2026-03-28T14:19:16",
          "last_login_at": "...", "login_count": 2
        }
      ],
      "total": 2, "page": 1, "page_size": 20
    }
  }
  ```
- **Frontend expected**: `{ users: [...] }` or flat array of `ManagedUser`
- **Match status**: MISMATCH

### Issues:
1. Unwrap: `payload = res.data?.data ?? res.data` -> gets `{ items: [...], total: 2, ... }`
2. Frontend checks `payload?.users` (not found) then `Array.isArray(payload)` (false) -> falls back to MOCK
3. Should check for `payload?.items` instead of `payload?.users`
4. Even if fixed: `membership` vs `membership_tier`, `createdAt` vs `created_at` (camelCase vs snake_case)
5. Falls back to MOCK_USERS

---

# Summary

## Critical Issues (data completely wrong or feature broken)

| # | Page | API | Issue | Severity |
|---|------|-----|-------|----------|
| 1 | DashboardPage | `/dashboard` | All field names mismatch (camelCase vs snake_case), missing fields (weekStats, recommendations). Shows mock data. | HIGH |
| 2 | DailyPuzzlePage | `/puzzles/daily` | `solution_moves` is SAN format (e.g., "d3", "Qxf7#"), frontend expects UCI (e.g., "d2d3", "h5f7"). Puzzle solving will NEVER match. | CRITICAL |
| 3 | PuzzleSolvePage | `/puzzles/{id}` | Same SAN vs UCI issue. Also `res.data` not unwrapped (should be `res.data.data`). | CRITICAL |
| 4 | PuzzleChallengePage | `/puzzles/challenge/{level}` | `res.data` not unwrapped. Field names mismatch. | HIGH |
| 5 | ReviewPage | `/play/games/{id}/review` | `res.data` not unwrapped (should be `res.data.data`) | HIGH |
| 6 | LessonPage | `/learn/lessons/{id}` | `res.data` not unwrapped. `blocks` vs `content_data.steps`. Interactive model completely different (`expectedMove` vs `correct_squares`). | HIGH |
| 7 | DailyPlanPage | `/train/today` | `tasks` vs `items` field name. Task fields mismatch. | HIGH |
| 8 | AdventureMapPage | `/adventure/map` | `res.data` not unwrapped. Region field names completely different. No challenges array. | HIGH |
| 9 | UserManagePage | `/admin/users` | `users` vs `items`. Field name mismatches. | MEDIUM |

## Moderate Issues (partially working, some fields wrong)

| # | Page | API | Issue | Severity |
|---|------|-----|-------|----------|
| 10 | PuzzlesHomePage | `/puzzles/challenge/progress` | Endpoint does not exist (server returns 422). Challenge data is in `/puzzles/stats`. | MEDIUM |
| 11 | ProfilePage | gamification APIs | `rating` vs `game_rating`, `current/target` vs `xp_today/xp_to_next_level`, `unlockedAt` vs `achieved_at` | MEDIUM |
| 12 | AchievementsPage | `/gamification/achievements` | Matches by `id` (UUID) instead of `slug`. `unlockedAt` vs `achieved_at`. | MEDIUM |
| 13 | GamePage | `/play/games` (create) | `res.data?.id` should be `res.data?.data?.id` | LOW |

## Working Correctly

| # | Page | API | Status |
|---|------|-----|--------|
| 14 | CharacterHallPage | `/play/characters` | OK - recently fixed, proper unwrap and field mapping |
| 15 | CourseListPage | `/learn/courses` | OK - recently fixed, proper unwrap and field mapping |
| 16 | GameHistoryPage | `/play/games` (list) | OK - proper unwrap with `items` support |
| 17 | PuzzlesHomePage | `/puzzles/stats` | OK - proper unwrap and field mapping |
| 18 | DailyPlanPage | `/train/streak` | OK - correctly falls back to `login_streak` |

## Common Patterns to Fix

1. **Missing `res.data.data` unwrap**: ReviewPage, PuzzleSolvePage, PuzzleChallengePage, LessonPage, AdventureMapPage - all do `res.data` instead of `res.data.data` or `res.data?.data ?? res.data`
2. **snake_case vs camelCase**: Dashboard, Profile, Achievements, UserManage, DailyPlan - backend uses snake_case, frontend expects camelCase
3. **SAN vs UCI move format**: All puzzle pages - backend stores moves in SAN ("Qxf7#"), frontend compares UCI ("h5f7"). Need either backend to return UCI or frontend to convert.
4. **Field naming differences**: `items` vs `tasks`/`users`, `is_completed` vs `completed`, `achieved_at` vs `unlockedAt`
5. **Missing nested data**: Courses don't include lesson objects, Adventure regions don't include challenge objects

## Pages Requiring Fix (Priority Order)

1. **DailyPuzzlePage** - CRITICAL: SAN/UCI mismatch makes puzzles unsolvable
2. **PuzzleSolvePage** - CRITICAL: Same SAN/UCI + missing unwrap
3. **DashboardPage** - HIGH: Shows entirely mock data
4. **LessonPage** - HIGH: Missing unwrap + completely different content structure
5. **PuzzleChallengePage** - HIGH: Missing unwrap + field mismatch
6. **ReviewPage** - HIGH: Missing unwrap
7. **DailyPlanPage** - HIGH: `tasks` vs `items` mismatch
8. **AdventureMapPage** - HIGH: Missing unwrap + field mismatches
9. **UserManagePage** - MEDIUM: `users` vs `items`
10. **PuzzlesHomePage** - MEDIUM: Non-existent challenge/progress endpoint
11. **ProfilePage** - MEDIUM: Field name mismatches in gamification APIs
12. **AchievementsPage** - MEDIUM: ID vs slug matching, field names
13. **GamePage** - LOW: Minor game ID unwrap issue
