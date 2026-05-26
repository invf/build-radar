'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Search, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils/format'
import type { Permit, PermitType } from '@/types'

interface PermitWithObject extends Permit {
  object_name?: string
  object_city?: string
}

interface PermitsResponse {
  items: PermitWithObject[]
  total: number
  page: number
  pages: number
}

const PERMIT_TYPE_LABELS: Record<PermitType, string> = {
  construction_permit: 'Дозвіл на будівництво',
  readiness_declaration: 'Декларація готовності',
  urban_planning_conditions: 'Містобудівні умови',
  technical_conditions: 'Технічні умови',
  design_approval: 'Погодження проекту',
  expert_examination: 'Експертиза',
}

const PERMIT_TYPE_COLORS: Record<PermitType, string> = {
  construction_permit: 'border-green-500/30 text-green-400',
  readiness_declaration: 'border-blue-500/30 text-blue-400',
  urban_planning_conditions: 'border-purple-500/30 text-purple-400',
  technical_conditions: 'border-orange-500/30 text-orange-400',
  design_approval: 'border-yellow-500/30 text-yellow-400',
  expert_examination: 'border-zinc-500/30 text-zinc-400',
}

export default function PermitsPage() {
  const [search, setSearch] = useState('')
  const [permitType, setPermitType] = useState<string>('all')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['permits', search, permitType, page],
    queryFn: () =>
      apiFetch<PermitsResponse>('/permits', {
        params: {
          search: search || undefined,
          permit_type: permitType !== 'all' ? permitType : undefined,
          page,
          page_size: 24,
          sort_by: 'issued_date',
          sort_order: 'desc',
        },
      }),
  })

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Дозволи ЄДЕССБ</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {data?.total ? `${data.total.toLocaleString('uk-UA')} дозволів` : 'Завантаження...'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Номер дозволу..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select value={permitType} onValueChange={(v) => { setPermitType(v); setPage(1) }}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Тип дозволу" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всі типи</SelectItem>
            {Object.entries(PERMIT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Номер</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Тип</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden md:table-cell">Об&apos;єкт</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Орган</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Дата</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {data?.items.map((permit) => (
                  <tr key={permit.id} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-zinc-200">{permit.permit_number}</span>
                      {permit.series && (
                        <span className="ml-1 text-xs text-zinc-600">({permit.series})</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="outline"
                        className={`text-xs ${PERMIT_TYPE_COLORS[permit.permit_type]}`}
                      >
                        {PERMIT_TYPE_LABELS[permit.permit_type]}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      {permit.object_name ? (
                        <Link href={`/objects/${permit.object_id}`} className="text-zinc-300 hover:text-zinc-100 line-clamp-1">
                          {permit.object_name}
                          {permit.object_city && <span className="text-zinc-600 ml-1">· {permit.object_city}</span>}
                        </Link>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <span className="text-zinc-400 text-xs line-clamp-1">{permit.issuing_authority || '—'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-zinc-400 text-xs">{formatDate(permit.issued_date)}</span>
                    </td>
                    <td className="py-3 px-4">
                      {permit.document_url && (
                        <a href={permit.document_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-600 hover:text-zinc-300">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data?.items.length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">Дозволів не знайдено</p>
              </div>
            )}
          </div>

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
