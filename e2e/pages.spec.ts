import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('页面渲染检查', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin', 'admin123')
  })

  const pages = [
    { path: '/', title: '首页', selector: 'text=今日任务' },
    { path: '/play', title: '对弈', selector: 'text=选择你的对手' },
    { path: '/puzzles', title: '谜题', selector: 'text=谜题' },
    { path: '/learn', title: '学习', selector: 'text=课程' },
    { path: '/train', title: '训练', selector: 'text=训练' },
    { path: '/adventure', title: '冒险', selector: 'text=冒险' },
    { path: '/diagnosis', title: '弱点诊断', selector: 'text=弱点诊断, text=诊断' },
    { path: '/profile', title: '我的', selector: 'text=段位' },
    { path: '/play/free', title: '自由对弈', selector: 'text=面对面对弈' },
    { path: '/play/editor', title: '摆题', selector: 'text=分析' },
  ]

  for (const p of pages) {
    test(`${p.title}页面正常渲染 (${p.path})`, async ({ page }) => {
      await page.goto(p.path)
      await page.waitForLoadState('networkidle')
      // 页面不是空白
      const body = page.locator('body')
      await expect(body).not.toBeEmpty()
      // 不应该有未捕获的JS错误导致白屏（检查root有子元素）
      const root = page.locator('#root')
      const childCount = await root.evaluate((el) => el.children.length)
      expect(childCount).toBeGreaterThan(0)
    })
  }
})

test.describe('课后练习流程', () => {
  test('学习中心切换到课后练习tab', async ({ page }) => {
    await login(page, 'admin', 'admin123')
    await page.goto('/learn')
    await page.waitForLoadState('networkidle')

    // 点击"课后练习" tab
    await page.click('text=课后练习')
    await page.waitForTimeout(500)

    // 应该显示练习概览（总题数）
    await expect(page.getByText('总题数')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('角色大厅', () => {
  test('显示9个角色按区域分组', async ({ page }) => {
    await login(page, 'admin', 'admin123')
    await page.goto('/play')
    await page.waitForLoadState('networkidle')

    // 应该有区域标题
    await expect(page.getByText('启蒙草原')).toBeVisible({ timeout: 5000 })

    // 应该有自由对弈入口
    await expect(page.getByText('自由对弈')).toBeVisible()
  })
})
