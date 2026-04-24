import { test, expect } from '@playwright/test'

test.describe('Landing page → register → welcome', () => {
  test('用例 1: 落地页正常渲染 + CTA 跳转', async ({ page }) => {
    await page.goto('/landing?code=TEST_E2E&ref=test')
    await expect(page.getByText('棋境大陆').first()).toBeVisible()
    await expect(page.getByText(/让孩子在家|国际象棋/).first()).toBeVisible()

    const cta = page.getByRole('link', { name: /开始试玩/ })
    await expect(cta).toBeVisible()
    await cta.click()

    await expect(page).toHaveURL(/\/register\?/)
    await expect(page).toHaveURL(/code=TEST_E2E/)
  })

  test('用例 2: 注册页邀请码字段预填 URL ?code=', async ({ page }) => {
    await page.goto('/register?code=PREFILL_TEST')

    const codeInput = page.getByPlaceholder(/邀请码/)
    await expect(codeInput).toHaveValue('PREFILL_TEST')
    await expect(page.getByText(/邀请码已自动填入/)).toBeVisible()
  })

  test('用例 3: 访客能直接打开 /landing（不被 redirect）', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => localStorage.clear())

    await page.goto('/landing')
    await expect(page.getByText('棋境大陆').first()).toBeVisible()
    await expect(page).toHaveURL(/\/landing/)
  })
})
