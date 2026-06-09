'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Loader2, Database, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { manufacturersApi } from '@/lib/api/manufacturers'
import { ordersApi } from '@/lib/api/orders'

interface MfrStore { name: string; phone: string; email: string; website: string; address: string; notes: string }
interface OrdStore {
  date: string | null; customer: string; objectName: string; address: string
  equipmentCount: string; manufacturer: string; productionDate: string | null
  notes: string; status: string; lat: number | null; lng: number | null
}

type ItemStatus = 'pending' | 'ok' | 'error'

interface MigrateItem { name: string; status: ItemStatus; error?: string }

export default function MigratePage() {
  const [manufacturers, setManufacturers] = useState<MfrStore[]>([])
  const [orders, setOrders] = useState<OrdStore[]>([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [mfrItems, setMfrItems] = useState<MigrateItem[]>([])
  const [ordItems, setOrdItems] = useState<MigrateItem[]>([])

  useEffect(() => {
    try {
      const mfr = localStorage.getItem('buildradar-manufacturers')
      const ord = localStorage.getItem('buildradar-orders')
      if (mfr) {
        const parsed = JSON.parse(mfr)
        setManufacturers(parsed?.state?.manufacturers ?? [])
      }
      if (ord) {
        const parsed = JSON.parse(ord)
        setOrders(parsed?.state?.orders ?? [])
      }
    } catch { /* ignore */ }
  }, [])

  const totalItems = manufacturers.length + orders.length

  const run = async () => {
    setRunning(true)

    // Init status arrays
    const mfrs: MigrateItem[] = manufacturers.map((m) => ({ name: m.name || '—', status: 'pending' }))
    const ords: MigrateItem[] = orders.map((o) => ({ name: o.customer || o.objectName || '(без назви)', status: 'pending' }))
    setMfrItems([...mfrs])
    setOrdItems([...ords])

    // Migrate manufacturers
    for (let i = 0; i < manufacturers.length; i++) {
      const m = manufacturers[i]
      try {
        await manufacturersApi.create({
          name: m.name || '—',
          phone: m.phone || undefined,
          email: m.email || undefined,
          website: m.website || undefined,
          address: m.address || undefined,
          notes: m.notes || undefined,
        })
        mfrs[i] = { ...mfrs[i], status: 'ok' }
      } catch (e: unknown) {
        mfrs[i] = { ...mfrs[i], status: 'error', error: String(e) }
      }
      setMfrItems([...mfrs])
    }

    // Migrate orders
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i]
      try {
        await ordersApi.create({
          date: o.date ? o.date.split('T')[0] : null,
          customer: o.customer || undefined,
          object_name: o.objectName || undefined,
          address: o.address || undefined,
          equipment_count: o.equipmentCount || undefined,
          manufacturer: o.manufacturer || undefined,
          production_date: o.productionDate ? o.productionDate.split('T')[0] : null,
          notes: o.notes || undefined,
          status: (o.status as 'in_progress' | 'planned' | 'completed') || 'in_progress',
          lat: o.lat ?? null,
          lng: o.lng ?? null,
        })
        ords[i] = { ...ords[i], status: 'ok' }
      } catch (e: unknown) {
        ords[i] = { ...ords[i], status: 'error', error: String(e) }
      }
      setOrdItems([...ords])
    }

    setRunning(false)
    setDone(true)
  }

  const icon = (s: ItemStatus) =>
    s === 'ok' ? <CheckCircle className="h-4 w-4 text-green-400 shrink-0" /> :
    s === 'error' ? <XCircle className="h-4 w-4 text-red-400 shrink-0" /> :
    <Loader2 className="h-4 w-4 text-zinc-400 animate-spin shrink-0" />

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4 md:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
          <Database className="h-5 w-5 text-brand-400" />
          Міграція даних
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Перенесення виробників та замовлень з локального сховища браузера до бази даних.
        </p>
      </div>

      {totalItems === 0 && !done && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
          <p className="text-zinc-400 text-sm">Локальних даних не знайдено.</p>
          <p className="text-zinc-600 text-xs mt-1">
            Виробники та замовлення вже в базі або не були додані.
          </p>
        </div>
      )}

      {totalItems > 0 && !running && !done && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-200">Знайдено в localStorage:</p>
              <ul className="text-sm text-zinc-400 mt-1 space-y-0.5">
                {manufacturers.length > 0 && <li>• {manufacturers.length} виробників</li>}
                {orders.length > 0 && <li>• {orders.length} замовлень</li>}
              </ul>
            </div>
            <ArrowRight className="h-5 w-5 text-zinc-600" />
            <div className="text-right text-sm text-zinc-400">→ база даних</div>
          </div>

          <Button variant="brand" onClick={run} className="w-full">
            Перенести дані
          </Button>
        </div>
      )}

      {(running || done) && (
        <div className="space-y-4">
          {mfrItems.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Виробники</p>
              {mfrItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {icon(item.status)}
                  <span className={item.status === 'error' ? 'text-red-400' : 'text-zinc-300'}>{item.name}</span>
                  {item.error && <span className="text-xs text-red-500 truncate">{item.error}</span>}
                </div>
              ))}
            </div>
          )}

          {ordItems.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Замовлення</p>
              {ordItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {icon(item.status)}
                  <span className={item.status === 'error' ? 'text-red-400' : 'text-zinc-300'}>{item.name}</span>
                  {item.error && <span className="text-xs text-red-500 truncate">{item.error}</span>}
                </div>
              ))}
            </div>
          )}

          {done && (
            <div className="rounded-xl border border-green-500/30 bg-green-950/20 p-4 text-center">
              <CheckCircle className="h-6 w-6 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-green-300 font-medium">Міграцію завершено</p>
              <p className="text-xs text-zinc-500 mt-1">
                Тепер ці дані зберігаються в базі і доступні з будь-якого пристрою.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
