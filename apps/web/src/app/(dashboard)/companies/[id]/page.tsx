'use client'

import { use, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building, Phone, Mail, Globe, MapPin, Star, ArrowLeft, ExternalLink,
  MessageCircle, Pencil, ChevronLeft, ChevronRight, Image, Map, Plus, Trash2,
  Building2, FileText, ShoppingCart,
} from 'lucide-react'
import Link from 'next/link'
import { companiesApi } from '@/lib/api/companies'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { CompanyFormModal } from '@/components/companies/company-form-modal'
import { ObjectFormModal } from '@/components/objects/object-form-modal'
import { STATUS_LABELS, STATUS_COLORS, CATEGORY_LABELS } from '@/lib/utils/format'
import type { Company, CompanyContact, CompanyObject, CompanyRole, ConstructionObject, RelationshipStatus } from '@/types'

const COMPANY_ROLE_LABELS: Record<CompanyRole, string> = {
  developer: 'Забудовник',
  general_contractor: 'Генеральний підрядник',
  subcontractor: 'Субпідрядник',
  designer: 'Проектувальник',
  engineering: 'Інжиніринг',
  technical_supervision: 'Технічний нагляд',
  architect: 'Архітектор',
  investor: 'Інвестор',
}



// ── Tab 1: Загальна інформація ──────────────────────────────────────────────

function GeneralTab({ company }: { company: Company & { recent_objects: { id: string; name: string; city: string; status: string }[]; is_favorite: boolean; objects_count?: number } }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left */}
      <div className="space-y-4">
        {/* Реквізити */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Реквізити</p>
          {company.address && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-zinc-500 mt-0.5 shrink-0" />
              <span className="text-zinc-300">{company.address}</span>
            </div>
          )}
          {company.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-zinc-500 shrink-0" />
              <a href={`tel:${company.phone}`} className="text-brand-400 hover:text-brand-300">{company.phone}</a>
            </div>
          )}
          {company.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-zinc-500 shrink-0" />
              <a href={`mailto:${company.email}`} className="text-brand-400 hover:text-brand-300">{company.email}</a>
            </div>
          )}
          {company.website && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-zinc-500 shrink-0" />
              <a
                href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                target="_blank" rel="noopener noreferrer"
                className="text-brand-400 hover:text-brand-300 flex items-center gap-1"
              >
                {company.website.replace(/^https?:\/\//, '')}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
          {!company.address && !company.phone && !company.email && !company.website && (
            <p className="text-zinc-600 text-sm">Реквізити відсутні</p>
          )}
        </div>

        {/* Статистика */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2.5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Статистика</p>
          {[
            ['Проектів у системі', company.objects_count ?? 0],
            ['Контактів', (company.contacts ?? []).length],
            ["Об'єктів", (company.projects ?? []).length],
          ].map(([label, val]) => (
            <div key={label as string} className="flex justify-between items-center">
              <span className="text-sm text-zinc-500">{label as string}</span>
              <span className="text-sm font-medium text-zinc-100">{val as number}</span>
            </div>
          ))}
          {company.ai_score !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-500">AI рейтинг</span>
              <span className="text-sm font-medium text-brand-400">{Math.round(company.ai_score * 100)} / 100</span>
            </div>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="lg:col-span-2 space-y-4">
        {company.description && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Про компанію</p>
            <p className="text-sm text-zinc-300 leading-relaxed">{company.description}</p>
          </div>
        )}

        {company.recent_objects.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Останні об&apos;єкти у системі</p>
            <div className="space-y-1">
              {company.recent_objects.map((obj) => (
                <Link key={obj.id} href={`/objects/${obj.id}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-zinc-800/50 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200 truncate group-hover:text-zinc-100">{obj.name}</p>
                    {obj.city && <p className="text-xs text-zinc-500 mt-0.5">{obj.city}</p>}
                  </div>
                  <span className={`text-xs font-medium shrink-0 ml-3 ${STATUS_COLORS[obj.status as keyof typeof STATUS_COLORS] || 'text-zinc-400'}`}>
                    {STATUS_LABELS[obj.status as keyof typeof STATUS_LABELS] || obj.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab 2: Контакти ─────────────────────────────────────────────────────────

function ContactsTab({ contacts }: { contacts: CompanyContact[] }) {
  if (contacts.length === 0) {
    return <p className="text-zinc-500 text-sm text-center py-12">Контактів не додано</p>
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {contacts.map((c, i) => (
        <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 flex gap-4">
          {/* Photo */}
          <div className="shrink-0">
            {c.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.photo_url} alt={c.name} className="h-16 w-16 rounded-full object-cover border border-zinc-700" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xl font-semibold text-zinc-500">
                {c.name ? c.name[0].toUpperCase() : '?'}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div>
              <p className="text-sm font-medium text-zinc-100">{c.name || <span className="italic text-zinc-500">Без імені</span>}</p>
              {c.position && <p className="text-xs text-zinc-500">{c.position}</p>}
            </div>
            {c.phone && (
              <div className="flex items-center gap-1.5 text-xs">
                <Phone className="h-3 w-3 text-zinc-500 shrink-0" />
                <a href={`tel:${c.phone}`} className="text-brand-400 hover:text-brand-300">{c.phone}</a>
              </div>
            )}
            {c.email && (
              <div className="flex items-center gap-1.5 text-xs">
                <Mail className="h-3 w-3 text-zinc-500 shrink-0" />
                <a href={`mailto:${c.email}`} className="text-brand-400 hover:text-brand-300 truncate">{c.email}</a>
              </div>
            )}
            {c.telegram && (
              <div className="flex items-center gap-1.5 text-xs">
                <MessageCircle className="h-3 w-3 text-zinc-500 shrink-0" />
                <span className="text-zinc-300">{c.telegram}</span>
              </div>
            )}
            {c.viber && (
              <div className="flex items-center gap-1.5 text-xs">
                <Phone className="h-3 w-3 text-zinc-500 shrink-0" />
                <span className="text-zinc-300">Viber: {c.viber}</span>
              </div>
            )}
            {c.notes && <p className="text-xs text-zinc-500 italic pt-1 border-t border-zinc-800">{c.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab 3: Об'єкти ──────────────────────────────────────────────────────────

const OBJ_REL_OPTIONS: { value: RelationshipStatus | ''; label: string }[] = [
  { value: '', label: 'Відносини...' },
  { value: 'active', label: 'Працюємо' },
  { value: 'prospect', label: 'Перспективний' },
  { value: 'inactive', label: 'Не працюємо' },
]
const OBJ_CARD_CLS: Record<RelationshipStatus, string> = {
  active: 'border-green-500/50 bg-green-950/20 hover:border-green-400/70',
  prospect: 'border-yellow-500/50 bg-yellow-950/20 hover:border-yellow-400/70',
  inactive: 'border-red-500/50 bg-red-950/20 hover:border-red-400/70',
}
const OBJ_SEL_CLS: Record<RelationshipStatus, string> = {
  active: 'border-green-500/50 text-green-400',
  prospect: 'border-yellow-500/50 text-yellow-400',
  inactive: 'border-red-500/50 text-red-400',
}

function companyObjectToConstructionObject(obj: CompanyObject): ConstructionObject {
  return {
    id: obj.id,
    name: obj.name,
    address: obj.address || '',
    city: obj.city || '',
    oblast: '',
    status: (obj.status || 'planned') as ConstructionObject['status'],
    category: (obj.category || '') as ConstructionObject['category'],
    object_type: '' as ConstructionObject['object_type'],
    source: 'manual',
    photos: obj.photos || [],
    ai_score: obj.ai_score,
    created_at: '',
    updated_at: '',
  }
}

function CompanyObjectCard({
  obj, status, onStatusChange, onClick, onEdit, onDelete,
}: {
  obj: CompanyObject
  status: RelationshipStatus | ''
  onStatusChange: (s: RelationshipStatus | '') => void
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const mainPhoto = obj.photos?.[0]
  const cardCls = status ? OBJ_CARD_CLS[status] : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900'
  const selCls = status ? OBJ_SEL_CLS[status] : 'border-zinc-700 text-zinc-500'
  const fullAddress = [obj.address, obj.city].filter(Boolean).join(', ')

  return (
    <div
      className={`group relative rounded-xl border transition-all cursor-pointer overflow-hidden ${cardCls}`}
      onClick={onClick}
    >
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          className="rounded-md bg-black/60 hover:bg-black/80 p-1.5"
          title="Редагувати"
        >
          <Pencil className="h-3 w-3 text-white" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="rounded-md bg-black/60 hover:bg-red-500/80 p-1.5"
          title="Відкріпити"
        >
          <Trash2 className="h-3 w-3 text-white" />
        </button>
      </div>

      <div className="w-full h-36 bg-zinc-800 overflow-hidden flex items-center justify-center">
        {mainPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mainPhoto} alt="" className="w-full h-full object-cover" />
        ) : (
          <Image className="h-8 w-8 text-zinc-600" />
        )}
      </div>

      <div className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-1">
          <p className="text-sm font-medium text-zinc-100 truncate leading-snug">{obj.name}</p>
          {obj.role && (
            <span className="shrink-0 text-[10px] font-medium text-brand-400 bg-brand-400/10 border border-brand-400/20 rounded px-1.5 py-0.5">
              {COMPANY_ROLE_LABELS[obj.role as CompanyRole] ?? obj.role}
            </span>
          )}
        </div>

        {fullAddress && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 shrink-0 text-zinc-500" />
            <span className="text-xs text-zinc-500 truncate flex-1">{fullAddress}</span>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
              target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 flex items-center gap-0.5 text-[10px] text-brand-400 hover:text-brand-300 border border-brand-400/30 rounded px-1.5 py-0.5 transition-colors"
            >
              <Map className="h-2.5 w-2.5" />
              Мапа
            </a>
          </div>
        )}

        <select
          value={status}
          onChange={(e) => { e.stopPropagation(); onStatusChange(e.target.value as RelationshipStatus | '') }}
          onClick={(e) => e.stopPropagation()}
          className={`mt-1 w-full text-xs rounded-md px-2 py-1 border outline-none cursor-pointer bg-zinc-900 transition-colors ${selCls}`}
        >
          {OBJ_REL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-zinc-900 text-zinc-100">{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function CompanyObjectModal({
  obj, status, onStatusChange, onClose, onEdit,
}: {
  obj: CompanyObject
  status: RelationshipStatus | ''
  onStatusChange: (s: RelationshipStatus | '') => void
  onClose: () => void
  onEdit: () => void
}) {
  const [photoIdx, setPhotoIdx] = useState(0)
  const photos = obj.photos ?? []
  const selCls = status ? OBJ_SEL_CLS[status] : 'border-zinc-700 text-zinc-500'
  const fullAddress = [obj.address, obj.city].filter(Boolean).join(', ')

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Photo */}
        <div className="relative w-full h-56 bg-zinc-800 shrink-0">
          {photos.length > 0 ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photos[photoIdx]} alt="" className="w-full h-full object-cover" />
              {photos.length > 1 && (
                <>
                  <button onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70 transition">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70 transition">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {photos.map((_, i) => (
                      <button key={i} onClick={() => setPhotoIdx(i)}
                        className={`h-1.5 w-1.5 rounded-full transition-colors ${i === photoIdx ? 'bg-white' : 'bg-white/40'}`} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Image className="h-12 w-12 text-zinc-600" />
            </div>
          )}
          <button onClick={onEdit}
            className="absolute top-3 left-3 flex items-center gap-1.5 text-xs bg-black/60 hover:bg-black/80 text-white rounded-md px-2.5 py-1.5 transition-colors">
            <Pencil className="h-3.5 w-3.5" />
            Редагувати
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-4">
          {/* Title + status */}
          <div className="flex items-start justify-between gap-3 pr-6">
            <DialogTitle className="text-base font-semibold text-zinc-100 leading-snug">{obj.name}</DialogTitle>
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value as RelationshipStatus | '')}
              className={`shrink-0 text-xs rounded-md px-2 py-1 border outline-none cursor-pointer bg-zinc-900 transition-colors ${selCls}`}
            >
              {OBJ_REL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-zinc-900 text-zinc-100">{o.label}</option>
              ))}
            </select>
          </div>

          {/* Address + Map */}
          {fullAddress && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="h-4 w-4 shrink-0 text-zinc-500" />
                <span className="text-sm text-zinc-300 truncate">{fullAddress}</span>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                target="_blank" rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300 bg-brand-400/10 hover:bg-brand-400/20 border border-brand-400/30 rounded-md px-2.5 py-1 transition-colors"
              >
                <Map className="h-3.5 w-3.5" />
                Мапа
              </a>
            </div>
          )}

          {/* Status / Category / Type badges */}
          <div className="flex gap-2 flex-wrap">
            {obj.status && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded border ${STATUS_COLORS[obj.status as keyof typeof STATUS_COLORS] || 'text-zinc-400'} border-current/30`}>
                {STATUS_LABELS[obj.status as keyof typeof STATUS_LABELS] || obj.status}
              </span>
            )}
            {obj.category && (
              <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                {CATEGORY_LABELS[obj.category as keyof typeof CATEGORY_LABELS] || obj.category}
              </span>
            )}
            {obj.object_type && (
              <span className="text-xs text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded border border-zinc-800">
                {obj.object_type}
              </span>
            )}
            {obj.ai_score != null && (
              <span className="ml-auto text-xs text-purple-400 font-medium bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/30">
                AI {Math.round(obj.ai_score * 100)}
              </span>
            )}
          </div>

          {/* Tech specs */}
          {(obj.floors || obj.building_area) && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              {obj.floors && (
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Поверхів</p>
                  <p className="text-sm text-zinc-200 mt-0.5 flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-zinc-500" />
                    {obj.floors}
                  </p>
                </div>
              )}
              {obj.building_area && (
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Площа будівлі</p>
                  <p className="text-sm text-zinc-200 mt-0.5">{obj.building_area.toLocaleString('uk-UA')} м²</p>
                </div>
              )}
            </div>
          )}

          {/* Permits / Tenders */}
          {((obj.permits_count ?? 0) > 0 || (obj.tenders_count ?? 0) > 0) && (
            <div className="flex gap-3">
              {(obj.permits_count ?? 0) > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">
                  <FileText className="h-3.5 w-3.5" />
                  {obj.permits_count} дозвол{obj.permits_count === 1 ? '' : 'ів'}
                </span>
              )}
              {(obj.tenders_count ?? 0) > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-500/10 px-3 py-1.5 rounded-lg border border-yellow-500/20">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  {obj.tenders_count} тендер{obj.tenders_count === 1 ? '' : 'ів'}
                </span>
              )}
            </div>
          )}

          {/* Description */}
          {obj.description && (
            <div className="text-sm text-zinc-400 leading-relaxed border-t border-zinc-800 pt-3">
              {obj.description}
            </div>
          )}

          {/* Photo thumbnails */}
          {photos.length > 1 && (
            <div className="flex gap-2 flex-wrap pt-1">
              {photos.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="" onClick={() => setPhotoIdx(i)}
                  className={`h-14 w-14 rounded-lg object-cover border cursor-pointer transition-all ${
                    i === photoIdx ? 'border-brand-400 opacity-100' : 'border-zinc-700 opacity-60 hover:opacity-100'
                  }`} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ProjectsTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient()
  const [openId, setOpenId] = useState<string | null>(null)
  const [editObj, setEditObj] = useState<ConstructionObject | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [statuses, setStatuses] = useState<Record<string, RelationshipStatus | ''>>({})

  const { data: objects = [], isLoading } = useQuery({
    queryKey: ['company-objects', companyId],
    queryFn: () => companiesApi.listObjects(companyId),
  })

  const statusMutation = useMutation({
    mutationFn: ({ objectId, status }: { objectId: string; status: string | null }) =>
      companiesApi.updateObjectRelationship(companyId, objectId, status),
  })

  const unlinkMutation = useMutation({
    mutationFn: (objectId: string) => companiesApi.unlinkObject(companyId, objectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-objects', companyId] })
      qc.invalidateQueries({ queryKey: ['company', companyId] })
    },
  })

  const handleDelete = (objectId: string) => {
    if (!window.confirm("Відкріпити об'єкт від компанії?")) return
    unlinkMutation.mutate(objectId)
  }

  const getStatus = (obj: CompanyObject): RelationshipStatus | '' =>
    statuses[obj.id] ?? obj.relationship_status ?? ''

  const handleStatusChange = (objectId: string, status: RelationshipStatus | '') => {
    setStatuses((prev) => ({ ...prev, [objectId]: status }))
    statusMutation.mutate({ objectId, status: status || null })
  }

  const openEdit = (obj: CompanyObject) => {
    setOpenId(null)
    setEditObj(companyObjectToConstructionObject(obj))
    setEditOpen(true)
  }

  const handleCreateSuccess = async (newObj: ConstructionObject) => {
    await companiesApi.linkObject(companyId, newObj.id)
    qc.invalidateQueries({ queryKey: ['company-objects', companyId] })
    qc.invalidateQueries({ queryKey: ['company', companyId] })
    qc.invalidateQueries({ queryKey: ['objects'] })
  }

  const handleEditSuccess = () => {
    qc.invalidateQueries({ queryKey: ['company-objects', companyId] })
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
      </div>
    )
  }

  const openObj = objects.find((o) => o.id === openId)

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Додати об&apos;єкт
        </Button>
      </div>

      {objects.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-zinc-500 text-sm">Об&apos;єктів не знайдено</p>
          <p className="text-zinc-600 text-xs mt-1">Натисніть «Додати об&apos;єкт» щоб додати перший</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {objects.map((obj) => (
            <CompanyObjectCard
              key={obj.id}
              obj={obj}
              status={getStatus(obj)}
              onStatusChange={(s) => handleStatusChange(obj.id, s)}
              onClick={() => setOpenId(obj.id)}
              onEdit={() => openEdit(obj)}
              onDelete={() => handleDelete(obj.id)}
            />
          ))}
        </div>
      )}

      {openObj && (
        <CompanyObjectModal
          obj={openObj}
          status={getStatus(openObj)}
          onStatusChange={(s) => handleStatusChange(openObj.id, s)}
          onClose={() => setOpenId(null)}
          onEdit={() => openEdit(openObj)}
        />
      )}

      <ObjectFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleCreateSuccess}
      />

      {editObj && (
        <ObjectFormModal
          initialData={editObj}
          open={editOpen}
          onOpenChange={(v) => { setEditOpen(v); if (!v) setEditObj(null) }}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: () => companiesApi.get(id),
  })

  const favMutation = useMutation({
    mutationFn: () =>
      company?.is_favorite ? companiesApi.unfavorite(id) : companiesApi.favorite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', id] }),
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (!company) {
    return (
      <div className="p-6 text-center py-16">
        <p className="text-zinc-500">Компанію не знайдено</p>
        <Link href="/companies">
          <Button variant="outline" className="mt-4 border-zinc-800">Назад до компаній</Button>
        </Link>
      </div>
    )
  }

  const contacts: CompanyContact[] = (company.contacts as CompanyContact[]) || []

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/companies">
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100 -ml-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          {/* Logo or icon */}
          {company.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logo_url}
              alt={company.name}
              className="h-14 w-14 rounded-xl object-cover border border-zinc-700 shrink-0"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
              <Building className="h-7 w-7 text-zinc-400" />
            </div>
          )}

          <div>
            <h1 className="text-xl font-semibold text-zinc-100">{company.name}</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {company.edrpou && (
                <span className="text-sm text-zinc-500">ЄДРПОУ: {company.edrpou}</span>
              )}
              {company.type && (
                <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">
                  {COMPANY_ROLE_LABELS[company.type as CompanyRole] || company.type}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="border-zinc-800 text-zinc-400 gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            Редагувати
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => favMutation.mutate()}
            disabled={favMutation.isPending}
            className={`border-zinc-800 gap-1.5 ${company.is_favorite ? 'text-yellow-400 border-yellow-400/30' : 'text-zinc-400'}`}
          >
            <Star className={`h-4 w-4 ${company.is_favorite ? 'fill-yellow-400' : ''}`} />
            {company.is_favorite ? 'В обраних' : 'Обране'}
          </Button>
        </div>
      </div>

      {/* Edit modal */}
      <CompanyFormModal
        initialData={company as unknown as Company}
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v)
          if (!v) qc.invalidateQueries({ queryKey: ['company', id] })
        }}
      />

      {/* Tabs */}
      <Tabs defaultValue="general">
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="general" className="flex-1">Загальна інформація</TabsTrigger>
          <TabsTrigger value="contacts" className="flex-1">
            Контакти {contacts.length > 0 && <span className="ml-1.5 rounded-full bg-zinc-700 text-zinc-400 text-[10px] px-1.5 py-0.5">{contacts.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex-1">
            Об&apos;єкти {(company.objects_count ?? 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-zinc-700 text-zinc-400 text-[10px] px-1.5 py-0.5">
                {company.objects_count}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <GeneralTab company={company as Parameters<typeof GeneralTab>[0]['company']} />
        </TabsContent>
        <TabsContent value="contacts" className="mt-6">
          <ContactsTab contacts={contacts} />
        </TabsContent>
        <TabsContent value="projects" className="mt-6">
          <ProjectsTab companyId={id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
