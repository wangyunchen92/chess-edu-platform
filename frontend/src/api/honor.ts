import apiClient from '@/api/client'
import type { APIResponse, MyHonorResponse, CreateHonorRequest, CompetitionHonorItem } from '@/types/api'

export const honorApi = {
  getWall: (params?: { page?: number; page_size?: number; competition_name?: string }) =>
    apiClient.get('/honor/wall', { params }),
  getCompetitionNames: () =>
    apiClient.get<APIResponse<string[]>>('/honor/wall/competitions'),
  getMine: () =>
    apiClient.get<APIResponse<MyHonorResponse>>('/honor/mine'),
  getUserHonors: (userId: string) =>
    apiClient.get<APIResponse<MyHonorResponse>>(`/honor/user/${userId}`),
  createRecord: (data: CreateHonorRequest) =>
    apiClient.post<APIResponse<CompetitionHonorItem>>('/honor/record', data),
  updateRecord: (id: string, data: Partial<CreateHonorRequest>) =>
    apiClient.put<APIResponse<CompetitionHonorItem>>(`/honor/record/${id}`, data),
  deleteRecord: (id: string) =>
    apiClient.delete<APIResponse<null>>(`/honor/record/${id}`),
}
