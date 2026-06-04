'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { format } from 'date-fns'
import { Trash2, CheckSquare, RotateCcw, Pencil, Plus, MapPin, Database } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { OrderFormModal } from '@/components/orders/order-form-modal'
import { ManufacturerFormModal } from '@/components/manufacturers/manufacturer-form-modal'
import { ordersApi, type Order, type OrderStatus } from '@/lib/api/orders'
import { manufacturersApi, type Manufacturer } from '@/lib/api/manufacturers'
import { cn } from '@/lib/utils/cn'
import Link from 'next/link'

type ActiveTab = OrderStatus | 'map'

const CombinedMapClient = dynamic(
  () => import('@/components/map/combined-map-client').then((m) => m.CombinedMapClient),
  {
    ssr: false,
    loading: () => (
      <div className="h-[calc(100vh-260px)] min-h-[400px] rounded-xl border border-zinc-800 bg-zinc-900 animate-pulse" />
    ),
  }
)

const STATUS_LABELS: Record<OrderStatus, string> = {
  in_progress: 'В роботі',
  planned: 'Планується',
  completed: 'Виконано',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try { return format(new Date(iso), 'dd.MM.yyyy') } catch { return '—' }
}

// ─── Row ──────────────────────────────────────────────────────────────────────

interface OrderRowProps {
  order: Order
  isCompleted: boolean
  manufacturers: Manufacturer[]
  onComplete: (id: string) => void
  onRestore: (id: string, status: 'in_progress' | 'planned') => void
  onDelete: (id: string) => void
}

function OrderRow({ order, isCompleted, manufacturers, onComplete, onRestore, onDelete }: OrderRowProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [manufacturerOpen, setManufacturerOpen] = useState(false)

  const foundManufacturer = order.manufacturer
    ? manufacturers.find((m) => m.name === order.manufacturer)
    : undefined

  const mapsUrl = order.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`
    : null

  return (
    <>
      <tr className={cn('group transition-colors hover:bg-zinc-800/30', isCompleted && 'opacity-60')}>
        {!isCompleted && (
          <td className="px-3 py-3">
            <input
              type="checkbox"
              checked={false}
              onChange={() => onComplete(order.id)}
              title="Позначити як виконано"
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-brand-600 cursor-pointer"
            />
          </td>
        )}

        <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">{formatDate(order.date)}</td>

        <td className="px-4 py-3 whitespace-nowrap max-w-[160px]">
          {order.customer ? (
            <button
              onClick={() => router.push(`/companies?search=${encodeURIComponent(order.customer!)}`)}
              className="text-zinc-200 font-medium hover:text-brand-400 transition-colors truncate block max-w-full text-left"
              title={`Відкрити компанію: ${order.customer}`}
            >
              {order.customer}
            </button>
          ) : <span className="text-zinc-600">—</span>}
        </td>

        <td className="px-4 py-3 max-w-[200px]">
          {order.object_name ? (
            <button
              onClick={() => router.push(`/objects?search=${encodeURIComponent(order.object_name!)}`)}
              className="text-zinc-300 hover:text-brand-400 transition-colors truncate block max-w-full text-left"
              title={`Відкрити об'єкт: ${order.object_name}`}
            >
              {order.object_name}
            </button>
          ) : <span className="text-zinc-600">—</span>}
        </td>

        <td className="px-4 py-3 max-w-[180px]">
          {mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-zinc-400 hover:text-brand-400 transition-colors truncate" title="Відкрити на карті">
              <MapPin className="h-3 w-3 text-brand-400 shrink-0" />
              <span className="truncate">{order.address}</span>
            </a>
          ) : <span className="text-zinc-600">—</span>}
        </td>

        <td className="px-4 py-3 text-zinc-300 text-center">{order.equipment_count || '—'}</td>

        <td className="px-4 py-3 max-w-[160px]">
          {order.manufacturer ? (
            <button
              onClick={() => setManufacturerOpen(true)}
              className={cn(
                'truncate block max-w-full text-left transition-colors',
                foundManufacturer ? 'text-zinc-300 hover:text-brand-400' : 'text-zinc-500 cursor-default'
              )}
              title={foundManufacturer ? `Деталі: ${order.manufacturer}` : order.manufacturer}
              disabled={!foundManufacturer}
            >
              {order.manufacturer}
            </button>
          ) : <span className="text-zinc-600">—</span>}
        </td>

        <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">{formatDate(order.production_date)}</td>
        <td className="px-4 py-3 text-zinc-400 max-w-[200px] truncate">{order.notes || '—'}</td>

        <td className="px-3 py-3">
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" title="Редагувати" className="h-7 w-7 text-zinc-500 hover:text-zinc-200" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {isCompleted && (
              <Button variant="ghost" size="icon" title="Повернути в роботу" className="h-7 w-7 text-zinc-500 hover:text-zinc-200" onClick={() => onRestore(order.id, 'in_progress')}>
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" title="Видалити" className="h-7 w-7 text-zinc-500 hover:text-red-400" onClick={() => onDelete(order.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>

      <OrderFormModal open={editOpen} onOpenChange={setEditOpen} order={order} />

      {foundManufacturer && (
        <ManufacturerFormModal
          open={manufacturerOpen}
          onOpenChange={setManufacturerOpen}
          manufacturer={foundManufacturer}
          readOnly
        />
      )}
    </>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────

interface OrdersTableProps {
  orders: Order[]
  tab: OrderStatus
  manufacturers: Manufacturer[]
  onComplete: (id: string) => void
  onRestore: (id: string, status: 'in_progress' | 'planned') => void
  onDelete: (id: string) => void
}

function OrdersTable({ orders, tab, manufacturers, onComplete, onRestore, onDelete }: OrdersTableProps) {
  const isCompleted = tab === 'completed'

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
        <CheckSquare className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Замовлень немає</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/60">
            {!isCompleted && <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500 w-10">Вик.</th>}
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 whitespace-nowrap">Дата</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 whitespace-nowrap">Замовник</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 whitespace-nowrap">Назва об&apos;єкту</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Адреса</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 whitespace-nowrap">К-ть обл.</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 whitespace-nowrap">Виробництво</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 whitespace-nowrap">Дата виготовл.</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Примітки</th>
            <th className="px-3 py-3 w-24" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              isCompleted={isCompleted}
              manufacturers={manufacturers}
              onComplete={onComplete}
              onRestore={onRestore}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Add button ───────────────────────────────────────────────────────────────

function AddOrderButton({ status }: { status: 'in_progress' | 'planned' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="brand" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Додати замовлення
      </Button>
      <OrderFormModal open={open} onOpenChange={setOpen} defaultStatus={status} />
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function LocalDataBanner() {
  const [hasLocal, setHasLocal] = useState(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('buildradar-orders')
      if (!raw) return
      const parsed = JSON.parse(raw)
      const items = parsed?.state?.orders ?? []
      if (items.length > 0) setHasLocal(true)
    } catch { /* ignore */ }
  }, [])
  if (!hasLocal) return null
  return (
    <div className="flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-950/20 px-4 py-3 text-sm">
      <Database className="h-4 w-4 text-yellow-400 shrink-0" />
      <span className="text-yellow-200 flex-1">
        Знайдено замовлення у локальному сховищі браузера. Перенесіть їх у базу даних.
      </span>
      <Link href="/settings/migrate">
        <Button size="sm" variant="outline" className="border-yellow-500/40 text-yellow-300 hover:bg-yellow-950/40 shrink-0">
          Мігрувати
        </Button>
      </Link>
    </div>
  )
}

export default function OrdersPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<ActiveTab>('in_progress')

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.list(),
    staleTime: 30_000,
  })

  const { data: manufacturers = [] } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: () => manufacturersApi.list(),
    staleTime: 60_000,
  })

  const completeMutation = useMutation({
    mutationFn: ordersApi.complete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })

  const restoreMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'in_progress' | 'planned' }) =>
      ordersApi.restore(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: ordersApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })

  const byStatus = (status: OrderStatus) => orders.filter((o) => o.status === status)

  const counts = {
    in_progress: byStatus('in_progress').length,
    planned: byStatus('planned').length,
    completed: byStatus('completed').length,
    map: orders.filter((o) => o.lat && o.lng).length,
  }

  const mutationProps = {
    manufacturers,
    onComplete: (id: string) => completeMutation.mutate(id),
    onRestore: (id: string, status: 'in_progress' | 'planned') => restoreMutation.mutate({ id, status }),
    onDelete: (id: string) => {
      if (!window.confirm('Видалити замовлення?')) return
      deleteMutation.mutate(id)
    },
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Замовлення</h1>
        <p className="text-sm text-zinc-500 mt-1">Управління виробничими замовленнями</p>
      </div>
      <LocalDataBanner />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)} className="space-y-5">
        <TabsList className="gap-1">
          {(['in_progress', 'planned', 'completed'] as const).map((status) => (
            <TabsTrigger key={status} value={status} className="gap-2">
              {STATUS_LABELS[status]}
              {counts[status] > 0 && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                  activeTab === status ? 'bg-brand-600/30 text-brand-300' : 'bg-zinc-700 text-zinc-400'
                )}>
                  {counts[status]}
                </span>
              )}
            </TabsTrigger>
          ))}

          <TabsTrigger value="map" className="gap-2">
            <MapPin className="h-3.5 w-3.5" />
            Мапа
            {counts.map > 0 && (
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                activeTab === 'map' ? 'bg-brand-600/30 text-brand-300' : 'bg-zinc-700 text-zinc-400'
              )}>
                {counts.map}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {(['in_progress', 'planned'] as const).map((status) => (
          <TabsContent key={status} value={status} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">{counts[status]} замовлень</p>
              <AddOrderButton status={status} />
            </div>
            <OrdersTable orders={byStatus(status)} tab={status} {...mutationProps} />
          </TabsContent>
        ))}

        <TabsContent value="completed" className="space-y-4">
          <p className="text-sm text-zinc-500">{counts.completed} виконаних замовлень</p>
          <OrdersTable orders={byStatus('completed')} tab="completed" {...mutationProps} />
        </TabsContent>

        <TabsContent value="map">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">{counts.map} з {orders.length} замовлень мають геолокацію</p>
              <p className="text-xs text-zinc-600">Геолокація встановлюється автоматично при вказуванні адреси</p>
            </div>
            <CombinedMapClient orders={orders} mapPoints={[]} height="calc(100vh - 260px)" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
