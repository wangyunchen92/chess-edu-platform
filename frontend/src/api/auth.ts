import apiClient from './client'
import type {
  APIResponse,
  LoginRequest,
  LoginResponse,
  TokenRefreshRequest,
  TokenRefreshResponse,
} from '@/types/api'

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<APIResponse<LoginResponse>>('/auth/login', data),

  refreshToken: (refresh_token: string) =>
    apiClient.post<APIResponse<TokenRefreshResponse>>('/auth/token/refresh', {
      refresh_token,
    } satisfies TokenRefreshRequest),

  logout: () =>
    apiClient.post<APIResponse<null>>('/auth/logout'),
}
