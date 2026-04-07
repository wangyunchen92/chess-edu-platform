# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: teacher-student.spec.ts >> 师生管理 >> 学生输入无效邀请码显示错误
- Location: e2e/teacher-student.spec.ts:43:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('邀请码无效')
Expected: visible
Timeout: 3000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 3000ms
  - waiting for getByText('邀请码无效')

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
      - link "对弈" [ref=e17] [cursor=pointer]:
        - /url: /play
        - img [ref=e19]
        - generic [ref=e21]: 对弈
      - link "谜题" [ref=e22] [cursor=pointer]:
        - /url: /puzzles
        - img [ref=e24]
        - generic [ref=e27]: 谜题
      - link "学习" [ref=e28] [cursor=pointer]:
        - /url: /learn
        - img [ref=e30]
        - generic [ref=e32]: 学习
      - link "冒险" [ref=e33] [cursor=pointer]:
        - /url: /adventure
        - img [ref=e35]
        - generic [ref=e37]: 冒险
      - link "训练" [ref=e38] [cursor=pointer]:
        - /url: /train
        - img [ref=e40]
        - generic [ref=e43]: 训练
      - link "弱点诊断" [ref=e44] [cursor=pointer]:
        - /url: /diagnosis
        - img [ref=e46]
        - generic [ref=e50]: 弱点诊断
      - link "我的" [ref=e51] [cursor=pointer]:
        - /url: /profile
        - img [ref=e53]
        - generic [ref=e56]: 我的
    - button "折叠" [ref=e59] [cursor=pointer]:
      - img [ref=e60]
      - generic [ref=e62]: 折叠
  - banner [ref=e63]:
    - heading "个人中心" [level=1] [ref=e64]
    - generic [ref=e65]:
      - button [ref=e66] [cursor=pointer]:
        - img [ref=e67]
      - generic [ref=e71]:
        - generic [ref=e73]: 小
        - generic [ref=e74]: 小棋手
  - main [ref=e75]:
    - generic [ref=e77]:
      - generic [ref=e79]:
        - generic [ref=e80]: 小
        - generic [ref=e81]:
          - generic [ref=e82]:
            - heading "小棋手" [level=1] [ref=e83]
            - generic [ref=e84]: 学生
          - paragraph [ref=e85]: "@student"
          - generic [ref=e87]:
            - generic [ref=e88]: 🔥
            - generic [ref=e89]: "1"
            - generic [ref=e90]: 天
        - button "编辑资料" [ref=e91] [cursor=pointer]
      - generic [ref=e92]:
        - generic [ref=e94]:
          - text: 对弈评分
          - generic [ref=e96]:
            - generic [ref=e97]: 🥉 棋手 I
            - generic [ref=e98]: "400"
        - generic [ref=e100]:
          - text: 谜题评分
          - generic [ref=e102]:
            - generic [ref=e103]: 🫡 学徒 III
            - generic [ref=e104]: "300"
      - generic [ref=e105]:
        - generic [ref=e106]:
          - generic [ref=e107]:
            - generic [ref=e108]: ♞
            - heading "对弈统计" [level=3] [ref=e109]
          - generic [ref=e110]:
            - generic [ref=e111]:
              - generic [ref=e112]: 总对局
              - generic [ref=e113]: "0"
            - generic [ref=e114]:
              - generic [ref=e115]: 🏆 胜
              - generic [ref=e116]: "0"
            - generic [ref=e117]:
              - generic [ref=e118]: 💪 负
              - generic [ref=e119]: "0"
            - generic [ref=e120]:
              - generic [ref=e121]: 🤝 和
              - generic [ref=e122]: "0"
            - generic [ref=e124]:
              - generic [ref=e125]: 胜率
              - generic [ref=e126]: 0%
        - generic [ref=e129]:
          - generic [ref=e130]:
            - generic [ref=e131]: 🧩
            - heading "谜题统计" [level=3] [ref=e132]
          - generic [ref=e133]:
            - generic [ref=e134]:
              - generic [ref=e135]: 谜题评分
              - generic [ref=e136]: "300"
            - generic [ref=e137]:
              - generic [ref=e138]: 已解题数
              - generic [ref=e139]: "0"
            - generic [ref=e141]:
              - generic [ref=e142]: 正确率
              - generic [ref=e143]: 0%
        - generic [ref=e146]:
          - generic [ref=e147]:
            - generic [ref=e148]: 📚
            - heading "学习进度" [level=3] [ref=e149]
          - generic [ref=e150]:
            - generic [ref=e151]:
              - img [ref=e152]
              - generic [ref=e156]: 0/55
            - paragraph [ref=e157]: 已完成 0 / 55 门课程
          - button "继续学习" [ref=e158] [cursor=pointer]
      - generic [ref=e159]:
        - generic [ref=e160]:
          - generic [ref=e161]:
            - generic [ref=e162]: 🏅
            - heading "最近成就" [level=3] [ref=e163]
          - button "查看全部" [ref=e164] [cursor=pointer]
        - paragraph [ref=e165]: 还没有解锁成就，继续努力吧！
      - generic [ref=e166]:
        - generic [ref=e167]:
          - generic [ref=e168]:
            - generic [ref=e169]: 👨‍🏫
            - heading "我的老师" [level=3] [ref=e170]
          - button "加入老师" [ref=e171] [cursor=pointer]
        - generic [ref=e174]:
          - generic [ref=e175]: 👨‍🏫
          - generic [ref=e176]:
            - paragraph [ref=e177]: 王老师
            - paragraph [ref=e178]: 加入于 2026/4/3
        - generic [ref=e181]:
          - generic [ref=e182]:
            - heading "加入老师" [level=2] [ref=e183]
            - button [ref=e184] [cursor=pointer]:
              - img [ref=e185]
          - generic [ref=e187]:
            - paragraph [ref=e188]: 输入老师给你的6位邀请码
            - textbox "例如 A3K9X2" [ref=e189]: XXXXXX
            - paragraph [ref=e190]: Invalid invite code
            - button "确认加入" [ref=e191] [cursor=pointer]
      - button "退出登录" [ref=e192] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | import { login } from './helpers'
  3  | 
  4  | test.describe('师生管理', () => {
  5  |   test('老师在"我的"页面生成邀请码', async ({ page }) => {
  6  |     await login(page, 'teacher1', '123456')
  7  |     await page.click('text=我的')
  8  |     await page.waitForURL(/\/profile/)
  9  | 
  10 |     // 点击生成邀请码
  11 |     await page.click('text=生成邀请码')
  12 |     await page.waitForTimeout(1500)
  13 | 
  14 |     // 应该有邀请码显示（大号等宽字体）
  15 |     const codeElement = page.locator('.font-mono.text-2xl')
  16 |     if (await codeElement.count() > 0) {
  17 |       const codeText = await codeElement.first().textContent()
  18 |       expect(codeText?.trim()).toMatch(/^[A-Z0-9]{6}$/)
  19 |     }
  20 |   })
  21 | 
  22 |   test('老师复制邀请码', async ({ page }) => {
  23 |     await login(page, 'teacher1', '123456')
  24 |     await page.click('text=我的')
  25 |     await page.waitForURL(/\/profile/)
  26 |     await page.waitForTimeout(1000)
  27 | 
  28 |     // 如果有邀请码，点击复制
  29 |     const copyBtn = page.getByText('复制').first()
  30 |     if (await copyBtn.isVisible()) {
  31 |       await copyBtn.click()
  32 |       await expect(page.getByText('已复制').first()).toBeVisible({ timeout: 3000 })
  33 |     }
  34 |   })
  35 | 
  36 |   test('学生在"我的"页面看到"加入老师"入口', async ({ page }) => {
  37 |     await login(page, 'student', '123456')
  38 |     await page.click('text=我的')
  39 |     await page.waitForURL(/\/profile/)
  40 |     await expect(page.getByText('加入老师')).toBeVisible()
  41 |   })
  42 | 
  43 |   test('学生输入无效邀请码显示错误', async ({ page }) => {
  44 |     await login(page, 'student', '123456')
  45 |     await page.click('text=我的')
  46 |     await page.waitForURL(/\/profile/)
  47 | 
  48 |     // 点击"加入老师"
  49 |     await page.click('text=加入老师')
  50 |     await page.waitForTimeout(500)
  51 | 
  52 |     // 输入无效码
  53 |     const input = page.locator('input[maxlength="6"]').first()
  54 |     await input.fill('XXXXXX')
  55 |     await page.click('text=确认加入')
  56 |     await page.waitForTimeout(1500)
  57 | 
  58 |     // 应该显示错误提示
> 59 |     await expect(page.getByText('邀请码无效')).toBeVisible({ timeout: 3000 })
     |                                           ^ Error: expect(locator).toBeVisible() failed
  60 |   })
  61 | })
  62 | 
```