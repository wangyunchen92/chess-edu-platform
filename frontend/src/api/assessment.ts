import apiClient from './client'
import type {
  APIResponse,
  AssessmentQuestionsResponse,
  AssessmentResultResponse,
  SubmitAssessmentRequest,
} from '@/types/api'

export const assessmentApi = {
  getQuestions: (level: string) =>
    apiClient.get<APIResponse<AssessmentQuestionsResponse>>('/assessment/questions', {
      params: { experience_level: level },
    }),

  submit: (data: SubmitAssessmentRequest) =>
    apiClient.post<APIResponse<AssessmentResultResponse>>('/assessment/submit', data),
}
