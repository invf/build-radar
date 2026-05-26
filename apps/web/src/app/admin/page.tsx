'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Users, Zap, Database, Activity, Settings,
  Building2, Shield, BarChart3, ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { usersApi } from '@/lib/api/users'
import { apiFetch } from '@/lib/api/client'
import { objectsApi } from '@/lib/api/objects'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/utils/format'
import type { ParserLog } from '@/types'

function AdminCard({
  title,
  description,
  icon: Icon,
  href,
  badge,
}: {
  title: string
  description: string
  icon: React.ElementType
  href: string
  badge?: string
}) {
  return (
    <Link href={href}>
      <div className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-zinc-700 hover:bg-zinc-900 transition-all h-full">
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 group-hover:bg-zinc-700 transition-colors">
            <Icon className="h-5 w-5 text-zinc-400" />
          </div>
          {badge && (
            <Badge className="bg-brand-600/20 text-brand-400 border-brand-600/30 text-xs">{badge}</Badge>
          )}
        </div>
        <p className="mt-3 text-sm font-medium text-zinc-100">{title}</p>
        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{description}</p>
        <div className="mt-3 flex items-center text-xs text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity gap-1">
          Відкрити <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    </Link>
  )
}

export default function AdminPage() {
  const { data: users } = useQuery({
    queryKey: ['admin-users', { page: 1 }],
    queryFn: () => usersApi.list({ page: 1 }),
  })

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: objectsApi.getDashboardStats,
    staleTime: 60_000,
  })

  const { data: recentLogs } = useQuery({
    queryKey: ['parser-logs-recent'],
    queryFn: () => apiFetch<ParserLog[]>('/admin/parsers/logs?limit=3'),
    refetchInterval: 30_000,
  })

  const activeUsers = users?.items?.filter(u => u.is_active).length ?? 0

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600/20">
          <Shield className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Адмін панель</h1>
          <p className="text-xs text-zinc-500">Управління платформою BuildRadar</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Користувачів', value: users?.total ?? '—', icon: Users, color: 'text-blue-400' },
          { label: 'Активних', value: activeUsers, icon: Activity, color: 'text-green-400' },
          { label: "Об'єктів", value: stats?.total_objects?.toLocaleString('uk-UA') ?? '—', icon: Building2, color: 'text-brand-400' },
          { label: 'AI аналізів', value: stats?.ai_opportunities_count?.toLocaleString('uk-UA') ?? '—', icon: Zap, color: 'text-purple-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <Icon className={`h-4 w-4 ${color} mb-2`} />
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Nav cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AdminCard
          title="Користувачі"
          description="Керування акаунтами, запрошення, ролі та дозволи"
          icon={Users}
          href="/admin/users"
          badge={`${users?.total ?? 0}`}
        />
        <AdminCard
          title="Парсери"
          description="Статус збору даних ЄДЕССБ, Prozorro, data.gov.ua та журнали"
          icon={Zap}
          href="/admin/parsers"
        />
        <AdminCard
          title="База даних"
          description="Перегляд статистики таблиць та стан індексів"
          icon={Database}
          href="/admin/database"
        />
        <AdminCard
          title="Аналітика системи"
          description="Навантаження, час відповіді API, використання кешу"
          icon={BarChart3}
          href="/admin/metrics"
        />
        <AdminCard
          title="Аудит"
          description="Журнал дій користувачів та подій системи"
          icon={Activity}
          href="/admin/audit"
        />
        <AdminCard
          title="Налаштування системи"
          description="Параметри платформи, SMTP, Telegram, Sentry"
          icon={Settings}
          href="/admin/system"
        />
      </div>

      {/* Recent parser activity */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Остання активність парсерів</CardTitle>
          <Link href="/admin/parsers">
            <Button variant="ghost" size="sm" className="text-brand-400 hover:text-brand-300 gap-1 text-xs">
              Всі <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {!recentLogs ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : recentLogs.length === 0 ? (
            <p className="text-zinc-600 text-sm">Немає даних</p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-lg border border-zinc-800 p-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${
                      log.status === 'completed' ? 'bg-green-400' :
                      log.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                      log.status === 'failed' ? 'bg-red-400' : 'bg-zinc-600'
                    }`} />
                    <span className="text-sm text-zinc-300 font-medium uppercase">{log.source}</span>
                    <span className="text-xs text-zinc-600">
                      +{log.objects_created} / ~{log.objects_updated}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500">{formatDateTime(log.started_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
