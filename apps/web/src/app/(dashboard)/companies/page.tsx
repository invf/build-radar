'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building, Search, Star, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { companiesApi } from '@/lib/api/companies'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Company, CompanyRole } from '@/types'

const COMPANY_ROLE_LABELS: Record<CompanyRole, string> = {
  developer: 'Забудовник',
  general_contractor: 'Ген. підрядник',
  subcontractor: 'Субпідрядник',
  designer: 'Проектувальник',
  engineering: 'Інжиніринг',
  technical_supervision: 'Тех. нагляд',
  architect: 'Архітектор',
  investor: 'Інвестор',
}

function CompanyCard({ company }: { company: Company }) {
  return (
    <Link href={`/companies/${company.id}`}>
      <div className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-700 hover:bg-zinc-900 transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 group-hover:bg-zinc-700 transition-colors">
              <Building className="h-5 w-5 text-zinc-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-100 truncate group-hover:text-white">
                {company.name}
              </p>
              {company.edrpou && (
                <p className="text-xs text-zinc-500 mt-0.5">ЄДРПОУ: {company.edrpou}</p>
              )}
            </div>
          </div>
          <ExternalLink className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 shrink-0 mt-0.5 transition-colors" />
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {company.type && (
            <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
              {COMPANY_ROLE_LABELS[company.type as CompanyRole] || company.type}
            </Badge>
          )}
          {company.objects_count !== undefined && company.objects_count > 0 && (
            <span className="text-xs text-zinc-500">
              {company.objects_count} об{company.objects_count === 1 ? "'єкт" : "'єктів"}
            </span>
          )}
          {company.ai_score !== undefined && (
            <span className="ml-auto text-xs font-medium text-brand-400">
              AI {Math.round(company.ai_score * 100)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function CompaniesPage() {
  const [search, setSearch] = useState('')
  const [type, setType] = useState<string>('all')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['companies', search, type, page],
    queryFn: () =>
      companiesApi.list({
        search: search || undefined,
        type: type !== 'all' ? type : undefined,
        page,
        page_size: 24,
        sort_by: 'objects_count',
        sort_order: 'desc',
      }),
  })

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Компанії</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {data?.total ? `${data.total.toLocaleString('uk-UA')} компаній` : 'Завантаження...'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Пошук за назвою або ЄДРПОУ..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1) }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Тип компанії" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всі типи</SelectItem>
            {Object.entries(COMPANY_ROLE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data?.items.map((company) => (
              <CompanyCard key={company.id} company={company} />
            ))}
          </div>

          {data?.items.length === 0 && (
            <div className="text-center py-16">
              <p className="text-zinc-500 text-sm">Компаній не знайдено</p>
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
