import axios from 'axios'
import type { TokenRefreshResponse, APIResponse } from '@/types/api'

const base = import.meta.env.BASE_URL || '/'
const apiBase = `${base.replace(/\/$/, '')}/api/v1`

const apiClient = axios.create({
  baseURL: apiBase,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: inject Authorization header
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Track whether a token refresh is in progress to avoid duplicate refreshes
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error)
    } else {
      p.resolve(token!)
    }
  })
  failedQueue = []
}

function clearAuthAndRedirect() {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user')
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

// Response interceptor: unified error handling with token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response) {
      const { status } = error.response

      if (status === 401 && !originalRequest._retry) {
        const refreshToken = localStorage.getItem('refresh_token')

        if (!refreshToken) {
          clearAuthAndRedirect()
          return Promise.reject(error)
        }

        if (isRefreshing) {
          // Queue the request until the refresh completes
          return new Promise<string>((resolve, reject) => {
            failedQueue.push({ resolve, reject })
          }).then((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`
            return apiClient(originalRequest)
          })
        }

        originalRequest._retry = true
        isRefreshing = true

        try {
          const res = await axios.post<APIResponse<TokenRefreshResponse>>(
            '/api/v1/auth/token/refresh',
            { refresh_token: refreshToken }
          )
          const data = res.data.data
          const newToken = data.access_token
          const newRefreshToken = data.refresh_token

          localStorage.setItem('token', newToken)
          localStorage.setItem('refresh_token', newRefreshToken)

          apiClient.defaults.headers.common.Authorization = `Bearer ${newToken}`
          processQueue(null, newToken)

          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return apiClient(originalRequest)
        } catch (refreshError) {
          processQueue(refreshError, null)
          clearAuthAndRedirect()
          return Promise.reject(refreshError)
        } finally {
          isRefreshing = false
        }
      }

      // Extract error message from response
      const message =
        error.response.data?.message ||
        error.response.data?.detail ||
        `Request failed (${status})`

      return Promise.reject(new Error(message))
    }

    if (error.request) {
      return Promise.reject(new Error('Network error, please check your connection'))
    }

    return Promise.reject(error)
  }
)

export default apiClient
