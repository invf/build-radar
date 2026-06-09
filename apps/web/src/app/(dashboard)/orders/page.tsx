'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { format } from 'date-fns'
import { Trash2, CheckSquare, RotateCcw, Pencil, Plus, MapPin, Calendar, Building2, Package, Factory } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { OrderFormModal } from '@/components/orders/order-form-modal'
import { ManufacturerFormModal } from '@/components/manufacturers/manufacturer-form-modal'
import { ordersApi, type Order, type OrderStatus } from '@/lib/api/orders'
import { manufacturersApi, type Manufacturer } from '@/lib/api/manufacturers'
import { cn } from '@/lib/utils/cn'

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

// ─── Shared props ─────────────────────────────────────────────────────────────

interface OrderItemProps {
  order: Order
  isCompleted: boolean
  manufacturers: Manufacturer[]
  onComplete: (id: string) => void
  onRestore: (id: string, status: 'in_progress' | 'planned') => void
  onDelete: (id: string) => void
}

// ─── Mobile Card ──────────────────────────────────────────────────────────────

function OrderCard({ order, isCompleted, manufacturers, onComplete, onRestore, onDelete }: OrderItemProps) {
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
      <div className={cn(
        'rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3 transition-colors',
        isCompleted && 'opacity-60',
      )}>
        {/* Header: date + actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {!isCompleted && (
              <input
                type="checkbox"
                checked={false}
                onChange={() => onComplete(order.id)}
                title="Позначити як виконано"
                className="h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-800 accent-brand-600 cursor-pointer"
              />
            )}
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Calendar className="h-3 w-3 shrink-0" />
              <span>{formatDate(order.date)}</span>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-200" title="Редагувати" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {isCompleted && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-200" title="Повернути в роботу" onClick={() => onRestore(order.id, 'in_progress')}>
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-red-400" title="Видалити" onClick={() => onDelete(order.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Customer */}
        {order.customer && (
          <button
            onClick={() => router.push(`/companies?search=${encodeURIComponent(order.customer!)}`)}
            className="flex items-center gap-2 text-left w-full"
          >
            <Building2 className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <span className="text-sm font-medium text-zinc-200 hover:text-brand-400 transition-colors truncate">
              {order.customer}
            </span>
          </button>
        )}

        {/* Object name */}
        {order.object_name && (
          <button
            onClick={() => router.push(`/objects?search=${encodeURIComponent(order.object_name!)}`)}
            className="flex items-center gap-2 text-left w-full"
          >
            <Package className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <span className="text-sm text-zinc-300 hover:text-brand-400 transition-colors truncate">
              {order.object_name}
            </span>
          </button>
        )}

        {/* Address */}
        {order.address && (
          mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-400" />
              <span className="text-xs text-zinc-400 hover:text-brand-400 transition-colors truncate">
                {order.address}
              </span>
            </a>
          ) : (
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
              <span className="text-xs text-zinc-500 truncate">{order.address}</span>
            </div>
          )
        )}

        {/* Meta row: equipment + manufacturer + production date */}
        {(order.equipment_count || order.manufacturer || order.production_date) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-zinc-800">
            {order.equipment_count && (
              <span className="text-xs text-zinc-500">
                Облад.: <span className="text-zinc-300">{order.equipment_count}</span>
              </span>
            )}
            {order.manufacturer && (
              <button
                className={cn(
                  'flex items-center gap-1 text-xs',
                  foundManufacturer ? 'text-zinc-300 hover:text-brand-400' : 'text-zinc-500 cursor-default'
                )}
                onClick={() => foundManufacturer && setManufacturerOpen(true)}
                disabled={!foundManufacturer}
              >
                <Factory className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[120px]">{order.manufacturer}</span>
              </button>
            )}
            {order.production_date && (
              <span className="text-xs text-zinc-500">
                Вигот.: <span className="text-zinc-300">{formatDate(order.production_date)}</span>
              </span>
            )}
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <p className="text-xs text-zinc-600 line-clamp-2 pt-0.5">{order.notes}</p>
        )}
      </div>

      <OrderFormModal open={editOpen} onOpenChange={setEditOpen} order={order} />
      {foundManufacturer && (
        <ManufacturerFormModal open={manufacturerOpen} onOpenChange={setManufacturerOpen} manufacturer={foundManufacturer} readOnly />
      )}
    </>
  )
}

// ─── Desktop Row ──────────────────────────────────────────────────────────────

function OrderRow({ order, isCompleted, manufacturers, onComplete, onRestore, onDelete }: OrderItemProps) {
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
            <button onClick={() => router.push(`/companies?search=${encodeURIComponent(order.customer!)}`)}
              className="text-zinc-200 font-medium hover:text-brand-400 transition-colors truncate block max-w-full text-left">
              {order.customer}
            </button>
          ) : <span className="text-zinc-600">—</span>}
        </td>
        <td className="px-4 py-3 max-w-[200px]">
          {order.object_name ? (
            <button onClick={() => router.push(`/objects?search=${encodeURIComponent(order.object_name!)}`)}
              className="text-zinc-300 hover:text-brand-400 transition-colors truncate block max-w-full text-left">
              {order.object_name}
            </button>
          ) : <span className="text-zinc-600">—</span>}
        </td>
        <td className="px-4 py-3 max-w-[180px]">
          {mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-zinc-400 hover:text-brand-400 transition-colors truncate">
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
              className={cn('truncate block max-w-full text-left transition-colors',
                foundManufacturer ? 'text-zinc-300 hover:text-brand-400' : 'text-zinc-500 cursor-default')}
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
        <ManufacturerFormModal open={manufacturerOpen} onOpenChange={setManufacturerOpen} manufacturer={foundManufacturer} readOnly />
      )}
    </>
  )
}

// ─── List (mobile cards + desktop table) ─────────────────────────────────────

interface OrdersListProps {
  orders: Order[]
  tab: OrderStatus
  manufacturers: Manufacturer[]
  onComplete: (id: string) => void
  onRestore: (id: string, status: 'in_progress' | 'planned') => void
  onDelete: (id: string) => void
}

function OrdersList({ orders, tab, manufacturers, onComplete, onRestore, onDelete }: OrdersListProps) {
  const isCompleted = tab === 'completed'
  const itemProps = { isCompleted, manufacturers, onComplete, onRestore, onDelete }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
        <CheckSquare className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Замовлень немає</p>
      </div>
    )
  }

  return (
    <>
      {/* Mobile: cards */}
      <div className="md:hidden space-y-3">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} {...itemProps} />
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-zinc-800">
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
              <OrderRow key={order.id} order={order} {...itemProps} />
            ))}
          </tbody>
        </table>
      </div>
    </>
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
    <div className="p-4 md:p-6 space-y-4 md:space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Замовлення</h1>
        <p className="text-sm text-zinc-500 mt-1">Управління виробничими замовленнями</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)} className="space-y-5">
        <TabsList className="w-full overflow-x-auto flex-nowrap justify-start gap-1">
          {(['in_progress', 'planned', 'completed'] as const).map((status) => (
            <TabsTrigger key={status} value={status} className="gap-2 shrink-0">
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

          <TabsTrigger value="map" className="gap-2 shrink-0">
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
            <OrdersList orders={byStatus(status)} tab={status} {...mutationProps} />
          </TabsContent>
        ))}

        <TabsContent value="completed" className="space-y-4">
          <p className="text-sm text-zinc-500">{counts.completed} виконаних замовлень</p>
          <OrdersList orders={byStatus('completed')} tab="completed" {...mutationProps} />
        </TabsContent>

        <TabsContent value="map">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
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
