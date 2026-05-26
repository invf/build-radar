'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  TrendingUp,
  FileText,
  ShoppingCart,
  Zap,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { objectsApi } from '@/lib/api/objects'
import { StatsCard } from '@/components/dashboard/stats-card'
import { RecentObjects } from '@/components/dashboard/recent-objects'
import { StatusChart } from '@/components/analytics/status-chart'
import { TopCitiesChart } from '@/components/analytics/top-cities-chart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth'
import { formatRelative } from '@/lib/utils/format'

export default function DashboardPage() {
  const { user } = useAuthStore()

  const { data: stats, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: objectsApi.getDashboardStats,
    refetchInterval: 5 * 60 * 1000,
  })

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Вітаємо, {user?.full_name?.split(' ')[0] || 'Користувач'} 👋
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Огляд будівельного ринку України
            {dataUpdatedAt > 0 && (
              <span className="ml-2">· Оновлено {formatRelative(new Date(dataUpdatedAt).toISOString())}</span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="border-zinc-800 text-zinc-400 hover:text-zinc-100"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Оновити
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        ) : (
          <>
            <StatsCard
              title="Всього об'єктів"
              value={stats?.total_objects ?? 0}
              icon={Building2}
              subtitle="У базі даних"
              variant="brand"
            />
            <StatsCard
              title="Нових сьогодні"
              value={stats?.new_today ?? 0}
              icon={TrendingUp}
              subtitle="За останні 24 год"
              variant="success"
              trend={{ value: 12, label: 'vs вчора' }}
            />
            <StatsCard
              title="Активні тендери"
              value={stats?.active_tenders ?? 0}
              icon={ShoppingCart}
              subtitle="Prozorro"
              variant="warning"
            />
            <StatsCard
              title="AI можливостей"
              value={stats?.ai_opportunities_count ?? 0}
              icon={Zap}
              subtitle="Виявлено ШІ"
              variant="purple"
            />
          </>
        )}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <p className="text-xs text-zinc-500">Будується</p>
          <p className="text-xl font-bold text-yellow-400 mt-1">
            {isLoading ? <Skeleton className="h-7 w-16" /> : (stats?.under_construction ?? 0).toLocaleString('uk-UA')}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <p className="text-xs text-zinc-500">Дозволи (тижень)</p>
          <p className="text-xl font-bold text-blue-400 mt-1">
            {isLoading ? <Skeleton className="h-7 w-16" /> : (stats?.new_permits_week ?? 0).toLocaleString('uk-UA')}
          </p>
        </div>
        <div className="col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <p className="text-xs text-zinc-500 mb-2">Швидкі дії</p>
          <div className="flex gap-2 flex-wrap">
            <Link href="/objects?status=under_construction">
              <Button variant="outline" size="sm" className="border-zinc-700 text-xs">
                <Building2 className="h-3 w-3" />
                Будується
              </Button>
            </Link>
            <Link href="/tenders?status=active">
              <Button variant="outline" size="sm" className="border-zinc-700 text-xs">
                <ShoppingCart className="h-3 w-3" />
                Тендери
              </Button>
            </Link>
            <Link href="/permits">
              <Button variant="outline" size="sm" className="border-zinc-700 text-xs">
                <FileText className="h-3 w-3" />
                Дозволи
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Charts + Recent objects */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Статуси об&apos;єктів</CardTitle>
            <CardDescription>Розподіл за поточним статусом</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[220px] w-full rounded-lg" />
            ) : stats?.objects_by_status ? (
              <StatusChart data={stats.objects_by_status} />
            ) : null}
          </CardContent>
        </Card>

        {/* Top cities */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Топ міст</CardTitle>
            <CardDescription>Найбільше об&apos;єктів</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full rounded-lg" />
            ) : stats?.top_cities ? (
              <TopCitiesChart data={stats.top_cities} />
            ) : null}
          </CardContent>
        </Card>

        {/* Top developers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Топ забудовників</CardTitle>
            <CardDescription>За кількістю проектів</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))
            ) : stats?.top_developers?.map((item, i) => (
              <Link
                key={item.company.id}
                href={`/companies/${item.company.id}`}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-zinc-800/50 transition-colors group"
              >
                <span className="text-xs font-bold text-zinc-600 w-5 text-right shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 truncate group-hover:text-zinc-100">
                    {item.company.name}
                  </p>
                  <p className="text-xs text-zinc-500">ЄДРПОУ: {item.company.edrpou}</p>
                </div>
                <span className="text-xs font-medium text-zinc-400 shrink-0">
                  {item.objects_count}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent objects */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm">Нові об&apos;єкти</CardTitle>
            <CardDescription>Нещодавно додані до системи</CardDescription>
          </div>
          <Link href="/objects">
            <Button variant="ghost" size="sm" className="text-brand-400 hover:text-brand-300 gap-1">
              Всі об&apos;єкти
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <RecentObjects objects={stats?.recent_objects ?? []} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  )
}
