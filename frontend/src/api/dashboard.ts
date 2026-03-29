import apiClient from './client'
import type { APIResponse, DashboardResponse } from '@/types/api'

export const dashboardApi = {
  getDashboard: () =>
    apiClient.get<APIResponse<DashboardResponse>>('/dashboard'),
}
