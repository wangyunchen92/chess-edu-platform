# 棋育首发 5 条视频脚本

首发批次，按发布顺序：

| # | 文件 | 类型 | 时长 | 核心钩子 |
|---|---|---|---|---|
| 1 | [01-pain-no-time.md](01-pain-no-time.md) | 痛点 | 30s | 家长不会下棋也没时间 → AI 解决 |
| 2 | [02-product-douding.md](02-product-douding.md) | 产品 IP | 40s | 豆丁老师陪孩子对弈 |
| 3 | [03-data-weekly-report.md](03-data-weekly-report.md) | 学习数据 | 35s | 家长一周报告看得见效果 |
| 4 | [04-emotion-meadow-badge.md](04-emotion-meadow-badge.md) | 情感瞬间 | 40s | 草原小考毕业徽章 🌿 |
| 5 | [05-ai-personalized.md](05-ai-personalized.md) | AI 因材施教 | 45s | 弱点诊断 → 自动训练计划 |

## 通用参数

- **平台**：抖音（竖版 1080×1920）+ 视频号（同）+ 小红书（1080×1350）
- **受众**：主 K 家长，次 K 孩子
- **配音**：ChatTTS seed1111（温柔女声）
- **字幕**：drawtext 烧录（STHeiti Medium fontsize=28 白字黑描边）
- **BGM**：童趣温馨风 15% 音量，开头淡入 2s，结尾淡出 5s
- **品牌元素**：
  - 品牌色：参考前端 `--accent` 蓝紫
  - LOGO："🏰 棋境大陆"
  - Slogan："让孩子在家，学会国际象棋"
  - 角标位置：右下角，含邀请码"xxxx"

## 生产流水线

详见 `~/.claude/projects/.../memory/shared/skill_video_production.md`

步骤：
1. 每条脚本里列出 Playwright 截图清单 → 跑一次性截图脚本
2. ChatTTS 分段生成配音 wav（每条脚本里分段标好）
3. 开场/结尾画面用 Playwright setContent HTML 截图
4. 每段"图片 + 配音 + drawtext 字幕"单独合成 mp4 片段
5. concat 拼接 + 混 BGM
6. 输出 3 个版本（抖音 1080×1920 / 视频号 同 / 小红书 1080×1350）

## 演示账号

视频里的录屏请用**专门的演示账号**，不用 admin/student（那些测试账号会有测试残留数据）。

建议新建：
- 用户名：`demo_kid`（或 `小明`）
- 密码：随意
- 预埋数据：
  - 和豆丁下过 15 局（10 胜 5 负）
  - 完成 Level 0 前 3 课
  - 草原小考已通过（有「启蒙草原毕业」徽章）
  - 弱点诊断：战术-开局-残局分布自然
  - 最近活跃 7 天连续（streak=7）

运营侧创建时顺带准备好这批演示数据，不然录屏画面数据是 0 不好看。

## 邀请码

海报/视频角标用的邀请码，建议每渠道一个：
- 抖音：`DY2026`
- 视频号：`WX2026`
- 小红书：`XHS2026`
- 线下地推：`LN2026`

（运营在后台统一创建，追踪各渠道转化率）
