import { Page, expect } from '@playwright/test'

/**
 * Login helper — navigates to login page, enters credentials, submits.
 * Waits for redirect to dashboard.
 */
export async function login(page: Page, username: string, password: string) {
  // Need to clear localStorage at the localhost:5173 origin before the app's JS
  // runs — otherwise a leftover token auto-redirects us to /dashboard and the login
  // inputs never render. Strategy: land on /login once, run clear in that origin,
  // then reload so the app re-reads the now-empty localStorage. Use domcontentloaded
  // (Vite HMR WebSocket never lets networkidle fire). reload() — unlike back-to-back
  // page.goto — does not ERR_ABORTED when the previous nav has already settled.
  await page.context().clearCookies()
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  const hadAuth = await page.evaluate(() => {
    const had = !!localStorage.getItem('token')
    localStorage.clear()
    sessionStorage.clear()
    return had
  })
  if (hadAuth || !/\/login(\?|$|#)/.test(page.url())) {
    await page.reload({ waitUntil: 'domcontentloaded' })
  }
  await page.waitForSelector('input[autocomplete="username"]', { timeout: 10_000 })

  await page.fill('input[autocomplete="username"]', username)
  await page.fill('input[autocomplete="current-password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15_000 })
}

/**
 * Expect page to not have any console errors (excluding known warnings)
 */
export function setupConsoleErrorCheck(page: Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      // Ignore known non-critical errors
      if (text.includes('favicon') || text.includes('ResizeObserver')) return
      errors.push(text)
    }
  })
  return errors
}

/**
 * Wait for API response to complete
 */
export async function waitForApi(page: Page, urlPattern: string | RegExp) {
  return page.waitForResponse(
    (resp) => {
      const url = resp.url()
      if (typeof urlPattern === 'string') return url.includes(urlPattern)
      return urlPattern.test(url)
    },
    { timeout: 10_000 }
  )
}
