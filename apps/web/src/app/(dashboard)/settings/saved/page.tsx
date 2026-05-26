'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Search, Trash2, Bell, BellOff, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils/format'
import type { SavedSearch } from '@/types'

const STATUS_LABELS: Record<string, string> = {
  planned: 'Планується',
  approved: 'Затверджено',
  under_construction: 'Будується',
  completed: 'Завершено',
  suspended: 'Призупинено',
  cancelled: 'Скасовано',
}

const CATEGORY_LABELS: Record<string, string> = {
  residential: 'Житловий',
  commercial: 'Комерційний',
  industrial: 'Промисловий',
  infrastructure: 'Інфраструктура',
  social: 'Соціальний',
  mixed: 'Змішаний',
}

function filtersToQueryString(filters: SavedSearch['filters']): string {
  const params = new URLSearchParams()
  if (filters.status?.length) filters.status.forEach(s => params.append('status', s))
  if (filters.category?.length) filters.category.forEach(c => params.append('category', c))
  if (filters.city?.length) filters.city.forEach(c => params.append('city', c))
  if (filters.search) params.set('search', filters.search)
  return params.toString() ? `?${params.toString()}` : ''
}

function FilterSummary({ filters }: { filters: SavedSearch['filters'] }) {
  const tags: string[] = []
  if (filters.status?.length) tags.push(...filters.status.map(s => STATUS_LABELS[s] || s))
  if (filters.category?.length) tags.push(...filters.category.map(c => CATEGORY_LABELS[c] || c))
  if (filters.city?.length) tags.push(...filters.city)
  if (filters.oblast?.length) tags.push(...filters.oblast)
  if (filters.search) tags.push(`"${filters.search}"`)
  if (filters.min_floors) tags.push(`від ${filters.min_floors} поверхів`)
  if (filters.has_tenders) tags.push('З тендерами')

  if (tags.length === 0) return <span className="text-xs text-zinc-600">Без фільтрів</span>
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.slice(0, 5).map((tag) => (
        <Badge key={tag} variant="outline" className="text-xs border-zinc-700 text-zinc-500 py-0">{tag}</Badge>
      ))}
      {tags.length > 5 && (
        <span className="text-xs text-zinc-600">+{tags.length - 5} ще</span>
      )}
    </div>
  )
}

export default function SavedSearchesPage() {
  const qc = useQueryClient()

  const { data: searches, isLoading } = useQuery({
    queryKey: ['saved-searches'],
    queryFn: () => apiFetch<SavedSearch[]>('/saved-searches'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/saved-searches/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches'] }),
  })

  const toggleNotifyMutation = useMutation({
    mutationFn: ({ id, notify_enabled }: { id: string; notify_enabled: boolean }) =>
      apiFetch<SavedSearch>(`/saved-searches/${id}`, {
        method: 'PATCH',
        data: { notify_enabled },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches'] }),
  })

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Збережені пошуки</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {searches?.length ? `${searches.length} збережених пошуків` : 'Ваші збережені пошуки'}
          </p>
        </div>
        <Link href="/search">
          <Button variant="outline" size="sm" className="border-zinc-800 text-zinc-400 gap-1.5">
            <Search className="h-4 w-4" />
            Новий пошук
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : searches && searches.length > 0 ? (
        <div className="space-y-3">
          {searches.map((search) => (
            <div
              key={search.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Bookmark className="h-4 w-4 text-brand-400 shrink-0" />
                    <p className="text-sm font-medium text-zinc-100">{search.name}</p>
                    {search.notify_enabled && (
                      <Badge className="bg-brand-600/20 text-brand-400 border-brand-600/30 text-xs">
                        Сповіщення
                      </Badge>
                    )}
                  </div>
                  <FilterSummary filters={search.filters} />
                  {search.last_checked && (
                    <p className="text-xs text-zinc-600 mt-1">
                      Остання перевірка: {formatDate(search.last_checked)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      toggleNotifyMutation.mutate({
                        id: search.id,
                        notify_enabled: !search.notify_enabled,
                      })
                    }
                    className="h-8 w-8 p-0 text-zinc-600 hover:text-zinc-300"
                    title={search.notify_enabled ? 'Вимкнути сповіщення' : 'Увімкнути сповіщення'}
                  >
                    {search.notify_enabled ? (
                      <Bell className="h-4 w-4 text-brand-400" />
                    ) : (
                      <BellOff className="h-4 w-4" />
                    )}
                  </Button>
                  <Link href={`/objects${filtersToQueryString(search.filters)}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-zinc-600 hover:text-zinc-300"
                      title="Застосувати пошук"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(search.id)}
                    className="h-8 w-8 p-0 text-zinc-600 hover:text-red-400"
                    title="Видалити"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Bookmark className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Збережених пошуків немає</p>
          <p className="text-zinc-600 text-xs mt-1">
            Налаштуйте фільтри на сторінці пошуку і збережіть їх
          </p>
          <Link href="/search" className="mt-4 inline-block">
            <Button variant="outline" size="sm" className="border-zinc-800 mt-3 gap-1.5">
              <Search className="h-4 w-4" />
              Перейти до пошуку
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
