import { test, expect } from '@playwright/test'
import { login } from './helpers'

// Backend applies a 100 req/min per-IP rate limit (app/main.py: default_rpm=100).
// Playwright bursts ~30-40 requests per test (login+detail+stockfish init+etc),
// so 3 tests already saturate the window and a 4th sees 429 on createFreeGame
// ("创建对局失败，请稍后重试"). We pace the suite: on test start, if we've
// burned most of the budget, sleep until the 60-second sliding window rolls.
let _apiCount = 0
let _windowStart = Date.now()
const _BUDGET_SOFT_LIMIT = 70

test.describe('编辑器 · 和 AI 对弈', () => {
  test.beforeEach(async ({ page }) => {
    const elapsed = Date.now() - _windowStart
    if (elapsed > 60_000) {
      // window already rolled
      _apiCount = 0
      _windowStart = Date.now()
    } else if (_apiCount > _BUDGET_SOFT_LIMIT) {
      const wait = 61_000 - elapsed
      // eslint-disable-next-line no-console
      console.log(`[rate-limit-guard] pausing ${wait}ms (count=${_apiCount}) to avoid 429`)
      await new Promise((r) => setTimeout(r, wait))
      _apiCount = 0
      _windowStart = Date.now()
    }
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/')) _apiCount++
    })
    // Safety net: transparently retry /api/v1/play/free-games on 429 since the
    // user-facing failure there breaks the critical flow.
    await page.route('**/api/v1/play/free-games', async (route) => {
      try {
        let res = await route.fetch()
        if (res.status() === 429) {
          const retryAfter = Number(res.headers()['retry-after'] ?? 3)
          await new Promise((r) => setTimeout(r, (retryAfter + 0.5) * 1000))
          try {
            res = await route.fetch()
          } catch {
            /* page closed during wait */
          }
        }
        await route.fulfill({ response: res })
      } catch {
        // Page/context may have closed mid-flight; fall back to continue.
        try {
          await route.continue()
        } catch {
          /* ignore */
        }
      }
    })
    await login(page, 'student', '123456')
  })
  test.afterEach(async ({ page }) => {
    // Drain routes so any pending retry doesn't outlive the test.
    try {
      await page.unrouteAll({ behavior: 'ignoreErrors' })
    } catch {
      /* ignore */
    }
  })

  // 共用残局：K g6 + Q f7 + k h8, 白先。Qf7→h7# 是一步杀。
  // （白王 g6 保护 h7 格子，黑王无法吃后；若白王远在 a1，黑王可 Kxh7 变子力不足和棋）
  async function setupKQvsKEndgame(page: import('@playwright/test').Page) {
    await page.goto('/play/editor')
    await page.getByRole('button', { name: '清空棋盘' }).click()
    // 白王 g6
    await page.locator('[data-palette-piece="K"]').click()
    await page.locator('[data-square="g6"]').click()
    // 白后 f7
    await page.locator('[data-palette-piece="Q"]').click()
    await page.locator('[data-square="f7"]').click()
    // 黑王 h8
    await page.locator('[data-palette-piece="k"]').click()
    await page.locator('[data-square="h8"]').click()
  }

  test('用例 1: 摆残局 K+Q vs K 能进入对弈页', async ({ page }) => {
    await page.goto('/play/editor')

    // 清空棋盘
    await page.getByRole('button', { name: '清空棋盘' }).click()

    // 摆 K+Q(白) vs K(黑)：白王 e1、白后 a5、黑王 e8
    // （白后 a5 不将军黑王 e8 —— 用例 1 只要求局面合法，不需要一步杀）
    await page.locator('button[title="King"]').first().click()
    await page.locator('[data-square="e1"]').click()
    await page.locator('button[title="Queen"]').first().click()
    await page.locator('[data-square="a5"]').click()
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

  test('用例 2: 一步将杀后结果卡显示胜利', async ({ page }) => {
    await setupKQvsKEndgame(page)

    await page.getByRole('button', { name: '开始对弈' }).click()
    await page.waitForURL(/\/play\/free\/game\/[a-f0-9-]+/, { timeout: 10_000 })

    // 到达对弈页后 f7 有白后（验证 initial_fen 加载）
    await expect(page.locator('[data-square="f7"] img')).toBeVisible({ timeout: 5_000 })

    // 用户走 Qf7-h7# 一步将杀
    await page.locator('[data-square="f7"]').click()
    await page.locator('[data-square="h7"]').click()

    // 结果卡：Modal 组件用 title "对局结束" 标识。z-[1000] 是 Modal overlay 专有 class
    // （FreeGamePage 自身也是 fixed inset-0，不能只用 .fixed.inset-0 作为 scope）。
    const resultModal = page.locator('.z-\\[1000\\]').filter({ hasText: '对局结束' })
    await expect(resultModal.getByText(/将杀|胜利|获胜/)).toBeVisible({ timeout: 10_000 })

    // 3 个按钮存在（scope 到 modal 避免和棋盘下方按钮冲突）
    await expect(resultModal.getByRole('button', { name: '再来一局' })).toBeVisible()
    await expect(resultModal.getByRole('button', { name: '返回编辑器' })).toBeVisible()
    // 查看复盘 / 查看分析（FreeGamePage 实际文案为"查看分析"）—用正则兜底
    await expect(resultModal.getByRole('button', { name: /复盘|分析/ })).toBeVisible()
  })

  test('用例 3: 「返回编辑器」按钮回到 /play/editor', async ({ page }) => {
    await setupKQvsKEndgame(page)
    await page.getByRole('button', { name: '开始对弈' }).click()
    await page.waitForURL(/\/play\/free\/game\/[a-f0-9-]+/, { timeout: 10_000 })
    // Wait for initial_fen to load on board before clicking — otherwise
    // Chessboard's fen useEffect resets selectedSquare mid-click and the
    // move never lands.
    await expect(page.locator('[data-square="f7"] img')).toBeVisible({ timeout: 5_000 })
    await page.locator('[data-square="f7"]').click()
    await page.locator('[data-square="h7"]').click()

    const resultModal = page.locator('.z-\\[1000\\]').filter({ hasText: '对局结束' })
    await expect(resultModal.getByRole('button', { name: '返回编辑器' })).toBeVisible({ timeout: 10_000 })
    await resultModal.getByRole('button', { name: '返回编辑器' }).click()

    await expect(page).toHaveURL(/\/play\/editor$/, { timeout: 10_000 })
  })

  test('用例 5: 「再来一局」创建新 gameId 且棋盘回到原 FEN', async ({ page }) => {
    await setupKQvsKEndgame(page)
    await page.getByRole('button', { name: '开始对弈' }).click()
    await page.waitForURL(/\/play\/free\/game\/[a-f0-9-]+/, { timeout: 10_000 })
    const oldUrl = page.url()
    // Wait for initial_fen to load on board before clicking (same race as 用例 3).
    await expect(page.locator('[data-square="f7"] img')).toBeVisible({ timeout: 5_000 })
    await page.locator('[data-square="f7"]').click()
    await page.locator('[data-square="h7"]').click()

    const resultModal = page.locator('.z-\\[1000\\]').filter({ hasText: '对局结束' })
    await expect(resultModal.getByRole('button', { name: '再来一局' })).toBeVisible({ timeout: 10_000 })
    await resultModal.getByRole('button', { name: '再来一局' }).click()

    // URL 变化（新 gameId）
    await page.waitForURL(
      (url) => /\/play\/free\/game\/[a-f0-9-]+/.test(url.toString()) && url.toString() !== oldUrl,
      { timeout: 10_000 },
    )
    // 仍显示 Stockfish 对手
    await expect(page.getByText('Stockfish · 大师级')).toBeVisible({ timeout: 5_000 })
    // 棋盘原 FEN 还原：f7 仍是白后（未被走过）
    await expect(page.locator('[data-square="f7"] img')).toBeVisible({ timeout: 5_000 })
  })
})
