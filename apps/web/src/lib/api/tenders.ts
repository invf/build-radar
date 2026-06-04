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
}

export const tendersApi = {
  create: (data: TenderCreatePayload) =>
    apiFetch<unknown>('/tenders', { method: 'POST', data }),
}
