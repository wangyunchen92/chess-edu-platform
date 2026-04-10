import apiClient from './client'
import type {
  APIResponse,
  CourseListItem,
  CourseDetail,
  LessonContent,
  UpdateProgressRequest,
  UpdateProgressResponse,
  ExerciseItem,
  ExerciseAttemptResponse,
  AITeachResponse,
  ExerciseOverviewResponse,
  KidsProgressItem,
  UpdateKidsProgressRequest,
} from '@/types/api'

export const learnApi = {
  getCourses: () =>
    apiClient.get<APIResponse<CourseListItem[]>>('/learn/courses'),

  getCourseDetail: (id: string) =>
    apiClient.get<APIResponse<CourseDetail>>(`/learn/courses/${id}`),

  getLessonContent: (id: string) =>
    apiClient.get<APIResponse<LessonContent>>(`/learn/lessons/${id}`),

  updateProgress: (id: string, data: UpdateProgressRequest) =>
    apiClient.post<APIResponse<UpdateProgressResponse>>(`/learn/lessons/${id}/progress`, data),

  getExercises: (id: string) =>
    apiClient.get<APIResponse<ExerciseItem[]>>(`/learn/lessons/${id}/exercises`),

  submitExercise: (id: string, data: { user_answer: string; time_spent_ms?: number }) =>
    apiClient.post<APIResponse<ExerciseAttemptResponse>>(`/learn/exercises/${id}/attempt`, data),

  aiTeach: (id: string, message: string, context?: Record<string, unknown>) =>
    apiClient.post<APIResponse<AITeachResponse>>(`/learn/lessons/${id}/ai-teach`, { message, context }),

  getExercisesOverview: () =>
    apiClient.get<APIResponse<ExerciseOverviewResponse>>('/learn/exercises/overview'),

  getKidsProgress: () =>
    apiClient.get<APIResponse<KidsProgressItem[]>>('/learn/kids/progress'),

  updateKidsProgress: (data: UpdateKidsProgressRequest) =>
    apiClient.post<APIResponse<KidsProgressItem>>('/learn/kids/progress', data),
}
