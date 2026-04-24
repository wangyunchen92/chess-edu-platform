# 01 · 痛点 · 家长不会下棋也没时间

- 时长：约 30 秒
- 类型：痛点开场（用于漏斗最上方的曝光获客）
- 发布顺序：第 1 条

## 标题

- **抖音**：`孩子想学国际象棋，家长不会陪也没时间？这样解决 👇`
- **视频号**：`孩子想学国际象棋，家长不会陪也没时间？`
- **小红书**：`孩子爱上国际象棋，但家长不会下 😭 这招真香 🏰`

## 分镜脚本

| 时间 | 画面 | 配音文稿 | 字幕 |
|---|---|---|---|
| 0-3s | **开场卡片**（Playwright HTML）<br>深色背景 · 大字 "孩子想学棋…" · 下方小字 "但是…" | — | `孩子想学国际象棋…` |
| 3-6s | **家长痛点镜头**（可用 AI 生图或 stock footage）<br>妈妈拿着棋盘发愁表情 + 旁边孩子期待 | 孩子又吵着要学国际象棋？ | `家长不会下，怎么教？` |
| 6-10s | **痛点分镜**（Playwright HTML 四宫格）<br>① 下班回家累 ② 自己不会下 ③ 培训班太贵太远 ④ 不知道孩子学得怎样 | 不会下棋，没时间陪，培训班又贵又远⋯ | `不会下棋 · 没时间 · 培训班贵` |
| 10-16s | **产品切换**（Playwright 录屏）<br>`/play/hall` 角色大厅 → 孩子点豆丁 → 进入对弈 | 现在，让 AI 老师豆丁，陪孩子下棋。 | `让 AI 老师，陪孩子学棋` |
| 16-22s | **对弈录屏**（Playwright 录屏）<br>`/play/game/xxx` 对弈中，AI 走棋动画 + 底部对话气泡"很棒！继续加油！" | 下得不错，AI 实时鼓励。下错了，AI 立刻指导。 | `走得好 AI 夸你 · 走错 AI 教你` |
| 22-27s | **数据画面**（Playwright 录屏）<br>`/diagnosis` 雷达图 → `/honor` 成长里程碑 | 每局都有数据，每周有学习报告，孩子进步家长看得见。 | `每周学习报告 · 进步看得见` |
| 27-30s | **结尾 CTA 卡片**（HTML）<br>"棋境大陆" LOGO + 大字 "扫码免费试玩" + 二维码 + 邀请码 `DY2026` | 扫码下方二维码，孩子马上能玩。 | `🏰 棋境大陆 · 扫码试玩` |

## ChatTTS 配音分段

```python
segments = [
    # 对应 3-6s
    ("孩子又吵着要学国际象棋？", "pain1.wav"),
    # 对应 6-10s
    ("不会下棋，没时间陪，培训班又贵又远。", "pain2.wav"),
    # 对应 10-16s
    ("现在，让 AI 老师豆丁，陪孩子下棋。", "solution.wav"),
    # 对应 16-22s
    ("下得不错，AI 实时鼓励。下错了，AI 立刻指导。", "feature.wav"),
    # 对应 22-27s
    ("每局都有数据，每周有学习报告，孩子进步家长看得见。", "data.wav"),
    # 对应 27-30s
    ("扫码下方二维码，孩子马上能玩。", "cta.wav"),
]
```

## Playwright 截图清单

```javascript
// 所有截图前先登录 demo_kid 账号
const shots = [
  { url: '/play', path: '01_hall.png', wait: 3000 },
  { url: '/play/hall', path: '01_hall_characters.png', wait: 3000 },
  // 录屏：进入豆丁对弈（可以用 page.video 或单图 + AI 走棋动画截几帧）
  { url: '/play/game/DEMO_GAME_ID', path: '01_game_01.png', wait: 1500 },
  { url: '/play/game/DEMO_GAME_ID', path: '01_game_02.png', wait: 3000, action: 'make_move' },
  // 数据画面
  { url: '/diagnosis', path: '01_diagnosis_radar.png', wait: 3000 },
  { url: '/honor', path: '01_honor_milestones.png', wait: 3000 },
]
```

## 开场/结尾 HTML 卡片

**开场**：
```html
<div style="width:1080px;height:1920px;background:linear-gradient(180deg,#1e1b4b,#0f172a);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'PingFang SC',sans-serif;">
  <div style="font-size:90px;font-weight:800;color:#fbbf24;text-shadow:0 0 60px rgba(251,191,36,0.4);">孩子想学棋...</div>
  <div style="font-size:56px;color:#94a3b8;margin-top:60px;">但是...</div>
</div>
```

**四宫格痛点**：
```html
<div style="width:1080px;height:1920px;background:#0f172a;padding:80px;display:grid;grid-template-columns:1fr 1fr;gap:40px;font-family:'PingFang SC',sans-serif;">
  <div style="background:rgba(239,68,68,0.15);border:2px solid rgba(239,68,68,0.4);border-radius:24px;padding:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
    <div style="font-size:100px;">😫</div>
    <div style="font-size:48px;color:#fff;text-align:center;margin-top:40px;">下班太累</div>
  </div>
  <div style="background:rgba(239,68,68,0.15);border:2px solid rgba(239,68,68,0.4);border-radius:24px;padding:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
    <div style="font-size:100px;">🤷</div>
    <div style="font-size:48px;color:#fff;text-align:center;margin-top:40px;">自己不会下</div>
  </div>
  <div style="background:rgba(239,68,68,0.15);border:2px solid rgba(239,68,68,0.4);border-radius:24px;padding:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
    <div style="font-size:100px;">💸</div>
    <div style="font-size:48px;color:#fff;text-align:center;margin-top:40px;">培训班太贵</div>
  </div>
  <div style="background:rgba(239,68,68,0.15);border:2px solid rgba(239,68,68,0.4);border-radius:24px;padding:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
    <div style="font-size:100px;">❓</div>
    <div style="font-size:48px;color:#fff;text-align:center;margin-top:40px;">学得怎么样</div>
  </div>
</div>
```

**结尾 CTA**：
```html
<div style="width:1080px;height:1920px;background:linear-gradient(180deg,#1e1b4b,#312e81);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'PingFang SC',sans-serif;">
  <div style="font-size:140px;">🏰</div>
  <div style="font-size:72px;font-weight:800;color:#fff;margin-top:40px;">棋境大陆</div>
  <div style="font-size:40px;color:#cbd5e1;margin-top:20px;">让孩子在家，学会国际象棋</div>
  <div style="width:500px;height:500px;background:#fff;margin-top:80px;border-radius:20px;padding:30px;display:flex;align-items:center;justify-content:center;">
    <div style="width:440px;height:440px;background:#000;"><!-- QR code here --></div>
  </div>
  <div style="font-size:42px;color:#fbbf24;margin-top:40px;">邀请码：DY2026</div>
  <div style="font-size:36px;color:#94a3b8;margin-top:20px;">扫码免费试玩</div>
</div>
```

## 发布文案（平台版）

### 抖音
```
孩子想学国际象棋，家长自己都不会下？🥲
别让孩子停在"兴趣阶段"——

🏰 棋境大陆：AI 老师 24 小时陪练
✅ 孩子跟豆丁老师对弈，不用家长陪
✅ 每周学习报告自动发给你
✅ 每局 AI 复盘指导

扫码免费试玩，邀请码 DY2026

#国际象棋 #儿童教育 #AI陪练 #宝妈日常
```

### 视频号
```
孩子想学国际象棋，家长不会陪也没时间？

棋境大陆，AI 陪练在线上，数据报告给家长。
7 天免费体验，扫码即玩。

邀请码：WX2026
```

### 小红书
```
【宝妈必看】孩子学国际象棋，家长 0 基础也能陪 🎯

📌 痛点：自己不会下，没时间陪，培训班又贵又远
💡 方案：AI 老师 豆丁 24/7 陪练，每周数据家长看

✨ 我家娃用了 2 周，从不会吃子到能通关「草原小考」🌿
✨ 每周看学习报告，弱点一清二楚

#国际象棋 #学棋 #育儿 #宝妈推荐 #AI教学

邀请码：XHS2026（免费试玩）
```

## BGM 建议

- 前 10s（痛点部分）：低沉或日常压力感，如 `chill_stress.mp3`
- 10s 后（产品出现）：轻快上扬，如 `upbeat_kids.mp3`
- 最后 3s：品牌感余韵

可以用两段 BGM 在 10s 处交叉淡入淡出（2s 交叉）。
