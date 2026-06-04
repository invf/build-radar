'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search, Loader2, Building, FileText, Building2, MapPin,
  Calendar, Plus, ArrowRight, Sparkles, X,
} from 'lucide-react'
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
import type { ConstructionObject, Company } from '@/types'

// ── Smart search API ──────────────────────────────────────────────────────────

interface SmartResult {
  query_used: string
  objects: Array<{
    id: string; name: string; address?: string; city?: string
    oblast?: string; status: string; category?: string; source: string; score: number
  }>
  companies: Array<{
    id: string; name: string; edrpou?: string; type?: string
    address?: string; objects_count: number; score: number
  }>
  external_companies: Array<{
    name: string; edrpou: string; address?: string; status?: string; type?: string
  }>
  external_places: Array<{
    name: string; address: string; lat?: number; lng?: number
    city?: string; oblast?: string; osm_id?: string
  }>
}

async function smartSearch(q: string, variants: string[]): Promise<SmartResult> {
  const params = new URLSearchParams({ q })
  variants.forEach((v) => params.append('variants', v))
  return apiFetch<SmartResult>(`/smart-search?${params}`)
}

// ── Suggestions ───────────────────────────────────────────────────────────────

const SUGGESTIONS = ['Житловий комплекс', 'ТРЦ', 'Офісний центр', 'Логістичний центр', 'Школа']

// ── Status helpers ────────────────────────────────────────────────────────────

const OBJ_STATUS_LABELS: Record<string, string> = {
  planned: 'Заплановано', approved: 'Затверджено',
  under_construction: 'Будується', completed: 'Завершено',
  suspended: 'Призупинено', cancelled: 'Скасовано',
}
const OBJ_STATUS_COLORS: Record<string, string> = {
  planned: 'text-zinc-400', approved: 'text-blue-400',
  under_construction: 'text-orange-400', completed: 'text-green-400',
  suspended: 'text-zinc-500', cancelled: 'text-red-400',
}

// ── Quick-add helpers (build pre-fill objects) ────────────────────────────────

function buildObjectPrefill(place: SmartResult['external_places'][0]): ConstructionObject {
  return {
    id: '', name: place.name, address: place.address,
    city: place.city ?? '', oblast: place.oblast ?? '', district: '',
    coordinates: (place.lat && place.lng)
      ? { lat: place.lat, lng: place.lng } : undefined,
    status: 'planned' as never, source: 'manual',
    created_at: '', updated_at: '',
    permits: [], tenders: [],
  } as unknown as ConstructionObject
}

function buildCompanyPrefill(c: SmartResult['external_companies'][0]): Company {
  return {
    id: '', name: c.name, edrpou: c.edrpou ?? '',
    address: c.address ?? '', type: c.type as never ?? '',
    phone: '', email: '', website: '', description: '',
    logo_url: '', relationship_status: null,
    objects_count: 0, contacts: [], projects: [],
    created_at: '', updated_at: '',
  } as unknown as Company
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SearchPageInner({ initialQ }: { initialQ: string }) {
  const router = useRouter()
  const qc = useQueryClient()
  const [query, setQuery] = useState(initialQ)
  const [submittedQuery, setSubmittedQuery] = useState(initialQ)
  const [normalization, setNormalization] = useState<ReturnType<typeof detectAndNormalize>>(null)

  // Quick-add modal states
  const [addObjectData, setAddObjectData] = useState<ConstructionObject | null>(null)
  const [addCompanyData, setAddCompanyData] = useState<Company | null>(null)

  // Detect keyboard layout issue on every query change (debounced)
  const normTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (normTimer.current) clearTimeout(normTimer.current)
    normTimer.current = setTimeout(() => {
      setNormalization(detectAndNormalize(query))
    }, 300)
    return () => { if (normTimer.current) clearTimeout(normTimer.current) }
  }, [query])

  useEffect(() => {
    setQuery(initialQ)
    setSubmittedQuery(initialQ)
  }, [initialQ])

  const enabled = submittedQuery.length >= 2
  const variants = queryVariants(submittedQuery)
  // Normalisation is the first variant that differs from original
  const normalised = variants.find((v) => v !== submittedQuery) ?? null

  // ── Smart search (replaces separate searches) ──────────────────────────────
  const { data: smart, isLoading: smartLoading } = useQuery({
    queryKey: ['smart-search', submittedQuery, variants.join('|')],
    queryFn: () => smartSearch(submittedQuery, variants.slice(1)),
    enabled,
    staleTime: 30_000,
  })

  // Fallback: permits still use separate endpoint
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
            className="pl-10 h-11 text-base"
            autoFocus
          />
          {normalization && query && (
            <button
              type="button"
              onClick={() => { setQuery(normalization.text); setSubmittedQuery(normalization.text) }}
              className="absolute right-10 top-1/2 -translate-y-1/2 text-[11px] text-brand-400 hover:text-brand-300 whitespace-nowrap hidden sm:block"
              title={`Шукати як: ${normalization.text}`}
            >
              {normalization.text}?
            </button>
          )}
        </div>
        <Button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 text-white h-11 px-6"
          disabled={query.trim().length < 2 || isSearching}
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
            &nbsp;
            <span className="text-zinc-500 text-xs">
              ({detectAndNormalize(submittedQuery)?.label ?? 'нормалізація'})
            </span>
          </span>
          <button
            className="text-zinc-600 hover:text-zinc-400"
            onClick={() => { setQuery(normalised); setSubmittedQuery(normalised) }}
            title="Використати цей запит"
          >
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
              <button
                key={s}
                onClick={() => handleSuggestion(s)}
                className="rounded-full border border-zinc-800 px-3 py-1 text-sm text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-colors"
              >
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
              <Building2 className="h-3.5 w-3.5" />
              Об&apos;єкти
              {totalObjects > 0 && <Badge variant="muted" className="ml-1">{totalObjects}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="companies" className="gap-1.5">
              <Building className="h-3.5 w-3.5" />
              Компанії
              {totalCompanies > 0 && <Badge variant="muted" className="ml-1">{totalCompanies}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="permits" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Дозволи
              {totalPermits > 0 && <Badge variant="muted" className="ml-1">{totalPermits}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="external" className="gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Реєстри
              {totalExternal > 0 && (
                <Badge variant="muted" className="ml-1 bg-brand-600/20 text-brand-400">{totalExternal}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Objects ── */}
          <TabsContent value="objects" className="mt-4">
            {smartLoading ? <LoadingList /> :
              !smart?.objects.length ? (
                <EmptyState text="Об'єктів не знайдено" hint="Результати з вашої бази. Спробуйте вкладку Реєстри для зовнішнього пошуку." />
              ) : (
                <div className="space-y-2">
                  {smart.objects.map((obj) => (
                    <div
                      key={obj.id}
                      className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 hover:border-zinc-700 hover:bg-zinc-900 transition-all"
                    >
                      <div className="h-9 w-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-zinc-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-100 truncate">{obj.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5 truncate">
                          {[obj.address, obj.city, obj.oblast].filter(Boolean).join(', ')}
                        </p>
                      </div>
                      <span className={`text-xs font-medium shrink-0 ${OBJ_STATUS_COLORS[obj.status] ?? 'text-zinc-400'}`}>
                        {OBJ_STATUS_LABELS[obj.status] ?? obj.status}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 h-7 px-2 text-zinc-400 hover:text-zinc-100"
                        onClick={() => router.push(`/objects?search=${encodeURIComponent(obj.name)}`)}
                        title="Відкрити в Об'єктах"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
          </TabsContent>

          {/* ── Companies ── */}
          <TabsContent value="companies" className="mt-4">
            {smartLoading ? <LoadingList /> :
              !smart?.companies.length ? (
                <EmptyState text="Компаній не знайдено" hint="Результати з вашої бази. Спробуйте вкладку Реєстри для пошуку у ЄДРПОУ." />
              ) : (
                <div className="space-y-2">
                  {smart.companies.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 hover:border-zinc-700 hover:bg-zinc-900 transition-all"
                    >
                      <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                        <Building className="h-4 w-4 text-zinc-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-100 truncate">{c.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {c.edrpou && <span className="mr-3">ЄДРПОУ {c.edrpou}</span>}
                          {c.address}
                        </p>
                      </div>
                      {c.type && <Badge variant="muted" className="shrink-0 text-xs">{c.type}</Badge>}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 h-7 px-2 text-zinc-400 hover:text-zinc-100"
                        onClick={() => router.push(`/companies?search=${encodeURIComponent(c.name)}`)}
                        title="Відкрити в Компаніях"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
          </TabsContent>

          {/* ── Permits ── */}
          <TabsContent value="permits" className="mt-4">
            {permitsLoading ? <LoadingList /> :
              !permitsData?.items.length ? (
                <EmptyState text="Дозволів не знайдено" hint="Спробуйте номер дозволу, адресу або місто" />
              ) : (
                <div className="space-y-2">
                  {permitsData.items.map((permit) => (
                    <div key={permit.id} className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                      <div className="h-9 w-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="h-4 w-4 text-zinc-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-100">{permit.permit_number}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-0.5">
                          {permit.permit_type && <span className="text-xs text-zinc-500">{permit.permit_type}</span>}
                          {permit.city && (
                            <span className="flex items-center gap-1 text-xs text-zinc-600">
                              <MapPin className="h-3 w-3" />{permit.city}
                            </span>
                          )}
                          {permit.issued_date && (
                            <span className="flex items-center gap-1 text-xs text-zinc-600">
                              <Calendar className="h-3 w-3" />{permit.issued_date.split('T')[0]}
                            </span>
                          )}
                        </div>
                        {permit.object_name && (
                          <p className="text-xs text-zinc-600 mt-0.5 truncate">Об&apos;єкт: {permit.object_name}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </TabsContent>

          {/* ── External registries ── */}
          <TabsContent value="external" className="mt-4 space-y-5">
            {/* External companies (ЄДРПОУ) */}
            {smartLoading ? <LoadingList /> : (
              <>
                {!!smart?.external_companies.length && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">ЄДРПОУ — реєстр компаній</p>
                    {smart.external_companies.map((c, i) => (
                      <div
                        key={`ec-${i}`}
                        className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                      >
                        <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                          <Building className="h-4 w-4 text-zinc-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-100 truncate">{c.name}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {c.edrpou && <span className="mr-3 text-brand-400/80">ЄДРПОУ {c.edrpou}</span>}
                            {c.address}
                          </p>
                        </div>
                        {c.status && (
                          <Badge variant="muted" className="shrink-0 text-xs">{c.status}</Badge>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 h-7 gap-1 border-brand-600/40 text-brand-400 hover:bg-brand-600/10"
                          onClick={() => setAddCompanyData(buildCompanyPrefill(c))}
                          title="Додати в BuildRadar"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Додати
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* External places (OSM) */}
                {!!smart?.external_places.length && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">OpenStreetMap — місця та будівлі</p>
                    {smart.external_places.map((p, i) => (
                      <div
                        key={`ep-${i}`}
                        className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                      >
                        <div className="h-9 w-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin className="h-4 w-4 text-zinc-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-100 truncate">{p.name}</p>
                          <p className="text-xs text-zinc-500 mt-0.5 truncate">{p.address}</p>
                          {(p.lat && p.lng) && (
                            <p className="text-xs text-zinc-600 mt-0.5">
                              {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 h-7 gap-1 border-brand-600/40 text-brand-400 hover:bg-brand-600/10"
                          onClick={() => setAddObjectData(buildObjectPrefill(p))}
                          title="Додати як об'єкт"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Додати
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {!smart?.external_companies.length && !smart?.external_places.length && (
                  <EmptyState
                    text="Нічого не знайдено в зовнішніх реєстрах"
                    hint="ЄДРПОУ та OSM доступні якщо налаштовані API-ключі"
                  />
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Quick-add: Object from OSM */}
      {addObjectData && (
        <ObjectFormModal
          initialData={addObjectData}
          open
          onOpenChange={(open) => { if (!open) { setAddObjectData(null); qc.invalidateQueries({ queryKey: ['objects'] }) } }}
        />
      )}

      {/* Quick-add: Company from ЄДРПОУ */}
      {addCompanyData && (
        <CompanyFormModal
          initialData={addCompanyData}
          open
          onOpenChange={(open) => { if (!open) { setAddCompanyData(null); qc.invalidateQueries({ queryKey: ['companies'] }) } }}
        />
      )}
    </div>
  )
}

function LoadingList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
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
