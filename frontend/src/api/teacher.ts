import apiClient from './client'
import type {
  APIResponse,
  PaginatedData,
  InviteCodeResponse,
  TeacherStudentItem,
  StudentDetailResponse,
} from '@/types/api'

// ---------- Invite Codes ----------

/** Generate a new invite code */
export const createInviteCode = (data?: { max_uses?: number }) =>
  apiClient.post<APIResponse<InviteCodeResponse>>('/teacher/invite-codes', data ?? {})

/** List all invite codes for current teacher */
export const getInviteCodes = () =>
  apiClient.get<APIResponse<InviteCodeResponse[]>>('/teacher/invite-codes')

/** Revoke an invite code by its id */
export const revokeInviteCode = (codeId: string) =>
  apiClient.delete<APIResponse<null>>(`/teacher/invite-codes/${codeId}`)

// ---------- Students ----------

export interface StudentListParams {
  page?: number
  page_size?: number
  search?: string
}

/** List students bound to this teacher */
export const getStudents = (params?: StudentListParams) =>
  apiClient.get<APIResponse<PaginatedData<TeacherStudentItem>>>('/teacher/students', { params })

/** Get a single student's detailed data */
export const getStudentDetail = (studentId: string) =>
  apiClient.get<APIResponse<StudentDetailResponse>>(`/teacher/students/${studentId}`)

/** Remove a student binding */
export const removeStudent = (studentId: string) =>
  apiClient.delete<APIResponse<null>>(`/teacher/students/${studentId}`)
