import { chromium, type FullConfig } from '@playwright/test'

/**
 * Global setup: login as admin once and save storage state.
 * All tests in pages.spec.ts reuse this state.
 */
async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:5173'
  const browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage()

  await page.goto(`${baseURL}/login`)
  await page.waitForLoadState('networkidle')
  await page.fill('input[autocomplete="username"]', 'admin')
  await page.fill('input[autocomplete="current-password"]', 'admin123')
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15_000 })
  await page.waitForLoadState('networkidle')

  // Save storage state (localStorage + cookies)
  await page.context().storageState({ path: 'e2e/.auth/admin.json' })
  await browser.close()
}

export default globalSetup
