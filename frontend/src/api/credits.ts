import apiClient from './client'
import type {
  APIResponse,
  PaginatedData,
  CreditBalanceResponse,
  CreditTransactionItem,
  CreditPackageItem,
} from '@/types/api'

export const creditsApi = {
  getBalance: () =>
    apiClient.get<APIResponse<CreditBalanceResponse>>('/credits/balance'),

  getTransactions: (page = 1, pageSize = 20) =>
    apiClient.get<APIResponse<PaginatedData<CreditTransactionItem>>>(
      '/credits/transactions',
      { params: { page, page_size: pageSize } },
    ),

  getPackages: () =>
    apiClient.get<APIResponse<CreditPackageItem[]>>('/credits/packages'),

  consumeCredits: (amount: number, description: string, relatedId?: string) =>
    apiClient.post<APIResponse<CreditBalanceResponse>>('/credits/consume', {
      amount,
      description,
      related_id: relatedId,
    }),

  /** Teacher transfers credits to students */
  transferCredits: (studentIds: string[], amount: number) =>
    apiClient.post<APIResponse<{ transferred: number }>>('/teacher/credits/transfer', {
      student_ids: studentIds,
      amount,
    }),
}
