'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, Building2, FileText, ShoppingCart, Zap, Clock, Info, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils/cn'
import { formatRelative } from '@/lib/utils/format'
import type { Notification, NotificationType } from '@/types'

interface NotificationsResponse {
  items: Notification[]
  total: number
  unread_count: number
}

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; label: string; color: string }> = {
  new_object: { icon: Building2, label: "Новий об'єкт", color: 'text-blue-400' },
  status_change: { icon: Building2, label: 'Зміна статусу', color: 'text-yellow-400' },
  new_permit: { icon: FileText, label: 'Новий дозвіл', color: 'text-green-400' },
  new_tender: { icon: ShoppingCart, label: 'Новий тендер', color: 'text-orange-400' },
  ai_insight: { icon: Zap, label: 'AI аналіз', color: 'text-purple-400' },
  reminder: { icon: Clock, label: 'Нагадування', color: 'text-brand-400' },
  system: { icon: Info, label: 'Система', color: 'text-zinc-400' },
}

export default function AlertsPage() {
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', showUnreadOnly],
    queryFn: () =>
      apiFetch<NotificationsResponse>('/notifications', {
        params: { unread_only: showUnreadOnly, page_size: 50 },
      }),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllReadMutation = useMutation({
    mutationFn: () =>
      apiFetch<void>('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unreadCount = data?.unread_count ?? 0

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-zinc-100">Сповіщення</h1>
          {unreadCount > 0 && (
            <Badge className="bg-brand-600 text-white text-xs">{unreadCount}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={cn('text-zinc-400 gap-1.5', showUnreadOnly && 'text-brand-400')}
          >
            {showUnreadOnly ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            {showUnreadOnly ? 'Непрочитані' : 'Всі'}
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="border-zinc-800 text-zinc-400 gap-1.5"
            >
              <CheckCheck className="h-4 w-4" />
              Прочитати всі
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {data?.items.map((notification) => {
            const cfg = TYPE_CONFIG[notification.type]
            const Icon = cfg.icon
            return (
              <div
                key={notification.id}
                className={cn(
                  'rounded-xl border p-4 transition-all',
                  notification.is_read
                    ? 'border-zinc-800 bg-zinc-900/20'
                    : 'border-zinc-700 bg-zinc-900/60'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('mt-0.5 shrink-0', cfg.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={cn('text-sm font-medium', notification.is_read ? 'text-zinc-300' : 'text-zinc-100')}>
                          {notification.title}
                        </p>
                        <p className={cn('text-xs mt-0.5 leading-relaxed', notification.is_read ? 'text-zinc-600' : 'text-zinc-400')}>
                          {notification.body}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-zinc-600">
                          {formatRelative(notification.created_at)}
                        </span>
                        {!notification.is_read && (
                          <button
                            onClick={() => markReadMutation.mutate(notification.id)}
                            className="h-2 w-2 rounded-full bg-brand-500 hover:bg-brand-400 transition-colors shrink-0"
                            title="Позначити прочитаним"
                          />
                        )}
                      </div>
                    </div>
                    {notification.related_object_id && (
                      <Link
                        href={`/objects/${notification.related_object_id}`}
                        className="inline-block mt-1.5 text-xs text-brand-400 hover:text-brand-300"
                      >
                        Переглянути об&apos;єкт →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {data?.items.length === 0 && (
            <div className="text-center py-16">
              <Bell className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">
                {showUnreadOnly ? 'Немає непрочитаних сповіщень' : 'Сповіщень поки немає'}
              </p>
              <p className="text-zinc-600 text-xs mt-1">
                Сповіщення з&apos;являться коли будуть нові об&apos;єкти або зміни
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
