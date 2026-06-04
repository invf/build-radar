'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Building, Search, ExternalLink, Pencil, Trash2, Globe } from 'lucide-react'
import Link from 'next/link'
import { companiesApi } from '@/lib/api/companies'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Company, CompanyRole, RelationshipStatus } from '@/types'
import { CompanyFormModal } from '@/components/companies/company-form-modal'

const RELATIONSHIP_OPTIONS: { value: RelationshipStatus | ''; label: string }[] = [
  { value: '', label: 'Відносини...' },
  { value: 'active', label: 'Працюємо' },
  { value: 'prospect', label: 'Перспективний' },
  { value: 'inactive', label: 'Не працюємо' },
]

const RELATIONSHIP_CARD_CLASSES: Record<RelationshipStatus, string> = {
  active: 'border-green-500/50 bg-green-950/20 hover:border-green-400/70',
  prospect: 'border-yellow-500/50 bg-yellow-950/20 hover:border-yellow-400/70',
  inactive: 'border-red-500/50 bg-red-950/20 hover:border-red-400/70',
}

const RELATIONSHIP_SELECT_CLASSES: Record<RelationshipStatus, string> = {
  active: 'border-green-500/50 text-green-400',
  prospect: 'border-yellow-500/50 text-yellow-400',
  inactive: 'border-red-500/50 text-red-400',
}

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

function CompanyCard({
  company,
  onEdit,
  onDelete,
}: {
  company: Company
  onEdit: (company: Company) => void
  onDelete: (id: string) => void
}) {
  const qc = useQueryClient()
  const [localStatus, setLocalStatus] = useState<RelationshipStatus | ''>(
    company.relationship_status ?? ''
  )

  const statusMutation = useMutation({
    mutationFn: (status: RelationshipStatus | '') =>
      companiesApi.update(company.id, { relationship_status: status || null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation()
    const status = e.target.value as RelationshipStatus | ''
    setLocalStatus(status)
    statusMutation.mutate(status)
  }

  const cardBorderClass = localStatus
    ? RELATIONSHIP_CARD_CLASSES[localStatus]
    : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900'

  const selectClass = localStatus
    ? RELATIONSHIP_SELECT_CLASSES[localStatus]
    : 'border-zinc-700 text-zinc-500'

  return (
    <div className={`group relative rounded-xl border p-4 transition-all ${cardBorderClass}`}>
      <div className="flex items-start justify-between gap-3">
        <Link href={`/companies/${company.id}`} className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 group-hover:bg-zinc-700 transition-colors overflow-hidden">
            {company.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logo_url}
                alt={company.name}
                className="h-10 w-10 object-cover"
              />
            ) : (
              <Building className="h-5 w-5 text-zinc-400" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100 truncate group-hover:text-white">
              {company.name}
            </p>
            {company.edrpou && (
              <p className="text-xs text-zinc-500 mt-0.5">ЄДРПОУ: {company.edrpou}</p>
            )}
          </div>
        </Link>

        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-500 hover:text-zinc-100"
            onClick={() => onEdit(company)}
            title="Редагувати"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-500 hover:text-red-400"
            onClick={() => onDelete(company.id)}
            title="Видалити"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Link href={`/companies/${company.id}`} tabIndex={-1}>
            <ExternalLink className="h-4 w-4 text-zinc-600 hover:text-zinc-400 transition-colors ml-0.5" />
          </Link>
        </div>
      </div>

      {/* Website link */}
      {company.website && (
        <div className="mt-2">
          <a
            href={company.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors truncate"
          >
            <Globe className="h-3 w-3 shrink-0" />
            <span className="truncate">{company.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
          </a>
        </div>
      )}

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
          <span className="text-xs font-medium text-brand-400">
            AI {Math.round(company.ai_score * 100)}
          </span>
        )}
        <select
          value={localStatus}
          onChange={handleStatusChange}
          onClick={(e) => e.stopPropagation()}
          disabled={statusMutation.isPending}
          className={`ml-auto text-xs rounded-md px-2 py-0.5 border outline-none cursor-pointer bg-zinc-900 transition-colors disabled:opacity-50 ${selectClass}`}
        >
          {RELATIONSHIP_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-100">
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default function CompaniesPage() {
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [type, setType] = useState<string>('all')

  useEffect(() => {
    const q = searchParams.get('search')
    if (q) setSearch(q)
  }, [searchParams])
  const [page, setPage] = useState(1)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const qc = useQueryClient()

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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => companiesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
    onError: (err: Error) => window.alert(`Помилка видалення: ${err.message}`),
  })

  const handleEdit = (company: Company) => {
    setEditingCompany(company)
    setEditModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Видалити компанію? Цю дію неможливо скасувати.')) return
    deleteMutation.mutate(id)
  }

  const handleEditModalChange = (open: boolean) => {
    setEditModalOpen(open)
    if (!open) setEditingCompany(null)
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Компанії</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {data?.total ? `${data.total.toLocaleString('uk-UA')} компаній` : 'Завантаження...'}
          </p>
        </div>
        <CompanyFormModal />
      </div>

      {/* Edit modal (edit mode, no trigger button) */}
      {editingCompany && (
        <CompanyFormModal
          initialData={editingCompany}
          open={editModalOpen}
          onOpenChange={handleEditModalChange}
        />
      )}

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
              <CompanyCard
                key={company.id}
                company={company}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
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
