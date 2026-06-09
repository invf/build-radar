'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShoppingCart, Search, Clock, CheckCircle, XCircle,
  ExternalLink, Trash2, Loader2, Globe, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'
import { tendersApi } from '@/lib/api/tenders'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, formatCurrency } from '@/lib/utils/format'
import type { Tender, TenderStatus } from '@/types'
import { TenderFormModal } from '@/components/tenders/tender-form-modal'
import { SearchPageInner } from '../search/search-inner'

interface TenderWithObject extends Tender {
  object_name?: string
  object_city?: string
}

interface TendersResponse {
  items: TenderWithObject[]
  total: number
  page: number
  pages: number
}

interface IntlStats {
  total: number
  high_priority: number
  medium_priority: number
  low_priority: number
  total_budget_usd: number
  donors: string[]
  countries: string[]
}

const STATUS_CONFIG: Record<TenderStatus, { label: string; color: string; icon: React.ElementType }> = {
  active:       { label: 'Активний',    color: 'border-green-500/30 text-green-400',  icon: Clock        },
  complete:     { label: 'Завершено',   color: 'border-blue-500/30 text-blue-400',    icon: CheckCircle  },
  cancelled:    { label: 'Скасовано',   color: 'border-red-500/30 text-red-400',      icon: XCircle      },
  unsuccessful: { label: 'Не відбувся', color: 'border-zinc-500/30 text-zinc-400',   icon: XCircle      },
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────

function TendersStatsBar() {
  const { data: intlStats } = useQuery({
    queryKey: ['intl-stats'],
    queryFn: () => apiFetch<IntlStats>('/international/stats'),
    staleTime: 120_000,
  })

  const { data: systemData } = useQuery({
    queryKey: ['tenders-count'],
    queryFn: () => apiFetch<TendersResponse>('/tenders', { params: { page: 1, page_size: 1 } }),
    staleTime: 120_000,
  })

  const intlBudgetM = intlStats?.total_budget_usd
    ? `$${(intlStats.total_budget_usd / 1_000_000).toFixed(0)}M`
    : '—'

  const stats = [
    {
      label: 'Тендери в системі',
      value: systemData?.total != null ? String(systemData.total) : '—',
      cls: 'text-zinc-100',
      icon: ShoppingCart,
    },
    {
      label: 'Міжнародні тендери',
      value: intlStats?.total != null ? String(intlStats.total) : '—',
      cls: 'text-blue-400',
      icon: Globe,
    },
    {
      label: 'Високий пріоритет',
      value: intlStats?.high_priority != null ? String(intlStats.high_priority) : '—',
      cls: 'text-green-400',
      icon: TrendingUp,
    },
    {
      label: 'Бюджет міжнар.',
      value: intlBudgetM,
      cls: 'text-zinc-100',
      icon: Globe,
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-xl border border-zinc-800 overflow-hidden bg-zinc-800">
      {stats.map((s) => (
        <div key={s.label} className="bg-zinc-900/80 px-4 py-3 flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider leading-none">{s.label}</span>
          <span className={`text-lg font-semibold leading-tight ${s.cls}`}>{s.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Вкладка 1: Тендери в системі ─────────────────────────────────────────────

function SystemTendersTab() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['tenders', search, status, page],
    queryFn: () =>
      apiFetch<TendersResponse>('/tenders', {
        params: {
          search: search || undefined,
          status: status !== 'all' ? status : undefined,
          page,
          page_size: 24,
          sort_by: 'created_at',
          sort_order: 'desc',
        },
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tendersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenders'] })
      setConfirmDeleteId(null)
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Пошук за назвою..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всі статуси</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([value, { label }]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TenderFormModal />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <>
          <p className="text-xs text-zinc-600">{data?.total?.toLocaleString('uk-UA') ?? 0} тендерів</p>
          <div className="space-y-2">
            {data?.items.map((tender) => {
              const cfg = STATUS_CONFIG[tender.status]
              const Icon = cfg.icon
              const isIntl = !!(tender.source && tender.source !== 'prozorro')
              const externalUrl = isIntl
                ? (tender.source_url ?? undefined)
                : `https://prozorro.gov.ua/tender/${tender.prozorro_id}`
              const isDeleting = deleteMutation.isPending && confirmDeleteId === tender.id
              const isConfirming = confirmDeleteId === tender.id && !isDeleting

              return (
                <div key={tender.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-700 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className={`text-xs ${cfg.color} gap-1`}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                        {isIntl ? (
                          <>
                            <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/30 gap-1">
                              <Globe className="h-3 w-3" />
                              {tender.source}
                            </Badge>
                            {tender.country && (
                              <span className="text-xs text-zinc-500">{tender.country}</span>
                            )}
                            {tender.donor && (
                              <span className="text-xs text-zinc-500">{tender.donor}</span>
                            )}
                            {tender.sector && (
                              <Badge variant="outline" className="text-xs text-zinc-500 border-zinc-700">{tender.sector}</Badge>
                            )}
                          </>
                        ) : (
                          <a
                            href={`https://prozorro.gov.ua/tender/${tender.prozorro_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-zinc-600 font-mono hover:text-brand-400 transition-colors"
                            title="Відкрити на Prozorro"
                          >
                            {tender.prozorro_id}
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-zinc-200 line-clamp-2 leading-relaxed">{tender.title}</p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {tender.object_name && (
                          <Link href={`/objects/${tender.object_id}`} className="text-xs text-brand-400 hover:text-brand-300">
                            {tender.object_name}{tender.object_city && ` · ${tender.object_city}`}
                          </Link>
                        )}
                        {tender.procuring_entity && (
                          <span className="text-xs text-zinc-500 truncate max-w-xs">{tender.procuring_entity}</span>
                        )}
                      </div>
                    </div>

                    {/* Right: amount + actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        {tender.amount !== undefined && tender.amount > 0 && (
                          <p className="text-sm font-semibold text-zinc-100">
                            {formatCurrency(tender.amount, tender.currency || 'UAH')}
                          </p>
                        )}
                        {tender.deadline && (
                          <p className="text-xs text-zinc-500 mt-0.5">до {formatDate(tender.deadline)}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {/* External link */}
                        {externalUrl ? (
                          <a
                            href={externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                            title={isIntl ? `Відкрити на ${tender.source}` : 'Відкрити на Prozorro'}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="p-1.5 rounded text-zinc-700 cursor-not-allowed" title="Посилання недоступне">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </span>
                        )}

                        {/* Edit */}
                        <TenderFormModal tender={tender} />

                        {/* Delete */}
                        {isConfirming ? (
                          <div className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/5 px-2 py-1">
                            <span className="text-[11px] text-red-400 whitespace-nowrap">Видалити?</span>
                            <button
                              onClick={() => deleteMutation.mutate(tender.id)}
                              className="text-[11px] text-red-400 hover:text-red-300 font-medium transition-colors px-1"
                            >
                              Так
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors px-1"
                            >
                              Ні
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(tender.id)}
                            disabled={isDeleting}
                            className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Видалити"
                          >
                            {isDeleting
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />
                            }
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {data?.items.length === 0 && (
            <div className="text-center py-16">
              <ShoppingCart className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">Тендерів не знайдено</p>
            </div>
          )}

          {data && data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="border-zinc-800">Назад</Button>
              <span className="text-sm text-zinc-500">{page} / {data.pages}</span>
              <Button variant="outline" size="sm" disabled={page === data.pages} onClick={() => setPage(p => p + 1)} className="border-zinc-800">Вперед</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TendersPage() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Тендери</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Prozorro · Міжнародні донори · Управління</p>
        </div>
        <a href="https://prozorro.gov.ua" target="_blank" rel="noopener noreferrer"
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1">
          prozorro.gov.ua <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <TendersStatsBar />

      <Tabs defaultValue="system" className="space-y-5">
        <TabsList>
          <TabsTrigger value="system">
            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
            Тендери в системі
          </TabsTrigger>
          <TabsTrigger value="prozorro">
            <Search className="h-3.5 w-3.5 mr-1.5" />
            Тендери Prozorro
          </TabsTrigger>
          <TabsTrigger value="international">
            <Globe className="h-3.5 w-3.5 mr-1.5" />
            Міжнародні тендери
          </TabsTrigger>
        </TabsList>

        <TabsContent value="system">
          <SystemTendersTab />
        </TabsContent>

        <TabsContent value="prozorro">
          <SearchPageInner initialQ="" basePath="/tenders" showHeader={false} />
        </TabsContent>

        <TabsContent value="international">
          <SearchPageInner initialQ="" basePath="/tenders" showHeader={false} source="international" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
