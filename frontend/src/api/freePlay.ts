import apiClient from './client'
import type {
  APIResponse,
  CreateFreeGameRequest,
  CreateGameResponse,
  CompleteGameRequest,
  GameDetail,
  SavePositionRequest,
  SavePositionResponse,
} from '@/types/api'

export const freePlayApi = {
  createFreeGame: (data: CreateFreeGameRequest) =>
    apiClient.post<APIResponse<CreateGameResponse>>('/play/free-games', data),

  completeFreeGame: (gameId: string, data: CompleteGameRequest) =>
    apiClient.put<APIResponse<GameDetail>>(`/play/free-games/${gameId}/complete`, data),

  savePosition: (data: SavePositionRequest) =>
    apiClient.post<APIResponse<SavePositionResponse>>('/play/positions', data),
}
