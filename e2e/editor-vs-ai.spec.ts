import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('编辑器 · 和 AI 对弈', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'student', '123456')
  })

  test('用例 1: 摆残局 K+Q vs K 能进入对弈页', async ({ page }) => {
    await page.goto('/play/editor')

    // 清空棋盘
    await page.getByRole('button', { name: '清空棋盘' }).click()

    // 摆 K+Q(白) vs K(黑)：白王 e1、白后 h5、黑王 e8
    await page.locator('button[title="King"]').first().click()
    await page.locator('[data-square="e1"]').click()
    await page.locator('button[title="Queen"]').first().click()
    await page.locator('[data-square="h5"]').click()
    await page.locator('button[title="King"]').nth(1).click()
    await page.locator('[data-square="e8"]').click()

    // 验证按钮可用
    const startBtn = page.getByRole('button', { name: '开始对弈' })
    await expect(startBtn).toBeEnabled()

    // 点击开始对弈
    await startBtn.click()

    // 跳转到对弈页
    await page.waitForURL(/\/play\/free\/game\/[a-f0-9-]+/, { timeout: 10_000 })

    // 对手名显示
    await expect(page.getByText('Stockfish · 大师级')).toBeVisible({ timeout: 5_000 })
  })

  test('用例 4: 无王时按钮禁用 + 红字提示', async ({ page }) => {
    await page.goto('/play/editor')
    await page.getByRole('button', { name: '清空棋盘' }).click()

    const startBtn = page.getByRole('button', { name: '开始对弈' })
    await expect(startBtn).toBeDisabled()

    // 红字提示（白方缺王 → 先白后黑的校验顺序）
    await expect(page.getByText(/白方应有且仅有\s*1\s*个国王/)).toBeVisible()
  })
})
