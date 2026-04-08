import { create } from 'zustand'
import { creditsApi } from '@/api/credits'

interface CreditState {
  balance: number
  loading: boolean
  fetchBalance: () => Promise<void>
  deduct: (amount: number) => void
}

export const useCreditStore = create<CreditState>((set) => ({
  balance: 0,
  loading: false,

  fetchBalance: async () => {
    set({ loading: true })
    try {
      const res = await creditsApi.getBalance()
      const data = (res.data as any)?.data ?? res.data
      set({ balance: data.balance ?? 0 })
    } catch (err) {
      console.error('[creditStore] Failed to fetch balance:', err)
    } finally {
      set({ loading: false })
    }
  },

  deduct: (amount: number) => {
    set((state) => ({ balance: Math.max(0, state.balance - amount) }))
  },
}))
