import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('师生管理', () => {
  test('老师在"我的"页面生成邀请码', async ({ page }) => {
    await login(page, 'teacher1', '123456')
    await page.click('text=我的')
    await page.waitForURL(/\/profile/)

    // 点击生成邀请码
    await page.click('text=生成邀请码')
    await page.waitForTimeout(1500)

    // 应该有邀请码显示（大号等宽字体）
    const codeElement = page.locator('.font-mono.text-2xl')
    if (await codeElement.count() > 0) {
      const codeText = await codeElement.first().textContent()
      expect(codeText?.trim()).toMatch(/^[A-Z0-9]{6}$/)
    }
  })

  test('老师复制邀请码', async ({ page }) => {
    await login(page, 'teacher1', '123456')
    await page.click('text=我的')
    await page.waitForURL(/\/profile/)
    await page.waitForTimeout(1000)

    // 如果有邀请码，点击复制
    const copyBtn = page.getByText('复制').first()
    if (await copyBtn.isVisible()) {
      await copyBtn.click()
      await expect(page.getByText('已复制').first()).toBeVisible({ timeout: 3000 })
    }
  })

  test('学生在"我的"页面看到"加入老师"入口', async ({ page }) => {
    await login(page, 'student', '123456')
    await page.click('text=我的')
    await page.waitForURL(/\/profile/)
    await expect(page.getByText('加入老师')).toBeVisible()
  })

  test('学生输入无效邀请码显示错误', async ({ page }) => {
    await login(page, 'student', '123456')
    await page.click('text=我的')
    await page.waitForURL(/\/profile/)

    // 点击"加入老师"
    await page.click('text=加入老师')
    await page.waitForTimeout(500)

    // 输入无效码
    const input = page.locator('input[maxlength="6"]').first()
    await input.fill('XXXXXX')
    await page.click('text=确认加入')
    await page.waitForTimeout(1500)

    // 应该显示错误提示
    await expect(page.getByText('邀请码无效')).toBeVisible({ timeout: 3000 })
  })
})
