'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  MapPin,
  Building2,
  Calendar,
  ShoppingCart,
  ExternalLink,
  Star,
  Maximize2,
} from 'lucide-react'
import Link from 'next/link'
import { objectsApi } from '@/lib/api/objects'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { AIAnalysisCard } from '@/components/objects/ai-analysis-card'
import { NotePanel } from '@/components/objects/note-panel'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  CATEGORY_LABELS,
  COMPANY_ROLE_LABELS,
  formatDate,
  formatArea,
  formatRelative,
} from '@/lib/utils/format'

interface ObjectDetailPageProps {
  params: Promise<{ id: string }>
}

export default function ObjectDetailPage({ params }: ObjectDetailPageProps) {
  const { id } = use(params)

  const { data: object, isLoading } = useQuery({
    queryKey: ['object', id],
    queryFn: () => objectsApi.get(id),
  })

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4 md:space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!object) {
    return (
      <div className="p-6 text-center">
        <p className="text-zinc-500">Об&apos;єкт не знайдено</p>
        <Link href="/objects">
          <Button variant="outline" className="mt-4 border-zinc-800">Назад до списку</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/objects">
          <Button variant="ghost" size="sm" className="gap-1 text-zinc-500 hover:text-zinc-200 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Об&apos;єкти
          </Button>
        </Link>
      </div>

      {/* Object header */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 mb-3">
              <div className="h-12 w-12 rounded-xl bg-zinc-800 flex items-center justify-center text-2xl shrink-0">
                {object.category === 'residential' ? '🏢' :
                 object.category === 'commercial' ? '🏪' :
                 object.category === 'industrial' ? '🏭' : '🏗️'}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-zinc-100 leading-tight">{object.name}</h1>
                <div className="flex items-center gap-1.5 mt-1">
                  <MapPin className="h-4 w-4 text-zinc-500 shrink-0" />
                  <p className="text-zinc-400 text-sm">{object.address}, {object.city}</p>
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={STATUS_COLORS[object.status]} variant="outline">
                {STATUS_LABELS[object.status]}
              </Badge>
              <Badge variant="muted">{CATEGORY_LABELS[object.category]}</Badge>
              {object.floors && (
                <Badge variant="outline" className="border-zinc-800 text-zinc-400">
                  <Building2 className="h-3 w-3 mr-1" />
                  {object.floors} поверхів
                </Badge>
              )}
              {object.building_area && (
                <Badge variant="outline" className="border-zinc-800 text-zinc-400">
                  <Maximize2 className="h-3 w-3 mr-1" />
                  {formatArea(object.building_area)}
                </Badge>
              )}
              {object.planned_completion && (
                <Badge variant="outline" className="border-zinc-800 text-zinc-400">
                  <Calendar className="h-3 w-3 mr-1" />
                  {formatDate(object.planned_completion)}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className={`border-zinc-800 gap-1 ${object.is_favorite ? 'text-yellow-400' : 'text-zinc-400'}`}
            >
              <Star className={`h-4 w-4 ${object.is_favorite ? 'fill-yellow-400' : ''}`} />
              {object.is_favorite ? 'В обраному' : 'До обраного'}
            </Button>
          </div>
        </div>

        {/* Source info */}
        <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center gap-4 text-xs text-zinc-600">
          <span>Джерело: <span className="text-zinc-500">{object.source}</span></span>
          {object.source_id && <span>ID: <span className="text-zinc-500">{object.source_id}</span></span>}
          <span>Оновлено: <span className="text-zinc-500">{formatRelative(object.updated_at)}</span></span>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details tabs */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="overview">
            <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
              <TabsTrigger value="overview">Огляд</TabsTrigger>
              <TabsTrigger value="companies">
                Компанії {object.companies?.length > 0 && `(${object.companies.length})`}
              </TabsTrigger>
              <TabsTrigger value="tenders">
                Тендери {object.tenders?.length > 0 && `(${object.tenders.length})`}
              </TabsTrigger>
              <TabsTrigger value="history">Історія</TabsTrigger>
            </TabsList>

            {/* Overview tab */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              {object.description && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
                  <h3 className="text-sm font-medium text-zinc-300 mb-2">Опис</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{object.description}</p>
                </div>
              )}

              {/* Details grid */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
                <h3 className="text-sm font-medium text-zinc-300 mb-4">Технічні дані</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Тип об\'єкта', value: object.object_type },
                    { label: 'Категорія', value: CATEGORY_LABELS[object.category] },
                    { label: 'Область', value: object.oblast },
                    { label: 'Район', value: object.district },
                    { label: 'Поверхів', value: object.floors },
                    { label: 'Площа будівлі', value: formatArea(object.building_area) },
                    { label: 'Площа ділянки', value: formatArea(object.land_area) },
                    { label: 'Стадія', value: object.construction_stage },
                    { label: 'Плановане завершення', value: formatDate(object.planned_completion) },
                    { label: 'Координати', value: object.coordinates ? `${object.coordinates.lat.toFixed(5)}, ${object.coordinates.lng.toFixed(5)}` : undefined },
                  ].filter((item) => item.value).map((item) => (
                    <div key={item.label}>
                      <p className="text-xs text-zinc-600 uppercase tracking-wider">{item.label}</p>
                      <p className="text-sm text-zinc-300 mt-0.5">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Analysis */}
              {object.ai_analysis && <AIAnalysisCard analysis={object.ai_analysis} />}
            </TabsContent>

            {/* Companies tab */}
            <TabsContent value="companies" className="mt-4 space-y-3">
              {object.companies?.length > 0 ? object.companies.map((oc) => (
                <Link key={oc.company.id} href={`/companies/${oc.company.id}`}>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100">
                            {oc.company.name}
                          </p>
                          {oc.is_primary && (
                            <Badge variant="brand" className="text-xs">Основна</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-zinc-500">ЄДРПОУ: {oc.company.edrpou}</span>
                          <Badge variant="outline" className="border-zinc-800 text-zinc-500 text-xs">
                            {COMPANY_ROLE_LABELS[oc.role]}
                          </Badge>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400 shrink-0" />
                    </div>
                  </div>
                </Link>
              )) : (
                <p className="text-zinc-500 text-sm text-center py-8">Компанії не визначені</p>
              )}
            </TabsContent>

            {/* Tenders tab */}
            <TabsContent value="tenders" className="mt-4 space-y-3">
              {object.tenders?.length > 0 ? object.tenders.map((tender) => (
                <div key={tender.id} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                  <div className="flex items-start gap-3">
                    <ShoppingCart className="h-5 w-5 text-yellow-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200">{tender.title}</p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <Badge
                          variant={tender.status === 'active' ? 'success' : 'muted'}
                          className="text-xs"
                        >
                          {tender.status}
                        </Badge>
                        {tender.amount && (
                          <span className="text-xs text-zinc-400">
                            {new Intl.NumberFormat('uk-UA', { style: 'currency', currency: tender.currency || 'UAH', maximumFractionDigits: 0 }).format(tender.amount)}
                          </span>
                        )}
                        {tender.deadline && (
                          <span className="text-xs text-zinc-600">до {formatDate(tender.deadline)}</span>
                        )}
                      </div>
                      {tender.procuring_entity && (
                        <p className="text-xs text-zinc-600 mt-1">{tender.procuring_entity}</p>
                      )}
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-zinc-500 text-sm text-center py-8">Тендери не знайдено</p>
              )}
            </TabsContent>

            {/* History tab */}
            <TabsContent value="history" className="mt-4">
              {object.status_history?.length > 0 ? (
                <div className="relative pl-4">
                  <div className="absolute left-0 top-0 bottom-0 w-px bg-zinc-800 ml-3" />
                  <div className="space-y-4">
                    {object.status_history.map((entry) => (
                      <div key={entry.id} className="relative flex items-start gap-3">
                        <div className="absolute -left-4 top-1.5 h-2 w-2 rounded-full bg-zinc-600 ring-2 ring-zinc-950" />
                        <div className="ml-2">
                          <p className="text-xs text-zinc-500">{formatDate(entry.changed_at)}</p>
                          <p className="text-sm text-zinc-300 mt-0.5">
                            <span className="text-zinc-500">{entry.field_name}: </span>
                            {entry.old_value && <><span className="line-through text-zinc-600">{entry.old_value}</span> → </>}
                            <span className="text-zinc-200">{entry.new_value}</span>
                          </p>
                          <p className="text-xs text-zinc-600 mt-0.5">Джерело: {entry.source}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-zinc-500 text-sm text-center py-8">Немає записів в історії</p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Map preview */}
          {object.coordinates && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
              <div className="h-48 bg-zinc-800 flex items-center justify-center">
                <Link href={`/map?object=${object.id}`}>
                  <Button variant="outline" size="sm" className="border-zinc-700 gap-1">
                    <MapPin className="h-4 w-4" />
                    Відкрити на карті
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Note panel */}
          <NotePanel objectId={object.id} />

          {/* Object meta */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Мета-дані</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-600">Додано</span>
                <span className="text-zinc-400">{formatDate(object.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Оновлено</span>
                <span className="text-zinc-400">{formatRelative(object.updated_at)}</span>
              </div>
              {object.source_id && (
                <div className="flex justify-between">
                  <span className="text-zinc-600">Ідентифікатор</span>
                  <span className="text-zinc-400 font-mono text-xs">{object.source_id}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
