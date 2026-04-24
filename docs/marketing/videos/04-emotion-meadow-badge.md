# 04 · 情感瞬间 · 草原小考毕业徽章 🌿

- 时长：约 40 秒
- 类型：情感触动 · 孩子成就瞬间 · 家长被"感动到"转化
- 发布顺序：第 4 条

## 标题

- **抖音**：`5 岁女儿拿到国际象棋第一张毕业证书，笑了一整天 🌿`
- **视频号**：`孩子拿到第一张启蒙徽章，比奖状还激动 🎉`
- **小红书**：`女儿的第一个象棋毕业徽章 🌿 我居然被治愈了`

## 分镜脚本

| 时间 | 画面 | 配音文稿 | 字幕 |
|---|---|---|---|
| 0-3s | **开场卡片**（HTML）<br>背景：启蒙草原渐变绿 + 大字 "她 5 岁，拿到了第一张毕业证书" | — | `她 5 岁，拿到了第一张毕业证书` |
| 3-8s | **孩子画面**（stock 或 AI 生图）<br>小女孩专注看屏幕下棋 + 时钟转动暗示时间推移 | 从不会吃子，到每天主动练棋，3 个月时间。 | `3 个月 · 从零到入门` |
| 8-14s | **冒险地图**（录屏 `/adventure`）<br>"启蒙草原"区域 + 课程卡片 + 挑战"草原小考" | 在棋境大陆的启蒙草原，孩子要通过「草原小考」才能毕业。 | `启蒙草原 · 草原小考` |
| 14-22s | **答题过程**（录屏 `/adventure/quiz/meadow_exam`）<br>第 1 题：国王一次能走几步？<br>选择 A → ✓ 答对 + 解析<br>快剪 5 题过程 | 5 道棋类基础题，答对 3 题就能毕业。 | `5 题答对 3 题 · 即可毕业` |
| 22-28s | **毕业瞬间**（录屏）<br>结果页：🎉 启蒙草原毕业！5/5 + 奖励：+100 XP · +50 金币 · 🌿 徽章 | 5 题全对！启蒙草原毕业！孩子第一次拿到"毕业证书"。 | `🎉 启蒙草原毕业！` |
| 28-33s | **孩子反应**（stock）<br>女孩惊喜表情 + 跳起来欢呼 + 给妈妈看屏幕 | 那种成就感，和升学考试拿第一，一样重。 | `这种成就感 · 和拿奖状一样` |
| 33-40s | **结尾 CTA**（HTML）<br>徽章 🌿 + LOGO + 二维码 + 邀请码 | 扫码注册，让孩子拿到自己的第一张毕业证书。 | `🏰 棋境大陆 · 扫码开始冒险` |

## ChatTTS 配音分段

```python
segments = [
    ("从不会吃子，到每天主动练棋，3 个月时间。", "04_timeline.wav"),
    ("在棋境大陆的启蒙草原，孩子要通过「草原小考」才能毕业。", "04_quiz_intro.wav"),
    ("5 道棋类基础题，答对 3 题就能毕业。", "04_quiz_rule.wav"),
    ("5 题全对！启蒙草原毕业！孩子第一次拿到'毕业证书'。", "04_pass.wav"),
    ("那种成就感，和升学考试拿第一，一样重。", "04_emotion.wav"),
    ("扫码注册，让孩子拿到自己的第一张毕业证书。", "04_cta.wav"),
]
```

## Playwright 截图清单

```javascript
const shots = [
  { url: '/adventure', path: '04_map_meadow.png', wait: 3000 },
  { url: '/adventure', path: '04_meadow_expanded.png', wait: 2000, action: 'click_meadow_region' },
  // 点击「草原小考」
  { url: '/adventure', path: '04_quiz_modal.png', wait: 2000, action: 'click_meadow_exam' },
  // 答题过程（5 题每题截 1-2 张）
  { url: '/adventure/quiz/meadow_exam', path: '04_q1.png', wait: 2000 },
  { url: '/adventure/quiz/meadow_exam', path: '04_q1_correct.png', wait: 1500, action: 'click_A' },
  { url: '/adventure/quiz/meadow_exam', path: '04_q2.png', wait: 1500, action: 'click_next' },
  { url: '/adventure/quiz/meadow_exam', path: '04_q2_correct.png', wait: 1500, action: 'click_D' },
  // ... 省略 q3/q4/q5 类似
  { url: '/adventure/quiz/meadow_exam', path: '04_result_pass.png', wait: 3000 },
  // 徽章展示
  { url: '/honor', path: '04_badge_meadow.png', wait: 3000 },
]
```

**注意**：快剪 5 题可以合成一段 7 秒的快速切画。每题只保留 1-1.5 秒（镜头节奏感）。

## 开场/结尾 HTML 卡片

**开场**：
```html
<div style="width:1080px;height:1920px;background:linear-gradient(180deg,#16a34a,#064e3b);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px;font-family:'PingFang SC',sans-serif;">
  <div style="font-size:250px;">🌿</div>
  <div style="font-size:80px;font-weight:800;color:#fff;margin-top:60px;text-align:center;">她 5 岁</div>
  <div style="font-size:80px;font-weight:800;color:#fef3c7;margin-top:20px;text-align:center;">拿到了第一张毕业证书</div>
</div>
```

**毕业瞬间强调卡**（可在录屏毕业页之后叠加 2 秒定格）：
```html
<div style="width:1080px;height:1920px;background:radial-gradient(circle,#fcd34d 0%,#16a34a 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'PingFang SC',sans-serif;">
  <div style="font-size:350px;">🎉</div>
  <div style="font-size:100px;font-weight:900;color:#fff;margin-top:40px;">5 / 5 · 全对！</div>
  <div style="font-size:72px;color:#fef3c7;margin-top:40px;">启蒙草原毕业</div>
  <div style="display:flex;gap:40px;margin-top:80px;">
    <div style="background:rgba(255,255,255,0.2);border-radius:20px;padding:30px 50px;">
      <div style="font-size:48px;color:#fff;">+100</div>
      <div style="font-size:28px;color:#fef3c7;">XP</div>
    </div>
    <div style="background:rgba(255,255,255,0.2);border-radius:20px;padding:30px 50px;">
      <div style="font-size:48px;color:#fff;">+50</div>
      <div style="font-size:28px;color:#fef3c7;">金币</div>
    </div>
    <div style="background:rgba(255,255,255,0.2);border-radius:20px;padding:30px 50px;">
      <div style="font-size:48px;color:#fff;">🌿</div>
      <div style="font-size:28px;color:#fef3c7;">徽章</div>
    </div>
  </div>
</div>
```

**结尾 CTA**：
```html
<div style="width:1080px;height:1920px;background:linear-gradient(180deg,#16a34a,#064e3b);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'PingFang SC',sans-serif;">
  <div style="font-size:300px;">🌿</div>
  <div style="font-size:72px;font-weight:800;color:#fff;margin-top:40px;">让孩子</div>
  <div style="font-size:72px;font-weight:800;color:#fef3c7;margin-top:10px;">拿到自己的毕业证书</div>
  <div style="width:500px;height:500px;background:#fff;margin-top:60px;border-radius:20px;padding:30px;">
    <div style="width:440px;height:440px;background:#000;"><!-- QR --></div>
  </div>
  <div style="font-size:42px;color:#fde68a;margin-top:40px;">邀请码：DY2026</div>
</div>
```

## 发布文案

### 抖音
```
我家 5 岁女儿，今天哭着跑来跟我说："妈妈，我毕业了！"

😂 我懵了——才 5 岁毕业什么？

原来是她在棋境大陆的「草原小考」5 题全对，拿到了🌿 启蒙毕业徽章。

那种孩子发自内心的成就感，比我给她买任何礼物都珍贵。

扫码让你家娃也能有这个瞬间 ✨
邀请码：DY2026

#育儿 #儿童成长 #国际象棋 #亲子
```

### 视频号
```
5 岁女儿拿到了人生第一张"毕业证书" 🌿

国际象棋启蒙草原小考 · 5 题全对通过
那种成就感，比奖状还珍贵

棋境大陆 · 让孩子收获自己的毕业时刻
扫码体验，邀请码：WX2026
```

### 小红书
```
【治愈瞬间】女儿的第一张国际象棋毕业证书 🌿✨

📌 3 个月前：连兵怎么走都不知道
📌 今天：5 题全对通过「启蒙草原小考」
📌 看着她激动得跳起来，我眼眶湿了

游戏化的闯关设计真的太戳孩子：
🎮 有地图 🎖️ 有徽章 🎁 有奖励
💡 关键是每一步都是真的在学知识

不是随便玩的游戏，是真的有学习效果 👏

#育儿记录 #国际象棋启蒙 #儿童成长 #宝妈日常

免费体验：邀请码 XHS2026
```

## BGM 建议

- 0-8s：温暖回忆风（钢琴或吉他独奏）
- 8-22s：节奏渐快，轻快向上
- 22-28s：**胜利高潮**（升华情绪）
- 28-40s：温暖收尾 + 品牌 stinger

## 关键数据准备

演示账号 `demo_kid`：
- **草原小考状态为 pending**（可重新考一次让录屏有动画）
  - 或者：专门开另一个演示账号 `demo_girl` 只为录制本条视频
  - 录完可以把 record 重置，下次拍还能用
- 答题过程需自然，不要全对闪电过；中间穿插 1 个"答错→解析"让节奏自然

## 可选加分

如果能找到真实学员家长同意，**加入真实孩子的情感反应画面**（得徽章时的欢呼），视频效果会提升一个档次（小红书尤其受欢迎）。

如果拿不到真实画面，stock 或 AI 生图也 OK。
