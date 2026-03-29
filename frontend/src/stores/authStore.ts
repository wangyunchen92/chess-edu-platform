import { create } from 'zustand'
import type { UserResponse } from '@/types/api'

/** User type aligned with backend UserResponse schema. */
export type User = UserResponse

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: User | null
  isAuthenticated: boolean
  login: (token: string, refreshToken: string, user: User) => void
  logout: () => void
  setToken: (token: string) => void
  setRefreshToken: (refreshToken: string) => void
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refresh_token'),
  user: (() => {
    try {
      const raw = localStorage.getItem('user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })(),
  isAuthenticated: !!localStorage.getItem('token'),

  login: (token, refreshToken, user) => {
    localStorage.setItem('token', token)
    localStorage.setItem('refresh_token', refreshToken)
    localStorage.setItem('user', JSON.stringify(user))
    set({ token, refreshToken, user, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    set({ token: null, refreshToken: null, user: null, isAuthenticated: false })
  },

  setToken: (token) => {
    localStorage.setItem('token', token)
    set({ token })
  },

  setRefreshToken: (refreshToken) => {
    localStorage.setItem('refresh_token', refreshToken)
    set({ refreshToken })
  },

  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user))
    set({ user })
  },
}))
