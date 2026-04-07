import apiClient from './client'
import type { APIResponse, PaginatedData } from '@/types/api'

// ---------- Types ----------

export interface UserListItem {
  id: string
  username: string
  nickname: string
  avatar_url: string | null
  role: string
  status: string
  membership_tier: string
  membership_expires_at: string | null
  created_at: string
  last_login_at: string | null
  login_count: number
}

export interface AdminStats {
  total_users: number
  today_registered: number
  today_active: number
  membership_distribution: Record<string, number>
  role_distribution: Record<string, number>
  recent_users: Array<{
    id: string
    username: string
    nickname: string
    role: string
    created_at: string
  }>
}

export interface UserPointsDetail {
  user_id: string
  username: string
  nickname: string
  game_rating: number
  puzzle_rating: number
  rank_title: string
  rank_tier: number
  rank_region: string
  xp_total: number
  xp_today: number
  coins: number
}

export interface BatchMembershipResult {
  success_count: number
  failed: Array<{ user_id: string; reason: string }>
}

// ---------- Query Params ----------

export interface UserListParams {
  page?: number
  page_size?: number
  search?: string
  role?: string
  status?: string
  membership_tier?: string
}

// ---------- API Functions ----------

/** 数据概览统计 */
export const getAdminStats = () =>
  apiClient.get<APIResponse<AdminStats>>('/admin/stats')

/** 用户列表（带筛选） */
export const getUsers = (params: UserListParams) =>
  apiClient.get<APIResponse<PaginatedData<UserListItem>>>('/admin/users', { params })

/** 创建用户 */
export const createUser = (data: {
  username: string
  password: string
  nickname: string
  role?: string
}) => apiClient.post<APIResponse<UserListItem>>('/admin/users', data)

/** 修改用户信息 */
export const updateUser = (userId: string, data: {
  nickname?: string
  role?: string
}) => apiClient.put<APIResponse<UserListItem>>(`/admin/users/${userId}`, data)

/** 重置密码 */
export const resetPassword = (userId: string, newPassword: string) =>
  apiClient.put<APIResponse<{ message: string }>>(`/admin/users/${userId}/password`, {
    new_password: newPassword,
  })

/** 禁用/启用用户 */
export const updateUserStatus = (userId: string, status: 'active' | 'disabled') =>
  apiClient.put<APIResponse<UserListItem>>(`/admin/users/${userId}/status`, { status })

/** 单个授权会员 */
export const updateMembership = (userId: string, data: {
  membership_tier: string
  membership_expires_at?: string | null
}) => apiClient.put<APIResponse<UserListItem>>(`/admin/users/${userId}/membership`, data)

/** 批量授权会员 */
export const batchUpdateMembership = (data: {
  user_ids: string[]
  membership_tier: string
  membership_expires_at?: string | null
}) => apiClient.put<APIResponse<BatchMembershipResult>>('/admin/users/batch/membership', data)

/** 获取用户积分详情 */
export const getUserPoints = (userId: string) =>
  apiClient.get<APIResponse<UserPointsDetail>>(`/admin/users/${userId}/points`)

/** 调整用户积分 */
export const adjustUserPoints = (userId: string, data: {
  xp_change?: number
  coins_change?: number
  game_rating_change?: number
  puzzle_rating_change?: number
  reason: string
}) => apiClient.put<APIResponse<UserPointsDetail>>(`/admin/users/${userId}/points`, data)

/** 获取用户详情（含对弈/谜题/课程统计） */
export const getUserDetail = (userId: string) =>
  apiClient.get<APIResponse<any>>(`/admin/users/${userId}/detail`)
