import apiClient from './client'
import type {
  APIResponse,
  UserFullResponse,
  UpdateUserRequest,
  UpdateSettingsRequest,
  ProfileStatsResponse,
} from '@/types/api'

export const userApi = {
  getProfile: () =>
    apiClient.get<APIResponse<UserFullResponse>>('/user/me'),

  updateProfile: (data: UpdateUserRequest) =>
    apiClient.put<APIResponse<UserFullResponse>>('/user/me', data),

  getProfileStats: () =>
    apiClient.get<APIResponse<ProfileStatsResponse>>('/user/profile/stats'),

  updateSettings: (data: UpdateSettingsRequest) =>
    apiClient.put<APIResponse<null>>('/user/me/settings', data),
}
