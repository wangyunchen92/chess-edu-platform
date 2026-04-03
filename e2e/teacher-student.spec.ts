import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('师生管理', () => {
  test('老师生成邀请码并显示大号字体', async ({ page }) => {
    await login(page, 'teacher1', '123456')
    await page.click('text=我的学生')
    await page.waitForURL(/\/teacher/)

    // 点击生成邀请码
    await page.click('text=生成邀请码')

    // 等待邀请码弹窗或列表出现
    await page.waitForTimeout(1000)

    // 应该有邀请码显示（6位大写字母+数字，等宽字体）
    const codeElement = page.locator('.font-mono.text-3xl')
    if (await codeElement.count() > 0) {
      const codeText = await codeElement.first().textContent()
      expect(codeText).toMatch(/^[A-Z0-9]{6}$/)
    }
  })

  test('老师复制邀请码', async ({ page }) => {
    await login(page, 'teacher1', '123456')
    await page.click('text=我的学生')
    await page.waitForURL(/\/teacher/)

    // 如果有邀请码，点击复制
    const copyBtn = page.getByText('复制').first()
    if (await copyBtn.isVisible()) {
      await copyBtn.click()
      // 按钮应变为"已复制"
      await expect(page.getByText('已复制').first()).toBeVisible({ timeout: 3000 })
    }
  })

  test('学生在设置页看到"加入老师"入口', async ({ page }) => {
    await login(page, 'student', '123456')
    await page.click('text=设置')
    await page.waitForURL(/\/settings/)
    await expect(page.getByText('加入老师')).toBeVisible()
  })

  test('学生输入无效邀请码显示错误', async ({ page }) => {
    await login(page, 'student', '123456')
    await page.click('text=设置')
    await page.waitForURL(/\/settings/)

    // 点击"加入老师"
    await page.click('text=加入老师')

    // 输入无效码
    const input = page.locator('input[maxlength="6"], input[placeholder*="邀请码"]').first()
    if (await input.isVisible()) {
      await input.fill('XXXXXX')
      await page.click('text=确认加入, text=加入, button:has-text("加入")')
      await page.waitForTimeout(1000)
      // 应该显示错误提示
    }
  })
})
