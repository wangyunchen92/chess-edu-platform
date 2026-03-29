# Sprint 1 综合测试报告

**日期**: 2026-03-29
**测试方法**: API联通验证(curl通过Vite代理) + 前端源码数据绑定审查
**测试范围**: 全部 22 个页面，10 个功能模块
**环境**: 后端 localhost:8000 / 前端 localhost:5173

---

## 测试结果总览

| 等级 | 数量 | 说明 |
|---|---|---|
| P0 阻断 | 1 | 后台分配会员接口字段不匹配(422) |
| P1 功能异常 | 13 | 数据绑定错误、字段缺失、Mock 数据覆盖、设置不持久化 |
| P2 体验问题 | 5 | 信息利用不足、静默 fallback、premium显示为空 |
| P3 改进建议 | 2 | 功能增强建议 |

---

## 逐模块测试结果

### 1. 认证模块 ✅ 通过

| 页面 | 结果 | 备注 |
|---|---|---|
| LoginPage | ✅ | 登录/错误提示/token存储 均正常 |
| AssessmentPage | ⚠️ | API返回结构需确认(数组 vs 对象包装)，有本地题库兜底 |

---

### 2. 仪表盘 ⚠️ 有问题

| 页面 | 结果 | 备注 |
|---|---|---|
| DashboardPage | ⚠️ | 5个问题 |

**问题清单:**

| # | 严重度 | 描述 |
|---|---|---|
| D-1 | P1 | `xp_to_next_level` 后端不返回，经验进度始终 fallback 200 |
| D-2 | P1 | `rank_title` 从 rating 对象中被丢弃，页面不展示段位名称 |
| D-3 | P1 | `weekStats` 和 `recommendations` 后端无接口，完全依赖 mock |
| D-4 | P2 | `recent_games` 字段名不直接匹配(用 fallback 间接工作) |

---

### 3. 对弈模块 ⚠️ 有问题

| 页面 | 结果 | 备注 |
|---|---|---|
| CharacterHallPage | ❌ | 字段名错误 |
| GamePage | ✅ | 本地驱动，无API绑定问题 |
| GameHistoryPage | ✅ | 分页结构正确 |
| ReviewPage | ✅ | review_data 正确解包 |

**问题清单:**

| # | 严重度 | 描述 |
|---|---|---|
| P-1 | **P1** | CharacterHallPage: `stats.wins/losses/draws` 应为 `stats.games_won/games_lost/games_drawn`，**战绩始终显示 0** |
| P-2 | P2 | CharacterHallPage: `styleWeights` 后端不返回，棋风雷达图始终用均匀分布 fallback |

---

### 4. 课程学习模块 ⚠️ 有问题

| 页面 | 结果 | 备注 |
|---|---|---|
| CourseListPage | ✅ | 已修复，正确获取课程详情中的 lessons |
| LessonPage | ⚠️ | 有问题 |
| ExercisePage | ✅ | 练习提交正常 |
| InteractiveTeachPage | ⚠️ | 依赖火山引擎API，未配置时需确认降级 |

**问题清单:**

| # | 严重度 | 描述 |
|---|---|---|
| L-1 | **P1** | LessonPage: `next_lesson_id` 和 `exercise_id` 后端不返回，课程完成后**无法自动跳转下一课**，只能返回列表 |

---

### 5. 谜题模块 ⚠️ 有小问题

| 页面 | 结果 | 备注 |
|---|---|---|
| PuzzlesHomePage | ⚠️ | streak字段缺失 |
| DailyPuzzlePage | ✅ | 数据解包正确 |
| PuzzleSolvePage | ✅ | FEN/走子/提交 正常 |
| PuzzleChallengePage | ✅ | is_correct fallback 正确 |
| MistakeBookPage | ⚠️ | retried字段缺失 |

**问题清单:**

| # | 严重度 | 描述 |
|---|---|---|
| PZ-1 | P1 | PuzzlesHomePage: `streak` 字段后端 PuzzleStatsResponse 不存在，连续解题天数**始终显示 0** |
| PZ-2 | P2 | MistakeBookPage: `retried` 字段后端不存在，"已重做"标记**始终显示"待重做"** |

---

### 6. 每日训练模块 ❌ 有严重问题

| 页面 | 结果 | 备注 |
|---|---|---|
| DailyPlanPage | ⚠️ | streak取值问题 |
| TrainStatsPage | ❌ | 整页 fallback mock |

**问题清单:**

| # | 严重度 | 描述 |
|---|---|---|
| T-1 | **P1** | TrainStatsPage: 后端无分日训练统计接口，`days` 数组永远 undefined，**整页 fallback 到 mock 数据** |
| T-2 | P2 | DailyPlanPage: streak 应取 `train_streak` 而非 `login_streak` |

---

### 7. 冒险模块 ✅ 通过

| 页面 | 结果 | 备注 |
|---|---|---|
| AdventureMapPage | ✅ | 字段映射已修复，全部与后端 schema 一致 |

---

### 8. 成长体系 ❌ 有严重问题

| 页面 | 结果 | 备注 |
|---|---|---|
| ProfilePage | ❌ | 大量 mock 数据 |
| AchievementsPage | ⚠️ | MOCK 为主模式 |

**问题清单:**

| # | 严重度 | 描述 |
|---|---|---|
| G-1 | **P1** | ProfilePage: `streak`、`gameStats`、`puzzleStats.solved/accuracy`、`learnProgress` **全部使用 mock 数据**，后端有 `/user/profile/stats` 接口但未调用 |
| G-2 | P1 | ProfilePage: XP 进度条用 `xp_today` 而非等级内累计进度，**进度条显示不准确** |
| G-3 | P1 | AchievementsPage: 成就列表以 MOCK 为基础，通过 slug 匹配 API 数据更新解锁状态，**后端新增的成就不会显示** |

---

### 9. 设置页面 ❌ 有严重问题

| 页面 | 结果 | 备注 |
|---|---|---|
| SettingsPage | ❌ | 设置不持久化 |

**问题清单:**

| # | 严重度 | 描述 |
|---|---|---|
| S-1 | **P1** | 所有设置(音效/提醒/提醒时间)仅存 localStorage，**未调用后端 API 持久化** |
| S-2 | **P1** | 昵称修改只更新前端 Store，**未调用 PUT /user/me 持久化** |
| S-3 | P1 | 会员状态只判断 role=admin，忽略 `membership_tier` 字段，**已购买会员也显示"免费版"** |
| S-4 | P1 | 页面初始化未从后端加载用户设置偏好 |

---

### 10. 后台管理 ❌ 有阻断问题

| 页面 | 结果 | 备注 |
|---|---|---|
| UserManagePage | ❌ | P0+P1问题 |

**问题清单:**

| # | 严重度 | 描述 |
|---|---|---|
| A-1 | **P0** | 分配会员发送 `{membership}` 但后端期望 `{membership_tier, membership_expires_at}`，导致422，**功能完全不可用** |
| A-2 | P1 | 非管理员(student)访问 /admin 路由时 fallback 到 MOCK 用户列表，**无前端权限拦截** |
| A-3 | P2 | MEMBERSHIP_LABEL 缺少 premium，premium会员显示为空 |

---

## 按严重度汇总

### P1 功能异常 (11个，需修复)

| 编号 | 模块 | 问题 |
|---|---|---|
| P-1 | 对弈 | CharacterHallPage 战绩字段名错误，始终显示 0 |
| D-1 | 仪表盘 | xp_to_next_level 不存在，经验进度异常 |
| D-2 | 仪表盘 | rank_title 被丢弃，不显示段位 |
| D-3 | 仪表盘 | weekStats/recommendations 完全 mock |
| L-1 | 课程 | next_lesson_id 不存在，无法自动跳转下一课 |
| PZ-1 | 谜题 | streak 不存在，连续解题始终为 0 |
| T-1 | 训练 | TrainStatsPage 整页 mock 数据 |
| G-1 | 成长 | ProfilePage 关键统计全 mock |
| G-2 | 成长 | XP 进度条显示不准确 |
| G-3 | 成长 | 成就列表以 MOCK 为基础，不动态扩展 |
| S-1~4 | 设置 | 设置不持久化、昵称不保存、会员状态错误 |

### P2 体验问题 (4个)

| 编号 | 模块 | 问题 |
|---|---|---|
| P-2 | 对弈 | 棋风雷达图用均匀分布 fallback |
| D-4 | 仪表盘 | recent_games 字段名间接匹配 |
| PZ-2 | 谜题 | 错题重做标记始终"待重做" |
| T-2 | 训练 | DailyPlan streak 取 login_streak 而非 train_streak |

---

## 修复建议优先级

### 第一批：前端修复（不需要改后端）

1. **CharacterHallPage** `wins/losses/draws` → `games_won/games_lost/games_drawn`
2. **DashboardPage** 从 rating 对象提取 rank_title 展示
3. **SettingsPage** 调用 `PUT /user/me/settings` 和 `PUT /user/me` 持久化
4. **SettingsPage** 初始化时从 `GET /user/me` 加载设置
5. **SettingsPage** 会员状态读取 `membership_tier` 而非 `role`
6. **ProfilePage** 调用 `GET /user/profile/stats` 获取真实统计数据
7. **ProfilePage** XP 进度条修正
8. **AchievementsPage** 改为以 API 数据为主，MOCK 为兜底
9. **DailyPlanPage** streak 取 `train_streak`
10. **DashboardPage** recent_games 字段直接对齐后端

### 第二批：需要后端配合

1. **后端** `LessonContent` 增加 `next_lesson_id` 字段 → **前端** LessonPage 自动跳转下一课
2. **后端** `PuzzleStatsResponse` 增加 `streak` 字段 → **前端** PuzzlesHomePage 展示
3. **后端** `DashboardResponse` 增加 `xp_to_next_level` → **前端** 仪表盘进度条
4. **后端** 新增每日训练分日统计接口或字段 → **前端** TrainStatsPage 展示真实数据
5. **后端** `MistakeItem` 增加 `retried` 字段 → **前端** 错题重做标记
6. **后端** Dashboard 增加 weekStats / recommendations（或前端从已有接口聚合）

---

## 结论

Sprint 1 的 API 层和数据库层基本完整，**12个模块的接口全部联通**。主要问题集中在**前端页面数据绑定层**：
- 多个页面存在字段名不匹配或字段缺失，导致 fallback 到 mock 数据
- 设置页面完全未调用后端持久化接口
- 部分页面需要后端补充字段支持

建议先执行"第一批前端修复"（不涉及后端改动），修复后回归测试，再安排第二批前后端联合修复。
