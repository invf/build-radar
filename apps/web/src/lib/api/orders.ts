import { apiFetch } from './client'

export type OrderStatus = 'in_progress' | 'planned' | 'completed'

export interface Order {
  id: string
  date: string | null
  customer: string | null
  object_name: string | null
  address: string | null
  equipment_count: string | null
  manufacturer: string | null
  production_date: string | null
  notes: string | null
  status: OrderStatus
  lat: number | null
  lng: number | null
  created_at: string
}

export interface OrderPayload {
  date?: string | null
  customer?: string
  object_name?: string
  address?: string
  equipment_count?: string
  manufacturer?: string
  production_date?: string | null
  notes?: string
  status?: OrderStatus
  lat?: number | null
  lng?: number | null
}

export const ordersApi = {
  list: (status?: OrderStatus, search?: string) =>
    apiFetch<Order[]>('/orders', {
      params: {
        ...(status ? { status } : {}),
        ...(search ? { search } : {}),
      },
    }),

  get: (id: string) =>
    apiFetch<Order>(`/orders/${id}`),

  create: (data: OrderPayload) =>
    apiFetch<Order>('/orders', { method: 'POST', data }),

  update: (id: string, data: Partial<OrderPayload>) =>
    apiFetch<Order>(`/orders/${id}`, { method: 'PATCH', data }),

  complete: (id: string) =>
    apiFetch<Order>(`/orders/${id}/complete`, { method: 'POST' }),

  restore: (id: string, status: 'in_progress' | 'planned') =>
    apiFetch<Order>(`/orders/${id}/restore?status=${status}`, { method: 'POST' }),

  delete: (id: string) =>
    apiFetch<void>(`/orders/${id}`, { method: 'DELETE' }),
}
