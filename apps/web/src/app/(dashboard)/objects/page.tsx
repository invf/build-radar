'use client'

import { useState, useEffect, Suspense, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, List, Map as MapIcon, Download, SortAsc,
  MapPin, Building2, ShoppingCart, ChevronLeft, ChevronRight,
  Image as ImageIcon, Pencil, ExternalLink, Globe, Sparkles, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ObjectCard } from '@/components/objects/object-card'
import { FiltersPanel } from '@/components/objects/filters-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { objectsApi } from '@/lib/api/objects'
import { peekCompanyFormDraft, savePickedObjects } from '@/lib/company-form-draft'
import { useFiltersStore } from '@/stores/filters'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { ObjectFormModal } from '@/components/objects/object-form-modal'
import { OsmSearchPanel } from '@/components/objects/osm-search-panel'
import { STATUS_LABELS, STATUS_COLORS, CATEGORY_LABELS } from '@/lib/utils/format'
import type { ConstructionObject } from '@/types'

type ViewMode = 'list' | 'map'
type SortOption = 'updated_at' | 'created_at' | 'ai_score' | 'name'

function ObjectQuickViewModal({
  obj,
  onClose,
  onEdit,
}: {
  obj: ConstructionObject
  onClose: () => void
  onEdit: () => void
}) {
  const [photoIdx, setPhotoIdx] = useState(0)
  const photos = obj.photos ?? []
  const fullAddress = [obj.address, obj.city].filter(Boolean).join(', ')

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
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
              <ImageIcon className="h-12 w-12 text-zinc-600" />
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-2">
            <button onClick={onEdit}
              className="flex items-center gap-1.5 text-xs bg-black/60 hover:bg-black/80 text-white rounded-md px-2.5 py-1.5 transition-colors">
              <Pencil className="h-3.5 w-3.5" />
              Редагувати
            </button>
            <Link href={`/objects/${obj.id}`}
              className="flex items-center gap-1.5 text-xs bg-black/60 hover:bg-black/80 text-white rounded-md px-2.5 py-1.5 transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />
              Деталі
            </Link>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-4">
          <DialogTitle className="text-base font-semibold text-zinc-100 leading-snug pr-6">{obj.name}</DialogTitle>

          {fullAddress && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="h-4 w-4 shrink-0 text-zinc-500" />
                <span className="text-sm text-zinc-300 truncate">{fullAddress}</span>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                target="_blank" rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-brand-400 hover:text-brand-300 bg-brand-400/10 border border-brand-400/30 rounded-md px-2.5 py-1 transition-colors"
              >
                <MapPin className="h-3.5 w-3.5" />
                Мапа
              </a>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {obj.status && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded border ${STATUS_COLORS[obj.status] || 'text-zinc-400'} border-current/30`}>
                {STATUS_LABELS[obj.status] || obj.status}
              </span>
            )}
            {obj.category && (
              <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                {CATEGORY_LABELS[obj.category] || obj.category}
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

          {(obj.tenders?.length ?? 0) > 0 && (
            <div className="flex gap-3">
              <span className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-500/10 px-3 py-1.5 rounded-lg border border-yellow-500/20">
                <ShoppingCart className="h-3.5 w-3.5" />
                {obj.tenders!.length} тендер{obj.tenders!.length === 1 ? '' : 'ів'}
              </span>
            </div>
          )}

          {/* Учасники */}
          {(obj.customer || obj.general_contractor || obj.designer || obj.installer) && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Учасники</p>
              {[
                ['Замовник', obj.customer],
                ['Генпідрядник', obj.general_contractor],
                ['Проектувальник', obj.designer],
                ['Монтажник', obj.installer],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string} className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-zinc-500 shrink-0">{label as string}</span>
                  <span className="text-xs text-zinc-200 text-right">{value as string}</span>
                </div>
              ))}
            </div>
          )}

          {obj.description && (
            <p className="text-sm text-zinc-400 leading-relaxed border-t border-zinc-800 pt-3">{obj.description}</p>
          )}

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

function ObjectsPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pickForCompany = searchParams.get('pickFor') === 'company'
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [selectedObjects, setSelectedObjects] = useState<Map<string, ConstructionObject>>(new Map())

  useEffect(() => {
    const q = searchParams.get('search')
    if (q) setSearch(q)
  }, [searchParams])
  const [sortBy, setSortBy] = useState<SortOption>('updated_at')
  const [page, setPage] = useState(1)
  const [aiQuery, setAiQuery] = useState('')
  const [intentSummary, setIntentSummary] = useState('')
  const [editingObject, setEditingObject] = useState<ConstructionObject | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [quickViewObj, setQuickViewObj] = useState<ConstructionObject | null>(null)
  const [showOsmPanel, setShowOsmPanel] = useState(false)
  const { filters } = useFiltersStore()
  const qc = useQueryClient()

  const alreadyAddedIds = useMemo(() => {
    const draft = peekCompanyFormDraft()
    return new Set(
      (draft?.projects ?? [])
        .map((p) => p.object_id)
        .filter((id): id is string => !!id),
    )
  }, [pickForCompany])

  const toggleSelection = (obj: ConstructionObject) => {
    if (alreadyAddedIds.has(obj.id)) return
    setSelectedObjects((prev) => {
      const next = new Map(prev)
      if (next.has(obj.id)) next.delete(obj.id)
      else next.set(obj.id, obj)
      return next
    })
  }

  // Activate AI mode from global search (?ai= URL param)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('ai')
    if (q) setAiQuery(decodeURIComponent(q))
  }, [])

  const isAiMode = !!aiQuery

  const { data: aiData, isLoading: aiLoading, isFetching: aiFetching, error: aiError } = useQuery({
    queryKey: ['objects-ai', aiQuery, page],
    queryFn: () => objectsApi.aiSearch(aiQuery, page, 24),
    enabled: isAiMode,
    retry: 1,
  })

  const aiSearching = isAiMode && (aiLoading || aiFetching)

  useEffect(() => {
    if (aiData?.intent_summary) setIntentSummary(aiData.intent_summary)
  }, [aiData?.intent_summary])

  const { data: regularData, isLoading: regularLoading, error: regularError } = useQuery({
    queryKey: ['objects', filters, search, sortBy, page],
    queryFn: () => objectsApi.list({
      ...filters,
      search: search || undefined,
      sort_by: sortBy,
      sort_order: 'desc',
      page,
      page_size: 24,
    }),
    enabled: !isAiMode,
    retry: 1,
  })

  const data = isAiMode ? aiData : regularData
  const isLoading = isAiMode ? aiLoading : regularLoading
  const fetchError = isAiMode ? null : regularError

  const { data: favoritesData } = useQuery({
    queryKey: ['favorites'],
    queryFn: objectsApi.getFavorites,
  })

  const favoriteIds = new Set(favoritesData?.items?.map((o) => o.id) || [])

  const favoriteMutation = useMutation({
    mutationFn: (id: string) =>
      favoriteIds.has(id) ? objectsApi.unfavorite(id) : objectsApi.favorite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => objectsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['objects'] }),
    onError: (err: Error) => window.alert(`Помилка видалення: ${err.message}`),
  })

  const handleEdit = (obj: ConstructionObject) => {
    setEditingObject(obj)
    setEditModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (!window.confirm("Видалити об'єкт? Цю дію неможливо скасувати.")) return
    deleteMutation.mutate(id)
  }

  const handleEditModalChange = (open: boolean) => {
    setEditModalOpen(open)
    if (!open) setEditingObject(null)
  }

  const handleExport = async () => {
    const blob = await objectsApi.exportCSV(filters) as Blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `buildradar-objects-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePickCancel = () => {
    router.push('/companies?resumeCompanyForm=1')
  }

  const handlePickConfirm = () => {
    const selected = Array.from(selectedObjects.values())
    if (selected.length === 0) return
    savePickedObjects(selected.map((o) => ({
      id: o.id,
      name: o.name,
      address: o.address,
      city: o.city,
      photos: o.photos,
      customer: o.customer,
      general_contractor: o.general_contractor,
      designer: o.designer,
      installer: o.installer,
      description: o.description,
    })))
    router.push('/companies?resumeCompanyForm=1')
  }

  const selectedCount = selectedObjects.size

  return (
    <div className={cn('p-4 md:p-6 space-y-4 md:space-y-5 animate-fade-in', pickForCompany && 'pb-28')}>
      {pickForCompany && (
        <div className="rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-brand-300">Вибір об&apos;єктів для компанії</p>
            <p className="text-xs text-zinc-400 mt-0.5">Натисніть на картки об&apos;єктів, щоб додати їх до компанії</p>
          </div>
          <Button variant="outline" size="sm" onClick={handlePickCancel} className="border-zinc-700 shrink-0">
            Скасувати
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            {pickForCompany ? 'Оберіть об\'єкти' : 'Будівельні об\'єкти'}
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {data?.total ? `${data.total.toLocaleString('uk-UA')} об'єктів` : 'Завантаження...'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!pickForCompany && (
          <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOsmPanel(v => !v)}
            className={cn(
              'gap-1.5 border-zinc-800',
              showOsmPanel
                ? 'border-brand-500/50 text-brand-400 bg-brand-500/10'
                : 'text-zinc-400 hover:text-zinc-100'
            )}
          >
            <Globe className="h-4 w-4" />
            OSM
          </Button>
          <ObjectFormModal />
          {editingObject && (
            <ObjectFormModal
              initialData={editingObject}
              open={editModalOpen}
              onOpenChange={handleEditModalChange}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="border-zinc-800 text-zinc-400 hover:text-zinc-100 gap-1"
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>

          <div className="flex rounded-lg border border-zinc-800 overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded-none border-0 h-8',
                viewMode === 'list' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500'
              )}
            >
              <List className="h-4 w-4" />
            </Button>
            <Link href="/map">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-none border-0 h-8 text-zinc-500 hover:text-zinc-100"
              >
                <MapIcon className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          </>
          )}
        </div>
      </div>

      {/* AI mode banner — activated from global search (Ctrl+K → AI) */}
      {isAiMode && (
        <div className="flex items-start gap-3 rounded-lg border border-brand-500/30 bg-brand-500/8 px-4 py-3">
          <Sparkles className={`h-4 w-4 text-brand-400 mt-0.5 shrink-0 ${aiSearching ? 'animate-pulse' : ''}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-300">
              <span className="font-medium text-brand-400">AI-пошук:</span>{' '}
              <span className="text-zinc-200">{aiQuery}</span>
            </p>
            {intentSummary && (
              <p className="text-xs text-zinc-500 mt-0.5">{intentSummary}</p>
            )}
            {aiSearching && (
              <p className="text-xs text-zinc-600 mt-0.5">Аналізую запит…</p>
            )}
          </div>
          <button
            onClick={() => { setAiQuery(''); setIntentSummary(''); setPage(1) }}
            className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
            title="Вийти з AI-режиму"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* OSM Search Panel */}
      {showOsmPanel && (
        <OsmSearchPanel onClose={() => setShowOsmPanel(false)} />
      )}

      {/* Search + Sort */}
      <div className={cn('flex flex-col sm:flex-row items-stretch sm:items-center gap-3', isAiMode && 'opacity-40 pointer-events-none')}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Пошук за назвою, адресою..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SortAsc className="hidden sm:block h-4 w-4 text-zinc-500" />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated_at">Нещодавно оновлені</SelectItem>
              <SelectItem value="created_at">Нові першими</SelectItem>
              <SelectItem value="ai_score">AI рейтинг</SelectItem>
              <SelectItem value="name">За назвою</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters */}
      <FiltersPanel />

      {/* AI error */}
      {aiError && isAiMode && !aiSearching && (
        <div className="rounded-lg border border-red-900/50 bg-red-900/10 px-4 py-3 text-sm text-red-400">
          ШІ-пошук не вдався: {(aiError as Error).message}. Перевір чи встановлені AI ключі на Render.
        </div>
      )}

      {/* Regular fetch error */}
      {fetchError && !isAiMode && (
        <div className="rounded-lg border border-red-900/50 bg-red-900/10 px-4 py-3 text-sm text-red-400">
          Помилка завантаження об&apos;єктів: {(fetchError as Error).message}
        </div>
      )}

      {/* AI searching overlay */}
      {aiSearching && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-brand-400" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-zinc-300 font-medium">ШІ аналізує запит…</p>
            <p className="text-zinc-500 text-sm mt-1">Це може зайняти кілька секунд</p>
          </div>
        </div>
      )}

      {/* Objects grid */}
      {!aiSearching && isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : !aiSearching && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data?.items.map((obj) => (
              <ObjectCard
                key={obj.id}
                object={obj}
                isFavorite={favoriteIds.has(obj.id)}
                onFavorite={pickForCompany ? undefined : (id) => favoriteMutation.mutate(id)}
                onEdit={pickForCompany ? undefined : handleEdit}
                onDelete={pickForCompany ? undefined : handleDelete}
                onQuickView={pickForCompany ? undefined : (o) => setQuickViewObj(o)}
                selectable={pickForCompany}
                selected={selectedObjects.has(obj.id)}
                selectionDisabled={alreadyAddedIds.has(obj.id)}
                onSelectToggle={toggleSelection}
              />
            ))}
          </div>

          {data?.items.length === 0 && (
            <div className="text-center py-16">
              <p className="text-zinc-500 text-sm">Об&apos;єктів не знайдено</p>
              <p className="text-zinc-600 text-xs mt-1">Спробуйте змінити фільтри або пошуковий запит</p>
            </div>
          )}

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="border-zinc-800"
              >
                Назад
              </Button>
              <span className="text-sm text-zinc-500">
                {page} / {data.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === data.pages}
                onClick={() => setPage(p => p + 1)}
                className="border-zinc-800"
              >
                Вперед
              </Button>
            </div>
          )}
        </>
      )}

      {quickViewObj && !pickForCompany && (
        <ObjectQuickViewModal
          obj={quickViewObj}
          onClose={() => setQuickViewObj(null)}
          onEdit={() => { setQuickViewObj(null); handleEdit(quickViewObj) }}
        />
      )}

      {pickForCompany && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <p className="text-sm text-zinc-400">
              {selectedCount > 0
                ? `Обрано: ${selectedCount}`
                : 'Оберіть один або кілька об\'єктів'}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePickCancel} className="border-zinc-700">
                Скасувати
              </Button>
              <Button size="sm" onClick={handlePickConfirm} disabled={selectedCount === 0}>
                Додати вибрані{selectedCount > 0 ? ` (${selectedCount})` : ''}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ObjectsPage() {
  return (
    <Suspense>
      <ObjectsPageInner />
    </Suspense>
  )
}
