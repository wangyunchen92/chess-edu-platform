# 荣誉记录 (Honor Records) 设计文档

> 日期：2026-04-13

## 目标

专属学员风采板块，展示赛事成绩与成长里程碑。线下赛事由老师/管理员手动录入，系统里程碑自动生成。赛事荣誉公开展示在光荣榜，里程碑仅个人可见。

## 数据模型

### 新增表 `honor_records`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID, PK | 主键 |
| user_id | FK→users | 获荣誉的学员 |
| type | String | `competition`(赛事) / `milestone`(系统里程碑) |
| title | String | 如"XX杯赛季军"、"对弈评分突破800" |
| description | String, nullable | 补充说明 |
| rank | String, nullable | 名次，如"第3名"、"一等奖"（仅赛事） |
| competition_name | String, nullable | 赛事名称（仅赛事） |
| competition_date | Date, nullable | 赛事日期（仅赛事） |
| milestone_key | String, nullable | 里程碑标识如`game_rating_800`（仅里程碑，用于去重） |
| milestone_value | Int, nullable | 触发值如800（仅里程碑） |
| is_public | Bool, default=True | 是否上光荣榜（赛事默认True，里程碑固定False） |
| created_by | FK→users, nullable | 录入人（老师/管理员），里程碑为null |
| created_at | DateTime | 创建时间 |

唯一约束：`(user_id, milestone_key)` — 同一用户同一里程碑只记录一次。

## 系统里程碑定义

硬编码在后端 `honor_service.py`，不建额外表。共约25个：

| 类别 | milestone_key 模式 | 阈值 | title |
|------|-------------------|------|-------|
| 对弈评分 | `game_rating_{N}` | 500, 800, 1000, 1200, 1500 | 对弈评分突破{N} |
| 谜题评分 | `puzzle_rating_{N}` | 500, 800, 1000, 1200, 1500 | 谜题评分突破{N} |
| 对局数 | `games_{N}` | 10, 50, 100, 500 | 累计对弈{N}盘 |
| 谜题数 | `puzzles_{N}` | 50, 200, 500, 1000 | 累计解题{N}道 |
| 连胜 | `win_streak_{N}` | 3, 5, 10 | 对弈{N}连胜 |
| 连续训练 | `train_streak_{N}` | 7, 30, 100 | 连续训练{N}天 |

**检查时机**：对弈结束、谜题完成、每日训练完成时调用 `check_milestones()`，只检查该场景相关的类别。通过 `milestone_key` 唯一约束去重。

## API 接口

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/honor/wall` | 无需登录 | 光荣榜：分页返回 is_public=True 的赛事荣誉，按 competition_date 倒序，join 用户昵称/头像 |
| GET | `/honor/mine` | 登录 | 我的荣誉：当前用户全部荣誉（赛事+里程碑），按 created_at 倒序 |
| GET | `/honor/user/{user_id}` | 老师/管理员 | 查看指定学员荣誉（老师限自己的学员） |
| POST | `/honor/record` | 老师/管理员 | 手动录入赛事荣誉 |
| PUT | `/honor/record/{id}` | 老师/管理员 | 修改赛事荣誉（录入人或管理员可改） |
| DELETE | `/honor/record/{id}` | 老师/管理员 | 删除赛事荣誉 |

### POST/PUT 请求体

```json
{
  "user_id": "string",
  "title": "string",
  "description": "string (optional)",
  "rank": "string (optional)",
  "competition_name": "string",
  "competition_date": "2026-04-13",
  "is_public": true
}
```

### 光荣榜响应 item

```json
{
  "id": "uuid",
  "user_nickname": "string",
  "user_avatar_url": "string | null",
  "title": "string",
  "description": "string | null",
  "rank": "string | null",
  "competition_name": "string",
  "competition_date": "2026-04-13",
  "created_at": "datetime"
}
```

### 我的荣誉响应

```json
{
  "competitions": [
    {
      "id": "uuid",
      "title": "string",
      "rank": "string | null",
      "competition_name": "string",
      "competition_date": "date",
      "description": "string | null",
      "is_public": true,
      "created_at": "datetime"
    }
  ],
  "milestones": [
    {
      "id": "uuid | null",
      "milestone_key": "game_rating_800",
      "title": "对弈评分突破800",
      "achieved": true,
      "achieved_at": "datetime | null",
      "current_value": 620,
      "target_value": 800,
      "category": "game_rating"
    }
  ]
}
```

`/honor/mine` 的 milestones 返回全部25个里程碑定义，已达成的有 `id` 和 `achieved_at`，未达成的 `achieved=false` 并附带当前进度值。

## 前端页面

### 路由

`/honor` → HonorPage，侧边栏"成长"分组中，排在"我的"之前。

### Tab 1: 光荣榜

- 顶部：大标题"光荣榜" + 副标题"每一次努力都被看见"
- 筛选：按赛事名称下拉筛选（从已有数据提取去重）
- 卡片列表：
  - 学员头像（首字母圆形）+ 昵称
  - 赛事名称 + 名次标签（金色冠军/银色亚军/铜色季军/灰色其他）
  - 荣誉标题
  - 赛事日期
- 分页：每页20条
- 空状态："暂无荣誉记录，期待大家的精彩表现"
- 风格：暖色调渐变背景（金色/琥珀色系）

### Tab 2: 我的荣誉

- 上半部分"赛事荣誉"：
  - 卡片列表，不显示头像/昵称（就是自己的）
  - 空状态："还没有赛事荣誉，继续加油"
- 分隔线
- 下半部分"成长里程碑"：
  - 按类别分组（对弈评分/谜题评分/对局数/谜题数/连胜/训练）
  - 已达成：彩色图标 + 标题 + 达成日期
  - 未达成：灰色锁定态 + 标题 + 进度条（如"620/800"）
  - 类别主题色：评分蓝、对局绿、谜题紫、训练橙

### 老师/管理员录入入口

不在荣誉页面内，而是在已有页面中添加按钮：
- 老师：`/teacher` 学生详情页，新增"添加荣誉"按钮
- 管理员：`/admin` 用户管理页，新增"添加荣誉"按钮
- 点击后弹出 Modal 表单：选学员（管理员需选，老师自动限本班学员）、填赛事信息

### 响应式

- 移动端：单列卡片
- 桌面：双列卡片网格

## 侧边栏重组

### 分组配置

提取到 `frontend/src/config/navigation.ts`，Sidebar 和 BottomNav 统一读取此配置，后续改分组只改这一个文件。

### 分组结构

| 分组 | 入口 |
|------|------|
| （置顶） | 首页 |
| 学习 | 学习、训练、谜题 |
| 实战 | 对弈、冒险、弱点诊断 |
| 成长 | 荣誉（新）、我的 |
| 管理 | 我的学生（老师）、设置（管理员） |

分组间用细分隔线隔开，不加文字标题。折叠态下分隔线依然可见。

### 移动端 BottomNav

保持 5 个核心入口不变：首页、学习、对弈、谜题、我的。荣誉从"我的"页面内入口进入（ProfilePage 加一个"我的荣誉"跳转按钮）。

## 与现有系统的关系

- **成就系统**：互不影响。成就是趣味徽章（10个），里程碑是数据突破（25个），定位不同。
- **积分系统**：里程碑达成不发积分（避免与成就奖励重复），纯荣誉展示。
- **老师系统**：复用 TeacherStudent 绑定关系做权限校验（老师只能给自己学员录入）。
