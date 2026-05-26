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

export const objectsApi = {
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
