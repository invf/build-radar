import { apiFetch } from './client'
import type { Company, PaginatedResponse } from '@/types'

export interface CompanyDetail extends Company {
  updated_at: string
  recent_objects: Array<{ id: string; name: string; city: string; status: string }>
  is_favorite: boolean
}

export interface CompaniesQueryParams {
  search?: string
  type?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

export const companiesApi = {
  list: (params?: CompaniesQueryParams) =>
    apiFetch<PaginatedResponse<Company>>('/companies', { params }),

  get: (id: string) =>
    apiFetch<CompanyDetail>(`/companies/${id}`),

  favorite: (id: string) =>
    apiFetch<void>(`/companies/${id}/favorite`, { method: 'POST' }),

  unfavorite: (id: string) =>
    apiFetch<void>(`/companies/${id}/favorite`, { method: 'DELETE' }),
}
