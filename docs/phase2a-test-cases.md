# Phase 2a Sprint 1 测试用例

> 版本：v1.0 | 日期：2026-03-30 | 作者：qa-agent
> 基于：Phase 2a 架构设计 v1.0 + Phase 2a 规划文档 v1.0
> 原则：TDD — 测试用例先于实现代码编写，验收标准明确可执行

---

## 测试环境

| 项目 | 值 |
|------|-----|
| 后端地址 | http://localhost:8000 |
| 前端地址 | http://localhost:5173 |
| 测试账号（学生） | student / 123456 |
| 测试账号（管理员） | admin / admin123 |
| API 前缀 | /api/v1 |
| 统一响应格式 | `{ code: 0, message: "success", data: T }` |
| 错误响应格式 | `{ code: <status>, message: "<error>", data: null }` |

---

## 一、接口测试

### F1: AI 角色扩展

#### TC-API-F1-001 角色列表返回9个角色并按段位分组

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F1-001 |
| **标题** | GET /play/characters 返回9个角色，按段位分组 |
| **优先级** | P0 |
| **前置条件** | 6个新角色种子数据已导入 characters 表；用户已登录获取 token |
| **测试步骤** | 1. 发送 `GET /api/v1/play/characters`，Header 带 Authorization: Bearer {token} |
| **预期结果** | 1. 返回 code=0，data 为数组，长度=9 <br> 2. 入门段(beginner)角色3个：豆丁(base_rating=500)、棉花糖(base_rating=650)、龟龟(base_rating=750) <br> 3. 初级段(intermediate)角色3个：冬冬(base_rating=850)、狸花花(base_rating=1000)、铁墩墩(base_rating=1100) <br> 4. 中级段(advanced)角色3个：银鬃(base_rating=1300)、咕噜(base_rating=1450)、云朵师父(base_rating=1550) <br> 5. 每个角色包含 `region` 字段（meadow/forest/plateau） <br> 6. 每个角色包含 `play_style_params` 字段且为 JSON 对象 |

---

#### TC-API-F1-002 未解锁角色标记 is_unlocked=false

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F1-002 |
| **标题** | GET /play/characters 未解锁角色 is_unlocked=false |
| **优先级** | P0 |
| **前置条件** | 新注册用户（Rating 较低，未通过任何晋级挑战），已登录 |
| **测试步骤** | 1. 发送 `GET /api/v1/play/characters` |
| **预期结果** | 1. 入门段角色中，豆丁 is_unlocked=true（默认解锁） <br> 2. 棉花糖根据解锁条件（完成 Level 0 前3课+1场对弈），新用户 is_unlocked=false <br> 3. 初级段3个角色（冬冬、狸花花、铁墩墩）全部 is_unlocked=false <br> 4. 中级段3个角色（银鬃、咕噜、云朵师父）全部 is_unlocked=false <br> 5. 未解锁角色包含 `unlock_condition` 字段描述解锁条件 |

---

#### TC-API-F1-003 段位达标时可解锁角色

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F1-003 |
| **标题** | POST /play/characters/{id}/unlock 段位达标解锁成功 |
| **优先级** | P0 |
| **前置条件** | 用户 Rating >= 800 且已通过「草原守护者之战」晋级挑战（promotion_challenges 记录 status='passed'） |
| **测试步骤** | 1. 获取冬冬的 character_id <br> 2. 发送 `POST /api/v1/play/characters/{character_id}/unlock` |
| **预期结果** | 1. 返回 code=0 <br> 2. data.unlocked=true <br> 3. data.character_name="冬冬" <br> 4. data.unlock_story 为非空数组，包含剧情对话（speaker/text/emotion 字段） <br> 5. user_character_relations 表中该用户与冬冬的 is_unlocked 更新为 true <br> 6. 再次调用 GET /play/characters 时，冬冬的 is_unlocked=true |

---

#### TC-API-F1-004 段位不足时解锁返回失败

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F1-004 |
| **标题** | POST /play/characters/{id}/unlock 段位不足返回条件不满足 |
| **优先级** | P0 |
| **前置条件** | 用户 Rating=650，未通过晋级挑战 |
| **测试步骤** | 1. 获取冬冬的 character_id <br> 2. 发送 `POST /api/v1/play/characters/{character_id}/unlock` |
| **预期结果** | 1. 返回 code=0（注意：架构设计中条件不满足也返回200，通过 data.unlocked=false 区分） <br> 2. data.unlocked=false <br> 3. data.missing_conditions 为数组，至少包含： <br> -- `{"type": "rating", "required": 800, "current": 650}` <br> -- `{"type": "promotion_challenge", "required": "草原守护者之战", "completed": false}` <br> 4. user_character_relations 表中 is_unlocked 仍为 false |

---

#### TC-API-F1-005 角色对话数据完整性

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F1-005 |
| **标题** | 每个角色12场景各有对话数据 |
| **优先级** | P0 |
| **前置条件** | 角色对话种子数据已导入 character_dialogues 表 |
| **测试步骤** | 1. 对9个角色逐一查询 character_dialogues 表 <br> 2. 检查每个角色在以下12个场景是否有对话记录：greeting, game_start, player_good_move, player_mistake, ai_winning, ai_losing, ai_win, ai_lose, draw, hint, encourage, farewell |
| **预期结果** | 1. 每个角色在12个场景中均有至少5条对话记录 <br> 2. 每条对话包含 content（非空字符串）、emotion（合法表情标识）、sort_order <br> 3. 新增 unlock_story 场景的对话：6个新角色各有至少1条 unlock_story 场景对话 |

---

#### TC-API-F1-006 角色解锁条件查询接口

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F1-006 |
| **标题** | POST /play/characters/{id}/check-unlock 查询解锁条件 |
| **优先级** | P1 |
| **前置条件** | 用户已登录，冬冬角色存在 |
| **测试步骤** | 1. 发送 `POST /api/v1/play/characters/{character_id}/check-unlock` |
| **预期结果** | 1. 返回 code=0 <br> 2. data.conditions 为数组，每个条件包含 type, label, required, current（或 met 布尔值） <br> 3. data.is_unlocked 准确反映用户当前是否满足全部条件 <br> 4. 该接口为只读，不会修改 user_character_relations |

---

#### TC-API-F1-007 角色棋风参数差异化验证

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F1-007 |
| **标题** | 不同段位角色的棋风参数差异化 |
| **优先级** | P1 |
| **前置条件** | 9个角色数据已导入 |
| **测试步骤** | 1. 发送 `GET /api/v1/play/characters` <br> 2. 提取每个角色的 base_rating, play_style_params, engine_depth_min, engine_depth_max, mistake_rate |
| **预期结果** | 1. 入门段：base_rating 500-750, depth 较浅(2-6), mistake_rate 较高(0.3-0.45) <br> 2. 初级段：base_rating 850-1100, depth 中等(6-10), mistake_rate 中等(0.15-0.25) <br> 3. 中级段：base_rating 1300-1550, depth 较深(10-14), mistake_rate 较低(0.05-0.1) <br> 4. 狸花花 play_style_params.prefer_traps=true <br> 5. 铁墩墩 play_style_params.defensive_bias=0.8 <br> 6. 银鬃 play_style_params.aggressive_bias=0.7 <br> 7. 咕噜 play_style_params.trap_frequency=0.3 <br> 8. 云朵师父 play_style_params.positional_bias=0.8 |

---

### F2: Level 2-3 课程

#### TC-API-F2-001 课程列表返回4个课程

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F2-001 |
| **标题** | GET /learn/courses 返回4个课程（L0/L1/L2/L3） |
| **优先级** | P0 |
| **前置条件** | Level 2、Level 3 课程种子数据已导入 courses 表；用户已登录 |
| **测试步骤** | 1. 发送 `GET /api/v1/learn/courses` |
| **预期结果** | 1. 返回 code=0，data 数组长度=4 <br> 2. 包含 Level 0（零基础启蒙，10课）、Level 1（初级提高，15课）、Level 2（基础战术，约15课）、Level 3（中级战略，约15课） <br> 3. 每个课程包含 id, title, level, description, is_free, membership_required 字段 <br> 4. Level 2 的 prerequisite_id 指向 Level 1 的 id <br> 5. Level 3 的 prerequisite_id 指向 Level 2 的 id |

---

#### TC-API-F2-002 Level 2/3 课程详情包含 lessons 列表

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F2-002 |
| **标题** | GET /learn/courses/{id} 返回 Level 2/3 课程的 lessons 列表 |
| **优先级** | P0 |
| **前置条件** | Level 2、Level 3 课程及其课时数据已导入 |
| **测试步骤** | 1. 获取 Level 2 课程的 id <br> 2. 发送 `GET /api/v1/learn/courses/{level2_id}` <br> 3. 获取 Level 3 课程的 id <br> 4. 发送 `GET /api/v1/learn/courses/{level3_id}` |
| **预期结果** | 1. Level 2 响应中 lessons 数组长度约15，每个 lesson 包含 id, title, unit_name, unit_order, sort_order <br> 2. Level 2 课程主题涵盖：双重攻击、牵制、闪击、串击、引入/引离等战术 <br> 3. Level 3 响应中 lessons 数组长度约15 <br> 4. Level 3 课程主题涵盖：中局计划、兵结构、开放线控制、弱格利用等战略 <br> 5. 每个 lesson 的 sort_order 递增，unit_name 非空 |

---

#### TC-API-F2-003 课程前置条件检查

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F2-003 |
| **标题** | 未完成 Level 1 不能开始 Level 2 |
| **优先级** | P0 |
| **前置条件** | 用户未完成 Level 1 课程（lesson_progresses 中 Level 1 未全部 status='completed'） |
| **测试步骤** | 1. 获取 Level 2 课程的第一课 lesson_id <br> 2. 发送 `GET /api/v1/learn/lessons/{lesson_id}` 或 `POST /api/v1/learn/lessons/{lesson_id}/progress` 尝试开始学习 |
| **预期结果** | 1. 返回错误响应（code 非0，如 403 或业务错误码） <br> 2. message 中包含提示信息，说明需要先完成 Level 1 <br> 3. 同理，未完成 Level 2 不能开始 Level 3 的课时 |

---

#### TC-API-F2-004 已完成前置课程可正常开始后续课程

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F2-004 |
| **标题** | 完成 Level 1 后可正常访问 Level 2 课时 |
| **优先级** | P1 |
| **前置条件** | 用户已完成 Level 1 全部课时（lesson_progresses 全部 status='completed'） |
| **测试步骤** | 1. 获取 Level 2 第一课 lesson_id <br> 2. 发送 `GET /api/v1/learn/lessons/{lesson_id}` |
| **预期结果** | 1. 返回 code=0 <br> 2. data 中包含完整的课时内容（title, content_data 等） <br> 3. content_data 为有效 JSON，包含讲解内容和互动棋盘数据 |

---

### F3: 弱点诊断

#### TC-API-F3-001 新用户获取弱点画像返回数据不足提示

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F3-001 |
| **标题** | GET /diagnosis/profile 新用户返回数据不足提示 |
| **优先级** | P0 |
| **前置条件** | 新用户（对弈不足10局且谜题不足30道），已登录 |
| **测试步骤** | 1. 发送 `GET /api/v1/diagnosis/profile` |
| **预期结果** | 1. 返回 code=0 <br> 2. data.confidence="low" <br> 3. data.scores=null <br> 4. data.games_analyzed < 10 <br> 5. data.puzzles_analyzed < 30 <br> 6. data.min_games_required=10 <br> 7. data.min_puzzles_required=30 <br> 8. data.message 包含友好提示文本（如"需要更多对弈和解题数据才能生成准确的弱点诊断"） |

---

#### TC-API-F3-002 触发分析但数据不足时返回提示

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F3-002 |
| **标题** | POST /diagnosis/analyze 数据不足时返回提示 |
| **优先级** | P0 |
| **前置条件** | 新用户（对弈不足10局且谜题不足30道） |
| **测试步骤** | 1. 发送 `POST /api/v1/diagnosis/analyze`，body: `{"force": false}` |
| **预期结果** | 1. 返回 code=0 <br> 2. data.analyzed=false 或 data.confidence="low" <br> 3. 返回当前已分析的 games_analyzed 和 puzzles_analyzed 数值 <br> 4. 不会因数据不足而报错（优雅降级） |

---

#### TC-API-F3-003 数据充足时获取弱点画像

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F3-003 |
| **标题** | GET /diagnosis/profile 数据充足时返回完整弱点画像 |
| **优先级** | P0 |
| **前置条件** | 用户已完成至少10局对弈和30道谜题（可通过数据库直接插入测试数据） |
| **测试步骤** | 1. 发送 `GET /api/v1/diagnosis/profile` |
| **预期结果** | 1. 返回 code=0 <br> 2. data.confidence 为 "medium" 或 "high" <br> 3. data.scores 包含5个维度分数（opening_score, middlegame_tactics_score, middlegame_strategy_score, endgame_score, time_management_score），每个值在 0-100 范围内 <br> 4. data.theme_scores 为对象，包含至少1个主题及其 correct/total/score <br> 5. data.weakest_dimensions 为数组，长度不超过3 <br> 6. data.last_analyzed_at 为有效时间戳 |

---

#### TC-API-F3-004 获取推荐训练列表

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F3-004 |
| **标题** | GET /diagnosis/recommendations 返回推荐训练列表 |
| **优先级** | P0 |
| **前置条件** | 用户弱点画像已生成（confidence >= medium） |
| **测试步骤** | 1. 发送 `GET /api/v1/diagnosis/recommendations?limit=5&status=active` |
| **预期结果** | 1. 返回 code=0 <br> 2. data 为数组，长度 <= 5 <br> 3. 每个推荐项包含 id, weakness_dimension, recommendation_type, target_label, priority, status, reason <br> 4. recommendation_type 为 puzzle_theme / course / training_plan / practice_game 之一 <br> 5. 推荐项按 priority 升序排列（0=最高） <br> 6. 推荐项的 target_label 为中文可读文案 |

---

#### TC-API-F3-005 触发全量重新分析

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F3-005 |
| **标题** | POST /diagnosis/analyze force=true 触发全量重算 |
| **优先级** | P1 |
| **前置条件** | 用户已有弱点画像，且新增了对弈/谜题数据 |
| **测试步骤** | 1. 记录当前 profile 的 last_analyzed_at <br> 2. 发送 `POST /api/v1/diagnosis/analyze`，body: `{"force": true}` <br> 3. 再次 GET /diagnosis/profile |
| **预期结果** | 1. analyze 返回 data.analyzed=true <br> 2. data.changes 数组记录了各维度分数变化（old_score, new_score, trend） <br> 3. 重新获取 profile 时，last_analyzed_at 已更新为最新时间 |

---

#### TC-API-F3-006 Dashboard 弱点摘要接口

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F3-006 |
| **标题** | GET /diagnosis/summary 返回 Dashboard 用弱点摘要 |
| **优先级** | P1 |
| **前置条件** | 用户已有弱点画像 |
| **测试步骤** | 1. 发送 `GET /api/v1/diagnosis/summary` |
| **预期结果** | 1. 返回 code=0 <br> 2. data.has_diagnosis=true <br> 3. data.confidence 为有效值 <br> 4. data.primary_weakness 包含 dimension, label, score, suggestion <br> 5. data.active_recommendations_count >= 0 |

---

#### TC-API-F3-007 更新推荐项状态

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F3-007 |
| **标题** | PATCH /diagnosis/recommendations/{id} 更新推荐项状态 |
| **优先级** | P2 |
| **前置条件** | 用户有至少1条 active 状态的推荐项 |
| **测试步骤** | 1. GET /diagnosis/recommendations 获取一条 active 推荐项的 id <br> 2. 发送 `PATCH /api/v1/diagnosis/recommendations/{id}`，body: `{"status": "completed"}` <br> 3. 再次 GET /diagnosis/recommendations?status=active |
| **预期结果** | 1. PATCH 返回 code=0，data.status="completed" <br> 2. 再次查询 active 推荐项时，该项不再出现 |

---

### F4: 自适应难度

#### TC-API-F4-001 对弈结算后 adaptive_difficulty_configs 记录更新

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F4-001 |
| **标题** | 对弈结算后自适应难度配置记录被更新 |
| **优先级** | P0 |
| **前置条件** | 用户已解锁并选择某角色（如豆丁），adaptive_difficulty_configs 表中该用户+角色无记录或有初始记录 |
| **测试步骤** | 1. 创建对局：`POST /api/v1/play/games`（选择豆丁角色） <br> 2. 完成对局：`POST /api/v1/play/games/{game_id}/complete`（提交结果为 win） <br> 3. 查询数据库 adaptive_difficulty_configs 表 |
| **预期结果** | 1. adaptive_difficulty_configs 表中存在该 user_id + character_id 的记录 <br> 2. recent_results 数组包含最新一局结果 "win" <br> 3. recent_win_rate 已重新计算 <br> 4. games 表中该对局的 difficulty_mode 字段非空（easy/normal/hard） <br> 5. games 表中该对局的 adaptive_params 字段包含本局使用的参数快照 |

---

#### TC-API-F4-002 连续输3局后 AI 难度降低

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F4-002 |
| **标题** | 连续输3局后 AI 难度应降低 |
| **优先级** | P0 |
| **前置条件** | 用户对某角色的 adaptive_difficulty_configs 初始状态为默认（offset=0） |
| **测试步骤** | 1. 连续完成3局对弈，结果均为 loss（通过 POST /play/games/{id}/complete 提交） <br> 2. 查询 adaptive_difficulty_configs <br> 3. 发送 `GET /api/v1/play/adaptive/{character_id}` |
| **预期结果** | 1. recent_results 至少包含3个 "loss" <br> 2. recent_win_rate < 0.40 <br> 3. current_rating_offset < 0（AI 变弱） <br> 4. current_depth_adjustment < 0 或 current_mistake_rate_adjustment > 0 <br> 5. GET adaptive 返回 difficulty_mode="easy" <br> 6. effective_rating < base_rating |

---

#### TC-API-F4-003 连续赢3局后 AI 难度提升

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F4-003 |
| **标题** | 连续赢3局后 AI 难度应提升 |
| **优先级** | P0 |
| **前置条件** | 用户对某角色的 adaptive_difficulty_configs 初始状态为默认 |
| **测试步骤** | 1. 连续完成3局对弈，结果均为 win <br> 2. 查询 adaptive_difficulty_configs <br> 3. 发送 `GET /api/v1/play/adaptive/{character_id}` |
| **预期结果** | 1. recent_results 至少包含3个 "win" <br> 2. recent_win_rate > 0.60 <br> 3. current_rating_offset > 0（AI 变强） <br> 4. current_depth_adjustment > 0 或 current_mistake_rate_adjustment < 0 <br> 5. GET adaptive 返回 difficulty_mode="hard" <br> 6. effective_rating > base_rating |

---

#### TC-API-F4-004 心流区间不调整难度

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F4-004 |
| **标题** | 胜率在40%-60%区间内不调整难度 |
| **优先级** | P1 |
| **前置条件** | 用户对某角色有5局记录，胜率恰好50%（如 win, loss, win, loss, win） |
| **测试步骤** | 1. 确认 adaptive_difficulty_configs 中 recent_win_rate 在 0.40-0.60 <br> 2. 完成一局（使胜率仍在区间内） <br> 3. 查询 adaptive_difficulty_configs |
| **预期结果** | 1. current_rating_offset 不变 <br> 2. difficulty_mode="normal" |

---

#### TC-API-F4-005 自适应参数限幅验证

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F4-005 |
| **标题** | 自适应参数不超过限幅范围 |
| **优先级** | P1 |
| **前置条件** | 用户对某角色已连续输很多局，offset 接近下限 |
| **测试步骤** | 1. 通过数据库将 current_rating_offset 设为 -190 <br> 2. 完成1局 loss <br> 3. 查询 adaptive_difficulty_configs |
| **预期结果** | 1. current_rating_offset >= -200（不低于下限） <br> 2. current_depth_adjustment >= -3 <br> 3. current_mistake_rate_adjustment <= 0.15 <br> 4. 同理验证上限：rating_offset <= +200, depth_adjustment <= +3, mistake_rate_adjustment >= -0.15 |

---

#### TC-API-F4-006 获取自适应难度状态接口

| 字段 | 内容 |
|------|------|
| **编号** | TC-API-F4-006 |
| **标题** | GET /play/adaptive/{character_id} 返回自适应状态 |
| **优先级** | P1 |
| **前置条件** | 用户与某角色有对弈记录 |
| **测试步骤** | 1. 发送 `GET /api/v1/play/adaptive/{character_id}` |
| **预期结果** | 1. 返回 code=0 <br> 2. data 包含 character_id, character_name, base_rating, effective_rating, difficulty_mode <br> 3. data.recent_win_rate 在 0.0-1.0 范围内 <br> 4. data.recent_results 为字符串数组（元素为 win/loss/draw） <br> 5. data.adjustment_detail 包含 rating_offset, depth_adjustment, mistake_rate_adjustment |

---

## 二、页面实操测试

> 页面实操测试必须启动前后端服务（make backend-dev + make frontend-dev），在浏览器中实际操作验证。

### F1: AI 角色扩展

#### TC-UI-F1-001 角色大厅显示9个角色卡片

| 字段 | 内容 |
|------|------|
| **编号** | TC-UI-F1-001 |
| **标题** | 角色大厅显示9个角色卡片 |
| **优先级** | P0 |
| **前置条件** | 启动前后端服务；以 student 账号登录 |
| **测试步骤** | 1. 导航到 /play 或 /play/characters（角色大厅页面） <br> 2. 观察页面渲染 |
| **预期结果** | 1. 页面正常加载，无白屏、无 JS 报错 <br> 2. 显示9个角色卡片 <br> 3. 卡片按段位分组展示：入门段（3个）、初级段（3个）、中级段（3个） <br> 4. 每个分组有明确的标题或视觉分隔 <br> 5. 每个角色卡片显示：头像（或占位图）、名称、Rating、简介 <br> 6. 不出现 undefined、null、NaN 等异常数据 |

---

#### TC-UI-F1-002 未解锁角色显示锁定样式+解锁条件

| 字段 | 内容 |
|------|------|
| **编号** | TC-UI-F1-002 |
| **标题** | 未解锁角色显示锁定样式和解锁条件提示 |
| **优先级** | P0 |
| **前置条件** | 以新用户（Rating 较低）登录 |
| **测试步骤** | 1. 进入角色大厅 <br> 2. 查看初级段和中级段的角色卡片 <br> 3. 点击一个未解锁角色（如冬冬） |
| **预期结果** | 1. 未解锁角色卡片有明显的锁定视觉样式（如灰色遮罩、锁图标、透明度降低） <br> 2. 卡片上或悬浮提示中显示解锁条件（如"对弈 Rating >= 800 + 通过草原守护者之战"） <br> 3. 点击未解锁角色不会进入对弈页面 <br> 4. 点击后应显示解锁条件弹窗/提示，而非无响应或跳转到空白页 |

---

#### TC-UI-F1-003 点击已解锁角色可进入对弈

| 字段 | 内容 |
|------|------|
| **编号** | TC-UI-F1-003 |
| **标题** | 点击已解锁角色可进入对弈页面 |
| **优先级** | P0 |
| **前置条件** | 以 student 登录，豆丁为默认解锁角色 |
| **测试步骤** | 1. 进入角色大厅 <br> 2. 找到豆丁卡片（应为已解锁状态） <br> 3. 点击豆丁卡片 |
| **预期结果** | 1. 页面跳转到对弈页面（/play/game 或类似路由） <br> 2. 对弈页面正常加载棋盘 <br> 3. 棋盘上的棋子正常渲染（不是空白或缺失图片） <br> 4. 角色头像和名称正确显示（"豆丁"） <br> 5. 对弈可正常进行（用户可以走子） |

---

#### TC-UI-F1-004 角色卡片 region 区域标识

| 字段 | 内容 |
|------|------|
| **编号** | TC-UI-F1-004 |
| **标题** | 角色卡片显示所属区域标识 |
| **优先级** | P2 |
| **前置条件** | 启动前后端，已登录 |
| **测试步骤** | 1. 进入角色大厅 <br> 2. 检查每个段位组的角色是否有区域标识 |
| **预期结果** | 1. 入门段角色标记为"启蒙草原"(meadow) <br> 2. 初级段角色标记为"试炼森林"(forest) <br> 3. 中级段角色标记为"风暴高原"(plateau) |

---

### F2: Level 2-3 课程

#### TC-UI-F2-001 课程列表显示4个课程

| 字段 | 内容 |
|------|------|
| **编号** | TC-UI-F2-001 |
| **标题** | 课程列表显示4个课程 |
| **优先级** | P0 |
| **前置条件** | 启动前后端服务；Level 2/3 课程数据已导入；已登录 |
| **测试步骤** | 1. 导航到 /learn（课程列表页面） |
| **预期结果** | 1. 页面正常加载，无白屏 <br> 2. 显示4个课程卡片：Level 0 零基础启蒙、Level 1 初级提高、Level 2 基础战术、Level 3 中级战略 <br> 3. 每个课程卡片显示课程名称、等级、课时数量、简介 <br> 4. 课程按 Level 升序排列 <br> 5. 数据来自真实 API（非 mock 数据），可通过 Network 面板确认 API 调用成功 |

---

#### TC-UI-F2-002 Level 2/3 对未达条件用户显示锁定状态

| 字段 | 内容 |
|------|------|
| **编号** | TC-UI-F2-002 |
| **标题** | Level 2/3 对未达条件用户显示锁定状态 |
| **优先级** | P0 |
| **前置条件** | 以未完成 Level 1 的用户登录 |
| **测试步骤** | 1. 进入课程列表 /learn <br> 2. 查看 Level 2 和 Level 3 的课程卡片 <br> 3. 尝试点击 Level 2 课程 |
| **预期结果** | 1. Level 2 课程卡片显示锁定状态（如锁图标、灰色、"需先完成 Level 1"文案） <br> 2. Level 3 课程卡片显示锁定状态（如"需先完成 Level 2"文案） <br> 3. 点击锁定课程不能进入课时列表，而是显示提示信息 <br> 4. Level 0（如果 is_free=true）应为可点击状态 |

---

#### TC-UI-F2-003 已解锁课程可正常进入学习

| 字段 | 内容 |
|------|------|
| **编号** | TC-UI-F2-003 |
| **标题** | 已完成前置条件的课程可正常进入学习 |
| **优先级** | P1 |
| **前置条件** | 用户已完成 Level 1 全部课时 |
| **测试步骤** | 1. 进入课程列表 /learn <br> 2. 点击 Level 2 课程 <br> 3. 点击 Level 2 的第一课 |
| **预期结果** | 1. Level 2 课程卡片显示为可点击/已解锁状态 <br> 2. 点击后进入课时列表页面，显示约15课 <br> 3. 点击第一课进入课时详情页面 <br> 4. 课时内容正常渲染（讲解文本、互动棋盘、练习题） <br> 5. 互动棋盘可正常操作（如果有的话） |

---

### F3: 弱点诊断

#### TC-UI-F3-001 弱点诊断入口可达

| 字段 | 内容 |
|------|------|
| **编号** | TC-UI-F3-001 |
| **标题** | 弱点诊断入口可达 |
| **优先级** | P0 |
| **前置条件** | 启动前后端服务；已登录 |
| **测试步骤** | 1. 从 Dashboard 或导航栏找到弱点诊断入口 <br> 2. 点击进入弱点诊断页面 |
| **预期结果** | 1. 在 Dashboard 或导航栏中有可见的弱点诊断入口（按钮/链接/卡片） <br> 2. 点击后导航到弱点诊断页面（路由如 /diagnosis） <br> 3. 页面正常加载，无白屏、无 404 |

---

#### TC-UI-F3-002 数据不足时显示友好提示

| 字段 | 内容 |
|------|------|
| **编号** | TC-UI-F3-002 |
| **标题** | 弱点诊断数据不足时显示友好提示 |
| **优先级** | P0 |
| **前置条件** | 以新用户（对弈<10局, 谜题<30道）登录 |
| **测试步骤** | 1. 进入弱点诊断页面 |
| **预期结果** | 1. 不显示空白雷达图或全零数据 <br> 2. 显示友好的提示信息，如"数据收集中"、"需要更多对弈和解题数据" <br> 3. 提示中包含具体进度，如"已完成 3/10 局对弈，8/30 道谜题" <br> 4. 有引导用户去对弈/做谜题的按钮或链接 <br> 5. 页面无 JS 报错（API 返回 confidence=low 时前端应正常处理） |

---

#### TC-UI-F3-003 数据充足时显示弱点画像

| 字段 | 内容 |
|------|------|
| **编号** | TC-UI-F3-003 |
| **标题** | 数据充足时正确展示弱点画像图表 |
| **优先级** | P1 |
| **前置条件** | 用户已有足够数据（>= 10局 + >= 30题），弱点画像已生成 |
| **测试步骤** | 1. 进入弱点诊断页面 |
| **预期结果** | 1. 显示雷达图或柱状图，展示5个维度能力值 <br> 2. 各维度标签为中文（开局、中局战术、中局战略、残局、时间管理） <br> 3. 薄弱环节有视觉高亮（如红色标记、警告图标） <br> 4. 显示最薄弱的3个维度列表 <br> 5. 下方显示推荐训练卡片（来自 recommendations API） |

---

### F4: 自适应难度

#### TC-UI-F4-001 对弈界面显示当前难度模式

| 字段 | 内容 |
|------|------|
| **编号** | TC-UI-F4-001 |
| **标题** | 对弈界面显示当前难度模式 |
| **优先级** | P1 |
| **前置条件** | 用户与某角色有对弈历史，自适应难度已调整过 |
| **测试步骤** | 1. 进入角色大厅，选择一个有对弈记录的角色 <br> 2. 进入对弈页面 |
| **预期结果** | 1. 对弈界面上有难度模式标识（如"轻松"/"正常"/"挑战"或对应 easy/normal/hard 的中文标签） <br> 2. 标识与 adaptive_difficulty_configs 中的 difficulty_mode 一致 <br> 3. 标识位置合理，不影响棋盘操作 |

---

#### TC-UI-F4-002 对弈结算页展示难度信息

| 字段 | 内容 |
|------|------|
| **编号** | TC-UI-F4-002 |
| **标题** | 对弈结算页展示本局难度参数（可选） |
| **优先级** | P2 |
| **前置条件** | 完成一局对弈 |
| **测试步骤** | 1. 完成一局对弈 <br> 2. 查看结算/复盘页面 |
| **预期结果** | 1. 结算页面显示本局的难度模式（easy/normal/hard） <br> 2. 可选：显示 effective_rating 和 base_rating 的对比 <br> 3. 如有难度调整，显示调整方向提示（如"AI 将在下局变得更强/更弱"） |

---

## 三、测试用例汇总

### 按优先级统计

| 优先级 | 接口测试 | 页面实操测试 | 合计 |
|--------|---------|------------|------|
| P0 | 11 | 7 | 18 |
| P1 | 6 | 3 | 9 |
| P2 | 1 | 2 | 3 |
| **合计** | **18** | **12** | **30** |

### 按功能模块统计

| 功能 | 接口测试 | 页面实操测试 | 合计 |
|------|---------|------------|------|
| F1 AI角色扩展 | 7 | 4 | 11 |
| F2 Level 2-3 课程 | 4 | 3 | 7 |
| F3 弱点诊断 | 7 | 3 | 10 |
| F4 自适应难度 | 6 | 2 | 8 |

---

## 四、验收标准（Sprint 1 整体）

### 通过条件

- [ ] 全部 P0 用例通过（18个）
- [ ] P1 用例通过率 >= 90%（允许1个降级）
- [ ] P2 用例作为参考，不阻塞上线
- [ ] 无 Blocker 和 Critical 级别 Bug 遗留
- [ ] 回归测试：Phase 1 核心功能（入门角色对弈、Level 0-1 课程、谜题、训练、段位）未被破坏

### 不通过条件（任一触发即退回修复）

- P0 用例有任何 Fail
- 页面白屏或 JS 报错
- API 返回 500 错误
- 数据出现 undefined/null/NaN 异常显示
- 解锁逻辑错误（不该解锁的能解锁，或该解锁的无法解锁）
- 自适应难度不生效（连续胜/负后参数无变化）

---

## 五、Bug 报告模板

当测试不通过时，使用以下格式提交 Bug 报告：

```markdown
### Bug Report

| 字段 | 内容 |
|------|------|
| Bug ID | BUG-2A-XXX |
| 关联测试用例 | TC-API/UI-FX-XXX |
| 严重级别 | Blocker / Critical / Major / Minor |
| 所属模块 | F1/F2/F3/F4 |
| 复现步骤 | （具体操作步骤） |
| 预期结果 | （应该发生什么） |
| 实际结果 | （实际发生了什么） |
| 截图/日志 | （附相关截图或错误日志） |
| 环境 | 浏览器版本 / 系统 |
| 指派 | backend-agent / frontend-agent / chess-engine-agent |
```
