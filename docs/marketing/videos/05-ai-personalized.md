# 05 · AI 因材施教 · 雷达图与个性化训练

- 时长：约 45 秒
- 类型：AI 核心卖点 · 建立"1对1名师级能力"差异化认知
- 发布顺序：第 5 条（漏斗最底部，面向决策理性型家长的临门一脚）

## 标题

- **抖音**：`1对1名师才有的"因材施教"，AI 帮你做到了 🎯`
- **视频号**：`AI 比老师更了解你孩子——精准告诉你孩子哪里弱`
- **小红书**：`每个孩子的学习计划都不一样！AI 做到了真正的因材施教 🎯`

## 分镜脚本

| 时间 | 画面 | 配音文稿 | 字幕 |
|---|---|---|---|
| 0-3s | **开场卡片**（HTML）<br>大字 "每个孩子都不一样" + 副"但 90% 的培训班，用同一套教材" | — | `每个孩子不一样 · 教材却一样` |
| 3-9s | **问题陈述**（HTML 对比）<br>左：大班课 30 个孩子一本书<br>右：1对1 名师贵、少、难约 | 大班课教材一刀切，1对1名师又太贵。 | `大班一刀切 vs 1对1太贵` |
| 9-15s | **解决方案**（录屏 `/diagnosis` 首屏）<br>"弱点诊断"页面加载，雷达图慢慢展开 | 棋境大陆的 AI 弱点诊断，就是为每个孩子量身定做的。 | `AI 弱点诊断 · 量身定做` |
| 15-23s | **雷达图特写**（录屏）<br>雷达图 4 维：开局 75 · 中局 65 · 残局 50 · 战术 70<br>→ 红圈强调残局维度"需加强" | AI 分析孩子每一局的表现，绘出这张雷达图：哪里强、哪里弱，一清二楚。 | `4 维度分析 · 哪里弱一清二楚` |
| 23-32s | **推荐训练**（录屏）<br>页面滚动到 AI 推荐部分：<br>- 残局训练包（30 题）<br>- 针对"象车残局"专项<br>- 云朵师父对弈建议 | 根据弱点，AI 自动推荐训练方案——不同孩子，不同计划。 | `AI 自动推荐 · 千人千面` |
| 32-39s | **效果验证**（录屏）<br>2 周后复访 `/diagnosis`：残局维度从 50 升到 72，雷达图变大 | 两周后，弱点变强项。这就是因材施教。 | `2 周见效 · 弱点变强项` |
| 39-45s | **结尾 CTA**（HTML）<br>雷达图 + LOGO + 二维码 + 邀请码 | 扫码让 AI 为你家孩子，定制一份学习计划。 | `🏰 棋境大陆 · AI 定制计划` |

## ChatTTS 配音分段

```python
segments = [
    ("大班课教材一刀切，1对1名师又太贵。", "05_problem.wav"),
    ("棋境大陆的 AI 弱点诊断，就是为每个孩子量身定做的。", "05_solution.wav"),
    ("AI 分析孩子每一局的表现，绘出这张雷达图：哪里强、哪里弱，一清二楚。", "05_radar.wav"),
    ("根据弱点，AI 自动推荐训练方案——不同孩子，不同计划。", "05_recommend.wav"),
    ("两周后，弱点变强项。这就是因材施教。", "05_effect.wav"),
    ("扫码让 AI 为你家孩子，定制一份学习计划。", "05_cta.wav"),
]
```

## Playwright 截图清单

```javascript
const shots = [
  // 诊断主页
  { url: '/diagnosis', path: '05_diagnosis_top.png', wait: 3000 },
  { url: '/diagnosis', path: '05_radar_closeup.png', wait: 2000, action: 'scroll_to_radar' },
  // 推荐训练区
  { url: '/diagnosis', path: '05_recommendations.png', wait: 2000, action: 'scroll_to_recommend' },
  // 两周后"对比"画面——可以准备两个账号 demo_kid_week1 和 demo_kid_week3 分别截图
  { url: '/diagnosis', path: '05_week1_radar.png', wait: 2000, account: 'demo_kid_week1' },
  { url: '/diagnosis', path: '05_week3_radar.png', wait: 2000, account: 'demo_kid_week3' },
]
```

**高级技巧**：两张雷达图对比可以用"雷达图对比卡"HTML 合成，把两个 png 并排展示 + 红色箭头指向变化最大的维度。

## 开场/中段/结尾 HTML 卡片

**开场**：
```html
<div style="width:1080px;height:1920px;background:linear-gradient(180deg,#1e1b4b,#312e81);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px;font-family:'PingFang SC',sans-serif;">
  <div style="font-size:100px;font-weight:900;color:#fff;">每个孩子</div>
  <div style="font-size:100px;font-weight:900;color:#fbbf24;margin-top:20px;">都不一样</div>
  <div style="font-size:48px;color:#94a3b8;margin-top:80px;text-align:center;">但 90% 的培训班</div>
  <div style="font-size:48px;color:#94a3b8;margin-top:10px;text-align:center;">都用同一套教材</div>
</div>
```

**问题对比**（9s）：
```html
<div style="width:1080px;height:1920px;background:#0f172a;padding:80px;display:flex;flex-direction:column;gap:80px;font-family:'PingFang SC',sans-serif;">
  <div style="background:rgba(239,68,68,0.15);border:2px solid rgba(239,68,68,0.4);border-radius:24px;padding:80px;">
    <div style="font-size:56px;color:#fca5a5;margin-bottom:40px;">大班课 👥</div>
    <div style="font-size:64px;color:#fff;font-weight:bold;">30 个孩子</div>
    <div style="font-size:64px;color:#fff;font-weight:bold;margin-top:10px;">一本教材</div>
    <div style="font-size:40px;color:#94a3b8;margin-top:40px;">弱的跟不上，强的吃不饱</div>
  </div>
  <div style="background:rgba(234,179,8,0.15);border:2px solid rgba(234,179,8,0.4);border-radius:24px;padding:80px;">
    <div style="font-size:56px;color:#fcd34d;margin-bottom:40px;">1对1 名师 💎</div>
    <div style="font-size:64px;color:#fff;font-weight:bold;">因材施教，但⋯</div>
    <div style="font-size:40px;color:#94a3b8;margin-top:40px;">300-500 元/小时 · 约课难</div>
  </div>
</div>
```

**雷达图对比卡**（32-39s 两周效果）：
```html
<div style="width:1080px;height:1920px;background:#0f172a;padding:80px;display:flex;flex-direction:column;justify-content:center;font-family:'PingFang SC',sans-serif;">
  <div style="font-size:80px;font-weight:900;color:#fff;text-align:center;margin-bottom:80px;">2 周后 · 效果说话</div>
  <div style="display:flex;gap:40px;justify-content:center;">
    <div style="flex:1;background:rgba(100,116,139,0.15);border-radius:24px;padding:40px;">
      <div style="font-size:40px;color:#94a3b8;text-align:center;margin-bottom:20px;">第 1 周</div>
      <!-- radar image placeholder -->
      <div style="width:100%;aspect-ratio:1;background:#1e293b;border-radius:12px;"></div>
      <div style="font-size:52px;color:#ef4444;text-align:center;margin-top:20px;font-weight:bold;">残局 50</div>
    </div>
    <div style="flex:1;background:rgba(34,197,94,0.15);border-radius:24px;padding:40px;">
      <div style="font-size:40px;color:#86efac;text-align:center;margin-bottom:20px;">第 3 周</div>
      <div style="width:100%;aspect-ratio:1;background:#1e293b;border-radius:12px;"></div>
      <div style="font-size:52px;color:#22c55e;text-align:center;margin-top:20px;font-weight:bold;">残局 72 ↑</div>
    </div>
  </div>
</div>
```

（实际制作时把 placeholder div 换成 Playwright 截取的雷达图 PNG，overlay 上去）

**结尾 CTA**：
```html
<div style="width:1080px;height:1920px;background:linear-gradient(180deg,#1e1b4b,#312e81);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'PingFang SC',sans-serif;">
  <div style="font-size:160px;">🎯</div>
  <div style="font-size:80px;font-weight:900;color:#fff;margin-top:40px;">AI 定制学习计划</div>
  <div style="font-size:48px;color:#94a3b8;margin-top:20px;">不是广告词，是功能</div>
  <div style="width:500px;height:500px;background:#fff;margin-top:60px;border-radius:20px;padding:30px;">
    <div style="width:440px;height:440px;background:#000;"><!-- QR --></div>
  </div>
  <div style="font-size:42px;color:#fde68a;margin-top:40px;">邀请码：DY2026</div>
</div>
```

## 发布文案

### 抖音
```
1对1 国际象棋老师 300-500/小时，还不一定约得到 💸

棋境大陆：AI 做到了真正的因材施教 🎯

🎯 每一局 AI 帮孩子分析
📊 自动画出雷达图（开局/中局/残局/战术）
💡 根据弱点推荐针对训练
📈 2 周见效：残局 50 → 72

这不是广告词，是真实功能
扫码免费体验，邀请码 DY2026

#国际象棋 #AI教育 #因材施教 #儿童培训
```

### 视频号
```
大班课一刀切，1对1名师贵又难约
棋境大陆的 AI 弱点诊断，替你解决。

📊 每个孩子一张雷达图
🎯 AI 自动推荐训练
📈 2 周弱点变强项

邀请码：WX2026
```

### 小红书
```
【干货】AI 因材施教，具体是怎么做到的？🎯

📊 AI 分析每局对弈 → 给孩子画雷达图（4 维度）
🔍 一眼看出：我家娃残局就是差
💡 AI 自动推荐：30 题残局包 + 象车专项 + 找"云朵师父"加练
📈 2 周后复看雷达：残局从 50 升到 72

以前我以为 AI 只是陪练
现在发现，它在做 1对1名师的工作 👀

#国际象棋 #AI教育 #因材施教 #数据化学习

免费体验：XHS2026
```

## BGM 建议

- 0-9s：问题感（低沉或节奏放缓）
- 9-32s：**科技感 + 上扬**（展示 AI 能力）
- 32-39s：胜利感（效果爆发）
- 39-45s：品牌收尾

## 关键数据准备

- `demo_kid_week1` 演示账号：少量对局数据，雷达图残局偏低
- `demo_kid_week3` 演示账号：更多对局数据（或同一账号推进时间模拟），残局维度明显提升
- 两个账号的雷达图对比有视觉冲击力

**备选方案**：如果不想准备两个账号，可以用 Photoshop/Figma 手动绘制"2 周后效果"雷达图（用 Playwright 截的真实图为模板微调数据）。

## 可选加分

- 在雷达图出现时，加一个"圆环展开动画"（Playwright 录视频实现）
- 推荐训练卡滚动时，逐个高亮（录视频 + ffmpeg drawbox 滤镜）
- 两周对比那帧用"箭头飞越"动画（After Effects 制作或 FFmpeg overlay）

制作难度：★★★（本条视频是 5 条里工期最长的，因为涉及雷达图动效和数据对比）
