import { apiFetch } from './client'

export interface PermitCreatePayload {
  object_id: string
  permit_number: string
  permit_type: string
  series?: string
  issued_date?: string
  valid_until?: string
  issuing_authority?: string
  document_url?: string
}

export interface PermitListItem {
  id: string
  permit_number: string
  permit_type: string
  city?: string | null
  issued_date?: string | null
  issuing_authority?: string | null
  object_id?: string | null
  object_name?: string | null
}

export const permitsApi = {
  create: (data: PermitCreatePayload) =>
    apiFetch<unknown>('/permits', { method: 'POST', data }),

  search: (q: string, page_size = 10) =>
    apiFetch<{ items: PermitListItem[]; total: number }>('/permits', {
      params: { search: q, page_size, sort_by: 'issued_date', sort_order: 'desc' },
    }),
}
