import { Page, expect } from '@playwright/test'

/**
 * Login helper — navigates to login page, enters credentials, submits.
 * Waits for redirect to dashboard.
 */
export async function login(page: Page, username: string, password: string) {
  // Clear any existing auth state first
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
  })
  // Reload to ensure clean state
  await page.goto('/login', { waitUntil: 'networkidle' })

  await page.fill('input[autocomplete="username"]', username)
  await page.fill('input[autocomplete="current-password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15_000 })
  await page.waitForLoadState('networkidle')
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
