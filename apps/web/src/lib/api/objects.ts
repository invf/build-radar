import { apiFetch } from './client'
import type {
  ConstructionObject,
  ConstructionObjectDetail,
  PaginatedResponse,
  ObjectFilters,
  DashboardStats,
} from '@/types'

export interface ObjectsQueryParams extends ObjectFilters {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface ObjectCreatePayload {
  name: string
  address?: string
  city?: string
  oblast?: string
  district?: string
  lat?: number
  lng?: number
  status?: string
  category?: string
  object_type?: string
  floors?: number
  building_area?: number
  land_area?: number
  construction_stage?: string
  planned_completion?: string
  description?: string
  photos?: string[]
  customer?: string
  general_contractor?: string
  designer?: string
  installer?: string
  website?: string
  source?: string
}

export const objectsApi = {
  create: (data: ObjectCreatePayload) =>
    apiFetch<ConstructionObject>('/objects', { method: 'POST', data }),

  update: (id: string, data: Partial<ObjectCreatePayload>) =>
    apiFetch<ConstructionObject>(`/objects/${id}`, { method: 'PATCH', data }),

  delete: (id: string) =>
    apiFetch<void>(`/objects/${id}`, { method: 'DELETE' }),

  list: (params?: ObjectsQueryParams) =>
    apiFetch<PaginatedResponse<ConstructionObject>>('/objects', {
      params,
    }),

  get: (id: string) =>
    apiFetch<ConstructionObjectDetail>(`/objects/${id}`),

  getMapPoints: (params?: ObjectFilters) =>
    apiFetch<Array<{ id: string; lat: number; lng: number; status: string; name: string }>>(
      '/objects/map-points',
      { params }
    ),

  getDashboardStats: () =>
    apiFetch<DashboardStats>('/analytics/dashboard'),

  getRegionalStats: () =>
    apiFetch<unknown[]>('/analytics/regional'),

  search: (query: string, filters?: ObjectFilters) =>
    apiFetch<PaginatedResponse<ConstructionObject>>('/objects/search', {
      params: { q: query, ...filters },
    }),

  favorite: (id: string) =>
    apiFetch<void>(`/objects/${id}/favorite`, { method: 'POST' }),

  unfavorite: (id: string) =>
    apiFetch<void>(`/objects/${id}/favorite`, { method: 'DELETE' }),

  getFavorites: () =>
    apiFetch<PaginatedResponse<ConstructionObject>>('/objects/favorites'),

  exportCSV: (filters?: ObjectFilters) =>
    apiFetch<Blob>('/objects/export/csv', {
      params: filters,
      responseType: 'blob',
    }),

  exportExcel: (filters?: ObjectFilters) =>
    apiFetch<Blob>('/objects/export/excel', {
      params: filters,
      responseType: 'blob',
    }),

  aiSearch: (query: string, page = 1, pageSize = 24) =>
    apiFetch<PaginatedResponse<ConstructionObject> & { intent_summary: string; parsed_filters: Record<string, unknown> }>(
      '/objects/ai-search',
      { method: 'POST', data: { query }, params: { page, page_size: pageSize } }
    ),
}
