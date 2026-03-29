import apiClient from './client'
import type {
  APIResponse,
  AdventureMapResponse,
  RegionDetail,
  ChallengeRecord,
  CompleteChallengeRequest,
} from '@/types/api'

export const adventureApi = {
  getAdventureMap: () =>
    apiClient.get<APIResponse<AdventureMapResponse>>('/adventure/map'),

  getRegionDetail: (regionId: string) =>
    apiClient.get<APIResponse<RegionDetail>>(`/adventure/regions/${regionId}`),

  startChallenge: (challengeId: string) =>
    apiClient.post<APIResponse<ChallengeRecord>>(`/adventure/promotion-challenge/${challengeId}/start`),

  completeChallenge: (challengeId: string, data: CompleteChallengeRequest) =>
    apiClient.put<APIResponse<ChallengeRecord>>(`/adventure/promotion-challenge/${challengeId}/complete`, data),
}
