import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    channel: 'chrome',
    storageState: 'e2e/.auth/admin.json',  // 复用已登录状态
  },
  projects: [
    // 无需登录的测试（auth.spec.ts 自己处理登录）
    {
      name: 'auth',
      testMatch: 'auth.spec.ts',
      use: { storageState: undefined },  // 不复用登录状态
    },
    // 需要特定角色的测试
    {
      name: 'teacher-student',
      testMatch: 'teacher-student.spec.ts',
      use: { storageState: undefined },  // 自己登录不同角色
    },
    // 需要 admin 登录的页面测试（复用 globalSetup 的状态）
    {
      name: 'pages',
      testMatch: 'pages.spec.ts',
      dependencies: [],
    },
    // 编辑器摆残局 + 和 AI 对弈（测试内自行以 student 账号登录）
    {
      name: 'editor-vs-ai',
      testMatch: 'editor-vs-ai.spec.ts',
      use: { storageState: undefined },
    },
    // 冒险 · 草原小考（测试内自行登录）
    {
      name: 'adventure-quiz',
      testMatch: 'adventure-quiz.spec.ts',
      use: { storageState: undefined },
    },
    {
      name: 'landing',
      testMatch: 'landing.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/empty.json',
      },
    },
  ],
})
