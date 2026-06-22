import type { CompanyContact, CompanyProject } from '@/types'
import type { CompanyCreatePayload } from '@/lib/api/companies'

const DRAFT_KEY = 'buildradar:company-form-draft'
const PICKED_KEY = 'buildradar:company-picked-objects'

export interface CompanyFormDraft {
  form: Omit<CompanyCreatePayload, 'contacts' | 'projects'>
  contacts: CompanyContact[]
  projects: CompanyProject[]
  companyId?: string
  isEditMode: boolean
  activeTab: 'main' | 'contacts' | 'projects'
}

export interface PickedRegistryObject {
  id: string
  name: string
  address?: string
  city?: string
  photos?: string[]
  customer?: string
  general_contractor?: string
  designer?: string
  installer?: string
  description?: string
}

const EMPTY_PROJECT: CompanyProject = {
  object_name: '', address: '', queue: '', deadline: '', customer: '', contractor: '', installer: '', supplier: '', designer: '', notes: '', photos: [],
}

export function projectFromRegistryObject(obj: PickedRegistryObject): CompanyProject {
  return {
    ...EMPTY_PROJECT,
    object_id: obj.id,
    object_name: obj.name,
    address: [obj.address, obj.city].filter(Boolean).join(', '),
    photos: obj.photos ?? [],
    customer: obj.customer ?? '',
    contractor: obj.general_contractor ?? '',
    designer: obj.designer ?? '',
    installer: obj.installer ?? '',
    notes: obj.description ?? '',
  }
}

export function mergePickedIntoProjects(
  projects: CompanyProject[],
  picked: PickedRegistryObject[],
): CompanyProject[] {
  const existingIds = new Set(projects.map((p) => p.object_id).filter(Boolean))
  const newOnes = picked
    .filter((o) => !existingIds.has(o.id))
    .map((o) => projectFromRegistryObject(o))
  return newOnes.length > 0 ? [...projects, ...newOnes] : projects
}

export function saveCompanyFormDraft(draft: CompanyFormDraft) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

export function peekCompanyFormDraft(): CompanyFormDraft | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(DRAFT_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as CompanyFormDraft
  } catch {
    return null
  }
}

export function popCompanyFormDraft(): CompanyFormDraft | null {
  const draft = peekCompanyFormDraft()
  if (draft) sessionStorage.removeItem(DRAFT_KEY)
  return draft
}

export function savePickedObjects(objects: PickedRegistryObject[]) {
  sessionStorage.setItem(PICKED_KEY, JSON.stringify(objects))
}

export function popPickedObjects(): PickedRegistryObject[] | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(PICKED_KEY)
  if (!raw) return null
  sessionStorage.removeItem(PICKED_KEY)
  try {
    return JSON.parse(raw) as PickedRegistryObject[]
  } catch {
    return null
  }
}
