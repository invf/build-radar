import { apiFetch } from './client'

export interface CompanyEnrichResult {
  edrpou?: string
  type?: string
  address?: string
  phone?: string
  email?: string
  website?: string
  description?: string
  confidence?: 'high' | 'medium' | 'low'
  note?: string
}

export interface ObjectEnrichResult {
  address?: string
  city?: string
  oblast?: string
  district?: string
  status?: string
  category?: string
  object_type?: string
  floors?: number
  building_area?: number
  land_area?: number
  construction_stage?: string
  description?: string
  lat?: number
  lng?: number
  confidence?: 'high' | 'medium' | 'low'
  note?: string
}

export interface WebEnrichResult {
  website?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  oblast?: string
  description?: string
  // company-specific
  type?: string
  edrpou?: string
  logo_url?: string
  // object-specific
  status?: string
  category?: string
  object_type?: string
  floors?: number
  building_area?: number
  customer?: string
  general_contractor?: string
  designer?: string
  planned_completion?: string
  // shared
  photos?: string[]
  confidence?: 'high' | 'medium' | 'low'
  note?: string
}

export const aiEnrichApi = {
  company: (name: string, edrpou?: string) =>
    apiFetch<CompanyEnrichResult>('/ai/enrich/company', {
      method: 'POST',
      data: { name, edrpou },
    }),

  object: (name: string, address?: string, city?: string) =>
    apiFetch<ObjectEnrichResult>('/ai/enrich/object', {
      method: 'POST',
      data: { name, address, city },
    }),

  web: (name: string, entityType: 'object' | 'company', city?: string, url?: string) =>
    apiFetch<WebEnrichResult>('/ai/enrich/web', {
      method: 'POST',
      data: { name, entity_type: entityType, city, url },
    }),
}
