import { create } from 'zustand'

export interface ToastItem {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

interface UIState {
  theme: 'light' | 'dark'
  sidebarCollapsed: boolean
  toasts: ToastItem[]

  toggleTheme: () => void
  setTheme: (theme: 'light' | 'dark') => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  addToast: (type: ToastItem['type'], message: string) => void
  removeToast: (id: string) => void
}

let toastCounter = 0

export const useUIStore = create<UIState>((set) => ({
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  sidebarCollapsed: localStorage.getItem('sidebarCollapsed') === 'true',
  toasts: [],

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light'
      localStorage.setItem('theme', next)
      document.documentElement.classList.toggle('dark', next === 'dark')
      return { theme: next }
    }),

  setTheme: (theme) => {
    localStorage.setItem('theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
    set({ theme })
  },

  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarCollapsed
      localStorage.setItem('sidebarCollapsed', String(next))
      return { sidebarCollapsed: next }
    }),

  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem('sidebarCollapsed', String(collapsed))
    set({ sidebarCollapsed: collapsed })
  },

  addToast: (type, message) => {
    const id = `toast-${++toastCounter}`
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }))
    // Auto-remove after 3 seconds
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 3000)
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
