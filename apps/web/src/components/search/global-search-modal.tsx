'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  Search, Loader2, Sparkles, Building2, Building,
  ArrowRight, X, CornerDownLeft,
} from 'lucide-react'
import { objectsApi } from '@/lib/api/objects'
import { companiesApi } from '@/lib/api/companies'
import { cn } from '@/lib/utils/cn'

interface GlobalSearchModalProps {
  open: boolean
  onClose: () => void
}

export function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [aiMode, setAiMode] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setDebouncedQuery('')
      setActiveIdx(-1)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 280)
    return () => clearTimeout(t)
  }, [query])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const enabled = debouncedQuery.length >= 2 && !aiMode

  const { data: objects, isLoading: objLoading } = useQuery({
    queryKey: ['gsearch-obj', debouncedQuery],
    queryFn: () => objectsApi.search(debouncedQuery),
    enabled,
    staleTime: 30_000,
  })

  const { data: companies, isLoading: compLoading } = useQuery({
    queryKey: ['gsearch-comp', debouncedQuery],
    queryFn: () => companiesApi.list({ search: debouncedQuery, page_size: 5 }),
    enabled,
    staleTime: 30_000,
  })

  const isLoading = objLoading || compLoading

  // Flatten results for keyboard nav
  const objItems = (objects?.items ?? []).slice(0, 4)
  const compItems = (companies?.items ?? []).slice(0, 3)
  const totalItems = objItems.length + compItems.length

  const navigate = useCallback((href: string) => {
    router.push(href)
    onClose()
  }, [router, onClose])

  const getHref = (idx: number): string => {
    if (idx < objItems.length) return `/objects/${objItems[idx].id}`
    return `/companies/${compItems[idx - objItems.length].id}`
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, totalItems - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIdx >= 0 && totalItems > 0) {
      e.preventDefault()
      navigate(getHref(activeIdx))
    }
  }

  const handleSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault()
    const q = query.trim()
    if (q.length < 2) return
    if (aiMode) {
      navigate(`/objects?ai=${encodeURIComponent(q)}`)
    } else {
      navigate(`/search?q=${encodeURIComponent(q)}`)
    }
  }

  const hasResults = totalItems > 0

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-[12%] z-50 w-full max-w-xl -translate-x-1/2 rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
        {/* Input row */}
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-3 px-4 py-3">
            {isLoading
              ? <Loader2 className="h-4 w-4 text-zinc-500 shrink-0 animate-spin" />
              : <Search className="h-4 w-4 text-zinc-500 shrink-0" />
            }
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveIdx(-1) }}
              onKeyDown={handleKeyDown}
              placeholder={aiMode
                ? "Опишіть що шукаєте (ШІ знайде найкраще)..."
                : "Пошук об'єктів, компаній, адрес, ЄДРПОУ..."
              }
              className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
            />
            {/* AI toggle */}
            <button
              type="button"
              onClick={() => setAiMode(v => !v)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors shrink-0',
                aiMode
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40'
                  : 'text-zinc-500 hover:text-zinc-300 border border-zinc-700 hover:border-zinc-600'
              )}
              title={aiMode ? 'Вимкнути AI-режим' : 'Увімкнути AI-режим'}
            >
              <Sparkles className="h-3 w-3" />
              AI
            </button>
            <button type="button" onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </form>

        <div className="border-t border-zinc-800" />

        {/* AI mode hint */}
        {aiMode && (
          <div className="px-4 py-4 flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-brand-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-zinc-300">Режим ШІ-пошуку</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Опишіть запит природньою мовою — ШІ знайде відповідні об&apos;єкти.
                Натисніть <kbd className="text-zinc-400 bg-zinc-800 px-1 rounded text-[10px]">Enter</kbd> для пошуку.
              </p>
            </div>
          </div>
        )}

        {/* Quick results */}
        {enabled && !aiMode && (
          <div className="max-h-80 overflow-y-auto">
            {/* Objects section */}
            {objItems.length > 0 && (
              <section>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                  Об&apos;єкти
                </p>
                {objItems.map((obj, i) => (
                  <button
                    key={obj.id}
                    type="button"
                    onClick={() => navigate(`/objects/${obj.id}`)}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left',
                      activeIdx === i ? 'bg-zinc-800' : 'hover:bg-zinc-800/60'
                    )}
                  >
                    <Building2 className="h-4 w-4 text-zinc-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm text-zinc-200 truncate">{obj.name}</span>
                      {(obj.city || obj.address) && (
                        <span className="block text-xs text-zinc-500 truncate">
                          {[obj.city, obj.address].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-700 shrink-0" />
                  </button>
                ))}
              </section>
            )}

            {/* Companies section */}
            {compItems.length > 0 && (
              <section>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                  Компанії
                </p>
                {compItems.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/companies/${c.id}`)}
                    onMouseEnter={() => setActiveIdx(objItems.length + i)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left',
                      activeIdx === objItems.length + i ? 'bg-zinc-800' : 'hover:bg-zinc-800/60'
                    )}
                  >
                    <Building className="h-4 w-4 text-zinc-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm text-zinc-200 truncate">{c.name}</span>
                      {c.edrpou && (
                        <span className="block text-xs text-zinc-500">ЄДРПОУ {c.edrpou}</span>
                      )}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-700 shrink-0" />
                  </button>
                ))}
              </section>
            )}

            {/* Empty */}
            {!isLoading && !hasResults && (
              <p className="px-4 py-6 text-sm text-zinc-500 text-center">
                Нічого не знайдено за запитом «{debouncedQuery}»
              </p>
            )}

            {/* See all */}
            {hasResults && (
              <div className="border-t border-zinc-800 px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs text-zinc-600">
                  {(objects?.total ?? 0) + (companies?.total ?? 0)} результатів
                </span>
                <button
                  type="button"
                  onClick={() => navigate(`/search?q=${encodeURIComponent(query)}`)}
                  className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                >
                  Показати всі
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer hints */}
        <div className={cn(
          'flex items-center justify-between px-4 py-2 border-t border-zinc-800/50 text-[10px] text-zinc-700',
          (!enabled || aiMode) && 'border-t-0 pt-1'
        )}>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-2.5 w-2.5" /> Перейти
            </span>
            {!aiMode && totalItems > 0 && (
              <span className="flex items-center gap-1">↑↓ Навігація</span>
            )}
          </div>
          <span className="flex items-center gap-1">
            <kbd className="bg-zinc-800 px-1 rounded text-[10px] text-zinc-500">Esc</kbd> Закрити
          </span>
        </div>
      </div>
    </>
  )
}
