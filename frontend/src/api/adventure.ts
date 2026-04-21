import apiClient from './client'
import type {
  APIResponse,
  AdventureMapResponse,
  RegionDetail,
  ChallengeRecord,
  CompleteChallengeRequest,
  QuizBank,
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

  getQuiz: (challengeId: string) =>
    apiClient.get<APIResponse<QuizBank>>(`/adventure/quiz/${challengeId}`),
}
