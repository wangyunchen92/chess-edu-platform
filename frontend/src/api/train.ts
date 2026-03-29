import apiClient from './client'
import type {
  APIResponse,
  TodayPlanResponse,
  CompletePlanItemResponse,
  TrainStatsResponse,
  StreakResponse,
} from '@/types/api'

export const trainApi = {
  getTodayPlan: () =>
    apiClient.get<APIResponse<TodayPlanResponse>>('/train/today'),

  completeItem: (idx: number) =>
    apiClient.put<APIResponse<CompletePlanItemResponse>>(`/train/today/items/${idx}/complete`),

  getTrainStats: () =>
    apiClient.get<APIResponse<TrainStatsResponse>>('/train/stats'),

  getStreak: () =>
    apiClient.get<APIResponse<StreakResponse>>('/train/streak'),
}
