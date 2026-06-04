'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShoppingCart, Search, Clock, CheckCircle, XCircle,
  ExternalLink, Plus, Loader2, CheckCheck, AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'
import { prozorroApi, type ProzorroTender } from '@/lib/api/prozorro'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

const STATUS_LABEL: Record<string, string> = {
  active: 'Активний',
  complete: 'Завершено',
  cancelled: 'Скасовано',
  unsuccessful: 'Не відбувся',
}

// ── Вкладка 1: Тендери в системі ─────────────────────────────────────────────

function SystemTendersTab() {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          <div className="relative min-w-48 max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Пошук за назвою..."
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
        <TenderFormModal />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : (
        <>
          <p className="text-xs text-zinc-600">{data?.total?.toLocaleString('uk-UA') ?? 0} тендерів</p>
          <div className="space-y-2">
            {data?.items.map((tender) => {
              const cfg = STATUS_CONFIG[tender.status]
              const Icon = cfg.icon
              return (
                <div key={tender.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-700 transition-all">
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
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {tender.object_name && (
                          <Link href={`/objects/${tender.object_id}`} className="text-xs text-brand-400 hover:text-brand-300">
                            {tender.object_name}{tender.object_city && ` · ${tender.object_city}`}
                          </Link>
                        )}
                        {tender.procuring_entity && (
                          <span className="text-xs text-zinc-500">{tender.procuring_entity}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {tender.amount !== undefined && tender.amount > 0 && (
                        <p className="text-sm font-semibold text-zinc-100">{formatCurrency(tender.amount, tender.currency || 'UAH')}</p>
                      )}
                      {tender.deadline && <p className="text-xs text-zinc-500 mt-0.5">до {formatDate(tender.deadline)}</p>}
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

// ── Вкладка 2: Пошук Prozorro ─────────────────────────────────────────────────

const KEYWORD_PRESETS = [
  'теплообмінник', 'насоси', 'котел', 'вентиляція', 'кондиціонер',
  'опалення', 'трубопровід', 'ліфт', 'електромонтаж', 'вікна',
]

const CPV_PRESETS = [
  { label: 'Теплообмінники (42500000)', value: '42500000' },
  { label: 'Насоси (42122000)', value: '42122000' },
  { label: 'Котли (44621000)', value: '44621000' },
  { label: 'Опалення/Вентиляція (45331000)', value: '45331000' },
  { label: 'Будівельні роботи (45000000)', value: '45000000' },
  { label: 'Ліфти (42416000)', value: '42416000' },
  { label: 'Вікна/двері (44220000)', value: '44220000' },
]

function ProzorroSearchTab() {
  const qc = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [cpv, setCpv] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [submitted, setSubmitted] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savingId, setSavingId] = useState<string | null>(null)

  const { data: results = [], isLoading, error } = useQuery({
    queryKey: ['prozorro-search', keyword, cpv, statusFilter],
    queryFn: () => prozorroApi.search({
      q: keyword || undefined,
      cpv: cpv || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      limit: 50,
    }),
    enabled: submitted && (!!keyword || !!cpv),
    staleTime: 5 * 60_000,
    retry: false,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyword && !cpv) return
    setSubmitted(true)
  }

  const handlePreset = (kw: string) => { setKeyword(kw); setSubmitted(false) }
  const handleCpvPreset = (code: string) => { setCpv(code); setSubmitted(false) }

  const saveTender = async (t: ProzorroTender) => {
    setSavingId(t.prozorro_id)
    try {
      await apiFetch('/tenders', {
        method: 'POST',
        data: {
          prozorro_id: t.prozorro_id,
          title: t.title,
          status: t.status,
          amount: t.amount,
          currency: t.currency,
          deadline: t.deadline,
          procuring_entity: t.procuring_entity,
          procuring_entity_edrpou: t.procuring_entity_edrpou,
        },
      })
      setSavedIds(prev => new Set([...prev, t.prozorro_id]))
      qc.invalidateQueries({ queryKey: ['tenders'] })
    } catch {
      // likely duplicate — mark as already saved
      setSavedIds(prev => new Set([...prev, t.prozorro_id]))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Search form */}
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Ключове слово</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="теплообмінник, насоси, котел..."
                value={keyword}
                onChange={(e) => { setKeyword(e.target.value); setSubmitted(false) }}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {KEYWORD_PRESETS.map((kw) => (
                <button key={kw} type="button" onClick={() => handlePreset(kw)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${keyword === kw ? 'border-brand-500/50 bg-brand-500/10 text-brand-400' : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}`}>
                  {kw}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-zinc-500 font-medium uppercase tracking-wider">CPV / DK021 код</label>
            <Input
              placeholder="45331000, 42122000..."
              value={cpv}
              onChange={(e) => { setCpv(e.target.value); setSubmitted(false) }}
            />
            <div className="flex flex-wrap gap-1.5 mt-1">
              {CPV_PRESETS.map((p) => (
                <button key={p.value} type="button" onClick={() => handleCpvPreset(p.value)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${cpv === p.value ? 'border-brand-500/50 bg-brand-500/10 text-brand-400' : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Активні</SelectItem>
              <SelectItem value="all">Всі статуси</SelectItem>
              <SelectItem value="complete">Завершені</SelectItem>
            </SelectContent>
          </Select>

          <Button type="submit" variant="brand" disabled={(!keyword && !cpv) || isLoading} className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {isLoading ? 'Пошук...' : 'Знайти'}
          </Button>

          {results.length > 0 && (
            <span className="text-sm text-zinc-500">{results.length} результатів</span>
          )}
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Не вдалось отримати результати від Prozorro. Спробуйте пізніше.
        </div>
      )}

      {/* Results table */}
      {submitted && !isLoading && results.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Назва тендеру</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 whitespace-nowrap">Організатор</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 whitespace-nowrap">Сума</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 whitespace-nowrap">Дедлайн</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">CPV</th>
                <th className="px-3 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {results.map((t) => {
                const isSaved = savedIds.has(t.prozorro_id)
                const isSaving = savingId === t.prozorro_id
                return (
                  <tr key={t.prozorro_id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3 max-w-sm">
                      <p className="text-zinc-200 line-clamp-2 text-sm leading-snug">{t.title}</p>
                      {t.city && <p className="text-xs text-zinc-500 mt-0.5">{[t.city, t.oblast].filter(Boolean).join(', ')}</p>}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-zinc-300 text-xs line-clamp-2">{t.procuring_entity || '—'}</p>
                      {t.procuring_entity_edrpou && (
                        <p className="text-zinc-600 text-[10px] font-mono mt-0.5">{t.procuring_entity_edrpou}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {t.amount ? (
                        <span className="text-zinc-100 font-medium text-xs">{formatCurrency(t.amount, t.currency)}</span>
                      ) : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {t.deadline ? (
                        <span className="text-zinc-400 text-xs">{formatDate(t.deadline)}</span>
                      ) : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        t.status === 'active' ? 'border-green-500/30 text-green-400' :
                        t.status === 'complete' ? 'border-blue-500/30 text-blue-400' :
                        'border-zinc-700 text-zinc-500'
                      }`}>
                        {STATUS_LABEL[t.status] || t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[120px]">
                        {t.cpv_codes.slice(0, 2).map((c) => (
                          <span key={c} className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">{c.split('-')[0]}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <a href={t.prozorro_url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors" title="Відкрити на Prozorro">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <Button
                          size="sm"
                          variant={isSaved ? 'ghost' : 'outline'}
                          disabled={isSaved || isSaving}
                          onClick={() => saveTender(t)}
                          className={`h-7 px-2 text-xs gap-1 ${isSaved ? 'text-green-400 border-green-500/30' : 'border-zinc-700 text-zinc-300 hover:border-brand-500/50 hover:text-brand-400'}`}
                          title={isSaved ? 'Вже додано' : 'Додати до тендерів'}
                        >
                          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> :
                           isSaved ? <CheckCheck className="h-3 w-3" /> :
                           <Plus className="h-3 w-3" />}
                          {isSaved ? 'Додано' : 'Додати'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {submitted && !isLoading && results.length === 0 && !error && (
        <div className="text-center py-16 text-zinc-600">
          <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Нічого не знайдено. Спробуйте інше ключове слово або CPV код.</p>
        </div>
      )}

      {!submitted && (
        <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/20 p-6 text-center text-zinc-600">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Введіть ключове слово або CPV код і натисніть «Знайти»</p>
          <p className="text-xs mt-1 opacity-60">Пошук виконується напряму по реєстру Prozorro</p>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TendersPage() {
  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Тендери</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Prozorro — будівництво та постачання</p>
        </div>
        <a href="https://prozorro.gov.ua" target="_blank" rel="noopener noreferrer"
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1">
          prozorro.gov.ua <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <Tabs defaultValue="system" className="space-y-5">
        <TabsList>
          <TabsTrigger value="system">
            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
            Тендери в системі
          </TabsTrigger>
          <TabsTrigger value="search">
            <Search className="h-3.5 w-3.5 mr-1.5" />
            Пошук Prozorro
          </TabsTrigger>
        </TabsList>

        <TabsContent value="system">
          <SystemTendersTab />
        </TabsContent>

        <TabsContent value="search">
          <ProzorroSearchTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
