import apiClient from './client'
import type {
  APIResponse,
  DiagnosisProfileResponse,
  DiagnosisAnalyzeRequest,
  DiagnosisAnalyzeResponse,
  RecommendationItem,
  DiagnosisSummaryResponse,
} from '@/types/api'

export const diagnosisApi = {
  getProfile: () =>
    apiClient.get<APIResponse<DiagnosisProfileResponse>>('/diagnosis/profile'),

  analyze: (data?: DiagnosisAnalyzeRequest) =>
    apiClient.post<APIResponse<DiagnosisAnalyzeResponse>>('/diagnosis/analyze', data ?? {}),

  getRecommendations: (limit = 5, status = 'active') =>
    apiClient.get<APIResponse<RecommendationItem[]>>('/diagnosis/recommendations', {
      params: { limit, status },
    }),

  updateRecommendation: (id: string, status: string) =>
    apiClient.patch<APIResponse<{ id: string; status: string }>>(`/diagnosis/recommendations/${id}`, {
      status,
    }),

  getSummary: () =>
    apiClient.get<APIResponse<DiagnosisSummaryResponse>>('/diagnosis/summary'),
}
