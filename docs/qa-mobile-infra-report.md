# 测试报告：移动端适配基础设施改动

- 测试日期: 2026-04-04
- 测试人: qa-agent
- 测试范围: useBreakpoint hook + AppLayout / BottomNav / Modal / Toast / Button 移动端适配改造

---

## 1. src/hooks/useBreakpoint.ts -- 通过

### 断点定义
- xs: <480 -- 正确
- sm: 480-767 -- 正确 (min-width:480, !md)
- md: 768-1023 -- 正确 (min-width:768, !lg)
- lg: >=1024 -- 正确 (min-width:1024)

### isMobile/isTablet/isDesktop 逻辑
- isMobile = !md（即 <768）-- 正确
- isTablet = md && !lg（即 768-1023）-- 正确
- isDesktop = lg（即 >=1024）-- 正确

### matchMedia 监听器清理
- useEffect 返回 cleanup 函数，正确 removeEventListener 三个 MediaQueryList -- 通过，无内存泄漏

### SSR 安全性
- useState 初始化函数中有 `typeof window === 'undefined'` 检查，返回 SSR 默认值 -- 通过
- SSR 默认值为 lg/desktop，符合"桌面优先渲染"策略

### 注意事项（非阻塞）
- SSR 默认值为 desktop，移动端首次水合时会有一次 breakpoint 切换闪烁（hydration mismatch）。可以接受，但未来如果做 SSR 需要考虑。

---

## 2. src/components/layout/AppLayout.tsx -- 通过

### useBreakpoint 使用
- 正确导入并使用 `const { isMobile } = useBreakpoint()` -- 通过

### 布局逻辑
- 桌面端: 渲染 Sidebar + TopNav，main 有 marginLeft 和 paddingTop -- 正确
- 移动端: 隐藏 Sidebar/TopNav，渲染 BottomNav，marginLeft=0/paddingTop=0 -- 正确
- 底部有 `pb-20 md:pb-6` 为 BottomNav 留空间 -- 正确

### window.innerWidth 残留
- 全局搜索确认：layout 目录下无 `window.innerWidth` 或直接 `matchMedia` 调用 -- 通过

---

## 3. src/components/layout/BottomNav.tsx -- 不通过

### 5个Tab完整性
- 定义了6个: 首页/对弈/谜题/学习/我的/设置(adminOnly)
- 非管理员用户看到5个 Tab -- 正确
- 管理员用户看到6个 Tab -- 需确认是否符合预期（6个Tab在小屏上可能拥挤）

### 触摸区域
- NavLink: `min-h-[52px] min-w-[44px]` -- 满足 >= 44px
- 图标容器: `w-[44px] h-[28px]` -- 水平触摸区域 44px 满足

### iOS safe-area-inset-bottom
- `paddingBottom: 'env(safe-area-inset-bottom, 0px)'` -- 正确

### 当前Tab高亮
- 通过 `isActive()` 判断，首页精确匹配 `/`，其他前缀匹配 -- 正确
- 颜色: active 用 `var(--accent)`，inactive 用 `var(--text-muted)` -- 正确

### [BUG] CSS 变量名错误
- **第89行**: `backgroundColor: 'var(--card-bg)'`
- 项目 CSS 变量系统中定义的是 `--bg-card`，不是 `--card-bg`
- `--card-bg` 在任何 CSS 文件中均未定义
- **后果**: BottomNav 背景色透明，在深色模式下内容会透过底栏显示，严重影响可读性
- **修复**: 将 `var(--card-bg)` 改为 `var(--bg-card)`

---

## 4. src/components/common/Modal.tsx -- 不通过

### 移动端底部弹出
- isMobile 时: `items-end` 将内容推到底部，`rounded-t-[20px]` 顶部圆角，max-h-[85vh] -- 正确
- 拖拽手柄: 仅移动端显示，`w-10 h-1 rounded-full` -- 正确（视觉提示）

### 桌面端居中
- !isMobile 时: `items-center justify-center` 居中 -- 正确
- 宽度由 props 控制，默认 480px，maxWidth 90vw -- 正确

### slide-up 动画
- 移动端: `animate-[sheet-up_0.3s_ease-out]`，关键帧 `translateY(100%) -> translateY(0)` -- 正确
- 桌面端: `animate-[modal-in_0.2s_ease-out]`，关键帧 `scale(0.95) translateY(8px) -> scale(1) translateY(0)` -- 正确

### safe-area 适配
- 移动端: `paddingBottom: 'env(safe-area-inset-bottom, 16px)'` -- 正确

### [BUG] 关闭按钮触摸区域不足
- **第80行**: `className="w-8 h-8 ..."` 即 32px x 32px
- 低于移动端 44px 最小触摸区域标准
- 桌面端 32px 可接受，但移动端应为 44px
- **修复建议**: 改为 `min-w-[44px] min-h-[44px]`，或在移动端条件下增大

### [注意] overlay 点击关闭的交互问题
- overlay 的 onClick 判断 `e.target === overlayRef.current`
- 但 overlay div 内部有一个绝对定位的 `bg-black/50` div 覆盖了整个区域
- 实际点击时 `e.target` 是内部的半透明 div，不是 overlayRef.current
- **后果**: 点击遮罩层无法关闭 Modal
- **修复建议**: 将 onClick 的判断改为 `e.target === overlayRef.current || e.target === overlayRef.current?.firstElementChild`，或将半透明层也设置 `pointer-events: none`

---

## 5. src/components/common/Toast.tsx -- 通过

### 移动端位置
- `bottom-20 left-4 right-4 items-center` -- 底部居中，距底部 80px（BottomNav 上方）-- 正确

### 桌面端位置
- `md:bottom-auto md:left-auto md:top-[var(--space-5)] md:right-[var(--space-5)]` -- 右上角 -- 正确

### 关闭按钮触摸区域
- `min-w-[44px] min-h-[44px]` -- 满足 >= 44px -- 正确

### 动画
- 移动端: `translateY(8px) -> translateY(0)` 从下滑入 -- 正确
- 桌面端: `translateX(20px) -> translateX(0)` 从右滑入 -- 正确

### 注意事项（非阻塞）
- Toast 使用 Tailwind 的 `md:` 前缀（768px）做响应式，而非 useBreakpoint hook
- 与 useBreakpoint 的 md 断点（768px）一致，不会产生不一致行为
- 但这是两套响应式判断机制并存（JS hook vs CSS media query），建议未来统一

---

## 6. src/components/common/Button.tsx -- 通过

### min-h-[44px] 检查
- sm: `min-h-[44px]` -- 通过
- md: `min-h-[44px]` -- 通过
- lg: `min-h-[44px]` -- 通过

所有尺寸变体均满足 44px 最小触摸区域要求。

---

## 7. TypeScript 编译检查 -- 通过

`npx tsc --noEmit` 执行结果: 0 errors，无输出，编译通过。

---

## 8. 断点一致性检查 -- 注意

variables.css 中的响应式断点定义:
- max-width: 768px (mobile)
- min-width: 769px (tablet)
- min-width: 1025px (desktop)

useBreakpoint hook 中的断点:
- min-width: 768px (md)
- min-width: 1024px (lg)

在 768px 和 1024px 两个边界值上存在 1px 差异:
- 768px 宽度时: CSS 认为是 mobile，hook 认为是 tablet（isMobile=false）
- 1024px 宽度时: CSS 认为是 tablet，hook 认为是 desktop

**影响**: CSS 变量（如 --sidebar-width）和 JS 逻辑（如 AppLayout 的 isMobile 判断）在边界像素上会不一致。实际影响极小（用户不太可能恰好停在这个精确宽度），但建议对齐。

---

## 问题汇总

| 序号 | 文件 | 严重度 | 问题描述 |
|------|------|--------|----------|
| BUG-1 | BottomNav.tsx:89 | **高** | CSS 变量名写错: `var(--card-bg)` 应为 `var(--bg-card)`，导致底栏背景透明 |
| BUG-2 | Modal.tsx:80 | **中** | 关闭按钮 w-8 h-8 (32px)，低于移动端 44px 触摸区域最小标准 |
| BUG-3 | Modal.tsx:44-46 | **中** | 点击遮罩关闭失效：overlayRef 内部有绝对定位子元素拦截了点击事件 |
| WARN-1 | variables.css vs useBreakpoint | 低 | 响应式断点边界值有 1px 差异（768/1024） |
| WARN-2 | Toast.tsx | 低 | 使用 Tailwind md: 前缀而非 useBreakpoint hook，两套响应式机制并存 |
| WARN-3 | BottomNav.tsx | 低 | 管理员用户显示6个Tab（含设置），小屏幕上可能拥挤 |

---

## 总体结论: 不通过

存在 3 个 BUG 需修复后重新测试:

1. **BUG-1（高优先级）**: BottomNav 背景色 CSS 变量名写错，将 `var(--card-bg)` 改为 `var(--bg-card)`
2. **BUG-2（中优先级）**: Modal 关闭按钮触摸区域不足 44px，需改为 `min-w-[44px] min-h-[44px]`
3. **BUG-3（中优先级）**: Modal 遮罩层点击关闭功能失效，需修复事件委托逻辑

请退回前端工程师修复以上 3 个问题后重新提测。
