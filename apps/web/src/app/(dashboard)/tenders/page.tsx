'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShoppingCart, Search, Clock, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatCurrency } from '@/lib/utils/format'
import type { Tender, TenderStatus } from '@/types'
import { TenderFormModal } from '@/components/tenders/tender-form-modal'

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

const STATUS_CONFIG: Record<TenderStatus, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: 'Активний', color: 'border-green-500/30 text-green-400', icon: Clock },
  complete: { label: 'Завершено', color: 'border-blue-500/30 text-blue-400', icon: CheckCircle },
  cancelled: { label: 'Скасовано', color: 'border-red-500/30 text-red-400', icon: XCircle },
  unsuccessful: { label: 'Не відбувся', color: 'border-zinc-500/30 text-zinc-400', icon: XCircle },
}

export default function TendersPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [page, setPage] = useState(1)

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

  const activeCount = status === 'active' ? data?.total : undefined

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Тендери Prozorro</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {data?.total ? `${data.total.toLocaleString('uk-UA')} тендерів` : 'Завантаження...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TenderFormModal />
          <a
            href="https://prozorro.gov.ua"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Джерело: Prozorro →
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Пошук за назвою тендеру..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-44">
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

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {data?.items.map((tender) => {
              const cfg = STATUS_CONFIG[tender.status]
              const Icon = cfg.icon
              return (
                <div
                  key={tender.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-700 hover:bg-zinc-900 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className={`text-xs ${cfg.color} gap-1`}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                        <span className="text-xs text-zinc-600 font-mono">{tender.prozorro_id}</span>
                      </div>
                      <p className="text-sm text-zinc-200 line-clamp-2 leading-relaxed">{tender.title}</p>
                      {(tender.object_name || tender.procuring_entity) && (
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {tender.object_name && (
                            <Link href={`/objects/${tender.object_id}`} className="text-xs text-brand-400 hover:text-brand-300">
                              {tender.object_name}
                              {tender.object_city && ` · ${tender.object_city}`}
                            </Link>
                          )}
                          {tender.procuring_entity && (
                            <span className="text-xs text-zinc-500">{tender.procuring_entity}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      {tender.amount !== undefined && tender.amount > 0 && (
                        <p className="text-sm font-semibold text-zinc-100">
                          {formatCurrency(tender.amount, tender.currency || 'UAH')}
                        </p>
                      )}
                      {tender.deadline && (
                        <p className="text-xs text-zinc-500 mt-0.5">до {formatDate(tender.deadline)}</p>
                      )}
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
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="border-zinc-800"
              >
                Назад
              </Button>
              <span className="text-sm text-zinc-500">{page} / {data.pages}</span>
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
