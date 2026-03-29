import { useState, useEffect, useCallback } from 'react'

interface PaywallResult {
  blocked: boolean
  message: string
  remaining: number
  checkAndBlock: () => boolean
}

const DAILY_LIMITS: Record<string, number> = {
  puzzle: 5,
  game: 3,
  ai_teach: 3,
}

function getUsageKey(feature: string): string {
  const today = new Date().toISOString().slice(0, 10)
  return `paywall_${feature}_${today}`
}

function getUsageCount(feature: string): number {
  try {
    return parseInt(localStorage.getItem(getUsageKey(feature)) ?? '0', 10)
  } catch {
    return 0
  }
}

function incrementUsage(feature: string): void {
  const key = getUsageKey(feature)
  const current = getUsageCount(feature)
  localStorage.setItem(key, String(current + 1))
}

/**
 * usePaywall - checks free-tier quota for a given feature.
 * Returns { blocked, message, remaining, checkAndBlock }.
 * Call checkAndBlock() before performing the action - it returns true if blocked.
 */
export function usePaywall(feature: string): PaywallResult {
  const limit = DAILY_LIMITS[feature] ?? 5
  const [count, setCount] = useState(() => getUsageCount(feature))

  useEffect(() => {
    setCount(getUsageCount(feature))
  }, [feature])

  const remaining = Math.max(0, limit - count)
  const blocked = remaining <= 0

  const message = blocked
    ? `今日免费${feature === 'puzzle' ? '谜题' : feature === 'game' ? '对局' : 'AI教学'}次数已用完，升级会员解锁更多！`
    : ''

  const checkAndBlock = useCallback((): boolean => {
    const current = getUsageCount(feature)
    if (current >= limit) {
      setCount(current)
      return true
    }
    incrementUsage(feature)
    setCount(current + 1)
    return false
  }, [feature, limit])

  return { blocked, message, remaining, checkAndBlock }
}
