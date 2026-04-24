# 宣传落地页 · 测试报告

- 日期：2026-04-24
- 分支：`master`
- 设计：[docs/superpowers/specs/2026-04-24-marketing-landing-and-videos-design.md](../specs/2026-04-24-marketing-landing-and-videos-design.md)
- 计划：[docs/superpowers/plans/2026-04-24-marketing-landing-page.md](2026-04-24-marketing-landing-page.md)

## 1. 功能概述

海报扫码 → 极简落地页 → CTA 跳 `/register?code=<邀请码>` 预填邀请码 → 注册完成 → 首登录弹「豆丁老师试玩引导」→ 点击跳 `/play?autoSelect=douding` 自动匹配豆丁对弈。

配套 4 渠道追踪二维码（抖音/视频号/小红书/线下）已生成品牌紫色 PNG，可直接印海报。

## 2. 本次交付 Commits

```
aa3f8db test(e2e): landing page + register prefill scenarios
cb94e47 chore(marketing): QR code generator for 4 channel invite codes
f7a9c0c feat(dashboard): show douding welcome on first login via localStorage flag
ff8c1d2 feat(onboarding): DoudingWelcome modal component
9a5e462 feat(register): prefill invite code from URL ?code= param
c697ba8 feat(frontend): wire /landing route under PublicRoute
a0adc96 feat(frontend): add /landing page with CTA preserving code+ref params
2fa8cf1 docs: implementation plan for marketing landing page
bf0c416 docs: 5 shoot-ready video scripts for first marketing batch
6f79c79 docs: design spec for v1 marketing (landing page + 5 videos)
```

10 个提交（2 docs + 7 实现 + 1 E2E 配 Playwright config）。

## 3. 测试结果

### 3.1 新增 Vitest

- `LandingPage.test.tsx`: **3/3 pass**
- `DoudingWelcome.test.tsx`: **4/4 pass**

### 3.2 全量 Vitest

```
Test Files  2 failed | 7 passed (9)
Tests       2 failed | 94 passed (96)
Duration    1.93s
```

**新增贡献：** 87 → 94（+7）
**Pre-existing failed（非本 PR 引入）：**
- `src/engine/__tests__/PlayStyleController.test.ts`
- `src/engine/__tests__/ReviewAnalyzer.test.ts`

### 3.3 新增 E2E

`e2e/landing.spec.ts`: **3/3 pass (17.1s)**
1. 落地页渲染 + CTA 跳转（带 code/ref 参数保留）
2. 注册页邀请码 URL 预填 + 绿字提示可见
3. 访客直接访问 /landing（不被重定向）

### 3.4 E2E 全量回归

```
21 passed, 10 failed, 1 flaky (20.5m)
```

**关键：landing 3 条全部 pass；0 个本 PR 功能 bug**

**失败分类（全部是 rate limit 累积 + pre-existing，跟上一轮 PR 报告一致）：**

| 分类 | 数量 | 原因 |
|---|---|---|
| editor-vs-ai（用例 1/2/5） | 3 | Rate limit 累积（默认 `default_rpm=100`）。单独跑 5/5 pass。 |
| adventure-quiz（用例 1） | 1 | 同 rate limit。单独跑 3/3 pass。 |
| adventure-quiz（用例 3 flaky） | 1 flaky | 第一次失败、retry 通过。 |
| auth teacher + teacher-student 4 个 | 5 | teacher 账号 pre-existing（多个 PR 报告记录过） |
| pages 课后练习 tab | 1 | pre-existing |

**结论**：landing 功能独立 / 回归都绿；编辑器 + 冒险的 rate limit 问题是 backend 限流在全量串行跑时累积，**单独跑它们各自的 project 都通过**。本 PR 未引入新的 functional failure。

### 3.5 前端构建

```
✓ built in 1.65s
dist/assets/index-CV3-sN2L.js  297.12 kB │ gzip: 96.62 kB
```

### 3.6 二维码产物

4 张品牌紫色 PNG，位于 `docs/marketing/qr-codes/`：

| 文件 | 对应渠道 | 大小 |
|---|---|---|
| `qr-DY2026.png` | 抖音 | 6007 B |
| `qr-WX2026.png` | 视频号 | 6614 B |
| `qr-XHS2026.png` | 小红书 | 6647 B |
| `qr-LN2026.png` | 线下地推 | 6685 B |

**示例 URL：** `https://chess.ccwu.cc/landing?code=DY2026&ref=%E6%8A%96%E9%9F%B3`

## 4. 过程中修复/发现的问题

### 发现 1：Playwright `storageState: undefined` 无法覆盖全局配置

- **症状**：landing E2E 跑到 `/register` 或 `/landing` 被 `PublicRoute` 跳到 `/`（Dashboard 页），因为 project 继承了 top-level `use.storageState: 'e2e/.auth/admin.json'`，而 `storageState: undefined` 在 Playwright use 合并规则下**不能清空继承**
- **修复**（commit `aa3f8db`）：新建 `e2e/.auth/empty.json`（空 cookies/origins），landing project 的 `storageState` 指向它显式覆盖
- **影响**：对其他用 `storageState: undefined` 的 project（editor-vs-ai / adventure-quiz）可能也有类似隐患——它们之所以通过是因为 beforeEach 里显式 login 覆盖了。本次不改它们。

### 工程细节

- LandingPage 用 `MemoryRouter` + `useSearchParams` 按 URL 参数构造 `registerHref`，保留 code + ref（若无 code 默认 ref=landing）
- RegisterPage `useState(codeFromUrl)` 初始值仅在 mount 时取一次，用户手改后就自用
- DoudingWelcome 复用项目 `Modal` + `Button`，测试里加 matchMedia stub 兼容 jsdom
- DashboardPage 用 `localStorage.chess_edu_welcome_shown` 一次性 flag，换设备 / 清 cache 都会重看

## 5. 未入 Git 的本地环境项

```
?? backend/data.db.local_backup*
?? backend/.claude/
```

均为本地文件，不入库。

## 6. 待处理 follow-ups（P2）

- 微信登录（spec 里列入 P2 backlog）
- 游客试玩模式（无需注册先玩 10 分钟）
- 7 天大师会员赠送机制
- 落地页 A/B 测试（不同文案版本）
- 首登录自动匹配豆丁的时候，确认 CharacterHallPage 的 `autoSelect=douding` 能匹配到数据库实际的 character（`slug === 'douding'` 或 UUID，需要线上验证一次）

## 7. 部署核对清单

### 数据
- **无 DB migration**
- **无新数据 seed**（邀请码由运营在后台创建）

### 部署步骤
1. 备份 `/opt/chess-edu/www/domain`（前端 only）
2. 前端已 build（`dist/assets/index-CV3-sN2L.js`）
3. `rsync -avz --delete frontend/dist/ root@118.31.237.111:/opt/chess-edu/www/domain/`
4. **无后端改动，无需重启 backend**

### 上线冒烟
1. `https://chess.ccwu.cc/landing` → 看到 🏰「棋境大陆」+ CTA
2. 点 CTA → 跳 `/register?ref=landing`
3. `https://chess.ccwu.cc/landing?code=DY2026` → 点 CTA → `/register?code=DY2026`，邀请码字段预填 + 绿字提示
4. 清 localStorage `chess_edu_welcome_shown` + 刷 `/` → 弹豆丁欢迎 → 点「好！来一局」→ 跳 `/play?autoSelect=douding`（CharacterHallPage 自动弹豆丁对局 Modal）

### 运营准备
- 在后台创建 4 个追踪邀请码：`DY2026` / `WX2026` / `XHS2026` / `LN2026`
- `docs/marketing/qr-codes/qr-*.png` 四张可直接印海报

### 回滚
- `/opt/chess-edu/backups/deploy-<TS>/www-domain` 恢复
