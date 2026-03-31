# Phase 2a 技术架构设计

> 版本：v1.0 | 日期：2026-03-30 | 作者：architect-agent
> 基于：Phase 2a 规划文档 v1.0 + 现有 25 表数据模型 + 产品设计方案 v1.1

---

## 0. 设计原则

1. **最小变更**：优先在现有表上扩展字段，避免不必要的新表
2. **向前兼容**：Phase 1 的 API 和数据不受影响，所有新增字段设默认值
3. **Phase 2b 预留**：为 LLM 对话、金币商城、复盘分享等预留扩展点
4. **数据驱动**：弱点诊断基于已有的 game_moves / puzzle_attempts 数据，不需要额外埋点

---

## 1. 数据库变更方案

### 1.1 现有表变更

#### characters 表 — 新增棋风参数字段

```sql
-- 新增字段（在 mistake_rate 之后）
ALTER TABLE characters ADD COLUMN play_style_params JSON DEFAULT '{}';
ALTER TABLE characters ADD COLUMN unlock_story TEXT DEFAULT NULL;
ALTER TABLE characters ADD COLUMN region VARCHAR(30) NOT NULL DEFAULT 'meadow';

-- play_style_params JSON 结构示例：
-- {
--   "prefer_traps": false,        -- 是否偏好设陷阱（狸花花/咕噜）
--   "defensive_bias": 0.0,        -- 防守倾向 0-1（铁墩墩=0.8）
--   "aggressive_bias": 0.0,       -- 进攻倾向 0-1（银鬃=0.7, 棉花糖=0.6）
--   "positional_bias": 0.0,       -- 位置型倾向 0-1（云朵师父=0.8）
--   "trap_frequency": 0.0,        -- 陷阱频率 0-1（咕噜=0.3）
--   "prefer_simple_moves": false, -- 偏好简单走法（豆丁=true）
--   "avoid_long_sequences": false  -- 避免长变化（豆丁=true）
-- }
--
-- 说明：原有 engine_depth_min/max 和 mistake_rate 控制基础棋力，
-- play_style_params 控制棋风个性化行为。
-- 现有3个入门角色的 engine_params 中的 prefer_simple_moves / avoid_long_sequences
-- 迁移到此 JSON 字段中。

-- region 字段说明：
-- 'meadow'  = 启蒙草原（入门段角色）
-- 'forest'  = 试炼森林（初级段角色）
-- 'plateau' = 风暴高原（中级段角色）
-- 'abyss'   = 暗影深渊（高级段角色，Phase 2b）
```

**设计决策**：使用 JSON 字段而非多个独立列，原因：
- 不同角色的棋风参数组合不同，稀疏性高
- 棋风参数在引擎层面解析，不需要数据库层面查询/索引
- 未来新增棋风参数不需要改表

#### character_dialogues 表 — 无变更

现有结构（character_id, scene, content, emotion, sort_order）完全满足新角色对话需求。12 个场景类型不变：`greeting, game_start, player_good_move, player_mistake, ai_winning, ai_losing, ai_win, ai_lose, draw, hint, encourage, farewell`。解锁剧情通过 `unlock_story` 场景类型扩展即可。

```sql
-- 仅需为 scene 字段补充一个新的枚举值（应用层处理，无需 DDL）
-- 新增场景：'unlock_story' — 角色解锁时的剧情对话
```

#### user_character_relations 表 — 新增好感度等级字段

```sql
ALTER TABLE user_character_relations ADD COLUMN affinity_level VARCHAR(20) NOT NULL DEFAULT 'stranger';
-- affinity_level 枚举值：stranger / acquainted / familiar / trusted / best_friend
-- 与 affinity 数值的对应关系由 service 层计算：
-- stranger:    affinity < 50
-- acquainted:  affinity >= 50  (对弈5次)
-- familiar:    affinity >= 150 (对弈15次 + 胜率>=40%)
-- trusted:     affinity >= 300 (对弈30次 + 胜率>=50% + 专项任务)
-- best_friend: affinity >= 500 (对弈50次 + 胜率>=55% + 隐藏成就)
```

#### games 表 — 新增自适应难度记录字段

```sql
ALTER TABLE games ADD COLUMN difficulty_mode VARCHAR(20) DEFAULT 'normal';
ALTER TABLE games ADD COLUMN adaptive_params JSON DEFAULT NULL;

-- difficulty_mode: 'easy' / 'normal' / 'hard' — 本局AI难度等级
-- adaptive_params: 本局使用的自适应参数快照
-- {
--   "adjusted_depth_min": 4,
--   "adjusted_depth_max": 7,
--   "adjusted_mistake_rate": 0.2,
--   "rating_offset": -50,         -- 相对角色 base_rating 的偏移
--   "recent_win_rate": 0.65,      -- 触发调整的依据
--   "recent_games_count": 5       -- 参考的近期对局数
-- }
```

#### game_moves 表 — 新增走法分类字段

```sql
ALTER TABLE game_moves ADD COLUMN move_classification VARCHAR(20) DEFAULT NULL;
ALTER TABLE game_moves ADD COLUMN game_phase VARCHAR(10) DEFAULT NULL;

-- move_classification: 'best' / 'excellent' / 'good' / 'inaccuracy' / 'mistake' / 'blunder'
-- （比现有 is_mistake / is_blunder 更细粒度，保留旧字段兼容）
--
-- game_phase: 'opening' / 'middlegame' / 'endgame'
-- 根据棋盘上剩余子力自动判定：
-- opening: 走步 <= 10 且双方未出动超过4个子
-- endgame: 双方总子力值（不含王和兵）<= 26（约等于各剩1轻子1重子）
-- middlegame: 其余
```

**设计决策**：`game_phase` 在对弈结算时由后端计算写入，不依赖前端传参。弱点诊断引擎根据此字段统计用户在不同阶段的失误率。

#### puzzles 表 — 无结构变更

现有 `themes` 字段（如 `"fork,pin,skewer"`）已支持主题标签，弱点诊断直接按 themes 聚合 puzzle_attempts 的正确率即可。

#### courses 表 — 无结构变更

现有 `level`, `prerequisite_id`, `is_free`, `membership_required` 字段完全满足 Level 2-3 课程需求。Level 2 的 `prerequisite_id` 指向 Level 1 课程的 id，Level 3 指向 Level 2。

#### lessons 表 — 无结构变更

`unit_name`, `unit_order` 字段已支持单元划分。`content_data` JSON 字段支持互动棋盘内容。

---

### 1.2 新增表

#### user_weakness_profiles — 用户弱点画像

```sql
CREATE TABLE user_weakness_profiles (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 各维度能力分（0-100），数值越高表示该维度越强
    opening_score INTEGER NOT NULL DEFAULT 50,
    middlegame_tactics_score INTEGER NOT NULL DEFAULT 50,
    middlegame_strategy_score INTEGER NOT NULL DEFAULT 50,
    endgame_score INTEGER NOT NULL DEFAULT 50,
    time_management_score INTEGER NOT NULL DEFAULT 50,

    -- 细分主题正确率（基于 puzzle themes 统计）
    theme_scores JSON NOT NULL DEFAULT '{}',
    -- 示例：{
    --   "fork": {"correct": 12, "total": 20, "score": 60},
    --   "pin": {"correct": 5, "total": 15, "score": 33},
    --   "skewer": {"correct": 8, "total": 10, "score": 80},
    --   "discovered_attack": {"correct": 3, "total": 8, "score": 38},
    --   "back_rank_mate": {"correct": 6, "total": 6, "score": 100}
    -- }

    -- 统计基础数据
    games_analyzed INTEGER NOT NULL DEFAULT 0,
    puzzles_analyzed INTEGER NOT NULL DEFAULT 0,

    -- 最薄弱的3个维度（冗余字段，加速查询）
    weakest_dimensions JSON NOT NULL DEFAULT '[]',
    -- 示例：["pin", "opening", "endgame"]

    -- 诊断可信度
    confidence VARCHAR(10) NOT NULL DEFAULT 'low',
    -- 'low': 数据不足（<10局 或 <30题）
    -- 'medium': 基本可信（10-30局, 30-100题）
    -- 'high': 高可信度（>30局, >100题）

    last_analyzed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    UNIQUE(user_id)
);

CREATE INDEX idx_weakness_profiles_user ON user_weakness_profiles(user_id);
```

#### weakness_recommendations — 弱点推荐训练项

```sql
CREATE TABLE weakness_recommendations (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    weakness_dimension VARCHAR(30) NOT NULL,
    -- 'opening' / 'middlegame_tactics' / 'middlegame_strategy' / 'endgame' / 'time_management'
    -- 或具体主题 key（'fork' / 'pin' / 'skewer' 等）

    recommendation_type VARCHAR(20) NOT NULL,
    -- 'puzzle_theme': 推荐做某主题谜题
    -- 'course': 推荐学某课程
    -- 'training_plan': 推荐某训练模板
    -- 'practice_game': 推荐与某角色对弈

    target_id VARCHAR(36) DEFAULT NULL,
    -- 关联的 puzzle_theme / course_id / training_template_id / character_id

    target_label VARCHAR(100) NOT NULL,
    -- 显示用文案，如 "牵制战术专项练习" / "Level 2 第3课：牵制的艺术"

    priority INTEGER NOT NULL DEFAULT 0,
    -- 优先级（0=最高），用于排序展示

    status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- 'active': 待完成
    -- 'in_progress': 进行中
    -- 'completed': 已完成
    -- 'dismissed': 用户关闭

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_weakness_rec_user ON weakness_recommendations(user_id, status);
```

#### adaptive_difficulty_configs — 自适应难度配置（角色维度）

```sql
CREATE TABLE adaptive_difficulty_configs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id VARCHAR(36) NOT NULL REFERENCES characters(id) ON DELETE CASCADE,

    -- 自适应状态
    recent_results JSON NOT NULL DEFAULT '[]',
    -- 最近 N 局结果，如 ["win","win","loss","win","draw"]

    recent_win_rate NUMERIC(3,2) NOT NULL DEFAULT 0.50,
    current_rating_offset INTEGER NOT NULL DEFAULT 0,
    -- 正值=AI 变强，负值=AI 变弱，范围 [-200, +200]

    current_depth_adjustment INTEGER NOT NULL DEFAULT 0,
    -- 搜索深度调整量，范围 [-3, +3]

    current_mistake_rate_adjustment NUMERIC(3,2) NOT NULL DEFAULT 0.00,
    -- 失误率调整量，范围 [-0.15, +0.15]

    adjustment_count INTEGER NOT NULL DEFAULT 0,
    -- 历史调整次数

    last_adjusted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, character_id)
);

CREATE INDEX idx_adaptive_config_user_char ON adaptive_difficulty_configs(user_id, character_id);
```

**设计决策**：自适应配置按 user + character 维度存储，而非全局。原因：
- 用户对不同角色的胜率不同（可能打得过进攻型但打不过防守型）
- 每个角色的自适应调整应独立，避免切换角色后难度突变
- 角色基础参数 + 自适应偏移 = 实际对弈参数

---

### 1.3 数据库变更总结

| 变更类型 | 表名 | 变更内容 |
|---------|------|---------|
| ALTER | characters | +play_style_params(JSON), +unlock_story(TEXT), +region(VARCHAR) |
| ALTER | user_character_relations | +affinity_level(VARCHAR) |
| ALTER | games | +difficulty_mode(VARCHAR), +adaptive_params(JSON) |
| ALTER | game_moves | +move_classification(VARCHAR), +game_phase(VARCHAR) |
| CREATE | user_weakness_profiles | 用户弱点画像（1 user : 1 profile） |
| CREATE | weakness_recommendations | 弱点推荐训练项（1 user : N recommendations） |
| CREATE | adaptive_difficulty_configs | 自适应难度配置（1 user x N characters） |

总计：4 表变更 + 3 新表 = 从 25 表增至 28 表。

---

## 2. API 契约

### 2.1 F1: AI 角色扩展

#### GET /api/v1/play/characters

**变更**：响应体中每个角色新增 `region`, `play_style_params`, `unlock_story` 字段。

```
现有 API 不变，响应扩展
Response 200:
{
  "code": 0,
  "data": [
    {
      "id": "...",
      "slug": "dongdong",
      "name": "冬冬",
      "tier": "intermediate",        // beginner / intermediate / advanced
      "region": "forest",            // [新增] meadow / forest / plateau / abyss
      "avatar_key": "dongdong",
      "personality": "...",
      "play_style": "balanced",
      "base_rating": 850,
      "rating_range_min": 750,
      "rating_range_max": 950,
      "play_style_params": {...},    // [新增] 棋风参数
      "unlock_condition": {...},
      "is_free": false,
      "is_unlocked": true,           // 基于 user_character_relations 计算
      "unlock_story": "...",         // [新增] 解锁剧情文本
      "affinity": 120,
      "affinity_level": "acquainted", // [新增]
      "games_played": 15,
      "games_won": 8,
      "sort_order": 4
    }
  ]
}
```

#### POST /api/v1/play/characters/{character_id}/unlock

**新增 API**：手动触发角色解锁检查。

```
Request: 无 body（后端根据用户当前数据判断是否满足条件）

Response 200（解锁成功）:
{
  "code": 0,
  "data": {
    "character_id": "...",
    "character_name": "冬冬",
    "unlocked": true,
    "unlock_story": [
      {"speaker": "system", "text": "你从草原来的？"},
      {"speaker": "dongdong", "text": "我听龟龟说了你的事。我在这片森林里训练了很久，来试试你有多强！", "emotion": "excited"}
    ]
  }
}

Response 200（条件不满足）:
{
  "code": 0,
  "data": {
    "character_id": "...",
    "unlocked": false,
    "missing_conditions": [
      {"type": "rating", "required": 800, "current": 650},
      {"type": "promotion_challenge", "required": "草原守护者之战", "completed": false}
    ]
  }
}
```

#### POST /api/v1/play/characters/{character_id}/check-unlock

**新增 API**：查询角色解锁条件满足情况（只读，不执行解锁）。

```
Response 200:
{
  "code": 0,
  "data": {
    "character_id": "...",
    "character_name": "冬冬",
    "is_unlocked": false,
    "conditions": [
      {"type": "rating", "label": "对弈Rating >= 800", "required": 800, "current": 650, "met": false},
      {"type": "promotion_challenge", "label": "通过「草原守护者之战」", "required": "grassland_guardian", "met": false},
      {"type": "course_complete", "label": "完成Level 1全部课程", "required": "level_1", "met": true}
    ]
  }
}
```

### 2.2 F2: Level 2-3 课程

**无新增 API**。现有 API 完全满足需求：

| 现有 API | 用途 | 是否需要改动 |
|---------|------|------------|
| GET /api/v1/learn/courses | 列出所有课程（含 Level 2-3） | 无需改动 |
| GET /api/v1/learn/courses/{id} | 获取课程详情+课时列表 | 无需改动 |
| GET /api/v1/learn/lessons/{id} | 获取课时内容 | 无需改动 |
| POST /api/v1/learn/lessons/{id}/progress | 更新学习进度 | 无需改动 |
| POST /api/v1/learn/exercises/{id}/attempt | 提交练习答案 | 无需改动 |

**工作内容仅为数据**：将 Level 2（15 课）和 Level 3（15 课）的内容 JSON 制作完成，通过种子脚本导入 courses + lessons + exercises 表。

前端 CourseListPage 需要适配按 level 分组展示和前置条件锁定 UI，但不涉及 API 变更。

### 2.3 F3: 弱点诊断系统

#### GET /api/v1/diagnosis/profile

获取当前用户的弱点画像。

```
Response 200:
{
  "code": 0,
  "data": {
    "user_id": "...",
    "confidence": "medium",
    "scores": {
      "opening": 45,
      "middlegame_tactics": 62,
      "middlegame_strategy": 38,
      "endgame": 55,
      "time_management": 70
    },
    "theme_scores": {
      "fork": {"score": 60, "correct": 12, "total": 20},
      "pin": {"score": 33, "correct": 5, "total": 15},
      "skewer": {"score": 80, "correct": 8, "total": 10},
      "discovered_attack": {"score": 38, "correct": 3, "total": 8}
    },
    "weakest_dimensions": ["middlegame_strategy", "pin", "opening"],
    "games_analyzed": 18,
    "puzzles_analyzed": 53,
    "last_analyzed_at": "2026-04-15T10:30:00Z"
  }
}

Response 200（数据不足）:
{
  "code": 0,
  "data": {
    "confidence": "low",
    "scores": null,
    "games_analyzed": 3,
    "puzzles_analyzed": 8,
    "min_games_required": 10,
    "min_puzzles_required": 30,
    "message": "需要更多对弈和解题数据才能生成准确的弱点诊断"
  }
}
```

#### POST /api/v1/diagnosis/analyze

触发重新分析（通常在对弈结束或批量做题后自动调用）。

```
Request:
{
  "force": false  // true=强制全量重算，false=增量更新
}

Response 200:
{
  "code": 0,
  "data": {
    "analyzed": true,
    "games_analyzed": 18,
    "puzzles_analyzed": 53,
    "changes": [
      {"dimension": "opening", "old_score": 50, "new_score": 45, "trend": "down"},
      {"dimension": "endgame", "old_score": 50, "new_score": 55, "trend": "up"}
    ]
  }
}
```

#### GET /api/v1/diagnosis/recommendations

获取基于弱点的推荐训练项。

```
Query Params:
  - limit: int = 5 (返回推荐数量)
  - status: str = "active" (过滤状态)

Response 200:
{
  "code": 0,
  "data": [
    {
      "id": "...",
      "weakness_dimension": "pin",
      "recommendation_type": "puzzle_theme",
      "target_id": "pin",
      "target_label": "牵制战术专项练习",
      "priority": 0,
      "status": "active",
      "reason": "你在牵制主题的谜题正确率仅33%，远低于平均水平"
    },
    {
      "id": "...",
      "weakness_dimension": "opening",
      "recommendation_type": "course",
      "target_id": "course-level2-id",
      "target_label": "Level 2 第5课：开局原则",
      "priority": 1,
      "status": "active",
      "reason": "你在前10步的平均失误率偏高"
    },
    {
      "id": "...",
      "weakness_dimension": "middlegame_strategy",
      "recommendation_type": "practice_game",
      "target_id": "yunduo-character-id",
      "target_label": "与云朵师父对弈——练习位置性下法",
      "priority": 2,
      "status": "active",
      "reason": "你的中局战略得分较低，与位置型对手对弈能提升战略意识"
    }
  ]
}
```

#### PATCH /api/v1/diagnosis/recommendations/{id}

更新推荐项状态（用户标记为完成或关闭）。

```
Request:
{
  "status": "completed"  // or "dismissed"
}

Response 200:
{
  "code": 0,
  "data": {
    "id": "...",
    "status": "completed"
  }
}
```

#### GET /api/v1/diagnosis/summary

Dashboard 用的弱点摘要（轻量级）。

```
Response 200:
{
  "code": 0,
  "data": {
    "has_diagnosis": true,
    "confidence": "medium",
    "primary_weakness": {
      "dimension": "pin",
      "label": "牵制战术",
      "score": 33,
      "suggestion": "试试做几道牵制专题谜题吧"
    },
    "active_recommendations_count": 3
  }
}
```

### 2.4 F4: 自适应难度

#### GET /api/v1/play/adaptive/{character_id}

获取与某角色的自适应难度状态。

```
Response 200:
{
  "code": 0,
  "data": {
    "character_id": "...",
    "character_name": "冬冬",
    "base_rating": 850,
    "effective_rating": 800,         // base_rating + rating_offset
    "difficulty_mode": "easy",        // easy / normal / hard
    "recent_win_rate": 0.70,
    "recent_results": ["win","win","loss","win","win"],
    "adjustment_detail": {
      "rating_offset": -50,
      "depth_adjustment": -1,
      "mistake_rate_adjustment": 0.05
    }
  }
}
```

#### 自适应计算逻辑（内部，不暴露 API）

自适应难度不需要独立的"调整"API，在每局对弈结算时自动触发：

```
POST /api/v1/play/games/{game_id}/complete  （已有 API，内部逻辑扩展）

对弈结算流程新增步骤：
1. 记录对局结果到 games 表
2. [新增] 更新 adaptive_difficulty_configs 表:
   a. 将结果 push 到 recent_results（保留最近 10 局）
   b. 重算 recent_win_rate
   c. 根据规则计算新的 offset:
      - win_rate > 0.60 → rating_offset += 25, depth +1, mistake_rate -0.03
      - win_rate < 0.40 → rating_offset -= 25, depth -1, mistake_rate +0.03
      - 0.40 <= win_rate <= 0.60 → 不调整（心流区间）
      - offset 限幅: [-200, +200], depth 限幅: [-3, +3], mistake_rate 限幅: [-0.15, +0.15]
   d. 记录 difficulty_mode = easy/normal/hard
3. [新增] 写入 games.adaptive_params 快照
4. [新增] 触发弱点增量分析（POST /diagnosis/analyze, force=false）
```

#### POST /api/v1/play/games — 创建对局（已有，内部扩展）

创建对局时，从 adaptive_difficulty_configs 读取当前偏移量，与角色基础参数叠加后生成本局实际参数，写入 games.adaptive_params。

---

## 3. 模块依赖关系

```
┌───────────────────────────────────────────────────────────────────┐
│                         数据层依赖                                 │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  characters 表 ◄──── F1 角色扩展（6条新数据 + 3表变更）           │
│       │                                                           │
│       ├──► games 表 ◄──── F4 自适应难度（新增字段 + 新表）       │
│       │       │                                                   │
│       │       └──► game_moves 表 ◄──── F3 弱点诊断（新增字段）   │
│       │                │                                          │
│       │                ▼                                          │
│       │     user_weakness_profiles ◄──── F3 弱点诊断（新表）      │
│       │                │                                          │
│       │                ▼                                          │
│       │     weakness_recommendations ◄──── F3 弱点诊断（新表）    │
│       │                │                                          │
│       │                └──► courses / puzzles（推荐目标）          │
│       │                                                           │
│       └──► adaptive_difficulty_configs ◄──── F4 自适应（新表）    │
│                                                                   │
│  courses 表 ◄──── F2 课程扩展（30课新数据，无结构变更）           │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### 3.1 开发顺序依赖

```
Week 1-2 (Sprint 2a-0): 并行启动
├── [架构] DB Schema 变更方案 + 迁移脚本              ← 本文档
├── [内容] 6个角色 JSON + 对话 + Level 2 课程内容     ← content-agent
└── [内容] 弱点维度定义文档                           ← content-agent

Week 3-4 (Sprint 2a-1): F1 + F2 并行
├── [后端] DB 迁移执行 + 角色种子导入 + 课程导入       ← 依赖架构方案 + 内容
├── [后端] 角色解锁逻辑 + 晋级挑战 API 完善           ← 依赖 DB 迁移
├── [前端] 角色大厅改造 + 冒险地图扩展 + 课程页面      ← 依赖后端 API
└── [引擎] 棋风参数扩展 + 行为控制优化                ← 依赖角色内容

Week 5-6 (Sprint 2a-2): F3 + F4
├── [后端] 弱点诊断引擎 + API 实现                    ← 依赖 DB 迁移 + 弱点维度定义
├── [后端] 推荐引擎                                  ← 依赖弱点诊断 + 课程数据
├── [引擎] 自适应难度算法                             ← 依赖 adaptive_difficulty_configs 表
└── [前端] Level 3 课程对接 + 难度指示器               ← 依赖后端 API

Week 7-8 (Sprint 2a-3): 集成 + 测试
├── [前端] 弱点诊断页面 + 推荐卡片 + Dashboard 集成   ← 依赖弱点诊断 API
├── [后端] 对弈结算流程扩展（触发自适应+弱点增量分析） ← 依赖 F3 + F4 后端完成
└── [测试] 全模块测试                                ← 依赖全部开发完成
```

### 3.2 关键依赖路径

1. **F1 角色内容 → F1 后端导入 → F1 前端展示**：角色 JSON 内容是最早的阻塞点
2. **DB 迁移 → F3/F4 后端 → F3/F4 前端**：新表必须先建好
3. **F1 角色 + F4 自适应 → 集成验证**：自适应算法需要在不同水平角色上验证效果
4. **F3 弱点诊断 + F2 课程 → 推荐引擎**：推荐需要有课程可推荐

---

## 4. 技术风险与应对

### 4.1 高风险

| 风险 | 影响 | 概率 | 应对 |
|------|------|------|------|
| **弱点诊断数据不足** | 新用户对弈/做题数少，诊断不准 | 高 | 设最低门槛（10局+30题），低于门槛显示"数据收集中"而非不准确的结果。confidence 字段分级展示 |
| **自适应难度参数调不好** | 用户体验太难或太简单震荡 | 高 | 先上线保守版本（仅调 rating_offset，幅度小），逐步加入 depth 和 mistake_rate 调整。加入调整冷却期（至少3局后才再次调整） |
| **6个角色棋风差异不明显** | 角色"下棋感觉一样"，削弱产品差异化 | 中 | play_style_params 参数需要引擎层精心调参，QA 需对比测试。每个角色至少用 10 局验证棋风感受 |

### 4.2 中风险

| 风险 | 影响 | 概率 | 应对 |
|------|------|------|------|
| **内容制作瓶颈** | 30课 + 6角色 x 12场景对话 = 工作量大 | 中 | content-agent 在 Sprint 2a-0 全力产出，Level 3 课程可降级为先出 5 课 |
| **game_moves 数据质量** | 旧数据没有 move_classification 和 game_phase | 中 | 迁移脚本对历史数据做一次批量回填（根据 move_number 和现有 is_mistake/is_blunder 推算），新数据在对弈结算时实时写入 |
| **SQLAlchemy JSON 字段修改陷阱** | play_style_params / adaptive_params 修改后不持久化 | 已知 | CLAUDE.md 已记录：必须 `flag_modified(obj, "field")`。所有涉及 JSON 字段修改的 service 代码需严格遵守 |

### 4.3 低风险

| 风险 | 影响 | 概率 | 应对 |
|------|------|------|------|
| **课程表结构不够用** | Level 2-3 可能需要新的内容类型 | 低 | content_data JSON 字段灵活性高，新的互动类型通过 content_type 枚举值扩展 |
| **角色解锁条件复杂** | 多维度条件判断逻辑复杂易出错 | 低 | 解锁条件定义在 characters.unlock_condition JSON 中，由统一的 CharacterUnlockService 解析执行，单元测试覆盖每种条件组合 |

---

## 5. 角色解锁机制详细设计

### 5.1 unlock_condition JSON 结构规范

```json
// 豆丁 — 默认解锁
{"type": "default"}

// 棉花糖 — 完成 Level 0 前3课 + 完成1场对弈
{
  "type": "multi",
  "conditions": [
    {"type": "course_lessons", "course_slug": "level_0", "min_lessons": 3},
    {"type": "games_played", "min_count": 1}
  ]
}

// 冬冬 — 通过晋级挑战 + Rating >= 800
{
  "type": "multi",
  "conditions": [
    {"type": "promotion_challenge", "challenge_type": "grassland_guardian"},
    {"type": "rating", "min_rating": 800}
  ]
}

// 银鬃 — 通过晋级挑战 + Rating >= 1200 + 会员
{
  "type": "multi",
  "conditions": [
    {"type": "promotion_challenge", "challenge_type": "forest_heart"},
    {"type": "rating", "min_rating": 1200},
    {"type": "membership", "min_tier": "premium"}
  ]
}
```

### 5.2 解锁检查时机

1. **对弈结束后**：Rating 变化可能触发新角色解锁
2. **晋级挑战通过后**：直接触发对应区域角色解锁
3. **课程完成后**：某些角色依赖课程完成度
4. **前端主动查询**：角色大厅页面加载时调用 check-unlock

### 5.3 角色解锁与晋级挑战的联动

```
晋级挑战通过（草原守护者之战）
    │
    ├── 更新 promotion_challenges.status = 'passed'
    ├── 更新 user_ratings.rank_title = 'warrior_1'
    ├── 更新 user_ratings.rank_region = 'forest'
    ├── 检查并解锁冬冬（如果 Rating 条件也满足）
    │     └── 插入/更新 user_character_relations (is_unlocked=true)
    └── 返回解锁结果 + unlock_story 剧情数据给前端
```

---

## 6. 自适应难度算法设计

### 6.1 核心算法

```
输入：
  - recent_results: 最近 N 局结果 (N=10, 不足则用全部)
  - character.base_rating, character.engine_depth_min/max, character.mistake_rate

计算：
  win_rate = count(win in recent_results) / len(recent_results)

  if win_rate > 0.60:  // 用户赢太多，AI 需变强
    rating_offset += 25  (上限 +200)
    depth_adjustment += 1  (上限 +3)
    mistake_rate_adjustment -= 0.03  (下限 -0.15)
    difficulty_mode = "hard"

  elif win_rate < 0.40:  // 用户输太多，AI 需变弱
    rating_offset -= 25  (下限 -200)
    depth_adjustment -= 1  (下限 -3)
    mistake_rate_adjustment += 0.03  (上限 +0.15)
    difficulty_mode = "easy"

  else:  // 心流区间，不调整
    difficulty_mode = "normal"

输出（传给引擎层）：
  effective_depth_min = character.engine_depth_min + depth_adjustment
  effective_depth_max = character.engine_depth_max + depth_adjustment
  effective_mistake_rate = character.mistake_rate + mistake_rate_adjustment
  effective_rating = character.base_rating + rating_offset

  // 安全限幅
  effective_depth_min = max(1, effective_depth_min)
  effective_mistake_rate = max(0.0, min(0.5, effective_mistake_rate))
```

### 6.2 调整节奏控制

- **冷却期**：每次调整后至少间隔 3 局才能再次调整
- **衰减机制**：超过 7 天未与某角色对弈，offset 自动衰减 50%（防止长期不玩后回来难度失真）
- **重置入口**：用户可手动重置某角色的自适应状态（通过角色大厅 UI）

---

## 7. 弱点诊断计算逻辑

### 7.1 各维度得分计算方式

| 维度 | 数据来源 | 计算公式 |
|------|---------|---------|
| opening_score | game_moves WHERE game_phase='opening' | 100 - (opening阶段失误率 * 100)，失误率 = (mistake+blunder) / total_opening_moves |
| middlegame_tactics_score | puzzle_attempts + game_moves WHERE game_phase='middlegame' | 0.6 * 谜题正确率 + 0.4 * (100 - 中局失误率) |
| middlegame_strategy_score | games (走步数、子力差、位置分趋势) | 基于对弈中的平均走步数、中局位置评分趋势（需要 eval_score 数据） |
| endgame_score | game_moves WHERE game_phase='endgame' | 100 - (残局阶段失误率 * 100)，加权残局到位时间 |
| time_management_score | game_moves.time_spent_ms | 基于走子平均用时和用时波动的稳定性评分 |

### 7.2 theme_scores 计算

```
FOR EACH theme IN puzzles.themes:
  correct = COUNT(puzzle_attempts WHERE is_correct=true AND puzzle.themes CONTAINS theme)
  total = COUNT(puzzle_attempts WHERE puzzle.themes CONTAINS theme)
  score = (correct / total) * 100
  theme_scores[theme] = {correct, total, score}
```

### 7.3 weakest_dimensions 排序

取 scores 中得分最低的 3 个维度 + theme_scores 中得分最低的 2 个主题（且 total >= 5），合并后取前 3。

### 7.4 推荐生成规则

| 弱点维度 | 推荐类型 | 匹配逻辑 |
|---------|---------|---------|
| 开局差 | course | 推荐 Level 2 中开局相关课程 |
| 某主题谜题差 | puzzle_theme | 推荐该主题的更多谜题 |
| 中局战略差 | practice_game + course | 推荐与位置型角色(云朵师父)对弈 + Level 3 战略课程 |
| 残局差 | course + puzzle_theme | 推荐残局课程（Level 3/4） + 残局谜题 |
| 时间管理差 | training_plan | 推荐限时训练模板 |

---

## 8. Phase 2b 预留接口

| Phase 2b 功能 | 本次预留 |
|--------------|---------|
| LLM 角色对话 | character_dialogues 表 scene 字段可扩展 'llm_prompt' 类型，content 存 prompt template |
| 金币商城 | weakness_recommendations.target_id 可关联商城商品 |
| 复盘分享 | games.review_data 已有，无需额外预留 |
| 大师会员 | characters.unlock_condition 已支持 membership 条件类型 |
| 家长面板 | user_weakness_profiles 数据可直接用于家长报告 |

---

## 9. 迁移脚本清单

| 序号 | 迁移文件 | 内容 | 依赖 |
|------|---------|------|------|
| 001 | alter_characters_add_fields | characters 新增 play_style_params, unlock_story, region | 无 |
| 002 | alter_user_character_relations_add_affinity_level | user_character_relations 新增 affinity_level | 无 |
| 003 | alter_games_add_adaptive_fields | games 新增 difficulty_mode, adaptive_params | 无 |
| 004 | alter_game_moves_add_classification | game_moves 新增 move_classification, game_phase | 无 |
| 005 | create_user_weakness_profiles | 创建 user_weakness_profiles 表 | 无 |
| 006 | create_weakness_recommendations | 创建 weakness_recommendations 表 | 005 |
| 007 | create_adaptive_difficulty_configs | 创建 adaptive_difficulty_configs 表 | 无 |
| 008 | seed_new_characters | 插入6个新角色数据 + 对话 | 001, 内容 JSON |
| 009 | seed_level2_course | 插入 Level 2 课程数据 | 内容 JSON |
| 010 | seed_level3_course | 插入 Level 3 课程数据 | 内容 JSON |
| 011 | backfill_game_moves_phase | 历史 game_moves 回填 game_phase 字段 | 004 |
| 012 | update_existing_characters | 更新现有3个角色的 play_style_params 和 region | 001 |

迁移 001-007 可在 Sprint 2a-0 末尾执行（不依赖内容），008-012 在 Sprint 2a-1 内容就绪后执行。
