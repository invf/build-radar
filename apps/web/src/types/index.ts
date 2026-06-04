// ─── User & Auth ───────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'manager' | 'viewer'

export interface User {
  id: string
  email: string
  full_name?: string | null
  role: UserRole
  is_active: boolean
  invited_by?: string
  avatar_url?: string
  created_at: string
  last_login?: string
}

export interface Invitation {
  id: string
  email: string
  role: UserRole
  invited_by: string
  expires_at: string
  used_at?: string
  token: string
}

// ─── Construction Objects ───────────────────────────────────────────────────────

export type ObjectStatus =
  | 'planned'
  | 'approved'
  | 'under_construction'
  | 'completed'
  | 'suspended'
  | 'cancelled'

export type ObjectCategory =
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'infrastructure'
  | 'social'
  | 'mixed'

export type ObjectType =
  | 'apartment_building'
  | 'private_house'
  | 'office'
  | 'shopping_center'
  | 'warehouse'
  | 'factory'
  | 'hospital'
  | 'school'
  | 'hotel'
  | 'infrastructure'
  | 'other'

export interface Coordinates {
  lat: number
  lng: number
}

export interface ConstructionObject {
  id: string
  name: string
  address: string
  city: string
  oblast: string
  district?: string
  coordinates?: Coordinates
  status: ObjectStatus
  category: ObjectCategory
  object_type: ObjectType
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
  source: string
  source_id?: string
  ai_score?: number
  ai_summary?: string
  companies?: ObjectCompany[]
  permits?: Permit[]
  tenders?: Tender[]
  notes_count?: number
  created_at: string
  updated_at: string
}

export interface ConstructionObjectDetail extends ConstructionObject {
  companies: ObjectCompany[]
  permits: Permit[]
  tenders: Tender[]
  status_history: StatusHistoryEntry[]
  ai_analysis?: AIAnalysis
  user_note?: ObjectNote
  is_favorite: boolean
}

// ─── Companies ─────────────────────────────────────────────────────────────────

export type CompanyRole =
  | 'developer'
  | 'general_contractor'
  | 'subcontractor'
  | 'designer'
  | 'engineering'
  | 'technical_supervision'
  | 'architect'
  | 'investor'

export type RelationshipStatus = 'active' | 'prospect' | 'inactive'

export interface CompanyContact {
  name: string
  position: string
  phone: string
  email: string
  telegram: string
  viber: string
  notes: string
  photo_url: string
}

export interface CompanyProject {
  object_name: string
  address?: string
  queue: string
  deadline: string
  customer: string
  contractor: string
  installer: string
  supplier: string
  designer: string
  notes: string
  photos: string[]
  relationship_status?: RelationshipStatus
}

export interface Company {
  id: string
  name: string
  edrpou: string
  type: CompanyRole
  address?: string
  phone?: string
  email?: string
  website?: string
  description?: string
  ai_score?: number
  logo_url?: string
  relationship_status?: RelationshipStatus
  objects_count?: number
  contacts?: CompanyContact[]
  projects?: CompanyProject[]
  created_at: string
  updated_at: string
}

export interface ObjectCompany {
  company: Company
  role: CompanyRole
  is_primary: boolean
  relationship_status?: RelationshipStatus
}

export interface CompanyObject {
  id: string
  name: string
  address: string
  city: string
  photos: string[]
  status: string
  category: string
  object_type?: string
  floors?: number
  building_area?: number
  description?: string
  ai_score?: number
  permits_count?: number
  tenders_count?: number
  relationship_status?: RelationshipStatus
  role?: CompanyRole
}

// ─── Permits ───────────────────────────────────────────────────────────────────

export type PermitType =
  | 'construction_permit'
  | 'readiness_declaration'
  | 'urban_planning_conditions'
  | 'technical_conditions'
  | 'design_approval'
  | 'expert_examination'

export interface Permit {
  id: string
  object_id: string
  permit_number: string
  permit_type: PermitType
  series?: string
  issued_date?: string
  valid_until?: string
  issuing_authority?: string
  document_url?: string
  created_at: string
}

// ─── Tenders ───────────────────────────────────────────────────────────────────

export type TenderStatus =
  | 'active'
  | 'complete'
  | 'cancelled'
  | 'unsuccessful'

export interface Tender {
  id: string
  object_id?: string
  prozorro_id: string
  title: string
  status: TenderStatus
  amount?: number
  currency?: string
  deadline?: string
  procuring_entity?: string
  created_at: string
  updated_at: string
}

// ─── User Notes ────────────────────────────────────────────────────────────────

export type NoteStatus =
  | 'interesting'
  | 'contact_later'
  | 'active_lead'
  | 'in_progress'
  | 'not_relevant'

export interface ObjectNote {
  id: string
  object_id: string
  user_id: string
  note_text: string
  status?: NoteStatus
  tags?: string[]
  reminder_date?: string
  created_at: string
  updated_at: string
}

// ─── AI Analytics ──────────────────────────────────────────────────────────────

export interface AIAnalysis {
  id: string
  object_id: string
  analysis_type: string
  summary: string
  hvac_opportunity?: number
  itp_opportunity?: number
  engineering_complexity?: 'low' | 'medium' | 'high' | 'very_high'
  estimated_budget_uah?: number
  opportunity_insights?: string[]
  recommended_actions?: string[]
  score: number
  model_version: string
  created_at: string
}

// ─── Saved Searches & Favorites ────────────────────────────────────────────────

export interface ObjectFilters {
  status?: ObjectStatus[]
  category?: ObjectCategory[]
  object_type?: ObjectType[]
  city?: string[]
  oblast?: string[]
  min_floors?: number
  max_floors?: number
  min_area?: number
  max_area?: number
  min_ai_score?: number
  search?: string
  source?: string[]
  date_from?: string
  date_to?: string
  has_tenders?: boolean
  has_permits?: boolean
}

export interface SavedSearch {
  id: string
  user_id: string
  name: string
  filters: ObjectFilters
  notify_enabled: boolean
  last_checked?: string
  created_at: string
}

export interface FavoriteObject {
  id: string
  user_id: string
  object_id: string
  object: ConstructionObject
  created_at: string
}

// ─── Notifications ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'new_object'
  | 'status_change'
  | 'new_permit'
  | 'new_tender'
  | 'ai_insight'
  | 'reminder'
  | 'system'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  is_read: boolean
  related_object_id?: string
  related_company_id?: string
  created_at: string
}

// ─── Status History ────────────────────────────────────────────────────────────

export interface StatusHistoryEntry {
  id: string
  object_id: string
  field_name: string
  old_value?: string
  new_value: string
  changed_at: string
  source: string
}

// ─── Analytics ─────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_objects: number
  new_today: number
  under_construction: number
  active_tenders: number
  new_permits_week: number
  objects_by_status: Record<ObjectStatus, number>
  objects_by_category: Record<ObjectCategory, number>
  top_cities: Array<{ city: string; count: number }>
  top_developers: Array<{ company: Company; objects_count: number }>
  recent_objects: ConstructionObject[]
  ai_opportunities_count: number
}

export interface RegionalStats {
  oblast: string
  total: number
  under_construction: number
  completed: number
  planned: number
  growth_rate: number
}

// ─── Parser & Admin ────────────────────────────────────────────────────────────

export type ParserStatus = 'running' | 'completed' | 'failed' | 'scheduled'

export interface ParserLog {
  id: string
  source: string
  started_at: string
  completed_at?: string
  objects_found: number
  objects_updated: number
  objects_created: number
  errors?: unknown[]
  status: ParserStatus
}

// ─── API Responses ─────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface APIError {
  detail: string
  code?: string
}
