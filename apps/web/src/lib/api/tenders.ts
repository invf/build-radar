import { apiFetch } from './client'

export interface TenderCreatePayload {
  prozorro_id: string
  title: string
  status?: string
  object_id?: string
  amount?: number
  currency?: string
  deadline?: string
  procuring_entity?: string
  procuring_entity_edrpou?: string
  source?: string
  source_url?: string
  country?: string
  donor?: string
  sector?: string
}

export interface TenderUpdatePayload {
  title?: string
  status?: string
  amount?: number
  currency?: string
  deadline?: string
  procuring_entity?: string
  procuring_entity_edrpou?: string
  object_id?: string
  source_url?: string
  country?: string
  donor?: string
  sector?: string
}

export const tendersApi = {
  create: (data: TenderCreatePayload) =>
    apiFetch<unknown>('/tenders', { method: 'POST', data }),
  update: (id: string, data: TenderUpdatePayload) =>
    apiFetch<unknown>(`/tenders/${id}`, { method: 'PATCH', data }),
  remove: (id: string) =>
    apiFetch<void>(`/tenders/${id}`, { method: 'DELETE' }),
}
