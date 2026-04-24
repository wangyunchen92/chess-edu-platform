# 02 · 产品 IP · 豆丁老师陪孩子对弈

- 时长：约 40 秒
- 类型：产品展示 · 角色 IP 建立情感连接
- 发布顺序：第 2 条

## 标题

- **抖音**：`认识一下豆丁老师——比真人还耐心的 AI 棋手 🐰`
- **视频号**：`豆丁老师，孩子的专属 AI 棋手`
- **小红书**：`孩子已经和豆丁老师下了 30 局棋，每天主动找 TA 🥹`

## 分镜脚本

| 时间 | 画面 | 配音文稿 | 字幕 |
|---|---|---|---|
| 0-3s | **开场卡片**（HTML）<br>豆丁大头像 🐰 + "Hi，我是豆丁老师" + 副标题 | — | `Hi，我是豆丁老师` |
| 3-8s | **角色大厅**（录屏 `/play/hall`）<br>展示角色阵容，镜头停在豆丁 | 在棋境大陆，有 9 位 AI 老师陪孩子下棋。 | `9 位 AI 老师 各有个性` |
| 8-14s | **豆丁信息卡**（录屏，鼠标悬停豆丁）<br>显示：豆丁 · 评分 500 · 随机可爱 · 启蒙草原 | 豆丁是新手教练，棋风随性可爱，专门陪刚入门的小朋友。 | `评分 500 · 随机可爱` |
| 14-20s | **进入对弈**（录屏 `/play/game`）<br>孩子选豆丁 → 棋盘加载 → 豆丁说"加油！" 对话气泡 | 选好豆丁，孩子就开始了和 AI 的第一局。 | `点击开始 · 立即对弈` |
| 20-28s | **对弈过程**（录屏）<br>孩子走兵 → 豆丁思考气泡 → 豆丁走马 → 气泡："不错的一步！"<br>→ 孩子走王前卒 → 气泡："小心我的皇后哦 ~" | 下得好，豆丁会夸你。走错了，豆丁会温柔提醒。 | `对话式指导 · 温柔鼓励` |
| 28-35s | **解锁剧情**（录屏 `/play/hall` + unlock story modal）<br>小孩跟豆丁下满 10 局 → 解锁新角色"棉花糖"的剧情动画 | 下到一定水平，还能解锁新角色，每位老师都有自己的故事。 | `成长解锁 · 9 位老师` |
| 35-40s | **结尾 CTA**（HTML）<br>豆丁头像 + "等你来下第一盘！" + 二维码 + 邀请码 | 扫码注册，豆丁老师在等你。 | `🏰 棋境大陆 · 扫码开始` |

## ChatTTS 配音分段

```python
segments = [
    ("在棋境大陆，有 9 位 AI 老师陪孩子下棋。", "02_intro.wav"),
    ("豆丁是新手教练，棋风随性可爱，专门陪刚入门的小朋友。", "02_douding.wav"),
    ("选好豆丁，孩子就开始了和 AI 的第一局。", "02_start.wav"),
    ("下得好，豆丁会夸你。走错了，豆丁会温柔提醒。", "02_feedback.wav"),
    ("下到一定水平，还能解锁新角色，每位老师都有自己的故事。", "02_unlock.wav"),
    ("扫码注册，豆丁老师在等你。", "02_cta.wav"),
]
```

## Playwright 截图清单

```javascript
const shots = [
  // 角色大厅（需要滚动展示多个角色，可录 10s 视频）
  { url: '/play/hall', path: '02_hall_overview.png', wait: 3000 },
  { url: '/play/hall', path: '02_hall_douding_hover.png', wait: 3000,
    action: 'hover_character_douding' },
  // 对弈页（关键：要展示对话气泡，所以预录一局有 AI 消息的对局）
  { url: '/play/game/DEMO_DOUDING_GAME', path: '02_game_start.png', wait: 2000 },
  { url: '/play/game/DEMO_DOUDING_GAME', path: '02_game_move1.png', wait: 1500, action: 'user_move_pawn' },
  { url: '/play/game/DEMO_DOUDING_GAME', path: '02_ai_thinking.png', wait: 2000 },
  { url: '/play/game/DEMO_DOUDING_GAME', path: '02_ai_speech_praise.png', wait: 1500 },
  { url: '/play/game/DEMO_DOUDING_GAME', path: '02_ai_speech_warn.png', wait: 1500, action: 'user_bad_move' },
  // 解锁剧情
  { url: '/play/hall?unlock=mianhuatang', path: '02_unlock_modal.png', wait: 3000 },
]
```

**注意**：对弈页的对话气泡需要触发角色剧本。准备 `DEMO_DOUDING_GAME` 对局的走子序列让 AI 恰好说出"不错！"和"小心我的皇后"两句（从 `content/characters/douding_dialogues.json` 对照）。

## 开场/结尾 HTML 卡片

**开场**（豆丁自我介绍）：
```html
<div style="width:1080px;height:1920px;background:linear-gradient(180deg,#10b981,#047857);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'PingFang SC',sans-serif;">
  <div style="font-size:400px;">🐰</div>
  <div style="font-size:100px;font-weight:800;color:#fff;margin-top:60px;">Hi，我是豆丁老师</div>
  <div style="font-size:48px;color:#d1fae5;margin-top:30px;">陪孩子下棋，就交给我 ~</div>
</div>
```

**结尾 CTA**：
```html
<div style="width:1080px;height:1920px;background:linear-gradient(180deg,#10b981,#065f46);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'PingFang SC',sans-serif;">
  <div style="font-size:300px;">🐰</div>
  <div style="font-size:84px;font-weight:800;color:#fff;margin-top:60px;">等你来下第一盘！</div>
  <div style="width:500px;height:500px;background:#fff;margin-top:80px;border-radius:20px;padding:30px;">
    <div style="width:440px;height:440px;background:#000;"><!-- QR --></div>
  </div>
  <div style="font-size:42px;color:#fde68a;margin-top:40px;">邀请码：DY2026</div>
</div>
```

## 发布文案

### 抖音
```
9 位 AI 老师，每个都有独特棋风 🎯
孩子最爱豆丁老师——随性可爱、温柔鼓励
下得好夸你，走错了提醒你 🥰

扫码让孩子和豆丁下第一局
邀请码：DY2026

#国际象棋 #AI陪练 #启蒙教育 #豆丁老师
```

### 视频号
```
🐰 认识一下豆丁老师

棋境大陆的 AI 启蒙教练，专门陪 4-8 岁小朋友。
对话式指导、温柔鼓励、还会讲故事解锁新角色。

扫码注册，免费试玩。
邀请码：WX2026
```

### 小红书
```
【儿童象棋】孩子交给"豆丁老师"陪学 🐰✨

💡 豆丁是 AI 角色，不是真人老师
💡 但互动比真人还耐心：每步都点评
💡 9 位老师性格不同，下到一定水平能解锁新角色

我家娃最近每天放学就找豆丁下一盘
不用我陪，不用我教，还学得很开心 🙌

#国际象棋启蒙 #AI教育 #豆丁老师 #宝妈种草

免费试玩邀请码：XHS2026
```

## BGM 建议

- 全程：温暖童趣风，如 kids_cheerful.mp3
- 结尾 3s：品牌 stinger（短促上扬）

## 关键数据准备

演示账号 `demo_kid` 需预埋：
- 已解锁豆丁、棉花糖、桂桂 3 个角色
- 有一局 **剧本精准**的对局（走完能触发"不错的一步"+"小心我的皇后"两句台词）——可以运营侧录一局满足剧本
- 角色大厅头像、简介完整显示
