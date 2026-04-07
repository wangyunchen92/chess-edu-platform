/**
 * usePaywall — 会员限制 hook
 *
 * 当前阶段：全部放开，不做任何限制。
 * 后续会员系统重新设计后，改为从后端 API 获取配额状态。
 * 前端不再用 localStorage 计数（不可靠），统一由后端判断。
 */

interface PaywallResult {
  blocked: boolean
  message: string
  remaining: number
  checkAndBlock: () => boolean
}

export function usePaywall(_feature: string): PaywallResult {
  return {
    blocked: false,
    message: '',
    remaining: Infinity,
    checkAndBlock: () => false,
  }
}
