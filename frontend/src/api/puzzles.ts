import apiClient from './client'
import type {
  APIResponse,
  DailyPuzzlesResponse,
  ChallengeProgressResponse,
  PuzzleItem,
  PuzzleAttemptRequest,
  PuzzleAttemptResponse,
  MistakeListResponse,
  PuzzleStatsResponse,
  ThemeItem,
} from '@/types/api'

export const puzzlesApi = {
  getDailyPuzzles: () =>
    apiClient.get<APIResponse<DailyPuzzlesResponse>>('/puzzles/daily'),

  getChallengeProgress: () =>
    apiClient.get<APIResponse<ChallengeProgressResponse>>('/puzzles/challenge'),

  getChallengePuzzles: (level: number) =>
    apiClient.get<APIResponse<PuzzleItem[]>>(`/puzzles/challenge/${level}`),

  getPuzzle: (id: string) =>
    apiClient.get<APIResponse<PuzzleItem>>(`/puzzles/${id}`),

  submitAttempt: (id: string, data: PuzzleAttemptRequest) =>
    apiClient.post<APIResponse<PuzzleAttemptResponse>>(`/puzzles/${id}/attempt`, data),

  getMistakes: () =>
    apiClient.get<APIResponse<MistakeListResponse>>('/puzzles/mistakes'),

  getPuzzleStats: () =>
    apiClient.get<APIResponse<PuzzleStatsResponse>>('/puzzles/stats'),

  getThemes: () =>
    apiClient.get<APIResponse<ThemeItem[]>>('/puzzles/themes'),

  getThemePuzzles: (theme: string, count: number = 10) =>
    apiClient.get<APIResponse<PuzzleItem[]>>(`/puzzles/theme/${theme}?count=${count}`),
}
