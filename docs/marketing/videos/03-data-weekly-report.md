# 03 · 学习数据 · 家长一周报告看得见效果

- 时长：约 35 秒
- 类型：信任建立 · 家长决策理性一面
- 发布顺序：第 3 条

## 标题

- **抖音**：`花钱让孩子学棋，究竟学没学会？看这张报告就知道 📊`
- **视频号**：`孩子学棋有没有效果？看数据不听口头反馈`
- **小红书**：`宝妈收到的第 4 周 AI 学习报告：进步肉眼可见 📈`

## 分镜脚本

| 时间 | 画面 | 配音文稿 | 字幕 |
|---|---|---|---|
| 0-3s | **开场卡片**（HTML）<br>大字 "钱花了，孩子学没学会？" | — | `钱花了，孩子学没学会？` |
| 3-8s | **家长场景**（stock 或 AI 生图）<br>妈妈疑惑看着孩子，孩子在下棋；旁边浮现报告通知"每周学习报告" | 传统培训班只能听老师口头反馈。棋境大陆不一样——每周自动给家长一份 AI 数据报告。 | `口头反馈 vs 数据报告` |
| 8-14s | **首页推送**（录屏 `/`）<br>首页卡片展示"本周报告已生成" + 点击查看 | 家长打开 App 首页，本周学习报告已经出来了。 | `每周自动生成` |
| 14-22s | **报告页内容**（录屏 `/honor` 或 `/profile` 成长里程碑）<br>展示：本周练习量（32 题 + 12 局）→ 胜率曲线 → 评分变化 → 已解锁徽章 | 孩子这周下了 12 局、做了 32 道题，胜率从 45% 升到 60%，评分涨了 80 分，还拿到了新徽章。 | `练习 · 胜率 · 评分 · 徽章` |
| 22-28s | **弱点雷达**（录屏 `/diagnosis`）<br>展示雷达图：开局/中局/残局/战术各维度 + 推荐训练 | 这块雷达图，告诉家长孩子哪里强、哪里弱，AI 自动给出训练建议。 | `强弱一目了然 · AI 推荐训练` |
| 28-32s | **对比价值**（HTML 对比卡）<br>左：传统反馈「孩子还不错」<br>右：AI 报告「本周 12 局 60% 胜率 残局需加强」 | 模糊的「还不错」，变成具体的数据。效果说得清，家长更安心。 | `模糊 → 具体` |
| 32-35s | **结尾 CTA**（HTML）<br>LOGO + 二维码 + 邀请码 | 扫码免费体验，给孩子一份属于自己的学习档案。 | `🏰 棋境大陆 · 扫码试玩` |

## ChatTTS 配音分段

```python
segments = [
    ("传统培训班只能听老师口头反馈。棋境大陆不一样——每周自动给家长一份 AI 数据报告。", "03_contrast.wav"),
    ("家长打开 App 首页，本周学习报告已经出来了。", "03_push.wav"),
    ("孩子这周下了 12 局、做了 32 道题，胜率从 45% 升到 60%，评分涨了 80 分，还拿到了新徽章。", "03_content.wav"),
    ("这块雷达图，告诉家长孩子哪里强、哪里弱，AI 自动给出训练建议。", "03_radar.wav"),
    ("模糊的「还不错」，变成具体的数据。效果说得清，家长更安心。", "03_value.wav"),
    ("扫码免费体验，给孩子一份属于自己的学习档案。", "03_cta.wav"),
]
```

## Playwright 截图清单

```javascript
const shots = [
  { url: '/', path: '03_home_report_card.png', wait: 3000 },
  // 点开报告 / 里程碑
  { url: '/honor', path: '03_honor_milestones.png', wait: 3000 },
  { url: '/profile', path: '03_profile_stats.png', wait: 3000 },
  // 弱点诊断
  { url: '/diagnosis', path: '03_diagnosis_radar.png', wait: 3000 },
  { url: '/diagnosis', path: '03_diagnosis_recommendations.png', wait: 3000,
    action: 'scroll_to_recommendations' },
]
```

## 开场/中段 HTML 卡片

**开场**：
```html
<div style="width:1080px;height:1920px;background:linear-gradient(180deg,#0f172a,#1e1b4b);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'PingFang SC',sans-serif;">
  <div style="font-size:90px;font-weight:800;color:#fbbf24;">钱花了</div>
  <div style="font-size:90px;font-weight:800;color:#fff;margin-top:40px;">孩子学没学会？</div>
  <div style="font-size:50px;color:#94a3b8;margin-top:80px;">🤔</div>
</div>
```

**对比卡**：
```html
<div style="width:1080px;height:1920px;background:#0f172a;padding:80px;display:flex;flex-direction:column;gap:80px;font-family:'PingFang SC',sans-serif;">
  <div style="background:rgba(239,68,68,0.15);border:2px solid rgba(239,68,68,0.4);border-radius:24px;padding:80px;">
    <div style="font-size:48px;color:#fca5a5;margin-bottom:40px;">传统反馈 ❌</div>
    <div style="font-size:72px;color:#fff;font-weight:bold;">"孩子挺不错的"</div>
    <div style="font-size:40px;color:#94a3b8;margin-top:40px;">具体学到啥？没人说得清</div>
  </div>
  <div style="background:rgba(34,197,94,0.15);border:2px solid rgba(34,197,94,0.4);border-radius:24px;padding:80px;">
    <div style="font-size:48px;color:#86efac;margin-bottom:40px;">AI 报告 ✅</div>
    <div style="font-size:64px;color:#fff;font-weight:bold;">12 局 · 60% 胜率</div>
    <div style="font-size:64px;color:#fff;font-weight:bold;margin-top:20px;">评分 +80 · 残局待加强</div>
    <div style="font-size:40px;color:#cbd5e1;margin-top:40px;">每周自动生成，手机一键看</div>
  </div>
</div>
```

## 发布文案

### 抖音
```
给孩子报了兴趣班，学得好不好？🤷
"挺不错的"——这种话听多少年？

棋境大陆每周给家长 AI 学习报告：
📊 12 局 / 32 题 / 胜率 60%
📈 评分 +80 分
🎯 残局薄弱，AI 推荐 3 套训练

数据说话，进步看得见 ✅
扫码免费试用，邀请码 DY2026

#育儿 #儿童教育 #AI报告 #象棋
```

### 视频号
```
孩子学棋有没有效果？
看具体数据：12 局、60% 胜率、评分 +80、哪弱 AI 告诉你。

棋境大陆 · 每周自动报告
扫码免费体验，邀请码：WX2026
```

### 小红书
```
【数据控宝妈】孩子学国际象棋第 4 周报告 📊

收到报告那一刻，我才真正知道娃进步到哪：
✅ 这周下了 12 局，胜率从 45% → 60%
✅ 评分涨了 80 分
✅ 拿到了 "启蒙草原毕业" 徽章 🌿
❗ 残局还是弱，AI 已经推荐训练计划

比"老师说挺好的"值钱多了 😂

#育儿 #国际象棋 #学习报告 #AI教育 #宝妈种草

邀请码：XHS2026（免费体验）
```

## BGM 建议

- 前 8s：疑问感 + 轻度紧张（家长痛点呼应）
- 8-28s：稳重温暖（展示产品可靠感）
- 28s 后：自信上扬（价值感确立）

## 关键数据准备

演示账号 `demo_kid`：
- 本周数据：12 局 / 32 题 / 胜率 60% / 评分 +80 / 3 个新徽章
- 弱点雷达：残局 50 / 开局 75 / 中局 65 / 战术 70（或类似，有高有低更有说服力）
- 首页要有"本周学习报告"推送卡片（这个卡片如果没做过需要前端确认有无）
