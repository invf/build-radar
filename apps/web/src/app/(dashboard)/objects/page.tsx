'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, List, Map as MapIcon, Download, SortAsc, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ObjectCard } from '@/components/objects/object-card'
import { FiltersPanel } from '@/components/objects/filters-panel'
import { AISearchBar } from '@/components/objects/ai-search-bar'
import { Skeleton } from '@/components/ui/skeleton'
import { objectsApi } from '@/lib/api/objects'
import { useFiltersStore } from '@/stores/filters'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

type ViewMode = 'list' | 'map'
type SortOption = 'updated_at' | 'created_at' | 'ai_score' | 'name'

export default function ObjectsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('updated_at')
  const [page, setPage] = useState(1)
  const [aiQuery, setAiQuery] = useState('')
  const [intentSummary, setIntentSummary] = useState('')
  const { filters } = useFiltersStore()
  const qc = useQueryClient()

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

  const { data: regularData, isLoading: regularLoading } = useQuery({
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
  })

  const data = isAiMode ? aiData : regularData
  const isLoading = isAiMode ? aiLoading : regularLoading
  const isFetching = isAiMode ? aiFetching : false

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

  const handleExport = async () => {
    const blob = await objectsApi.exportCSV(filters) as Blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `buildradar-objects-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Будівельні об&apos;єкти</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {data?.total ? `${data.total.toLocaleString('uk-UA')} об'єктів` : 'Завантаження...'}
          </p>
        </div>

        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* AI Search */}
      <AISearchBar
        onSearch={(q) => { setAiQuery(q); setPage(1) }}
        onClear={() => { setAiQuery(''); setIntentSummary('') }}
        isLoading={aiSearching}
        intentSummary={intentSummary}
      />

      {/* Search + Sort */}
      <div className={cn('flex items-center gap-3', isAiMode && 'opacity-40 pointer-events-none')}>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Пошук за назвою, адресою..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <SortAsc className="h-4 w-4 text-zinc-500" />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-44">
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
                onFavorite={(id) => favoriteMutation.mutate(id)}
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
    </div>
  )
}
