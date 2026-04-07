# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> 认证流程 >> 错误密码登录失败
- Location: e2e/auth.spec.ts:28:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[autocomplete="username"]')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - generic [ref=e6]:
      - img [ref=e8]
      - generic [ref=e10]: 棋境大陆
    - navigation [ref=e11]:
      - link "首页" [ref=e12] [cursor=pointer]:
        - /url: /
        - img [ref=e14]
        - generic [ref=e16]: 首页
      - link "对弈" [ref=e18] [cursor=pointer]:
        - /url: /play
        - img [ref=e20]
        - generic [ref=e22]: 对弈
      - link "谜题" [ref=e23] [cursor=pointer]:
        - /url: /puzzles
        - img [ref=e25]
        - generic [ref=e28]: 谜题
      - link "学习" [ref=e29] [cursor=pointer]:
        - /url: /learn
        - img [ref=e31]
        - generic [ref=e33]: 学习
      - link "冒险" [ref=e34] [cursor=pointer]:
        - /url: /adventure
        - img [ref=e36]
        - generic [ref=e38]: 冒险
      - link "训练" [ref=e39] [cursor=pointer]:
        - /url: /train
        - img [ref=e41]
        - generic [ref=e44]: 训练
      - link "弱点诊断" [ref=e45] [cursor=pointer]:
        - /url: /diagnosis
        - img [ref=e47]
        - generic [ref=e51]: 弱点诊断
      - link "我的" [ref=e52] [cursor=pointer]:
        - /url: /profile
        - img [ref=e54]
        - generic [ref=e57]: 我的
      - link "设置" [ref=e58] [cursor=pointer]:
        - /url: /settings
        - img [ref=e60]
        - generic [ref=e63]: 设置
    - button "折叠" [ref=e65] [cursor=pointer]:
      - img [ref=e66]
      - generic [ref=e68]: 折叠
  - banner [ref=e69]:
    - heading "首页" [level=1] [ref=e70]
    - generic [ref=e71]:
      - button [ref=e72] [cursor=pointer]:
        - img [ref=e73]
      - generic [ref=e77]:
        - generic [ref=e79]: 管
        - generic [ref=e80]: 管理员
  - main [ref=e81]:
    - generic [ref=e83]:
      - generic [ref=e84]:
        - generic [ref=e85]:
          - generic [ref=e86]: 管
          - generic [ref=e87]:
            - heading "管理员，你好！" [level=1] [ref=e88]
            - generic [ref=e89]:
              - generic [ref=e90]:
                - generic [ref=e91]: 🥉 棋手 I
                - generic [ref=e92]: "400"
              - generic [ref=e93]: 对弈评分
        - generic [ref=e94]:
          - generic [ref=e95]: 🔥
          - generic [ref=e96]: "2"
          - generic [ref=e97]: 天
      - generic [ref=e98]:
        - heading "📋 今日待办" [level=3] [ref=e99]
        - generic [ref=e100]:
          - generic [ref=e101] [cursor=pointer]:
            - generic [ref=e102]: 🎯
            - generic [ref=e103]: 完成每日训练 (0/3)
            - generic [ref=e104]: ›
          - generic [ref=e105] [cursor=pointer]:
            - generic [ref=e106]: ♞
            - generic [ref=e107]: 和AI角色下一盘棋
            - generic [ref=e108]: ›
          - generic [ref=e109] [cursor=pointer]:
            - generic [ref=e110]: 📚
            - generic [ref=e111]: 继续学习课程
            - generic [ref=e112]: ›
      - generic [ref=e113]:
        - generic [ref=e114] [cursor=pointer]:
          - generic [ref=e115]:
            - generic [ref=e116]: 🎯
            - heading "今日训练" [level=3] [ref=e117]
          - generic [ref=e119]:
            - generic [ref=e120]: 训练进度
            - generic [ref=e121]: 0 / 3
        - generic [ref=e124] [cursor=pointer]:
          - generic [ref=e125]:
            - generic [ref=e126]: ♞
            - heading "快速对弈" [level=3] [ref=e127]
          - paragraph [ref=e128]: 挑战AI角色，提升你的棋力
          - button "进入对弈大厅" [ref=e129]
        - generic [ref=e130] [cursor=pointer]:
          - generic [ref=e131]:
            - generic [ref=e132]: 🧩
            - heading "每日谜题" [level=3] [ref=e133]
          - paragraph [ref=e134]: 每天三道精选谜题，锻炼战术思维
          - button "今日谜题" [ref=e135]
      - generic [ref=e136]:
        - generic [ref=e137]:
          - heading "🎮 最近对局" [level=3] [ref=e138]
          - button "查看全部" [ref=e139] [cursor=pointer]
        - paragraph [ref=e140]: 还没有对局记录，去下一盘棋吧！
      - generic [ref=e141]:
        - heading "📊 本周数据概览" [level=3] [ref=e142]
        - generic [ref=e143]:
          - generic [ref=e144]:
            - generic [ref=e145]: ♞
            - generic [ref=e146]: "0"
            - generic [ref=e147]: 对局
          - generic [ref=e148]:
            - generic [ref=e149]: 🏆
            - generic [ref=e150]: 0%
            - generic [ref=e151]: 胜率
          - generic [ref=e152]:
            - generic [ref=e153]: 🧩
            - generic [ref=e154]: "4"
            - generic [ref=e155]: 谜题
          - generic [ref=e156]:
            - generic [ref=e157]: 📚
            - generic [ref=e158]: 0分钟
            - generic [ref=e159]: 学习
      - heading "💡 推荐内容" [level=3] [ref=e161]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | import { login } from './helpers'
  3  | 
  4  | test.describe('认证流程', () => {
  5  |   test('admin 登录成功并跳转到首页', async ({ page }) => {
  6  |     await login(page, 'admin', 'admin123')
  7  |     await expect(page).toHaveURL('/')
  8  |     // 侧边栏应该可见
  9  |     await expect(page.locator('aside')).toBeVisible()
  10 |   })
  11 | 
  12 |   test('student 登录成功', async ({ page }) => {
  13 |     await login(page, 'student', '123456')
  14 |     await expect(page).toHaveURL('/')
  15 |   })
  16 | 
  17 |   test('teacher 登录后侧边栏显示"我的学生"', async ({ page }) => {
  18 |     await login(page, 'teacher1', '123456')
  19 |     await expect(page).toHaveURL('/')
  20 |     await expect(page.getByText('我的学生')).toBeVisible()
  21 |   })
  22 | 
  23 |   test('student 侧边栏不显示"我的学生"', async ({ page }) => {
  24 |     await login(page, 'student', '123456')
  25 |     await expect(page.getByText('我的学生')).not.toBeVisible()
  26 |   })
  27 | 
  28 |   test('错误密码登录失败', async ({ page }) => {
  29 |     await page.goto('/login')
> 30 |     await page.fill('input[autocomplete="username"]', 'admin')
     |                ^ Error: page.fill: Test timeout of 30000ms exceeded.
  31 |     await page.fill('input[autocomplete="current-password"]', 'wrongpassword')
  32 |     await page.click('button[type="submit"]')
  33 |     // 应该还在登录页
  34 |     await page.waitForTimeout(1000)
  35 |     await expect(page).toHaveURL(/login/)
  36 |   })
  37 | })
  38 | 
```