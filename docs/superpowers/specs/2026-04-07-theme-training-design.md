# 专项训练模块设计

> 日期：2026-04-07 | 状态：已确认

## 需求

在谜题模块中新增"专项训练" tab，按战术主题分类练习，每个主题 10 关 x 20 题，难度递增。

## 入口

谜题首页（PuzzlesHomePage）顶部 tab：每日谜题 | 闯关挑战 | **专项训练**

## 页面结构

### 专项训练主页 — 主题列表

4 个大类卡片，每个大类展开显示主题：

| 大类 | 包含主题 |
|------|---------|
| 基础战术 | fork(双攻)、pin(牵制)、skewer(串击)、discoveredAttack(闪击)、doubleCheck(双将)、hangingPiece(悬子)、trappedPiece(困子) |
| 将杀训练 | mateIn1(一步杀)、mateIn2(两步杀)、mateIn3(三步杀)、backRankMate(底线杀)、smotheredMate(闷杀)、hookMate(钩杀)、mate(将杀) |
| 高级战术 | sacrifice(弃子)、deflection(引离)、decoy(引入)、intermezzo(中间着)、quietMove(安静着)、xRayAttack(X光攻击)、capturingDefender(吃掉防守者) |
| 残局训练 | pawnEndgame(兵残局)、rookEndgame(车残局)、queenEndgame(后残局)、bishopEndgame(象残局)、knightEndgame(马残局)、endgame(残局) |

每个主题显示：
- 中文名 + 英文标签
- 题库总数
- 进度：已完成 X/10 关
- 进度条

### 关卡列表页 — 某主题的 10 关

点击主题进入：
- 标题：主题中文名
- 10 关格子（类似闯关挑战），每关显示：
  - 关卡号（1-10）
  - 状态：已完成(绿) / 当前(蓝) / 未解锁(灰)
  - 已完成的显示得分（正确数/20）
- 当前关按钮"开始训练"

### 做题页

复用现有 PuzzleSolvePage，通过 URL 参数区分来源：
- `/puzzles/solve/:id?source=theme&theme=fork&level=3`

## 难度递增逻辑

某主题的所有谜题按 `puzzle_rating` 升序排列，均匀分为 10 段：
- 第 1 关：rating 最低的 20 题
- 第 10 关：rating 最高的 20 题
- 每关 20 题，固定分配（不随机），确保可复现

如果某主题不足 200 题（10关x20题），按实际数量均分，每关至少 5 题。

## 后端 API

### 新增 2 个端点

1. `GET /api/v1/puzzles/themes` — 获取所有可用主题（已有 `get_available_themes`，需注册路由）

响应：
```json
{
  "code": 0,
  "data": [
    { "theme": "fork", "name": "双攻", "count": 1200, "category": "basic_tactics" }
  ]
}
```

2. `GET /api/v1/puzzles/theme/{theme}/level/{level}` — 获取某主题某关的题目

参数：theme=fork, level=1(1-10)
响应：
```json
{
  "code": 0,
  "data": {
    "theme": "fork",
    "theme_name": "双攻",
    "level": 1,
    "total_levels": 10,
    "puzzles": [ { "id": "...", "fen": "...", ... } ],
    "completed_count": 5,
    "total_count": 20
  }
}
```

### 修改 1 个端点

`GET /api/v1/puzzles/themes` 的返回增加 `category` 字段和用户进度（每主题已完成关数）。

## 前端变更

| 文件 | 变更 |
|------|------|
| PuzzlesHomePage.tsx | 新增"专项训练" tab |
| 新建 ThemeTrainingPage.tsx | 主题列表（4大类分组+展开） |
| 新建 ThemeLevelPage.tsx | 某主题的10关列表 |
| PuzzleSolvePage.tsx | 支持 source=theme 参数，完成后跳回关卡列表 |
| App.tsx | 注册新路由 /puzzles/themes, /puzzles/theme/:theme |
| api/puzzles.ts | 新增 getThemes(), getThemeLevel() |

## 路由

- `/puzzles/themes` — 专项训练主题列表（在 AppLayout 内）
- `/puzzles/theme/:theme` — 某主题的关卡列表（在 AppLayout 内）
- `/puzzles/solve/:id?source=theme&theme=fork&level=3` — 做题（复用现有页面）

## 不涉及

- 不新增数据库表
- 不修改 puzzles 表结构
- 复用 puzzle_attempts 记录做题结果
- 不改现有的每日谜题和闯关挑战功能

## Bug 修复

闯关页面（PuzzleChallengePage）星星和标题重叠问题，需检查并修复间距。

## 验收标准

1. 谜题首页有"专项训练" tab
2. 点击进入看到 4 大类主题
3. 每个主题显示题库数+进度
4. 点击主题看到 10 关
5. 点击关卡进入做题，题目 rating 递增
6. 做完一题自动进入下一题
7. 做完一关显示得分，可进入下一关
8. 闯关页面星星和标题不再重叠
