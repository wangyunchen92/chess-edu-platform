import apiClient from './client'
import type {
  APIResponse,
  PaginatedData,
  CharacterListItem,
  CharacterDetail,
  CreateGameRequest,
  CreateGameResponse,
  CompleteGameRequest,
  GameListItem,
  GameDetail,
  GameReviewResponse,
} from '@/types/api'

export const playApi = {
  getCharacters: () =>
    apiClient.get<APIResponse<CharacterListItem[]>>('/play/characters'),

  getCharacterDetail: (id: string) =>
    apiClient.get<APIResponse<CharacterDetail>>(`/play/characters/${id}`),

  createGame: (data: CreateGameRequest) =>
    apiClient.post<APIResponse<CreateGameResponse>>('/play/games', data),

  completeGame: (id: string, data: CompleteGameRequest) =>
    apiClient.put<APIResponse<GameDetail>>(`/play/games/${id}/complete`, data),

  getGameHistory: (page: number, size: number) =>
    apiClient.get<APIResponse<PaginatedData<GameListItem>>>('/play/games', {
      params: { page, page_size: size },
    }),

  getGameDetail: (id: string) =>
    apiClient.get<APIResponse<GameDetail>>(`/play/games/${id}`),

  getGameReview: (id: string) =>
    apiClient.get<APIResponse<GameReviewResponse>>(`/play/games/${id}/review`),

  getGameDialogue: (gameId: string, event: string) =>
    apiClient.get<APIResponse<{ text: string; expression: string }>>(`/play/games/${gameId}/dialogue`, {
      params: { event },
    }),
}
