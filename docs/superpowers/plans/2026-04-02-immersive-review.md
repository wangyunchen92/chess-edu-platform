# 复盘沉浸式页面 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将复盘页面改为全屏沉浸式体验，隐藏侧边栏和顶部导航，深色背景，桌面端左棋盘右面板，移动端上下堆叠。

**Architecture:** 将 ReviewPage 路由从 AppLayout 内移出（参照 LessonPage 的做法），重写 ReviewPage 的外层布局为独立全屏页面，内部分析逻辑不变。

**Tech Stack:** React + TailwindCSS + CSS Variables，现有组件复用

**Spec:** `docs/superpowers/specs/2026-04-02-immersive-review-design.md`

---

## 文件结构

| 文件 | 变更 | 职责 |
|------|------|------|
| `frontend/src/App.tsx` | 修改 | 将 ReviewPage 路由移到 AppLayout 外 |
| `frontend/src/pages/play/ReviewPage.tsx` | 修改 | 重写外层布局为沉浸式全屏 |

仅 2 个文件变更，不新建文件。

---

### Task 1: 路由变更 — ReviewPage 移出 AppLayout

**Files:**
- Modify: `frontend/src/App.tsx:132`

- [ ] **Step 1: 移动路由**

在 App.tsx 中，将 ReviewPage 从 AppLayout 内移到与 LessonPage 同级（约第 119-122 行之后）：

```tsx
// 在 "Lesson page — full-screen immersive" 块之后，"Protected routes with layout" 块之前，新增：

{/* Review page — full-screen immersive, no app layout */}
<Route element={<ProtectedRoute />}>
  <Route path="/play/review/:id" element={<SuspenseWrapper><ReviewPage /></SuspenseWrapper>} />
</Route>
```

同时删除 AppLayout 内的这一行（约第 132 行）：
```tsx
// 删除这行：
<Route path="/play/review/:id" element={<SuspenseWrapper><ReviewPage /></SuspenseWrapper>} />
```

- [ ] **Step 2: 验证编译**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -v test.ts`
Expected: 无错误输出

- [ ] **Step 3: 提交**

```bash
git add frontend/src/App.tsx
git commit -m "refactor: ReviewPage路由移出AppLayout（沉浸式准备）"
```

---

### Task 2: ReviewPage 布局重写 — 沉浸式全屏

**Files:**
- Modify: `frontend/src/pages/play/ReviewPage.tsx`

- [ ] **Step 1: 替换最外层 div 为全屏容器**

将 ReviewPage return 中的最外层：
```tsx
<div className="space-y-5">
```

替换为沉浸式全屏容器：
```tsx
<div className="fixed inset-0 flex flex-col" style={{ background: '#0b1120' }}>
```

- [ ] **Step 2: 重写顶栏**

将现有的 Header 区域替换为固定顶栏：

```tsx
{/* 沉浸式顶栏 */}
<div
  className="flex items-center justify-between px-4 py-3 shrink-0"
  style={{
    background: 'rgba(11,17,32,0.9)',
    backdropFilter: 'blur(8px)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  }}
>
  <Button variant="secondary" size="sm" onClick={() => navigate('/play/history')}>
    ← 返回
  </Button>
  <div className="text-center">
    <span className="text-[var(--text-sm)] font-semibold text-white">
      {review.white} vs {review.black}
    </span>
    <span className="text-[var(--text-xs)] text-slate-400 ml-2">{review.result}</span>
  </div>
  <div className="flex items-center gap-2">
    {/* 分析按钮/深度选择器 — 保持现有逻辑 */}
  </div>
</div>
```

- [ ] **Step 3: 重写主体区域为左右布局（桌面）/ 上下布局（移动）**

在顶栏下方，用 flex 容器实现响应式布局：

```tsx
{/* 主体内容 */}
<div className="flex-1 overflow-auto">
  <div className="flex flex-col lg:flex-row h-full">
    {/* 左侧：棋盘区域 */}
    <div className="flex flex-col items-center justify-center p-4 lg:w-[60%] lg:min-h-full">
      {/* 评估条 */}
      {/* 棋盘 */}
      {/* 播放控制栏 */}
    </div>

    {/* 右侧：信息面板 */}
    <div
      className="flex-1 overflow-auto p-4 lg:border-l"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
    >
      {/* 分析进度 */}
      {/* 统计卡片 */}
      {/* 走法列表 */}
      {/* 局面小贴士 */}
    </div>
  </div>
</div>
```

- [ ] **Step 4: 调整棋盘大小**

棋盘容器使用响应式尺寸：
```tsx
<div className="w-full max-w-[min(100vw-32px,560px)] lg:max-w-[560px]">
  <Chessboard ... />
</div>
```

- [ ] **Step 5: 调整卡片/面板样式为深色透明**

将右侧面板中的 Card 组件背景替换为半透明深色：
```tsx
style={{
  background: 'rgba(30,41,59,0.6)',
  border: '1px solid rgba(255,255,255,0.08)',
}}
```

- [ ] **Step 6: 验证编译**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -v test.ts`
Expected: 无错误输出

- [ ] **Step 7: 本地验证**

Run: `cd frontend && npm run dev`
验证：
1. 访问 http://localhost:5173/play/review/{id} — 无侧边栏、无顶导航
2. 深色背景
3. 桌面端：左棋盘右面板
4. 缩小窗口：移动端上下堆叠
5. 返回按钮可正常跳转
6. 分析功能正常

- [ ] **Step 8: 构建验证**

Run: `cd frontend && VITE_BASE=/chess/ npm run build`
Expected: 构建成功

- [ ] **Step 9: 提交**

```bash
git add frontend/src/pages/play/ReviewPage.tsx
git commit -m "feat: 复盘页沉浸式全屏布局 — 深色背景+响应式左右/上下布局"
```

---

### Task 3: 验收验证

- [ ] **Step 1: verification-before-completion**

逐项验收：
1. 进入复盘页后无侧边栏、无顶部导航 — ✓/✗
2. 返回按钮可正常返回 — ✓/✗
3. 桌面端：左棋盘右面板布局 — ✓/✗
4. 移动端：上下堆叠，棋盘全宽 — ✓/✗
5. 分析功能正常工作 — ✓/✗
6. 深色背景沉浸式体验 — ✓/✗
7. TypeScript 编译无错误 — ✓/✗
8. Vite 构建成功 — ✓/✗

- [ ] **Step 2: 部署**

```bash
ssh root@118.31.237.111 "/opt/chess-edu/backup.sh"
ssh root@118.31.237.111 "rm -rf /opt/chess-edu/www/chess/assets"
scp -r frontend/dist/* root@118.31.237.111:/opt/chess-edu/www/chess/
```
