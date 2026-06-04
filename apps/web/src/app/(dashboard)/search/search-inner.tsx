'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search, Loader2, Building, FileText, Building2, MapPin,
  Calendar, Plus, ArrowRight, Sparkles, Globe, Phone, Mail,
  ExternalLink, ChevronDown, ChevronUp, User, Tag, X, Wand2, CheckCircle,
} from 'lucide-react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ObjectFormModal } from '@/components/objects/object-form-modal'
import { CompanyFormModal } from '@/components/companies/company-form-modal'
import { objectsApi } from '@/lib/api/objects'
import { companiesApi } from '@/lib/api/companies'
import { permitsApi } from '@/lib/api/permits'
import { apiFetch } from '@/lib/api/client'
import { detectAndNormalize, queryVariants } from '@/lib/utils/keyboard-layout'
import { formatCurrency } from '@/lib/utils/format'
import type { ConstructionObject, Company } from '@/types'

// ── Smart search API ──────────────────────────────────────────────────────────

interface SmartResult {
  query_used: string
  objects: Array<{
    id: string; name: string; address?: string; city?: string; oblast?: string
    status: string; category?: string; object_type?: string; source: string
    ai_score?: number; description?: string; website?: string
    floors?: number; building_area?: number; photos: string[]; score: number
  }>
  companies: Array<{
    id: string; name: string; edrpou?: string; type?: string
    address?: string; phone?: string; email?: string; website?: string
    logo_url?: string; relationship_status?: string
    objects_count: number; ai_score?: number; score: number
  }>
  external_companies: Array<{
    name: string; edrpou: string; address?: string; status?: string; type?: string
    phone?: string; email?: string; website?: string
    ceo?: string; activity?: string; registration_date?: string
  }>
  external_places: Array<{
    name: string; address: string; lat?: number; lng?: number
    city?: string; oblast?: string; osm_id?: string
    website?: string; phone?: string; email?: string
    operator?: string; description?: string; developer?: string
    floors?: number; building_type?: string
  }>
}

interface AiEnrichResult {
  name: string; website?: string; developer?: string; developer_edrpou?: string
  phone?: string; email?: string; description?: string; address?: string
  city?: string; category?: string; floors?: number; status?: string
  confidence: string; note?: string; source_url?: string
}

async function smartSearch(q: string, variants: string[]): Promise<SmartResult> {
  const params = new URLSearchParams({ q })
  variants.forEach((v) => params.append('variants', v))
  return apiFetch<SmartResult>(`/smart-search?${params}`)
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SUGGESTIONS = ['Житловий комплекс', 'ТРЦ', 'Офісний центр', 'Логістичний центр', 'Школа']

const OBJ_STATUS_LABELS: Record<string, string> = {
  planned: 'Заплановано', approved: 'Затверджено',
  under_construction: 'Будується', completed: 'Завершено',
  suspended: 'Призупинено', cancelled: 'Скасовано',
}
const OBJ_STATUS_COLORS: Record<string, string> = {
  planned: 'border-zinc-600 text-zinc-400',
  approved: 'border-blue-500/40 text-blue-400',
  under_construction: 'border-orange-500/40 text-orange-400',
  completed: 'border-green-500/40 text-green-400',
  suspended: 'border-zinc-700 text-zinc-500',
  cancelled: 'border-red-500/40 text-red-400',
}
const COMPANY_TYPE_LABELS: Record<string, string> = {
  developer: 'Забудовник', general_contractor: 'Ген. підрядник',
  subcontractor: 'Субпідрядник', designer: 'Проектувальник',
  engineering: 'Інжиніринг', technical_supervision: 'Тех. нагляд',
  architect: 'Архітектор', investor: 'Інвестор',
}
const REL_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Працюємо', cls: 'border-green-500/30 text-green-400' },
  prospect: { label: 'Перспективний', cls: 'border-yellow-500/30 text-yellow-400' },
  inactive: { label: 'Не працюємо', cls: 'border-red-500/30 text-red-400' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildObjectPrefill(
  place: SmartResult['external_places'][0],
  enriched?: AiEnrichResult
): ConstructionObject {
  return {
    id: '',
    name: place.name,
    address: enriched?.address || place.address,
    city: enriched?.city || place.city || '',
    oblast: place.oblast || '',
    district: '',
    coordinates: (place.lat && place.lng) ? { lat: place.lat, lng: place.lng } : undefined,
    status: 'planned' as never,
    source: 'manual',
    website: enriched?.website || place.website || '',
    description: enriched?.description || place.description || '',
    floors: enriched?.floors || place.floors || undefined,
    created_at: '', updated_at: '', permits: [], tenders: [],
  } as unknown as ConstructionObject
}

function buildCompanyPrefill(c: SmartResult['external_companies'][0]): Company {
  return {
    id: '', name: c.name, edrpou: c.edrpou ?? '',
    address: c.address ?? '', type: c.type as never ?? '',
    phone: c.phone ?? '', email: c.email ?? '', website: c.website ?? '',
    description: c.activity ?? '', logo_url: '',
    relationship_status: null, objects_count: 0, contacts: [], projects: [],
    created_at: '', updated_at: '',
  } as unknown as Company
}

function WebsiteLink({ url }: { url: string }) {
  const href = url.startsWith('http') ? url : `https://${url}`
  const display = url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-1 text-brand-400 hover:text-brand-300 transition-colors"
      onClick={(e) => e.stopPropagation()}>
      <Globe className="h-3 w-3 shrink-0" />
      <span className="truncate">{display}</span>
      <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
    </a>
  )
}

// ── Object Card ───────────────────────────────────────────────────────────────

function ObjectCard({ obj }: { obj: SmartResult['objects'][0] }) {
  const [expanded, setExpanded] = useState(false)
  const router = useRouter()
  const statusCls = OBJ_STATUS_COLORS[obj.status] ?? 'border-zinc-600 text-zinc-400'
  const statusLabel = OBJ_STATUS_LABELS[obj.status] ?? obj.status
  const photo = obj.photos?.[0]
  const hasExtra = !!(obj.description || obj.website || obj.floors || obj.building_area)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden hover:border-zinc-700 transition-all">
      <div className="flex gap-3 p-4">
        {/* Фото або іконка */}
        <div className="shrink-0">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-16 w-16 rounded-lg object-cover border border-zinc-700" />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700/50">
              <Building2 className="h-6 w-6 text-zinc-600" />
            </div>
          )}
        </div>

        {/* Основна інфо */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start gap-2">
            <p className="text-sm font-medium text-zinc-100 leading-snug flex-1">{obj.name}</p>
            <span className={`text-[11px] font-medium shrink-0 px-1.5 py-0.5 rounded border ${statusCls}`}>
              {statusLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {(obj.city || obj.oblast) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {[obj.city, obj.oblast].filter(Boolean).join(', ')}
              </span>
            )}
            {obj.address && !obj.city && (
              <span className="truncate">{obj.address}</span>
            )}
            {obj.category && (
              <span className="text-zinc-600">· {obj.category}</span>
            )}
            {obj.floors && (
              <span className="text-zinc-600">· {obj.floors} пов.</span>
            )}
            {obj.building_area && (
              <span className="text-zinc-600">· {obj.building_area.toLocaleString('uk-UA')} м²</span>
            )}
          </div>

          {obj.website && <div className="text-xs"><WebsiteLink url={obj.website} /></div>}

          {expanded && obj.description && (
            <p className="text-xs text-zinc-400 leading-relaxed border-t border-zinc-800 pt-2 mt-1">
              {obj.description.slice(0, 300)}{obj.description.length > 300 ? '…' : ''}
            </p>
          )}
        </div>

        {/* Дії */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Link href={`/objects/${obj.id}`}>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-zinc-400 hover:text-zinc-100 gap-1 text-xs">
              Відкрити <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
          {hasExtra && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 flex items-center gap-0.5"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Менше' : 'Більше'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Company Card ──────────────────────────────────────────────────────────────

function CompanyCard({ c }: { c: SmartResult['companies'][0] }) {
  const [expanded, setExpanded] = useState(false)
  const relStatus = c.relationship_status ? REL_STATUS[c.relationship_status] : null
  const typeLabel = c.type ? (COMPANY_TYPE_LABELS[c.type] ?? c.type) : null

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden hover:border-zinc-700 transition-all">
      <div className="flex gap-3 p-4">
        {/* Логотип */}
        <div className="shrink-0">
          {c.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.logo_url} alt="" className="h-12 w-12 rounded-lg object-cover border border-zinc-700" />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700/50">
              <Building className="h-5 w-5 text-zinc-600" />
            </div>
          )}
        </div>

        {/* Основна інфо */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start gap-2 flex-wrap">
            <p className="text-sm font-medium text-zinc-100 flex-1">{c.name}</p>
            {relStatus && (
              <span className={`text-[11px] font-medium shrink-0 px-1.5 py-0.5 rounded border ${relStatus.cls}`}>
                {relStatus.label}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            {c.edrpou && <span className="font-mono text-brand-400/80">ЄДРПОУ {c.edrpou}</span>}
            {typeLabel && <span className="text-zinc-600">{typeLabel}</span>}
            {c.objects_count > 0 && (
              <span className="text-zinc-600">{c.objects_count} об&apos;єкт{c.objects_count === 1 ? '' : 'ів'}</span>
            )}
          </div>

          {/* Контакти */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {c.website && <WebsiteLink url={c.website} />}
            {c.phone && (
              <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors">
                <Phone className="h-3 w-3" />{c.phone}
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors">
                <Mail className="h-3 w-3" />{c.email}
              </a>
            )}
          </div>

          {expanded && c.address && (
            <p className="text-xs text-zinc-500 flex items-start gap-1 border-t border-zinc-800 pt-2 mt-1">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />{c.address}
            </p>
          )}
        </div>

        {/* Дії */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Link href={`/companies/${c.id}`}>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-zinc-400 hover:text-zinc-100 gap-1 text-xs">
              Відкрити <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
          {c.address && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 flex items-center gap-0.5"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Менше' : 'Адреса'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── AI Enrich Button (reusable) ───────────────────────────────────────────────

function AiEnrichButton({
  name, city, entityType = 'object', websiteUrl,
  onEnriched,
}: {
  name: string; city?: string; entityType?: string; websiteUrl?: string
  onEnriched?: (r: AiEnrichResult) => void
}) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handle = async () => {
    setLoading(true)
    try {
      const r = await apiFetch<AiEnrichResult>('/search/enrich-place', {
        method: 'POST',
        data: { name, city, entity_type: entityType, website_url: websiteUrl },
      })
      setDone(true)
      onEnriched?.(r)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <span className="flex items-center gap-1 text-[10px] text-purple-400">
      <CheckCircle className="h-3 w-3" />Знайдено
    </span>
  )
  return (
    <button onClick={handle} disabled={loading}
      className="flex items-center gap-1 text-[11px] text-purple-400/70 hover:text-purple-300 transition-colors"
      title="Знайти сайт через ШІ">
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
      {loading ? 'ШІ...' : 'ШІ'}
    </button>
  )
}

// ── External Company Card ─────────────────────────────────────────────────────

function ExternalCompanyCard({
  c, onAdd,
}: { c: SmartResult['external_companies'][0]; onAdd: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const hasExtra = !!(c.ceo || c.activity || c.registration_date)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
      <div className="flex gap-3 p-4">
        <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5 border border-zinc-700/50">
          <Building className="h-4 w-4 text-zinc-500" />
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-sm font-medium text-zinc-100">{c.name}</p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-mono text-brand-400/80">ЄДРПОУ {c.edrpou}</span>
            {c.status && (
              <span className={`px-1.5 py-0.5 rounded border text-[11px] ${
                c.status.toLowerCase().includes('зареєстр') ? 'border-green-500/30 text-green-400' : 'border-zinc-700 text-zinc-500'
              }`}>{c.status}</span>
            )}
            {c.type && <span className="text-zinc-600">{c.type}</span>}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {c.website && <WebsiteLink url={c.website} />}
            {c.phone && (
              <span className="flex items-center gap-1 text-zinc-400">
                <Phone className="h-3 w-3" />{c.phone}
              </span>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200">
                <Mail className="h-3 w-3" />{c.email}
              </a>
            )}
          </div>

          {c.address && (
            <p className="text-xs text-zinc-500 flex items-start gap-1">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />{c.address}
            </p>
          )}

          {expanded && (
            <div className="border-t border-zinc-800 pt-2 mt-1 space-y-1 text-xs text-zinc-500">
              {c.ceo && (
                <p className="flex items-center gap-1.5">
                  <User className="h-3 w-3 shrink-0" />
                  <span className="text-zinc-400">{c.ceo}</span>
                </p>
              )}
              {c.activity && (
                <p className="flex items-start gap-1.5">
                  <Tag className="h-3 w-3 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{c.activity}</span>
                </p>
              )}
              {c.registration_date && (
                <p className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 shrink-0" />
                  Зареєстровано: {c.registration_date}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 border-brand-600/40 text-brand-400 hover:bg-brand-600/10 text-xs"
            onClick={onAdd}
          >
            <Plus className="h-3.5 w-3.5" />Додати
          </Button>
          {!c.website && (
            <AiEnrichButton name={c.name} entityType="company" onEnriched={(r) => {
              if (r.website) window.open(r.website, '_blank')
            }} />
          )}
          {hasExtra && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 flex items-center gap-0.5"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Менше' : 'Деталі'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── External Place Card ───────────────────────────────────────────────────────

function ExternalPlaceCard({
  p, onAdd,
}: { p: SmartResult['external_places'][0]; onAdd: (enriched?: AiEnrichResult) => void }) {
  const [enriching, setEnriching] = useState(false)
  const [enriched, setEnriched] = useState<AiEnrichResult | null>(null)
  const [enrichError, setEnrichError] = useState<string | null>(null)

  const mapsUrl = p.lat && p.lng
    ? `https://www.google.com/maps?q=${p.lat},${p.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`

  const handleEnrich = async () => {
    setEnriching(true)
    setEnrichError(null)
    try {
      const result = await apiFetch<AiEnrichResult>('/search/enrich-place', {
        method: 'POST',
        data: {
          name: p.name,
          city: p.city || undefined,
          entity_type: 'object',
          website_url: p.website || undefined,
        },
      })
      setEnriched(result)
    } catch {
      setEnrichError('Не вдалось збагатити дані')
    } finally {
      setEnriching(false)
    }
  }

  const display = enriched || null
  const website = display?.website || p.website
  const phone = display?.phone || p.phone
  const email = display?.email || p.email
  const description = display?.description || p.description
  const developer = display?.developer || p.developer || p.operator
  const floors = display?.floors || p.floors

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
      <div className="flex gap-3 p-4">
        <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5 border border-zinc-700/50">
          <MapPin className="h-4 w-4 text-zinc-500" />
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-sm font-medium text-zinc-100">{p.name}</p>

          {/* Address + meta */}
          <p className="text-xs text-zinc-500 leading-relaxed">{p.address}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
            {p.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.city}</span>}
            {p.oblast && <span>{p.oblast}</span>}
            {floors && <span>{floors} пов.</span>}
            {p.building_type && <span className="capitalize">{p.building_type}</span>}
            {p.lat && p.lng && (
              <span className="font-mono text-zinc-700">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</span>
            )}
          </div>

          {/* Contacts from OSM or AI */}
          {(website || phone || email) && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {website && <WebsiteLink url={website} />}
              {phone && (
                <a href={`tel:${phone}`} className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200">
                  <Phone className="h-3 w-3" />{phone}
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200">
                  <Mail className="h-3 w-3" />{email}
                </a>
              )}
            </div>
          )}

          {/* Developer/operator */}
          {developer && (
            <p className="text-xs text-zinc-500 flex items-center gap-1">
              <Building className="h-3 w-3 shrink-0" />
              <span className="text-zinc-400">{developer}</span>
              {display?.developer_edrpou && (
                <span className="font-mono text-brand-400/70 ml-1">ЄДРПОУ {display.developer_edrpou}</span>
              )}
            </p>
          )}

          {/* Description from AI */}
          {description && (
            <p className="text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/50 pt-1.5 mt-0.5">
              {description}
            </p>
          )}

          {/* Category / status from AI */}
          {(display?.category || display?.status) && (
            <div className="flex gap-2 text-xs">
              {display.category && (
                <span className="px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-500">{display.category}</span>
              )}
              {display.status && (
                <span className="px-1.5 py-0.5 rounded border border-brand-500/30 text-brand-400">{display.status}</span>
              )}
            </div>
          )}

          {enrichError && (
            <p className="text-xs text-red-400">{enrichError}</p>
          )}

          {/* Links */}
          <div className="flex items-center gap-3 pt-0.5">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-brand-400 transition-colors">
              <ExternalLink className="h-3 w-3" />Google Maps
            </a>
            {enriched?.source_url && enriched.source_url !== website && (
              <a href={enriched.source_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-brand-400 transition-colors">
                <ExternalLink className="h-3 w-3" />Джерело
              </a>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 border-brand-600/40 text-brand-400 hover:bg-brand-600/10 text-xs"
            onClick={() => onAdd(enriched || undefined)}
          >
            <Plus className="h-3.5 w-3.5" />Додати
          </Button>

          {!enriched ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 text-xs"
              onClick={handleEnrich}
              disabled={enriching}
              title="Знайти сайт, збагатити через ШІ"
            >
              {enriching
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Wand2 className="h-3.5 w-3.5" />}
              {enriching ? 'ШІ...' : 'ШІ'}
            </Button>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-purple-400">
              <CheckCircle className="h-3 w-3" />Збагачено
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function SearchPageInner({ initialQ }: { initialQ: string }) {
  const router = useRouter()
  const qc = useQueryClient()
  const [query, setQuery] = useState(initialQ)
  const [submittedQuery, setSubmittedQuery] = useState(initialQ)
  const [normalization, setNormalization] = useState<ReturnType<typeof detectAndNormalize>>(null)
  const [addObjectData, setAddObjectData] = useState<ConstructionObject | null>(null)
  const [addCompanyData, setAddCompanyData] = useState<Company | null>(null)

  const normTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (normTimer.current) clearTimeout(normTimer.current)
    normTimer.current = setTimeout(() => setNormalization(detectAndNormalize(query)), 300)
    return () => { if (normTimer.current) clearTimeout(normTimer.current) }
  }, [query])

  useEffect(() => { setQuery(initialQ); setSubmittedQuery(initialQ) }, [initialQ])

  const enabled = submittedQuery.length >= 2
  const variants = queryVariants(submittedQuery)
  const normalised = variants.find((v) => v !== submittedQuery) ?? null

  const { data: smart, isLoading: smartLoading } = useQuery({
    queryKey: ['smart-search', submittedQuery, variants.join('|')],
    queryFn: () => smartSearch(submittedQuery, variants.slice(1)),
    enabled,
    staleTime: 30_000,
  })

  const { data: permitsData, isLoading: permitsLoading } = useQuery({
    queryKey: ['search-permits', submittedQuery],
    queryFn: () => permitsApi.search(submittedQuery, 20),
    enabled,
  })

  const isSearching = smartLoading || permitsLoading

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length < 2) return
    setSubmittedQuery(trimmed)
    router.push(`/search?q=${encodeURIComponent(trimmed)}`, { scroll: false })
  }

  const handleSuggestion = (s: string) => {
    setQuery(s); setSubmittedQuery(s)
    router.push(`/search?q=${encodeURIComponent(s)}`, { scroll: false })
  }

  const totalObjects = smart?.objects.length ?? 0
  const totalCompanies = smart?.companies.length ?? 0
  const totalExternal = (smart?.external_companies.length ?? 0) + (smart?.external_places.length ?? 0)
  const totalPermits = permitsData?.items.length ?? 0

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Пошук</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Об&apos;єкти, компанії, дозволи. Розуміє помилки розкладки та транслітерацію.
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
          <Input
            type="search"
            placeholder="Введіть назву, адресу, ЄДРПОУ... (будь-яка мова)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-20 h-11 text-base"
            autoFocus
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {normalization && query && (
              <button
                type="button"
                onClick={() => { setQuery(normalization.text); setSubmittedQuery(normalization.text) }}
                className="text-[11px] text-brand-400 hover:text-brand-300 whitespace-nowrap hidden sm:block px-1"
                title={`Шукати як: ${normalization.text}`}
              >
                {normalization.text}?
              </button>
            )}
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setSubmittedQuery('')
                  router.push('/search', { scroll: false })
                }}
                className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                title="Очистити пошук"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <Button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 text-white h-11 px-6"
        >
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Знайти'}
        </Button>
      </form>

      {/* Normalisation banner */}
      {enabled && normalised && (
        <div className="flex items-center gap-2 rounded-lg border border-brand-500/30 bg-brand-500/8 px-4 py-2.5 max-w-2xl">
          <Sparkles className="h-4 w-4 text-brand-400 shrink-0" />
          <span className="text-sm text-zinc-300 flex-1">
            Результати також за:&nbsp;
            <span className="font-medium text-brand-300">{normalised}</span>
            &nbsp;<span className="text-zinc-500 text-xs">({detectAndNormalize(submittedQuery)?.label ?? 'нормалізація'})</span>
          </span>
          <button className="text-zinc-600 hover:text-zinc-400"
            onClick={() => { setQuery(normalised); setSubmittedQuery(normalised) }}>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Suggestions */}
      {!submittedQuery && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-600 uppercase tracking-wider">Популярні запити</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => handleSuggestion(s)}
                className="rounded-full border border-zinc-800 px-3 py-1 text-sm text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {submittedQuery && (
        <Tabs defaultValue="objects">
          <TabsList className="flex-wrap gap-1">
            <TabsTrigger value="objects" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" />Об&apos;єкти
              {totalObjects > 0 && <Badge variant="muted" className="ml-1">{totalObjects}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="companies" className="gap-1.5">
              <Building className="h-3.5 w-3.5" />Компанії
              {totalCompanies > 0 && <Badge variant="muted" className="ml-1">{totalCompanies}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="permits" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />Дозволи
              {totalPermits > 0 && <Badge variant="muted" className="ml-1">{totalPermits}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="external" className="gap-1.5">
              <MapPin className="h-3.5 w-3.5" />Реєстри
              {totalExternal > 0 && <Badge variant="muted" className="ml-1 bg-brand-600/20 text-brand-400">{totalExternal}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* ── Objects ── */}
          <TabsContent value="objects" className="mt-4">
            {smartLoading ? <LoadingList /> : !smart?.objects.length ? (
              <EmptyState text="Об'єктів не знайдено" hint="Результати з вашої бази. Спробуйте вкладку Реєстри для зовнішнього пошуку." />
            ) : (
              <div className="space-y-2">
                {smart.objects.map((obj) => <ObjectCard key={obj.id} obj={obj} />)}
              </div>
            )}
          </TabsContent>

          {/* ── Companies ── */}
          <TabsContent value="companies" className="mt-4">
            {smartLoading ? <LoadingList /> : !smart?.companies.length ? (
              <EmptyState text="Компаній не знайдено" hint="Результати з вашої бази. Спробуйте вкладку Реєстри для пошуку у ЄДРПОУ." />
            ) : (
              <div className="space-y-2">
                {smart.companies.map((c) => <CompanyCard key={c.id} c={c} />)}
              </div>
            )}
          </TabsContent>

          {/* ── Permits ── */}
          <TabsContent value="permits" className="mt-4">
            {permitsLoading ? <LoadingList /> : !permitsData?.items.length ? (
              <EmptyState text="Дозволів не знайдено" hint="Спробуйте номер дозволу, адресу або місто" />
            ) : (
              <div className="space-y-2">
                {permitsData.items.map((permit) => (
                  <div key={permit.id} className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 hover:border-zinc-700 transition-all">
                    <div className="h-9 w-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="h-4 w-4 text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-100">{permit.permit_number}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-0.5">
                        {permit.permit_type && <span className="text-xs text-zinc-500">{permit.permit_type}</span>}
                        {permit.city && <span className="flex items-center gap-1 text-xs text-zinc-600"><MapPin className="h-3 w-3" />{permit.city}</span>}
                        {permit.issued_date && <span className="flex items-center gap-1 text-xs text-zinc-600"><Calendar className="h-3 w-3" />{permit.issued_date.split('T')[0]}</span>}
                      </div>
                      {permit.object_name && <p className="text-xs text-zinc-600 mt-0.5 truncate">Об&apos;єкт: {permit.object_name}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── External registries ── */}
          <TabsContent value="external" className="mt-4 space-y-5">
            {smartLoading ? <LoadingList /> : (
              <>
                {!!smart?.external_companies.length && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">ЄДРПОУ — реєстр компаній</p>
                    {smart.external_companies.map((c, i) => (
                      <ExternalCompanyCard key={`ec-${i}`} c={c} onAdd={() => setAddCompanyData(buildCompanyPrefill(c))} />
                    ))}
                  </div>
                )}
                {!!smart?.external_places.length && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">OpenStreetMap — місця та будівлі</p>
                    {smart.external_places.map((p, i) => (
                      <ExternalPlaceCard
                        key={`ep-${i}`}
                        p={p}
                        onAdd={(enriched) => setAddObjectData(buildObjectPrefill(p, enriched))}
                      />
                    ))}
                  </div>
                )}
                {!smart?.external_companies.length && !smart?.external_places.length && (
                  <EmptyState text="Нічого не знайдено в зовнішніх реєстрах" hint="ЄДРПОУ та OSM доступні якщо налаштовані API-ключі" />
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      {addObjectData && (
        <ObjectFormModal initialData={addObjectData} open onOpenChange={(open) => { if (!open) { setAddObjectData(null); qc.invalidateQueries({ queryKey: ['objects'] }) } }} />
      )}
      {addCompanyData && (
        <CompanyFormModal initialData={addCompanyData} open onOpenChange={(open) => { if (!open) { setAddCompanyData(null); qc.invalidateQueries({ queryKey: ['companies'] }) } }} />
      )}
    </div>
  )
}

function LoadingList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
    </div>
  )
}

function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="text-center py-12">
      <span className="block text-zinc-500 text-sm">{text}</span>
      {hint && <span className="block text-zinc-600 text-xs mt-1">{hint}</span>}
    </div>
  )
}
