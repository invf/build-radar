'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { format } from 'date-fns'
import { Trash2, CheckSquare, RotateCcw, Pencil, Plus, MapPin } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { OrderFormModal } from '@/components/orders/order-form-modal'
import { ManufacturerFormModal } from '@/components/manufacturers/manufacturer-form-modal'
import { useOrdersStore, Order, OrderStatus } from '@/stores/orders'
import { useManufacturersStore, Manufacturer } from '@/stores/manufacturers'
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

// ─── Row ──────────────────────────────────────────────────────────────────────

function OrderRow({ order, isCompleted }: { order: Order; isCompleted: boolean }) {
  const { completeOrder, restoreOrder, deleteOrder } = useOrdersStore()
  const manufacturers = useManufacturersStore((s) => s.manufacturers)
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [manufacturerOpen, setManufacturerOpen] = useState(false)

  const foundManufacturer: Manufacturer | undefined = order.manufacturer
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
              onChange={() => completeOrder(order.id)}
              title="Позначити як виконано"
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-brand-600 cursor-pointer"
            />
          </td>
        )}

        {/* Дата */}
        <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">{formatDate(order.date)}</td>

        {/* Замовник — переходить на /companies?search= */}
        <td className="px-4 py-3 whitespace-nowrap max-w-[160px]">
          {order.customer ? (
            <button
              onClick={() => router.push(`/companies?search=${encodeURIComponent(order.customer)}`)}
              className="text-zinc-200 font-medium hover:text-brand-400 transition-colors truncate block max-w-full text-left"
              title={`Відкрити компанію: ${order.customer}`}
            >
              {order.customer}
            </button>
          ) : <span className="text-zinc-600">—</span>}
        </td>

        {/* Об'єкт — переходить на /objects?search= */}
        <td className="px-4 py-3 max-w-[200px]">
          {order.objectName ? (
            <button
              onClick={() => router.push(`/objects?search=${encodeURIComponent(order.objectName)}`)}
              className="text-zinc-300 hover:text-brand-400 transition-colors truncate block max-w-full text-left"
              title={`Відкрити об'єкт: ${order.objectName}`}
            >
              {order.objectName}
            </button>
          ) : <span className="text-zinc-600">—</span>}
        </td>

        {/* Адреса — відкриває Google Maps */}
        <td className="px-4 py-3 max-w-[180px]">
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-zinc-400 hover:text-brand-400 transition-colors truncate"
              title="Відкрити на карті"
            >
              <MapPin className="h-3 w-3 text-brand-400 shrink-0" />
              <span className="truncate">{order.address}</span>
            </a>
          ) : (
            <span className="text-zinc-600">—</span>
          )}
        </td>

        {/* К-ть обл. */}
        <td className="px-4 py-3 text-zinc-300 text-center">{order.equipmentCount || '—'}</td>

        {/* Виробництво — відкриває модалку виробника */}
        <td className="px-4 py-3 max-w-[160px]">
          {order.manufacturer ? (
            <button
              onClick={() => setManufacturerOpen(true)}
              className={cn(
                'truncate block max-w-full text-left transition-colors',
                foundManufacturer
                  ? 'text-zinc-300 hover:text-brand-400'
                  : 'text-zinc-500 cursor-default'
              )}
              title={foundManufacturer ? `Деталі: ${order.manufacturer}` : order.manufacturer}
              disabled={!foundManufacturer}
            >
              {order.manufacturer}
            </button>
          ) : <span className="text-zinc-600">—</span>}
        </td>

        {/* Дата виготовлення */}
        <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">{formatDate(order.productionDate)}</td>

        {/* Примітки */}
        <td className="px-4 py-3 text-zinc-400 max-w-[200px] truncate">{order.notes || '—'}</td>

        {/* Дії */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              title="Редагувати"
              className="h-7 w-7 text-zinc-500 hover:text-zinc-200"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {isCompleted && (
              <Button
                variant="ghost"
                size="icon"
                title="Повернути в роботу"
                className="h-7 w-7 text-zinc-500 hover:text-zinc-200"
                onClick={() => restoreOrder(order.id, 'in_progress')}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              title="Видалити"
              className="h-7 w-7 text-zinc-500 hover:text-red-400"
              onClick={() => deleteOrder(order.id)}
            >
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

function OrdersTable({ orders, tab }: { orders: Order[]; tab: OrderStatus }) {
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
            {!isCompleted && (
              <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500 w-10">Вик.</th>
            )}
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 whitespace-nowrap">Дата</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 whitespace-nowrap">Замовник</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 whitespace-nowrap">
              Назва об&apos;єкту
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Адреса</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 whitespace-nowrap">К-ть обл.</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 whitespace-nowrap">Виробництво</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 whitespace-nowrap">
              Дата виготовл.
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Примітки</th>
            <th className="px-3 py-3 w-24" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} isCompleted={isCompleted} />
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

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('in_progress')
  const orders = useOrdersStore((s) => s.orders)

  const byStatus = (status: OrderStatus) => orders.filter((o) => o.status === status)

  const counts = {
    in_progress: byStatus('in_progress').length,
    planned: byStatus('planned').length,
    completed: byStatus('completed').length,
    map: orders.filter((o) => o.lat && o.lng).length,
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Замовлення</h1>
        <p className="text-sm text-zinc-500 mt-1">Управління виробничими замовленнями</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)} className="space-y-5">
        <TabsList className="gap-1">
          {/* Status tabs */}
          {(['in_progress', 'planned', 'completed'] as const).map((status) => (
            <TabsTrigger key={status} value={status} className="gap-2">
              {STATUS_LABELS[status]}
              {counts[status] > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                    activeTab === status
                      ? 'bg-brand-600/30 text-brand-300'
                      : 'bg-zinc-700 text-zinc-400'
                  )}
                >
                  {counts[status]}
                </span>
              )}
            </TabsTrigger>
          ))}

          {/* Map tab */}
          <TabsTrigger value="map" className="gap-2">
            <MapPin className="h-3.5 w-3.5" />
            Мапа
            {counts.map > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                  activeTab === 'map'
                    ? 'bg-brand-600/30 text-brand-300'
                    : 'bg-zinc-700 text-zinc-400'
                )}
              >
                {counts.map}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* В роботі / Планується */}
        {(['in_progress', 'planned'] as const).map((status) => (
          <TabsContent key={status} value={status} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">{counts[status]} замовлень</p>
              <AddOrderButton status={status} />
            </div>
            <OrdersTable orders={byStatus(status)} tab={status} />
          </TabsContent>
        ))}

        {/* Виконано */}
        <TabsContent value="completed" className="space-y-4">
          <p className="text-sm text-zinc-500">{counts.completed} виконаних замовлень</p>
          <OrdersTable orders={byStatus('completed')} tab="completed" />
        </TabsContent>

        {/* Мапа */}
        <TabsContent value="map">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">
                {counts.map} з {orders.length} замовлень мають геолокацію
              </p>
              <p className="text-xs text-zinc-600">
                Геолокація встановлюється автоматично при вказуванні адреси
              </p>
            </div>
            <CombinedMapClient orders={orders} mapPoints={[]} height="calc(100vh - 260px)" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
