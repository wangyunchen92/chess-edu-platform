import apiClient from './client'
import type {
  APIResponse,
  UserFullResponse,
  UpdateUserRequest,
  UpdateSettingsRequest,
  ProfileStatsResponse,
  ReferralInfoResponse,
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

  getReferralInfo: () =>
    apiClient.get<APIResponse<ReferralInfoResponse>>('/user/referral'),

  // Remark endpoints
  setRemark: (targetUserId: string, remarkName: string) =>
    apiClient.put(`/user/remark/${targetUserId}`, { remark_name: remarkName }),

  getRemarks: () =>
    apiClient.get<APIResponse<Array<{ target_user_id: string; remark_name: string }>>>('/user/remarks'),

  deleteRemark: (targetUserId: string) =>
    apiClient.delete(`/user/remark/${targetUserId}`),
}
