'use client'

import { Suspense } from 'react'
import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search, Loader2, Building, FileText, Building2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ObjectCard } from '@/components/objects/object-card'
import { objectsApi } from '@/lib/api/objects'
import { Badge } from '@/components/ui/badge'

function SearchPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams.get('q') || ''
  const [query, setQuery] = useState(initialQuery)
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['search', submittedQuery],
    queryFn: () => objectsApi.search(submittedQuery),
    enabled: submittedQuery.length >= 2,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim().length >= 2) {
      setSubmittedQuery(query.trim())
      router.push(`/search?q=${encodeURIComponent(query.trim())}`, { scroll: false })
    }
  }

  useEffect(() => {
    if (initialQuery) setSubmittedQuery(initialQuery)
  }, [initialQuery])

  const isSearching = isLoading || isFetching

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Пошук</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Пошук по об&apos;єктах, компаніях, ЄДРПОУ, адресах та дозволах
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
          <Input
            type="search"
            placeholder="Введіть назву, адресу, ЄДРПОУ, номер дозволу..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-11 text-base"
            autoFocus
          />
        </div>
        <Button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 text-white h-11 px-6"
          disabled={query.trim().length < 2 || isSearching}
        >
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Знайти'}
        </Button>
      </form>

      {/* Search suggestions */}
      {!submittedQuery && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-600 uppercase tracking-wider">Популярні запити</p>
          <div className="flex flex-wrap gap-2">
            {['Житловий комплекс', 'ТРЦ', 'Офісний центр', 'Промисловий об\'єкт', 'Логістичний центр'].map((q) => (
              <button
                key={q}
                onClick={() => { setQuery(q); setSubmittedQuery(q) }}
                className="rounded-full border border-zinc-800 px-3 py-1 text-sm text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {submittedQuery && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {isSearching ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Пошук...
              </div>
            ) : data && (
              <p className="text-sm text-zinc-400">
                Знайдено <span className="font-bold text-zinc-200">{data.total}</span> об&apos;єктів
                за запитом «<span className="text-brand-400">{submittedQuery}</span>»
              </p>
            )}
          </div>

          <Tabs defaultValue="objects">
            <TabsList>
              <TabsTrigger value="objects" className="gap-2">
                <Building2 className="h-4 w-4" />
                Об&apos;єкти
                {data && <Badge variant="muted" className="ml-1">{data.total}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="companies" className="gap-2">
                <Building className="h-4 w-4" />
                Компанії
              </TabsTrigger>
              <TabsTrigger value="permits" className="gap-2">
                <FileText className="h-4 w-4" />
                Дозволи
              </TabsTrigger>
            </TabsList>

            <TabsContent value="objects" className="mt-4">
              {isSearching ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-40 rounded-xl bg-zinc-900/50 border border-zinc-800 animate-pulse" />
                  ))}
                </div>
              ) : data?.items.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-zinc-500">Нічого не знайдено</p>
                  <p className="text-zinc-600 text-sm mt-1">Спробуйте інший запит</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {data?.items.map((obj) => (
                    <ObjectCard key={obj.id} object={obj} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="companies" className="mt-4">
              <p className="text-zinc-500 text-sm text-center py-8">
                Пошук по компаніях буде доступний незабаром
              </p>
            </TabsContent>

            <TabsContent value="permits" className="mt-4">
              <p className="text-zinc-500 text-sm text-center py-8">
                Пошук по дозволах буде доступний незабаром
              </p>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageInner />
    </Suspense>
  )
}
