import { apiFetch } from './client'

export interface Manufacturer {
  id: string
  name: string
  phone: string | null
  email: string | null
  website: string | null
  address: string | null
  notes: string | null
  created_at: string
}

export interface ManufacturerPayload {
  name: string
  phone?: string
  email?: string
  website?: string
  address?: string
  notes?: string
}

export const manufacturersApi = {
  list: (search?: string) =>
    apiFetch<Manufacturer[]>('/manufacturers', { params: search ? { search } : undefined }),

  get: (id: string) =>
    apiFetch<Manufacturer>(`/manufacturers/${id}`),

  create: (data: ManufacturerPayload) =>
    apiFetch<Manufacturer>('/manufacturers', { method: 'POST', data }),

  update: (id: string, data: Partial<ManufacturerPayload>) =>
    apiFetch<Manufacturer>(`/manufacturers/${id}`, { method: 'PATCH', data }),

  delete: (id: string) =>
    apiFetch<void>(`/manufacturers/${id}`, { method: 'DELETE' }),
}
