import { apiFetch } from './client'
import type { Company, CompanyContact, CompanyProject, CompanyObject, PaginatedResponse } from '@/types'

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

export interface CompanyCreatePayload {
  name: string
  edrpou?: string
  type?: string
  address?: string
  phone?: string
  email?: string
  website?: string
  description?: string
  logo_url?: string
  relationship_status?: string | null
  contacts?: CompanyContact[]
  projects?: CompanyProject[]
}

export const companiesApi = {
  list: (params?: CompaniesQueryParams) =>
    apiFetch<PaginatedResponse<Company>>('/companies', { params }),

  get: (id: string) =>
    apiFetch<CompanyDetail>(`/companies/${id}`),

  create: (data: CompanyCreatePayload) =>
    apiFetch<Company>('/companies', { method: 'POST', data }),

  update: (id: string, data: Partial<CompanyCreatePayload>) =>
    apiFetch<Company>(`/companies/${id}`, { method: 'PATCH', data }),

  delete: (id: string) =>
    apiFetch<void>(`/companies/${id}`, { method: 'DELETE' }),

  favorite: (id: string) =>
    apiFetch<void>(`/companies/${id}/favorite`, { method: 'POST' }),

  unfavorite: (id: string) =>
    apiFetch<void>(`/companies/${id}/favorite`, { method: 'DELETE' }),

  listObjects: (companyId: string) =>
    apiFetch<CompanyObject[]>(`/companies/${companyId}/objects`),

  linkObject: (companyId: string, objectId: string) =>
    apiFetch<{ ok: boolean }>(`/companies/${companyId}/link/${objectId}`, { method: 'POST' }),

  unlinkObject: (companyId: string, objectId: string) =>
    apiFetch<void>(`/companies/${companyId}/objects/${objectId}`, { method: 'DELETE' }),

  updateObjectRelationship: (companyId: string, objectId: string, status: string | null) =>
    apiFetch<{ ok: boolean }>(`/companies/${companyId}/objects/${objectId}/relationship`, {
      method: 'PATCH',
      data: { relationship_status: status },
    }),
}
