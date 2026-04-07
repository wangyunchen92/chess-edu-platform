# 专项训练 + 闯关挑战改造 设计

> 日期：2026-04-07 | 状态：已确认

## 需求

1. **闯关挑战改造**：从 5 关改为 10 关 x 20 题，难度递增
2. **专项训练**：新增 tab，按战术主题分类做题，不分关，按用户 rating 匹配难度
3. **Bug 修复**：闯关页面星星和标题重叠

## 一、闯关挑战改造

### 现状
- 5 个难度级别，每级若干题

### 改造后
- **10 关**，每关 **20 题**
- 难度递增：第 1 关最简单（低 rating 题），第 10 关最难（高 rating 题）
- 题目从挑战谜题池中按 rating 排序分段
- 每关通过条件：完成 20 题（不要求全对）
- 通过后解锁下一关

### 后端变更
- 修改 `get_challenge_puzzles(db, user_id, level)` — level 范围从 1-5 改为 1-10，每 level 返回 20 题
- 修改 `get_challenge_progress(db, user_id)` — 返回 10 关进度

### 前端变更
- PuzzleChallengePage：从 5 关改为 10 关格子显示
- 修复星星和标题重叠的间距问题

## 二、专项训练（新功能）

### 入口
谜题首页（PuzzlesHomePage）新增"专项训练" tab

### 页面结构

**专项训练主页 — 4 大类 + 主题列表**

| 大类 | 包含主题 |
|------|---------|
| 基础战术 | fork(双攻)、pin(牵制)、skewer(串击)、discoveredAttack(闪击)、doubleCheck(双将)、hangingPiece(悬子)、trappedPiece(困子) |
| 将杀训练 | mateIn1(一步杀)、mateIn2(两步杀)、mateIn3(三步杀)、backRankMate(底线杀)、smotheredMate(闷杀)、hookMate(钩杀)、mate(将杀) |
| 高级战术 | sacrifice(弃子)、deflection(引离)、decoy(引入)、intermezzo(中间着)、quietMove(安静着)、xRayAttack(X光攻击)、capturingDefender(吃掉防守者) |
| 残局训练 | pawnEndgame(兵残局)、rookEndgame(车残局)、queenEndgame(后残局)、bishopEndgame(象残局)、knightEndgame(马残局)、endgame(残局) |

每个主题显示：
- 中文名
- 题库总数
- 已做题数 / 正确率
- 进度条

**做题流程 — 不分关，连续做题**

点击某主题 → 直接开始做题：
- 按用户 puzzle_rating +/- 200 匹配难度（复用已有的 `get_theme_puzzles`）
- 每次取 10 题，做完自动加载下一批
- 不限制数量，用户随时可退出
- 每题做完显示对错 + 下一题按钮
- 退出时显示本次训练统计（做了几题、正确率）

### 后端 API

1. `GET /api/v1/puzzles/themes` — 获取所有可用主题 + 用户进度

响应：
```json
{
  "code": 0,
  "data": [
    {
      "theme": "fork",
      "name": "双攻",
      "category": "basic_tactics",
      "count": 1200,
      "attempted": 45,
      "correct": 38,
      "accuracy": 84
    }
  ]
}
```

2. `GET /api/v1/puzzles/theme/{theme}?count=10` — 获取某主题的题目（按 rating 匹配）

复用已有 `get_theme_puzzles`，注册路由即可。

### 前端变更

| 文件 | 变更 |
|------|------|
| PuzzlesHomePage.tsx | 新增"专项训练" tab |
| 新建 ThemeTrainingPage.tsx | 主题列表（4大类分组+展开） |
| 新建 ThemePracticePage.tsx | 某主题连续做题（不分关） |
| PuzzleSolvePage.tsx | 支持 source=theme 参数 |
| App.tsx | 注册新路由 |
| api/puzzles.ts | 新增 getThemes(), getThemePuzzles() |

### 路由

- `/puzzles/themes` — 专项训练主题列表
- `/puzzles/theme/:theme` — 某主题连续做题

## 不涉及

- 不新增数据库表
- 不修改 puzzles 表结构
- 复用 puzzle_attempts 记录做题结果

## 验收标准

1. 闯关挑战改为 10 关 x 20 题，难度递增
2. 闯关页面星星和标题不再重叠
3. 谜题首页有"专项训练" tab
4. 点击进入看到 4 大类主题，每个主题显示题库数+正确率
5. 点击主题直接开始做题
6. 题目按用户 rating 匹配难度
7. 做完显示对错，可继续下一题
8. 随时可退出，显示本次统计
