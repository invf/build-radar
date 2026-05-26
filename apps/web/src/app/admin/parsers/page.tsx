'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Zap, Play, RefreshCw, CheckCircle, XCircle, Clock,
  AlertTriangle, Database, ChevronDown, ChevronRight,
} from 'lucide-react'
import { useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatRelative } from '@/lib/utils/format'
import type { ParserLog, ParserStatus } from '@/types'

interface ParserInfo {
  source: string
  label: string
  description: string
  schedule: string
  last_run?: ParserLog
  next_run?: string
}

const STATUS_CONFIG: Record<ParserStatus, { label: string; color: string; icon: React.ElementType }> = {
  running: { label: 'Виконується', color: 'text-yellow-400', icon: RefreshCw },
  completed: { label: 'Завершено', color: 'text-green-400', icon: CheckCircle },
  failed: { label: 'Помилка', color: 'text-red-400', icon: XCircle },
  scheduled: { label: 'Очікує', color: 'text-zinc-400', icon: Clock },
}

function ParserCard({ info, onRun, isRunning }: {
  info: ParserInfo
  onRun: (source: string) => void
  isRunning: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const log = info.last_run
  const cfg = log ? STATUS_CONFIG[log.status] : null
  const Icon = cfg?.icon || Clock

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full shrink-0 mt-0.5 ${
              log?.status === 'completed' ? 'bg-green-400' :
              log?.status === 'running' ? 'bg-yellow-400 animate-pulse' :
              log?.status === 'failed' ? 'bg-red-400' : 'bg-zinc-600'
            }`} />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-zinc-100">{info.label}</p>
                {cfg && (
                  <Badge variant="outline" className={`text-xs ${cfg.color} border-current/30 gap-1`}>
                    <Icon className={`h-3 w-3 ${log?.status === 'running' ? 'animate-spin' : ''}`} />
                    {cfg.label}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">{info.description}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRun(info.source)}
            disabled={isRunning || log?.status === 'running'}
            className="border-zinc-700 text-zinc-400 hover:text-zinc-100 gap-1.5 shrink-0"
          >
            {isRunning || log?.status === 'running' ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Запустити
          </Button>
        </div>

        {log && (
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-zinc-800/50 p-2.5 text-center">
              <p className="text-lg font-bold text-zinc-100">{log.objects_created}</p>
              <p className="text-[10px] text-zinc-500">Нових</p>
            </div>
            <div className="rounded-lg bg-zinc-800/50 p-2.5 text-center">
              <p className="text-lg font-bold text-zinc-100">{log.objects_updated}</p>
              <p className="text-[10px] text-zinc-500">Оновлено</p>
            </div>
            <div className="rounded-lg bg-zinc-800/50 p-2.5 text-center">
              <p className="text-lg font-bold text-zinc-100">{log.objects_found}</p>
              <p className="text-[10px] text-zinc-500">Знайдено</p>
            </div>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between">
          <div className="text-xs text-zinc-600">
            {info.schedule} · {log ? formatRelative(log.started_at) : 'Ще не запускався'}
          </div>
          {log?.errors && (log.errors as unknown[]).length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
            >
              <AlertTriangle className="h-3 w-3" />
              {(log.errors as unknown[]).length} помилок
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>

      {expanded && log?.errors && (
        <div className="border-t border-zinc-800 p-4">
          <p className="text-xs text-zinc-500 mb-2">Журнал помилок:</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {(log.errors as string[]).map((err, i) => (
              <p key={i} className="text-xs text-red-400 font-mono bg-red-950/20 rounded p-1.5">{err}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ParsersPage() {
  const qc = useQueryClient()

  const { data: logs, isLoading } = useQuery({
    queryKey: ['parser-logs'],
    queryFn: () => apiFetch<{ items: ParserLog[] }>('/admin/parsers/logs'),
    refetchInterval: 15_000,
  })

  const runMutation = useMutation({
    mutationFn: (source: string) =>
      apiFetch<void>(`/admin/parsers/${source}/run`, { method: 'POST' }),
    onSuccess: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: ['parser-logs'] }), 2000)
    },
  })

  const lastBySource = (logs?.items || []).reduce<Record<string, ParserLog>>((acc, log) => {
    if (!acc[log.source] || new Date(log.started_at) > new Date(acc[log.source].started_at)) {
      acc[log.source] = log
    }
    return acc
  }, {})

  const parsers: ParserInfo[] = [
    {
      source: 'edesb',
      label: 'ЄДЕССБ',
      description: 'Єдиний державний електронний реєстр у сфері будівництва',
      schedule: 'Кожні 15 хв',
      last_run: lastBySource['edesb'],
    },
    {
      source: 'prozorro',
      label: 'Prozorro',
      description: 'Тендери публічних закупівель будівельної галузі',
      schedule: 'Щогодини',
      last_run: lastBySource['prozorro'],
    },
    {
      source: 'data_gov',
      label: 'data.gov.ua',
      description: 'Відкриті дані держреєстрів та облік нерухомості',
      schedule: 'Кожні 6 год',
      last_run: lastBySource['data_gov'],
    },
  ]

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600/20">
            <Zap className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Парсери даних</h1>
            <p className="text-xs text-zinc-500">Статус збору та оновлення будівельних даних</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ['parser-logs'] })}
          className="border-zinc-800 text-zinc-400 gap-1.5"
        >
          <RefreshCw className="h-4 w-4" />
          Оновити
        </Button>
      </div>

      {/* Parser cards */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {parsers.map((parser) => (
            <ParserCard
              key={parser.source}
              info={parser}
              onRun={(source) => runMutation.mutate(source)}
              isRunning={runMutation.isPending && runMutation.variables === parser.source}
            />
          ))}
        </div>
      )}

      {/* Recent logs table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4 text-zinc-400" />
            Журнал запусків
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="text-left py-2 px-3 text-zinc-500 font-medium">Джерело</th>
                    <th className="text-left py-2 px-3 text-zinc-500 font-medium">Статус</th>
                    <th className="text-left py-2 px-3 text-zinc-500 font-medium hidden md:table-cell">Знайдено</th>
                    <th className="text-left py-2 px-3 text-zinc-500 font-medium hidden md:table-cell">Нових</th>
                    <th className="text-left py-2 px-3 text-zinc-500 font-medium hidden lg:table-cell">Оновлено</th>
                    <th className="text-left py-2 px-3 text-zinc-500 font-medium">Час</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {(logs?.items || []).slice(0, 20).map((log) => {
                    const cfg = STATUS_CONFIG[log.status]
                    const Icon = cfg.icon
                    return (
                      <tr key={log.id} className="hover:bg-zinc-900/30">
                        <td className="py-2 px-3">
                          <span className="font-medium text-zinc-300 uppercase">{log.source}</span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`flex items-center gap-1 ${cfg.color}`}>
                            <Icon className={`h-3 w-3 ${log.status === 'running' ? 'animate-spin' : ''}`} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-2 px-3 hidden md:table-cell text-zinc-400">{log.objects_found}</td>
                        <td className="py-2 px-3 hidden md:table-cell text-green-400">+{log.objects_created}</td>
                        <td className="py-2 px-3 hidden lg:table-cell text-zinc-400">~{log.objects_updated}</td>
                        <td className="py-2 px-3 text-zinc-600">{formatDateTime(log.started_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {(!logs?.items || logs.items.length === 0) && (
                <p className="text-center py-8 text-zinc-600">Немає даних журналу</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
