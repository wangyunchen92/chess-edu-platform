import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('冒险 · 草原小考', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'tester', 'test123')
  })

  test('用例 1: 点进草原小考能看到第一题', async ({ page }) => {
    await page.goto('/adventure')

    // Region card (div with onClick) needs to be clicked to expand and load challenges.
    // Click its heading — click bubbles up to the parent div's onClick.
    await page.getByRole('heading', { name: '启蒙草原' }).click()

    // Inline challenge button appears after region expands
    const quizBtn = page.getByRole('button', { name: /草原小考/ })
    await expect(quizBtn).toBeVisible({ timeout: 10_000 })
    await quizBtn.click()

    // Modal opens with "开始答题" button
    const startBtn = page.getByRole('button', { name: '开始答题' })
    await expect(startBtn).toBeEnabled()
    await startBtn.click()

    await page.waitForURL(/\/adventure\/quiz\/meadow_exam/, { timeout: 10_000 })
    await expect(page.getByText('国王一次能走几步？')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/第\s*1\s*\/\s*5\s*题/)).toBeVisible()
  })

  test('用例 2: 全对通过，结果页显示毕业', async ({ page }) => {
    await page.goto('/adventure/quiz/meadow_exam')
    await expect(page.getByText('国王一次能走几步？')).toBeVisible({ timeout: 10_000 })

    // Correct sequence: q1=A q2=D q3=C q4=B q5=A
    const answers = ['A', 'D', 'C', 'B', 'A']
    for (const ans of answers) {
      // Option buttons render as "A." / "B." / ... prefix + text
      await page.locator(`button:has-text("${ans}.")`).first().click()
      const next = page.getByRole('button', { name: /^(下一题|提交)$/ })
      await expect(next).toBeVisible({ timeout: 5_000 })
      await next.click()
    }

    await expect(page.getByRole('heading', { name: /毕业|通过/ })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/5\s*\/\s*5/)).toBeVisible()
    await expect(page.getByRole('button', { name: /返回冒险地图/ })).toBeVisible()
  })

  test('用例 3: 通过后再次访问显示已通过', async ({ page }) => {
    // After test 2 the tester should have passed meadow_exam
    await page.goto('/adventure')

    // Expand the meadow region so the inline challenge button renders
    await page.getByRole('heading', { name: '启蒙草原' }).click()

    // Inline challenge button still named "草原小考" but has "已完成" description
    const quizBtn = page.getByRole('button', { name: /草原小考/ })
    await expect(quizBtn).toBeVisible({ timeout: 10_000 })
    await quizBtn.click()

    // Modal shows "已通过" disabled button instead of "开始答题"
    const passedBtn = page.getByRole('button', { name: /^已通过$/ })
    await expect(passedBtn).toBeVisible({ timeout: 5_000 })
    await expect(passedBtn).toBeDisabled()
  })
})
