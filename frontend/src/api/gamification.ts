import apiClient from './client'
import type {
  APIResponse,
  AchievementsResponse,
  XPResponse,
  RankResponse,
  CheckAchievementsResponse,
} from '@/types/api'

export const gamificationApi = {
  getAchievements: () =>
    apiClient.get<APIResponse<AchievementsResponse>>('/gamification/achievements'),

  getXP: () =>
    apiClient.get<APIResponse<XPResponse>>('/gamification/xp'),

  getRank: () =>
    apiClient.get<APIResponse<RankResponse>>('/gamification/rank'),

  checkAchievements: () =>
    apiClient.post<APIResponse<CheckAchievementsResponse>>('/gamification/check'),
}
