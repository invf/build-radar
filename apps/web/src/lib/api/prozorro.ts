import { apiFetch } from './client'

export interface ProzorroTender {
  prozorro_id: string
  title: string
  status: string
  amount: number | null
  currency: string
  deadline: string | null
  procuring_entity: string | null
  procuring_entity_edrpou: string | null
  city: string | null
  oblast: string | null
  cpv_codes: string[]
  prozorro_url: string
}

export interface ProzorroSearchParams {
  q?: string
  cpv?: string
  status?: string
  limit?: number
}

export const prozorroApi = {
  search: (params: ProzorroSearchParams) =>
    apiFetch<ProzorroTender[]>('/prozorro/search', { params }),
}
