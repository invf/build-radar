'use client'

import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from 'recharts'
import { objectsApi } from '@/lib/api/objects'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { RegionalStats } from '@/types'

const STATUS_COLORS = {
  under_construction: '#facc15',
  completed: '#4ade80',
  planned: '#60a5fa',
  approved: '#a78bfa',
  suspended: '#fb923c',
  cancelled: '#f87171',
}

const CATEGORY_LABELS: Record<string, string> = {
  residential: 'Житловий',
  commercial: 'Комерційний',
  industrial: 'Промисловий',
  infrastructure: 'Інфраструктура',
  social: 'Соціальний',
  mixed: 'Змішаний',
}

const CATEGORY_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#84cc16',
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 shadow-xl text-xs">
      <p className="text-zinc-300 font-medium mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.fill || p.color }}>
          {p.name}: {p.value?.toLocaleString('uk-UA')}
        </p>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: objectsApi.getDashboardStats,
    staleTime: 0,
    refetchOnMount: true,
  })

  const { data: regional, isLoading: regionalLoading } = useQuery({
    queryKey: ['regional-stats'],
    queryFn: objectsApi.getRegionalStats,
    staleTime: 0,
    refetchOnMount: true,
  })

  const regionalData = (regional as RegionalStats[] | undefined)?.slice(0, 15) || []

  const statusData = stats?.objects_by_status
    ? Object.entries(stats.objects_by_status).map(([status, count]) => ({
        name: {
          planned: 'Планується',
          approved: 'Затверджено',
          under_construction: 'Будується',
          completed: 'Завершено',
          suspended: 'Призупинено',
          cancelled: 'Скасовано',
        }[status] || status,
        value: count as number,
        fill: (STATUS_COLORS as Record<string, string>)[status] || '#71717a',
      }))
    : []

  const categoryData = stats?.objects_by_category
    ? Object.entries(stats.objects_by_category).map(([cat, count], i) => ({
        name: CATEGORY_LABELS[cat] || cat,
        value: count as number,
        fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }))
    : []

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Аналітика</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Розподіл будівельних об&apos;єктів по Україні</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (
          <>
            {[
              { label: "Всього об'єктів", value: stats?.total_objects, color: 'text-brand-400' },
              { label: 'Будується', value: stats?.under_construction, color: 'text-yellow-400' },
              { label: 'Активні тендери', value: stats?.active_tenders, color: 'text-orange-400' },
              { label: 'AI можливостей', value: stats?.ai_opportunities_count, color: 'text-purple-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="text-xs text-zinc-500">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>
                  {(value ?? 0).toLocaleString('uk-UA')}
                </p>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Статуси об&apos;єктів</CardTitle>
            <CardDescription>Кількість по кожному статусу</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-60 w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs text-zinc-400">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Категорії об&apos;єктів</CardTitle>
            <CardDescription>Розподіл за призначенням</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-60 w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 16, right: 16 }}>
                  <XAxis type="number" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Regional breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Регіональна статистика</CardTitle>
          <CardDescription>Розподіл по областях України (топ 15)</CardDescription>
        </CardHeader>
        <CardContent>
          {regionalLoading ? (
            <Skeleton className="h-80 w-full rounded-lg" />
          ) : regionalData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={regionalData} margin={{ top: 8, right: 16, bottom: 60, left: 0 }}>
                <XAxis
                  dataKey="oblast"
                  tick={{ fill: '#a1a1aa', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="under_construction" name="Будується" fill="#facc15" radius={[2, 2, 0, 0]} stackId="a" />
                <Bar dataKey="planned" name="Планується" fill="#60a5fa" radius={[0, 0, 0, 0]} stackId="a" />
                <Bar dataKey="completed" name="Завершено" fill="#4ade80" radius={[2, 2, 0, 0]} stackId="a" />
                <Legend
                  formatter={(value) => <span className="text-xs text-zinc-400">{value}</span>}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-zinc-600 text-sm text-center py-8">Дані відсутні</p>
          )}
        </CardContent>
      </Card>

      {/* Top cities table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Топ міст</CardTitle>
          <CardDescription>Найбільша кількість об&apos;єктів</CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
            </div>
          ) : (
            <div className="space-y-1">
              {stats?.top_cities?.map((item, i) => {
                const max = stats.top_cities[0]?.count || 1
                const pct = Math.round((item.count / max) * 100)
                return (
                  <div key={item.city} className="flex items-center gap-3 rounded-lg p-2 hover:bg-zinc-800/30 transition-colors">
                    <span className="text-xs font-bold text-zinc-600 w-5 text-right shrink-0">{i + 1}</span>
                    <span className="text-sm text-zinc-300 w-36 truncate shrink-0">{item.city}</span>
                    <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 w-12 text-right shrink-0">
                      {item.count.toLocaleString('uk-UA')}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
