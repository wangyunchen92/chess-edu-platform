import { useState, useEffect, useCallback } from 'react'
import { userApi } from '@/api/user'
import { useUIStore } from '@/stores/uiStore'

/**
 * Hook to manage user remarks (remark names / 备注名).
 * Fetches all remarks on mount and provides helpers to set/delete.
 */
export function useRemarks() {
  const addToast = useUIStore((s) => s.addToast)
  const [remarkMap, setRemarkMap] = useState<Map<string, string>>(new Map())

  const loadRemarks = useCallback(async () => {
    try {
      const res = await userApi.getRemarks()
      const data = (res.data as any)?.data ?? res.data
      const items: Array<{ target_user_id: string; remark_name: string }> = Array.isArray(data) ? data : []
      const map = new Map<string, string>()
      items.forEach((item) => map.set(item.target_user_id, item.remark_name))
      setRemarkMap(map)
    } catch {
      // Degrade gracefully if API not available
    }
  }, [])

  useEffect(() => {
    loadRemarks()
  }, [loadRemarks])

  const setRemark = useCallback(async (targetUserId: string, remarkName: string) => {
    // Optimistic update
    setRemarkMap((prev) => {
      const next = new Map(prev)
      next.set(targetUserId, remarkName)
      return next
    })
    try {
      await userApi.setRemark(targetUserId, remarkName)
      addToast('success', '备注名已更新')
    } catch {
      // Revert on failure
      setRemarkMap((prev) => {
        const next = new Map(prev)
        next.delete(targetUserId)
        return next
      })
      addToast('error', '设置备注名失败')
    }
  }, [addToast])

  const deleteRemark = useCallback(async (targetUserId: string) => {
    const oldValue = remarkMap.get(targetUserId)
    // Optimistic update
    setRemarkMap((prev) => {
      const next = new Map(prev)
      next.delete(targetUserId)
      return next
    })
    try {
      await userApi.deleteRemark(targetUserId)
      addToast('success', '备注名已删除')
    } catch {
      // Revert on failure
      if (oldValue) {
        setRemarkMap((prev) => {
          const next = new Map(prev)
          next.set(targetUserId, oldValue)
          return next
        })
      }
      addToast('error', '删除备注名失败')
    }
  }, [addToast, remarkMap])

  const promptRemark = useCallback((targetUserId: string, currentRemark?: string) => {
    const input = window.prompt('设置备注名', currentRemark || '')
    if (input === null) return // cancelled
    if (input.trim() === '') {
      if (currentRemark) {
        deleteRemark(targetUserId)
      }
      return
    }
    setRemark(targetUserId, input.trim())
  }, [setRemark, deleteRemark])

  return { remarkMap, setRemark, deleteRemark, promptRemark }
}
