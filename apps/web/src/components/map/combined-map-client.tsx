'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { type Order, type OrderStatus } from '@/lib/api/orders'

// ── Types ──────────────────────────────────────────────────────────────────────

export type MapPoint = {
  id: string
  lat: number
  lng: number
  status: string
  name: string
}

type MarkerCategory = 'object' | 'order' | 'combined'

type MarkerInfo = {
  lat: number
  lng: number
  name: string
  color: string
  category: MarkerCategory
  statusLabel: string
  customer?: string
  address?: string
  orderStatus?: OrderStatus
  objectStatus?: string
}

// ── Color / label tables ───────────────────────────────────────────────────────

const OBJECT_COLORS: Record<string, string> = {
  planned: '#64748b',
  approved: '#3b82f6',
  under_construction: '#f97316',
  completed: '#22c55e',
  suspended: '#94a3b8',
  cancelled: '#ef4444',
}

const OBJECT_LABELS: Record<string, string> = {
  planned: 'Заплановано',
  approved: 'Затверджено',
  under_construction: 'Будується',
  completed: 'Завершено',
  suspended: 'Призупинено',
  cancelled: 'Скасовано',
}

const ORDER_COLORS: Record<OrderStatus, string> = {
  in_progress: '#a855f7',
  planned: '#eab308',
  completed: '#6b7280',
}

const ORDER_LABELS: Record<OrderStatus, string> = {
  in_progress: 'В роботі',
  planned: 'Планується (замовлення)',
  completed: 'Виконано (замовлення)',
}

// ── Legend config ──────────────────────────────────────────────────────────────

const ORDER_LEGEND: { status: OrderStatus; label: string }[] = [
  { status: 'in_progress', label: 'В роботі' },
  { status: 'planned', label: 'Планується' },
  { status: 'completed', label: 'Виконано' },
]

// All object-only markers are red (no order linked)
const OBJECT_NO_ORDER_COLOR = '#ef4444'

// ── Merge logic ────────────────────────────────────────────────────────────────

function buildMarkers(orders: Order[], mapPoints: MapPoint[]): MarkerInfo[] {
  // Index orders by objectName (latest win if duplicates)
  const ordersByName = new Map<string, Order>()
  orders.forEach((o) => {
    if (o.object_name) ordersByName.set(o.object_name, o)
  })

  const usedNames = new Set<string>()
  const result: MarkerInfo[] = []

  // 1. Walk through API objects that have coordinates
  mapPoints.forEach((mp) => {
    const order = ordersByName.get(mp.name)
    if (order) {
      // Object is linked to an order → use ORDER status color
      result.push({
        lat: mp.lat,
        lng: mp.lng,
        name: mp.name,
        color: ORDER_COLORS[order.status],
        category: 'combined',
        statusLabel: ORDER_LABELS[order.status],
        customer: order.customer || undefined,
        orderStatus: order.status,
        objectStatus: mp.status,
      })
      usedNames.add(mp.name)
    } else {
      // Object has no order → red marker
      result.push({
        lat: mp.lat,
        lng: mp.lng,
        name: mp.name,
        color: '#ef4444',
        category: 'object',
        statusLabel: OBJECT_LABELS[mp.status] ?? mp.status,
        objectStatus: mp.status,
      })
    }
  })

  // 2. Add standalone order markers (orders with lat/lng not already covered by an object)
  orders.forEach((o) => {
    if (!o.lat || !o.lng) return
    if (usedNames.has(o.object_name ?? '')) return // already shown via object marker
    result.push({
      lat: o.lat,
      lng: o.lng,
      name: o.object_name || 'Без назви',
      color: ORDER_COLORS[o.status],
      category: 'order',
      statusLabel: ORDER_LABELS[o.status],
      customer: o.customer || undefined,
      address: o.address ?? undefined,
      orderStatus: o.status,
    })
  })

  return result
}

// ── Popup HTML ─────────────────────────────────────────────────────────────────

function buildPopup(m: MarkerInfo): string {
  const badge = (color: string, label: string) =>
    `<span style="background:${color}22;color:${color};border:1px solid ${color}44;
      padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;">${label}</span>`

  const row = (label: string, value: string) =>
    `<div style="display:flex;justify-content:space-between;gap:8px;margin-top:4px;">
      <span style="color:#71717a;font-size:11px">${label}</span>
      <span style="color:#d4d4d8;font-size:11px;text-align:right">${value}</span>
    </div>`

  let html = `
    <div style="font-family:system-ui,sans-serif;min-width:190px;max-width:260px;position:relative;padding-right:20px">
      <button class="br-popup-close" title="Закрити" style="
        position:absolute;top:-2px;right:-4px;
        background:rgba(255,255,255,0.12);border:none;border-radius:4px;
        color:#a1a1aa;cursor:pointer;font-size:15px;line-height:1;
        padding:2px 6px;transition:background 0.15s;
      ">×</button>
      <p style="font-weight:600;color:#f4f4f5;margin:0 0 6px;font-size:13px;line-height:1.3">
        ${m.name}
      </p>`

  if (m.customer) html += row('Замовник', m.customer)
  if (m.address) html += row('Адреса', m.address)

  html += `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">`

  if (m.category === 'combined' && m.orderStatus && m.objectStatus) {
    html += badge(ORDER_COLORS[m.orderStatus], `Замовлення: ${ORDER_LABELS[m.orderStatus]}`)
    html += badge(OBJECT_COLORS[m.objectStatus] ?? '#64748b', `Об'єкт: ${OBJECT_LABELS[m.objectStatus] ?? m.objectStatus}`)
  } else if (m.category === 'object' && m.objectStatus) {
    html += badge('#ef4444', 'Без замовлення')
    html += badge(OBJECT_COLORS[m.objectStatus] ?? '#64748b', OBJECT_LABELS[m.objectStatus] ?? m.objectStatus)
  } else {
    html += badge(m.color, m.statusLabel)
  }

  html += '</div></div>'
  return html
}

// ── Component ──────────────────────────────────────────────────────────────────

interface CombinedMapClientProps {
  orders: Order[]
  mapPoints: MapPoint[]
  height?: string
}

export function CombinedMapClient({
  orders,
  mapPoints,
  height = '400px',
}: CombinedMapClientProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const markersLayerRef = useRef<unknown>(null)
  const [isMapReady, setIsMapReady] = useState(false)

  const markers = useMemo(
    () => buildMarkers(orders, mapPoints),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, mapPoints]
  )

  const orderCount = markers.filter((m) => m.category !== 'object').length
  const objectCount = markers.filter((m) => m.category !== 'order').length

  // Init Leaflet map once
  useEffect(() => {
    if (!mapRef.current) return
    let cancelled = false

    const init = async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      if (cancelled || !mapRef.current || mapInstanceRef.current) return

      delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current, {
        center: [48.3794, 31.1656],
        zoom: 6,
        zoomControl: true,
      })

      if (cancelled) { map.remove(); return }

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      map.on('popupopen', (e: L.PopupEvent) => {
        const btn = e.popup.getElement()?.querySelector<HTMLElement>('.br-popup-close')
        if (btn) btn.addEventListener('click', () => map.closePopup(), { once: true })
      })

      mapInstanceRef.current = map
      setIsMapReady(true)
    }

    init()

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove()
        mapInstanceRef.current = null
        setIsMapReady(false)
      }
    }
  }, [])

  // Refresh markers whenever data changes
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current) return
    let cancelled = false

    const update = async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapInstanceRef.current) return

      const map = mapInstanceRef.current as {
        addLayer: (l: unknown) => void
        removeLayer: (l: unknown) => void
        fitBounds: (b: unknown, opts?: unknown) => void
      }

      if (markersLayerRef.current) {
        map.removeLayer(markersLayerRef.current)
      }

      const group = L.featureGroup()

      markers.forEach((m) => {
        const size = m.category === 'combined' ? 16 : 13
        const ring = m.category === 'combined'
          ? `box-shadow:0 0 0 3px ${m.color}40,0 2px 8px rgba(0,0,0,.5);`
          : 'box-shadow:0 2px 8px rgba(0,0,0,.5);'

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:${m.color};
            border:2.5px solid rgba(255,255,255,.7);
            ${ring}
          "></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        })

        const marker = L.marker([m.lat, m.lng], { icon })
        marker.bindPopup(buildPopup(m), { maxWidth: 280, className: 'buildradar-popup', closeButton: true })
        marker.on('mouseover', function (this: typeof marker) { this.openPopup() })
        marker.on('mouseout', function (this: typeof marker) { this.closePopup() })
        marker.on('click', function (this: typeof marker) { this.openPopup() })
        marker.addTo(group)
      })

      group.addTo(map as unknown as Parameters<typeof group.addTo>[0])
      markersLayerRef.current = group

      if (markers.length > 0) {
        map.fitBounds((group as { getBounds: () => unknown }).getBounds(), { padding: [40, 40] })
      }
    }

    update()

    return () => { cancelled = true }
  }, [isMapReady, markers])

  return (
    <div className="relative rounded-xl overflow-hidden border border-zinc-800" style={{ height }}>
      <div ref={mapRef} className="absolute inset-0" />

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-zinc-700 bg-zinc-900/90 backdrop-blur-sm px-3 py-2 space-y-2 max-h-[calc(100%-24px)] overflow-y-auto">
        <div>
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Замовлення</p>
          {ORDER_LEGEND.map(({ status, label }) => (
            <div key={status} className="flex items-center gap-2 py-0.5">
              <div
                className="h-3.5 w-3.5 rounded-full shrink-0 ring-2 ring-white/20"
                style={{ background: ORDER_COLORS[status] }}
              />
              <span className="text-xs text-zinc-400">{label}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-zinc-700 pt-2">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Об&apos;єкти</p>
          <div className="flex items-center gap-2 py-0.5">
            <div className="h-3 w-3 rounded-full shrink-0" style={{ background: OBJECT_NO_ORDER_COLOR }} />
            <span className="text-xs text-zinc-400">Без замовлення</span>
          </div>
        </div>
      </div>

      {/* Counter */}
      <div className="absolute top-3 right-3 z-10 rounded-lg border border-zinc-700 bg-zinc-900/90 backdrop-blur-sm px-3 py-1.5 space-y-0.5">
        <p className="text-xs text-zinc-400">
          <span className="font-bold text-zinc-200">{orderCount}</span> замовлень
        </p>
        <p className="text-xs text-zinc-400">
          <span className="font-bold text-zinc-200">{objectCount}</span> об&apos;єктів
        </p>
      </div>

      {/* Empty state */}
      {markers.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/80">
          <p className="text-sm text-zinc-500">Немає об&apos;єктів або замовлень з геолокацією</p>
          <p className="text-xs text-zinc-600 mt-1">Вкажіть адресу при додаванні замовлення або об&apos;єкту</p>
        </div>
      )}
    </div>
  )
}
