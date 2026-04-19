import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('认证流程', () => {
  test('admin 登录成功并跳转到首页', async ({ page }) => {
    await login(page, 'admin', 'admin123')
    await expect(page).toHaveURL('/')
    // 侧边栏应该可见
    await expect(page.locator('aside')).toBeVisible()
  })

  test('student 登录成功', async ({ page }) => {
    await login(page, 'student', '123456')
    await expect(page).toHaveURL('/')
  })

  test('teacher 登录后侧边栏显示"我的学生"', async ({ page }) => {
    await login(page, 'teacher1', '123456')
    await expect(page).toHaveURL('/')
    await expect(page.getByText('我的学生')).toBeVisible()
  })

  test('student 侧边栏不显示"我的学生"', async ({ page }) => {
    await login(page, 'student', '123456')
    await expect(page.getByText('我的学生')).not.toBeVisible()
  })

  test('错误密码登录失败', async ({ page }) => {
    // 不走 login() helper：helper 内部 waitForURL 会等 15s 直到离开 /login，
    // 而错误密码场景永远不会跳走，会超时失败。此处直接手动操作。
    await page.context().clearCookies()
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
    await page.waitForSelector('input[autocomplete="username"]', { timeout: 10_000 })

    await page.fill('input[autocomplete="username"]', 'admin')
    await page.fill('input[autocomplete="current-password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // 应该还在登录页
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/login/)
  })
})
