'use client'

import { use } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building, Phone, Mail, Globe, MapPin, Star, ArrowLeft, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { companiesApi } from '@/lib/api/companies'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { CompanyRole } from '@/types'

const COMPANY_ROLE_LABELS: Record<CompanyRole, string> = {
  developer: 'Забудовник',
  general_contractor: 'Генеральний підрядник',
  subcontractor: 'Субпідрядник',
  designer: 'Проектувальник',
  engineering: 'Інжиніринг',
  technical_supervision: 'Технічний нагляд',
  architect: 'Архітектор',
  investor: 'Інвестор',
}

const STATUS_LABELS: Record<string, string> = {
  planned: 'Планується',
  approved: 'Затверджено',
  under_construction: 'Будується',
  completed: 'Завершено',
  suspended: 'Призупинено',
  cancelled: 'Скасовано',
}

const STATUS_COLORS: Record<string, string> = {
  planned: 'text-blue-400',
  approved: 'text-indigo-400',
  under_construction: 'text-yellow-400',
  completed: 'text-green-400',
  suspended: 'text-orange-400',
  cancelled: 'text-red-400',
}

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const qc = useQueryClient()

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: () => companiesApi.get(id),
  })

  const favMutation = useMutation({
    mutationFn: () =>
      company?.is_favorite ? companiesApi.unfavorite(id) : companiesApi.favorite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', id] }),
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (!company) {
    return (
      <div className="p-6 text-center py-16">
        <p className="text-zinc-500">Компанію не знайдено</p>
        <Link href="/companies">
          <Button variant="outline" className="mt-4 border-zinc-800">Назад до компаній</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/companies">
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100 -ml-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
            <Building className="h-6 w-6 text-zinc-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">{company.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {company.edrpou && (
                <span className="text-sm text-zinc-500">ЄДРПОУ: {company.edrpou}</span>
              )}
              {company.type && (
                <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">
                  {COMPANY_ROLE_LABELS[company.type as CompanyRole] || company.type}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => favMutation.mutate()}
          disabled={favMutation.isPending}
          className={`border-zinc-800 gap-1.5 ${company.is_favorite ? 'text-yellow-400 border-yellow-400/30' : 'text-zinc-400'}`}
        >
          <Star className={`h-4 w-4 ${company.is_favorite ? 'fill-yellow-400' : ''}`} />
          {company.is_favorite ? 'В обраних' : 'Додати в обрані'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Контакти</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {company.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-zinc-500 mt-0.5 shrink-0" />
                  <span className="text-zinc-300">{company.address}</span>
                </div>
              )}
              {company.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-zinc-500 shrink-0" />
                  <a href={`tel:${company.phone}`} className="text-brand-400 hover:text-brand-300">
                    {company.phone}
                  </a>
                </div>
              )}
              {company.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-zinc-500 shrink-0" />
                  <a href={`mailto:${company.email}`} className="text-brand-400 hover:text-brand-300">
                    {company.email}
                  </a>
                </div>
              )}
              {company.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-zinc-500 shrink-0" />
                  <a
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-400 hover:text-brand-300 flex items-center gap-1"
                  >
                    {company.website.replace(/^https?:\/\//, '')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {!company.address && !company.phone && !company.email && !company.website && (
                <p className="text-zinc-600 text-sm">Контактна інформація відсутня</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Статистика</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500">Проектів</span>
                <span className="text-sm font-medium text-zinc-100">{company.objects_count ?? 0}</span>
              </div>
              {company.ai_score !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">AI рейтинг</span>
                  <span className="text-sm font-medium text-brand-400">
                    {Math.round(company.ai_score * 100)} / 100
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent objects */}
        <div className="lg:col-span-2 space-y-4">
          {company.description && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Про компанію</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-300 leading-relaxed">{company.description}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Останні об&apos;єкти</CardTitle>
            </CardHeader>
            <CardContent>
              {company.recent_objects.length === 0 ? (
                <p className="text-zinc-600 text-sm">Об&apos;єктів не знайдено</p>
              ) : (
                <div className="space-y-2">
                  {company.recent_objects.map((obj) => (
                    <Link
                      key={obj.id}
                      href={`/objects/${obj.id}`}
                      className="flex items-center justify-between rounded-lg p-3 hover:bg-zinc-800/50 transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-200 truncate group-hover:text-zinc-100">{obj.name}</p>
                        {obj.city && <p className="text-xs text-zinc-500 mt-0.5">{obj.city}</p>}
                      </div>
                      <span className={`text-xs font-medium shrink-0 ml-3 ${STATUS_COLORS[obj.status] || 'text-zinc-400'}`}>
                        {STATUS_LABELS[obj.status] || obj.status}
                      </span>
                    </Link>
                  ))}
                  {(company.objects_count ?? 0) > company.recent_objects.length && (
                    <Link href={`/objects?company=${company.id}`}>
                      <Button variant="ghost" size="sm" className="w-full text-brand-400 hover:text-brand-300 mt-1">
                        Всі {company.objects_count} об&apos;єктів →
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
