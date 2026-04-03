import apiClient from './client'
import type {
  APIResponse,
  JoinTeacherRequest,
  JoinTeacherResponse,
  MyTeacherItem,
} from '@/types/api'

/** Join a teacher by entering an invite code */
export const joinTeacher = (data: JoinTeacherRequest) =>
  apiClient.post<APIResponse<JoinTeacherResponse>>('/student/join-teacher', data)

/** List teachers the current student is bound to */
export const getMyTeachers = () =>
  apiClient.get<APIResponse<MyTeacherItem[]>>('/student/my-teachers')

/** Leave a teacher */
export const leaveTeacher = (teacherId: string) =>
  apiClient.delete<APIResponse<null>>(`/student/leave-teacher/${teacherId}`)
