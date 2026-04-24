# 宣传落地页 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/landing` 极简引流落地页 + `/register` 支持 URL `?code=<邀请码>` 预填 + 新注册用户首登录弹"豆丁老师试玩引导" + 二维码生成脚本。配合海报扫码和视频评论区挂链使用。

**Architecture:** 纯前端功能，无后端改动（`/auth/register` 已支持 `invite_code` 和 `ref`）。三个改动面：新 LandingPage（PublicRoute）、RegisterPage 预填逻辑、DoudingWelcome 引导模态（DashboardPage 挂载时检查 localStorage flag 决定是否显示）。复用 CharacterHallPage 既有 `?autoSelect=douding` 机制引导新用户进入首局。

**Tech Stack:** React 18 · TypeScript · Vite · Tailwind · React Router v6 · Zustand (authStore) · Node.js `qrcode` + `sharp`（二维码脚本）

**设计文档：** [`docs/superpowers/specs/2026-04-24-marketing-landing-and-videos-design.md`](../specs/2026-04-24-marketing-landing-and-videos-design.md) §4

---

## 文件结构

| 文件 | 动作 | 责任 |
|---|---|---|
| `frontend/src/pages/landing/LandingPage.tsx` | 新建 | 极简落地页：LOGO + slogan + CTA 按钮 + 社会认同 + 备案信息 |
| `frontend/src/App.tsx` | 修改 | `/landing` 加到 `PublicRoute` 内，lazy import LandingPage |
| `frontend/src/pages/auth/RegisterPage.tsx` | 修改 | 新增 `?code=` URL 参数 → 预填 `inviteCode` state |
| `frontend/src/components/onboarding/DoudingWelcome.tsx` | 新建 | 欢迎模态组件（卡片 + 按钮），点击 navigate `/play?autoSelect=douding` |
| `frontend/src/pages/dashboard/DashboardPage.tsx` | 修改 | 挂载时检查 localStorage `chess_edu_welcome_shown` flag，未显示则弹 DoudingWelcome |
| `scripts/gen-landing-qr.js` | 新建 | Node 脚本：输入 URL+邀请码 → 输出品牌装饰的 QR 码 PNG |
| `frontend/src/pages/landing/__tests__/LandingPage.test.tsx` | 新建 | Vitest：CTA 带 URL 参数跳转、无障碍 |
| `e2e/landing.spec.ts` | 新建 | Playwright：扫码路径 → 注册 → 弹欢迎 → 试玩 |

**不新增**：后端接口、DB 字段、API 类型。

---

## 前置

- 开始前 `git status --short` 除 `backend/data.db*`、`backend/.claude/`、`data.db.local_backup*` 外干净
- 本地 dev：`cd frontend && npm run dev`（5173 已在跑）+ `cd backend && python3 -m uvicorn app.main:app --reload --port 8000`
- Vitest：`cd frontend && npx vitest run src/pages/landing/__tests__/`
- Playwright：`cd chess-edu-platform && npx playwright test e2e/landing.spec.ts`

---

## Task 1: LandingPage 组件（首版）

**Files:**
- Create: `frontend/src/pages/landing/LandingPage.tsx`
- Create: `frontend/src/pages/landing/__tests__/LandingPage.test.tsx`

### - [ ] Step 1.1: 写失败测试

Create `frontend/src/pages/landing/__tests__/LandingPage.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LandingPage from '../LandingPage'

describe('LandingPage', () => {
  it('renders brand name and slogan', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/棋境大陆/)).toBeTruthy()
    expect(screen.getByText(/让孩子在家|国际象棋/)).toBeTruthy()
  })

  it('CTA button has correct href to /register', () => {
    render(
      <MemoryRouter initialEntries={['/landing?code=DY2026']}>
        <LandingPage />
      </MemoryRouter>,
    )
    const cta = screen.getByRole('link', { name: /开始试玩/ })
    expect(cta.getAttribute('href')).toContain('/register')
    expect(cta.getAttribute('href')).toContain('code=DY2026')
  })

  it('defaults invite code to empty when no URL param', () => {
    render(
      <MemoryRouter initialEntries={['/landing']}>
        <LandingPage />
      </MemoryRouter>,
    )
    const cta = screen.getByRole('link', { name: /开始试玩/ })
    // Still navigates to /register, just without code param
    expect(cta.getAttribute('href')).toContain('/register')
  })
})
```

### - [ ] Step 1.2: 跑测试确认失败

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/frontend
npx vitest run src/pages/landing/__tests__/LandingPage.test.tsx 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../LandingPage'`

### - [ ] Step 1.3: 实现 LandingPage

Create `frontend/src/pages/landing/LandingPage.tsx`:

```tsx
import React, { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

const LandingPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code') || ''
  const ref = searchParams.get('ref') || ''

  // Build register URL preserving code + ref tracking params
  const registerHref = useMemo(() => {
    const params = new URLSearchParams()
    if (code) params.set('code', code)
    if (ref || !code) params.set('ref', ref || 'landing')
    const qs = params.toString()
    return qs ? `/register?${qs}` : '/register'
  }, [code, ref])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between px-6 py-10"
      style={{
        background:
          'linear-gradient(180deg, rgba(30,27,75,1) 0%, rgba(15,23,42,1) 100%)',
      }}
    >
      {/* Spacer for vertical centering */}
      <div />

      {/* Hero */}
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="text-8xl mb-6">{'\uD83C\uDFF0'}</div>
        <h1 className="text-4xl font-extrabold text-white tracking-wide">
          棋境大陆
        </h1>
        <p className="text-lg text-slate-300 mt-3">
          让孩子在家，学会国际象棋
        </p>
        <div className="flex gap-2 mt-4 text-xs text-slate-400 flex-wrap justify-center">
          <span className="px-3 py-1 rounded-full bg-white/10">AI 陪练</span>
          <span className="px-3 py-1 rounded-full bg-white/10">每周数据</span>
          <span className="px-3 py-1 rounded-full bg-white/10">游戏化</span>
        </div>

        <Link
          to={registerHref}
          className="mt-10 px-10 py-4 rounded-full font-bold text-lg text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{
            background: 'linear-gradient(90deg, #8b5cf6, #6366f1)',
            boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4)',
          }}
        >
          开始试玩 {'\u2192'}
        </Link>

        <p className="text-xs text-slate-500 mt-6">
          已有小棋手在这里冒险学习
        </p>
      </div>

      {/* Footer */}
      <div className="text-[10px] text-slate-600 text-center">
        <p>© 棋境大陆 · 面向 4-12 岁儿童的国际象棋在线学习平台</p>
      </div>
    </div>
  )
}

export default LandingPage
```

### - [ ] Step 1.4: 跑测试确认通过

```bash
npx vitest run src/pages/landing/__tests__/LandingPage.test.tsx 2>&1 | tail -10
```

Expected: **3 passed**

### - [ ] Step 1.5: tsc 验证

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: 无错

### - [ ] Step 1.6: 提交

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform
git add frontend/src/pages/landing/
git commit -m "feat(frontend): add /landing page with CTA preserving code+ref params"
```

---

## Task 2: App.tsx 加路由

**Files:**
- Modify: `frontend/src/App.tsx`

### - [ ] Step 2.1: 加 lazy import

在 App.tsx 顶部 lazy import 区（约 line 26 附近）加：

```tsx
const LandingPage = React.lazy(() => import('@/pages/landing/LandingPage'))
```

### - [ ] Step 2.2: 加 Route

找到 `PublicRoute` 块（约 line 145-148），在 `/register` 同级加一条：

```tsx
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/landing" element={<SuspenseWrapper><LandingPage /></SuspenseWrapper>} />
        </Route>
```

**重要**：`LandingPage` 要套 `SuspenseWrapper`（因为 lazy 加载），`/login` 和 `/register` 不套是因为它们用的是静态 import（这是既有的）。

### - [ ] Step 2.3: 手动冒烟

Vite dev server 热更新会自动拉起。浏览器访问：

- `http://localhost:5173/landing` → 应看到落地页（深紫渐变 + 🏰 图标 + 大字"棋境大陆"）
- 点「开始试玩 →」→ 跳到 `/register?ref=landing`
- `http://localhost:5173/landing?code=DY2026` → 点按钮 → 跳 `/register?code=DY2026`

若已登录用户访问 `/landing` → 被 `PublicRoute` 重定向到 `/`（这是预期行为）。

### - [ ] Step 2.4: tsc

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/frontend
npx tsc --noEmit 2>&1 | tail -5
```

Expected: 无错

### - [ ] Step 2.5: 提交

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform
git add frontend/src/App.tsx
git commit -m "feat(frontend): wire /landing route under PublicRoute"
```

---

## Task 3: RegisterPage 支持 `?code=` 预填

**Files:**
- Modify: `frontend/src/pages/auth/RegisterPage.tsx`

### - [ ] Step 3.1: 改 initial state + URL 读取

在 `frontend/src/pages/auth/RegisterPage.tsx` 定位：

```tsx
const [inviteCode, setInviteCode] = useState('')
```

上方 `useSearchParams` 那段（约 line 19-20）：

```tsx
const [searchParams] = useSearchParams()
const refCode = useMemo(() => searchParams.get('ref') || '', [searchParams])
```

改为从 URL 读 `code`，并把它作为 `inviteCode` 的初始值：

```tsx
const [searchParams] = useSearchParams()
const refCode = useMemo(() => searchParams.get('ref') || '', [searchParams])
const codeFromUrl = useMemo(() => searchParams.get('code') || '', [searchParams])

const [inviteCode, setInviteCode] = useState(codeFromUrl)
```

**关键**：`useState(codeFromUrl)` 只在组件首次 mount 时取一次，后续 URL 变化不会重算（因为 useState initial 只用一次）。这正是我们想要的——用户进来就预填，之后他手改了自己决定。

### - [ ] Step 3.2: （可选）展示"来自推广活动"提示

在已有 `{refCode && (...)}` 提示块附近加类似的 code 提示。定位 line 133 附近：

```tsx
{refCode && (
  <p className="text-xs text-[var(--text-muted)] mb-2">
    推荐来源：{refCode}
  </p>
)}
```

在其**下方**加：

```tsx
{codeFromUrl && (
  <p className="text-xs text-emerald-400 mb-2">
    🎉 邀请码已自动填入
  </p>
)}
```

### - [ ] Step 3.3: 手动冒烟

Dev server 热更：
- `http://localhost:5173/register?code=TEST123` → 邀请码字段应显示 `TEST123` + 绿字"🎉 邀请码已自动填入"
- `http://localhost:5173/register` → 邀请码字段空，无绿字

### - [ ] Step 3.4: tsc

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/frontend
npx tsc --noEmit 2>&1 | tail -5
```

Expected: 无错

### - [ ] Step 3.5: 提交

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform
git add frontend/src/pages/auth/RegisterPage.tsx
git commit -m "feat(register): prefill invite code from URL ?code= param"
```

---

## Task 4: DoudingWelcome 模态组件

**Files:**
- Create: `frontend/src/components/onboarding/DoudingWelcome.tsx`
- Create: `frontend/src/components/onboarding/__tests__/DoudingWelcome.test.tsx`

### - [ ] Step 4.1: 写失败测试

Create `frontend/src/components/onboarding/__tests__/DoudingWelcome.test.tsx`:

```tsx
// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DoudingWelcome from '../DoudingWelcome'

describe('DoudingWelcome', () => {
  it('renders douding greeting when open', () => {
    render(
      <MemoryRouter>
        <DoudingWelcome open={true} onClose={() => {}} onAccept={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/豆丁|Hi/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /来一局|开始/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /先看看|跳过/ })).toBeTruthy()
  })

  it('does not render when open is false', () => {
    const { queryByText } = render(
      <MemoryRouter>
        <DoudingWelcome open={false} onClose={() => {}} onAccept={() => {}} />
      </MemoryRouter>,
    )
    expect(queryByText(/豆丁|Hi/)).toBeNull()
  })

  it('calls onAccept when user clicks 来一局', () => {
    const onAccept = vi.fn()
    render(
      <MemoryRouter>
        <DoudingWelcome open={true} onClose={() => {}} onAccept={onAccept} />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /来一局|开始/ }))
    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when user clicks 先看看', () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <DoudingWelcome open={true} onClose={onClose} onAccept={() => {}} />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /先看看|跳过/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

### - [ ] Step 4.2: 跑测试确认失败

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/frontend
npx vitest run src/components/onboarding/__tests__/DoudingWelcome.test.tsx 2>&1 | tail -10
```

Expected: FAIL — 模块不存在

### - [ ] Step 4.3: 实现组件

Create `frontend/src/components/onboarding/DoudingWelcome.tsx`:

```tsx
import React from 'react'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'

interface DoudingWelcomeProps {
  open: boolean
  onClose: () => void
  onAccept: () => void
}

const DoudingWelcome: React.FC<DoudingWelcomeProps> = ({ open, onClose, onAccept }) => {
  return (
    <Modal open={open} onClose={onClose} title="">
      <div className="flex flex-col items-center text-center py-2">
        <div className="text-8xl mb-4 animate-bounce">{'\uD83D\uDC30'}</div>
        <h2 className="text-2xl font-bold text-[var(--text)] mb-2">
          Hi，我是豆丁老师 {'\uD83D\uDC4B'}
        </h2>
        <p className="text-[var(--text-sub)] text-sm mb-1">
          欢迎来到棋境大陆！
        </p>
        <p className="text-[var(--text-sub)] text-sm mb-6">
          现在跟我下第一局吧 {'\uD83D\uDE0A'}
        </p>

        <div className="flex gap-3 w-full">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            先看看
          </Button>
          <Button variant="primary" className="flex-1" onClick={onAccept}>
            好！来一局 {'\uD83D\uDC3E'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default DoudingWelcome
```

### - [ ] Step 4.4: 跑测试确认通过

```bash
npx vitest run src/components/onboarding/__tests__/DoudingWelcome.test.tsx 2>&1 | tail -10
```

Expected: **4 passed**

若 `Modal` 组件的 API 不同导致断言失败（比如 `open=false` 时仍渲染），检查 `frontend/src/components/common/Modal.tsx` 实际实现调整。**不改测试断言**，调整实现。

### - [ ] Step 4.5: 提交

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform
git add frontend/src/components/onboarding/
git commit -m "feat(onboarding): DoudingWelcome modal component"
```

---

## Task 5: DashboardPage 挂接首登录检测

**Files:**
- Modify: `frontend/src/pages/dashboard/DashboardPage.tsx`

### - [ ] Step 5.1: 加欢迎逻辑

在 `frontend/src/pages/dashboard/DashboardPage.tsx` 顶部 import 区加：

```tsx
import { useEffect, useState } from 'react'  // useState 若已有则合并，不重复 import
import { useNavigate } from 'react-router-dom'
import DoudingWelcome from '@/components/onboarding/DoudingWelcome'
```

（以上 3 个如果文件里已有就跳过；重点是加 `DoudingWelcome`）

在 DashboardPage 组件内（找到 state 声明区），新增：

```tsx
  const navigate = useNavigate()
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => {
    // Show one-time welcome if localStorage flag is absent
    const shown = localStorage.getItem('chess_edu_welcome_shown')
    if (!shown) {
      setShowWelcome(true)
    }
  }, [])

  const handleWelcomeClose = () => {
    localStorage.setItem('chess_edu_welcome_shown', '1')
    setShowWelcome(false)
  }

  const handleWelcomeAccept = () => {
    localStorage.setItem('chess_edu_welcome_shown', '1')
    setShowWelcome(false)
    navigate('/play?autoSelect=douding')
  }
```

### - [ ] Step 5.2: 在 JSX 末尾挂上组件

找到 DashboardPage 的最外层 `<div>` 或 `<>` 返回结构的**最末端**（在 `</div>` 或 `</>` 前），加：

```tsx
      <DoudingWelcome
        open={showWelcome}
        onClose={handleWelcomeClose}
        onAccept={handleWelcomeAccept}
      />
```

### - [ ] Step 5.3: 手动冒烟

打开 DevTools Console：

```js
localStorage.removeItem('chess_edu_welcome_shown')
```

然后刷新首页 `/` → 应弹豆丁欢迎模态。

- 点「先看看」→ 模态关，localStorage 有 `chess_edu_welcome_shown=1`
- 再刷新 → 不再弹

再测「好！来一局」：

```js
localStorage.removeItem('chess_edu_welcome_shown')
```

刷新 → 弹 → 点「好！来一局」→ navigate 到 `/play?autoSelect=douding` → CharacterHallPage 自动弹豆丁的对局设置 Modal（CharacterHallPage 既有行为）。

### - [ ] Step 5.4: tsc

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/frontend
npx tsc --noEmit 2>&1 | tail -5
```

Expected: 无错

### - [ ] Step 5.5: 提交

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform
git add frontend/src/pages/dashboard/DashboardPage.tsx
git commit -m "feat(dashboard): show douding welcome on first login via localStorage flag"
```

---

## Task 6: 二维码生成脚本

**Files:**
- Create: `scripts/gen-landing-qr.js`

### - [ ] Step 6.1: 安装依赖（项目根已有 package.json）

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform
npm install --save-dev qrcode
```

（不用 `sharp` — 用 `qrcode` 的 `toFile` + 手动 PNG 合成可以更简单；本 MVP 先出基础二维码即可）

### - [ ] Step 6.2: 写脚本

Create `scripts/gen-landing-qr.js`:

```javascript
#!/usr/bin/env node
/**
 * Generate QR code PNGs for landing page distribution.
 *
 * Usage:
 *   node scripts/gen-landing-qr.js                    # Generate for all known channels
 *   node scripts/gen-landing-qr.js DY2026             # Generate for a specific invite code
 *   node scripts/gen-landing-qr.js DY2026 https://...  # Custom base URL
 */
const path = require('path')
const fs = require('fs')
const QRCode = require('qrcode')

const BASE_URL = process.argv[3] || 'https://chess.ccwu.cc/landing'
const OUT_DIR = path.join(__dirname, '..', 'docs', 'marketing', 'qr-codes')

const CHANNELS = [
  { code: 'DY2026', name: '抖音' },
  { code: 'WX2026', name: '视频号' },
  { code: 'XHS2026', name: '小红书' },
  { code: 'LN2026', name: '线下地推' },
]

async function generate(code, channelName) {
  const url = `${BASE_URL}?code=${encodeURIComponent(code)}&ref=${channelName}`
  const outPath = path.join(OUT_DIR, `qr-${code}.png`)
  await QRCode.toFile(outPath, url, {
    errorCorrectionLevel: 'H',
    type: 'png',
    margin: 2,
    width: 600,
    color: {
      dark: '#1e1b4b',  // Brand purple-900
      light: '#ffffff',
    },
  })
  console.log(`[gen-qr] ${channelName.padEnd(8)} ${code.padEnd(10)} -> ${outPath}`)
  console.log(`         url: ${url}`)
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const targetCode = process.argv[2]
  if (targetCode) {
    // Generate for a single code passed as arg (use it as channel name too)
    await generate(targetCode, targetCode)
  } else {
    // Generate for all known channels
    for (const { code, name } of CHANNELS) {
      await generate(code, name)
    }
  }
  console.log('\n[gen-qr] done. PNGs saved to', OUT_DIR)
}

main().catch((err) => {
  console.error('[gen-qr] failed:', err)
  process.exit(1)
})
```

### - [ ] Step 6.3: 运行 + 验证

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform
node scripts/gen-landing-qr.js
```

Expected: 输出 4 个二维码路径，`docs/marketing/qr-codes/qr-DY2026.png` 等 4 个文件。

用 `open docs/marketing/qr-codes/qr-DY2026.png` 打开看二维码外观（紫色前景 + 白色背景）。**用手机扫码**应打开 `https://chess.ccwu.cc/landing?code=DY2026&ref=抖音`（如果线上还没上线 landing 页会 404，正常，上线后再扫）。

### - [ ] Step 6.4: gitignore 检查

`docs/marketing/qr-codes/` 里的 PNG 文件可以入库（体积小、改动频率低、运营拿得到方便）。不必 gitignore。

### - [ ] Step 6.5: 提交

```bash
git add scripts/gen-landing-qr.js package.json package-lock.json docs/marketing/qr-codes/
git commit -m "chore(marketing): QR code generator for 4 channel invite codes"
```

---

## Task 7: Playwright E2E

**Files:**
- Create: `e2e/landing.spec.ts`
- Modify: `playwright.config.ts`（加新 project）

### - [ ] Step 7.1: 写 E2E

Create `e2e/landing.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Landing page → register → welcome', () => {
  test('用例 1: 落地页正常渲染 + CTA 跳转', async ({ page }) => {
    await page.goto('/landing?code=TEST_E2E&ref=test')
    await expect(page.getByText('棋境大陆')).toBeVisible()
    await expect(page.getByText(/让孩子在家|国际象棋/)).toBeVisible()

    const cta = page.getByRole('link', { name: /开始试玩/ })
    await expect(cta).toBeVisible()
    await cta.click()

    await expect(page).toHaveURL(/\/register\?/)
    await expect(page).toHaveURL(/code=TEST_E2E/)
  })

  test('用例 2: 注册页邀请码字段预填 URL ?code=', async ({ page }) => {
    await page.goto('/register?code=PREFILL_TEST')

    // 邀请码 input 预填
    const codeInput = page.getByPlaceholder(/邀请码/)
    await expect(codeInput).toHaveValue('PREFILL_TEST')

    // 绿色提示条可见
    await expect(page.getByText(/邀请码已自动填入/)).toBeVisible()
  })

  test('用例 3: 访客访问 /landing，无论登录状态都能打开', async ({ page, context }) => {
    // Clear auth state
    await context.clearCookies()
    await page.goto('/login')
    await page.evaluate(() => localStorage.clear())

    await page.goto('/landing')
    await expect(page.getByText('棋境大陆')).toBeVisible()
    // Not redirected to /login
    await expect(page).toHaveURL(/\/landing/)
  })
})
```

**注意**：不测"欢迎模态"是因为它需要完整注册+登录流程，会打 backend 增加不稳定性；欢迎模态用 Vitest 覆盖（Task 4）。

### - [ ] Step 7.2: 注册 Playwright project

在 `playwright.config.ts` 的 `projects` 数组末尾加：

```typescript
{
  name: 'landing',
  testMatch: 'landing.spec.ts',
  use: {
    ...devices['Desktop Chrome'],
    storageState: undefined,  // tests run as anonymous visitor
  },
},
```

### - [ ] Step 7.3: 确保前后端 running

```bash
lsof -i :5173 | head -2
lsof -i :8000 | head -2
# 若没起：
# cd frontend && npm run dev > /tmp/vite.log 2>&1 &
# cd backend && python3 -m uvicorn app.main:app --reload --port 8000 > /tmp/uvi.log 2>&1 &
```

### - [ ] Step 7.4: 跑 E2E

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform
npx playwright test e2e/landing.spec.ts --project=landing --reporter=line 2>&1 | tail -15
```

Expected: **3 passed**

### - [ ] Step 7.5: 提交

```bash
git add e2e/landing.spec.ts playwright.config.ts
git commit -m "test(e2e): landing page + register prefill scenarios"
```

---

## Task 8: 回归 + 构建 + 部署

### - [ ] Step 8.1: 全量 Vitest

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform/frontend
npm test 2>&1 | tail -10
```

Expected: 既有通过用例数 + 新增 3 LandingPage + 4 DoudingWelcome = 旧 87 + 7 = 94 passed（加上 2 个 pre-existing failed）

### - [ ] Step 8.2: 构建

```bash
npm run build 2>&1 | tail -5
```

Expected: vite build 成功

### - [ ] Step 8.3: 全量 Playwright 回归（允许 rate limit 既有 flaky）

```bash
cd /Users/wangyunchen/agents/教育教学/chess-edu-platform
npx playwright test --reporter=line 2>&1 | tail -12
```

Expected: 既有 landing 3 + editor-vs-ai 5（单独）+ adventure-quiz 3（单独）+ auth/pages/teacher-student 中除既有 pre-existing failed 外全过

### - [ ] Step 8.4: 后端冒烟

```bash
cd backend && python3 -c "from app.main import app; print('ok')"
```

Expected: `ok`

### - [ ] Step 8.5: 备份

```bash
TS=$(date +%Y%m%d-%H%M%S)
ssh root@118.31.237.111 "mkdir -p /opt/chess-edu/backups/deploy-$TS && cp -r /opt/chess-edu/www/domain /opt/chess-edu/backups/deploy-$TS/www-domain && echo backup=/opt/chess-edu/backups/deploy-$TS"
```

### - [ ] Step 8.6: 部署前端（只改前端，后端不动）

```bash
rsync -avz --delete /Users/wangyunchen/agents/教育教学/chess-edu-platform/frontend/dist/ root@118.31.237.111:/opt/chess-edu/www/domain/ 2>&1 | tail -5
```

### - [ ] Step 8.7: 线上冒烟

```bash
ssh root@118.31.237.111 "ls /opt/chess-edu/www/domain/assets/index-*.js"
```

用户浏览器 **Ctrl+Shift+R 强刷** `https://chess.ccwu.cc/landing`，确认：
1. 落地页可见，带 🏰 图标 + 「开始试玩」按钮
2. 点按钮跳 `/register?ref=landing`
3. `https://chess.ccwu.cc/landing?code=DY2026` → 点按钮跳 `/register?code=DY2026`
4. 注册页邀请码字段预填 `DY2026` + 绿字提示
5. 新注册（或清 localStorage `chess_edu_welcome_shown` 后刷首页）能看到豆丁欢迎模态

### - [ ] Step 8.8: 测试报告

Create `docs/superpowers/plans/2026-04-24-marketing-landing-page-test-report.md`:
- Commits list
- Vitest / Playwright / build 结果
- 线上冒烟截图/路径说明
- 未解决 / follow-ups（如微信登录、游客模式等）

```bash
git add docs/superpowers/plans/2026-04-24-marketing-landing-page-test-report.md
git commit -m "docs: test report for landing page feature"
```

---

## 回顾 · 改动清单

| 文件 | 行数估计 |
|---|---|
| `frontend/src/pages/landing/LandingPage.tsx` | ~60 |
| `frontend/src/pages/landing/__tests__/LandingPage.test.tsx` | ~45 |
| `frontend/src/App.tsx` | +2 |
| `frontend/src/pages/auth/RegisterPage.tsx` | ~10 修改 |
| `frontend/src/components/onboarding/DoudingWelcome.tsx` | ~45 |
| `frontend/src/components/onboarding/__tests__/DoudingWelcome.test.tsx` | ~55 |
| `frontend/src/pages/dashboard/DashboardPage.tsx` | +25 |
| `scripts/gen-landing-qr.js` | ~50 |
| `e2e/landing.spec.ts` | ~45 |
| `playwright.config.ts` | +8 |
| **合计** | **~345 行** |

**无后端改动 · 无 DB migration · 无第三方新依赖（qrcode 是 devDep）**

---

## 风险清单

- **LocalStorage flag 不跨设备**：用户换设备/浏览器重登时会再看到欢迎模态（可接受，甚至是好事——新设备首触再提示一次）
- **CharacterHallPage `?autoSelect=` 机制现状**：已验证代码里存在（line 213），但要确认它用的是 `slug='douding'` 还是数据库 `id`。如果数据库里豆丁的 id 不是字符串 `'douding'` 而是 UUID，`autoSelect=douding` 会匹配失败——Task 5.3 手动冒烟时要确认。若失败 fallback：`navigate('/play')` 不带参数（进角色大厅让用户手动选）
- **二维码扫码需线上 /landing 生效后才可用**：本地测试用 `http://localhost:5173/landing?code=XXX` 直接访问（不扫码）
- **PublicRoute 重定向**：如果已登录访客扫码会被跳到 `/`。这可能让老用户无法通过扫码帮忙推广——但普通用户无此需求，可接受

---

## 回滚预案

- 部署后出问题：恢复 `/opt/chess-edu/backups/deploy-<ts>/www-domain`
- 只是某个 commit 要改：`git revert <sha>` 后重新 build + rsync
- 欢迎模态扰民：后端无法紧急关掉，可以发一版 localStorage 的 kill switch（把 flag check 改成 `false`）
