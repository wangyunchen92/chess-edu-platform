# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> 认证流程 >> student 登录成功
- Location: e2e/auth.spec.ts:12:7

# Error details

```
Error: page.goto: net::ERR_ABORTED at http://localhost:5173/login
Call log:
  - navigating to "http://localhost:5173/login", waiting until "networkidle"

```

# Page snapshot

```yaml
- generic [ref=e6]:
  - generic [ref=e7]:
    - img [ref=e9]
    - heading "棋境大陆" [level=1] [ref=e15]
    - paragraph [ref=e16]: 在线棋类教育平台
  - generic [ref=e17]:
    - generic [ref=e18]:
      - generic [ref=e19]: 用户名
      - textbox "请输入用户名" [ref=e20]
    - generic [ref=e21]:
      - generic [ref=e22]: 密码
      - textbox "请输入密码" [ref=e23]
    - button "登录" [ref=e24] [cursor=pointer]
```

# Test source

```ts
  1  | import { Page, expect } from '@playwright/test'
  2  | 
  3  | /**
  4  |  * Login helper — navigates to login page, enters credentials, submits.
  5  |  * Waits for redirect to dashboard.
  6  |  */
  7  | export async function login(page: Page, username: string, password: string) {
  8  |   // Clear any existing auth state first
  9  |   await page.goto('/login', { waitUntil: 'domcontentloaded' })
  10 |   await page.evaluate(() => {
  11 |     localStorage.removeItem('token')
  12 |     localStorage.removeItem('refresh_token')
  13 |     localStorage.removeItem('user')
  14 |   })
  15 |   // Reload to ensure clean state
> 16 |   await page.goto('/login', { waitUntil: 'networkidle' })
     |              ^ Error: page.goto: net::ERR_ABORTED at http://localhost:5173/login
  17 | 
  18 |   await page.fill('input[autocomplete="username"]', username)
  19 |   await page.fill('input[autocomplete="current-password"]', password)
  20 |   await page.click('button[type="submit"]')
  21 |   await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15_000 })
  22 |   await page.waitForLoadState('networkidle')
  23 | }
  24 | 
  25 | /**
  26 |  * Expect page to not have any console errors (excluding known warnings)
  27 |  */
  28 | export function setupConsoleErrorCheck(page: Page) {
  29 |   const errors: string[] = []
  30 |   page.on('console', (msg) => {
  31 |     if (msg.type() === 'error') {
  32 |       const text = msg.text()
  33 |       // Ignore known non-critical errors
  34 |       if (text.includes('favicon') || text.includes('ResizeObserver')) return
  35 |       errors.push(text)
  36 |     }
  37 |   })
  38 |   return errors
  39 | }
  40 | 
  41 | /**
  42 |  * Wait for API response to complete
  43 |  */
  44 | export async function waitForApi(page: Page, urlPattern: string | RegExp) {
  45 |   return page.waitForResponse(
  46 |     (resp) => {
  47 |       const url = resp.url()
  48 |       if (typeof urlPattern === 'string') return url.includes(urlPattern)
  49 |       return urlPattern.test(url)
  50 |     },
  51 |     { timeout: 10_000 }
  52 |   )
  53 | }
  54 | 
```