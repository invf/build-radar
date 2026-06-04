'use client'

import { useEffect, useRef, useState } from 'react'
import { type Order, type OrderStatus } from '@/lib/api/orders'

const STATUS_COLORS: Record<OrderStatus, string> = {
  in_progress: '#22c55e',  // зелений
  planned: '#eab308',      // жовтий
  completed: '#ef4444',    // червоний
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  in_progress: 'В роботі',
  planned: 'Планується',
  completed: 'Виконано',
}

interface OrdersMapClientProps {
  orders: Order[]
  height?: string
}

export function OrdersMapClient({ orders, height = '380px' }: OrdersMapClientProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const markersRef = useRef<unknown>(null)
  const [isMapReady, setIsMapReady] = useState(false)

  const mappable = orders.filter((o) => o.lat && o.lng)

  useEffect(() => {
    if (!mapRef.current) return
    let cancelled = false

    const initMap = async () => {
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

      mapInstanceRef.current = map
      setIsMapReady(true)
    }

    initMap()

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove()
        mapInstanceRef.current = null
        setIsMapReady(false)
      }
    }
  }, [])

  // Refresh markers whenever orders change
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current) return
    let cancelled = false

    const update = async () => {
      const L = (await import('leaflet')).default

      if (cancelled || !mapInstanceRef.current) return

      if (markersRef.current) {
        (mapInstanceRef.current as { removeLayer: (l: unknown) => void }).removeLayer(markersRef.current)
      }

      if (!mapInstanceRef.current) return

      const map = mapInstanceRef.current as {
        addLayer: (l: unknown) => void
        fitBounds: (b: unknown, opts?: unknown) => void
      }

      const group = L.featureGroup()

      mappable.forEach((order) => {
        const color = STATUS_COLORS[order.status]

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width: 14px; height: 14px; border-radius: 50%;
            background: ${color};
            border: 2.5px solid rgba(255,255,255,0.6);
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        })

        const marker = L.marker([order.lat!, order.lng!], { icon })
        marker.bindPopup(`
          <div style="font-family: system-ui, sans-serif; min-width: 180px;">
            <p style="font-weight: 600; color: #f4f4f5; margin: 0 0 4px; font-size: 13px;">
              ${order.object_name || '—'}
            </p>
            <p style="color: #a1a1aa; font-size: 12px; margin: 0 0 6px;">
              ${order.customer || '—'}
            </p>
            <span style="
              background: ${color}22; color: ${color};
              border: 1px solid ${color}44;
              padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500;
            ">${STATUS_LABELS[order.status]}</span>
            ${order.production_date ? `
              <p style="color: #71717a; font-size: 11px; margin: 8px 0 0;">
                Виготовлення: ${new Date(order.production_date).toLocaleDateString('uk-UA')}
              </p>` : ''}
          </div>
        `, { maxWidth: 260, className: 'buildradar-popup' })

        group.addLayer(marker)
      })

      group.addTo(map as unknown as Parameters<typeof group.addTo>[0])
      markersRef.current = group

      if (mappable.length > 0) {
        map.fitBounds((group as { getBounds: () => unknown }).getBounds(), { padding: [40, 40] })
      }
    }

    update()
  }, [isMapReady, mappable])

  return (
    <div className="relative rounded-xl overflow-hidden border border-zinc-800" style={{ height }}>
      <div ref={mapRef} className="absolute inset-0" />

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-zinc-700 bg-zinc-900/90 backdrop-blur-sm px-3 py-2">
        <p className="text-[10px] font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Статус</p>
        <div className="space-y-1">
          {(Object.entries(STATUS_LABELS) as [OrderStatus, string][]).map(([status, label]) => (
            <div key={status} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{ background: STATUS_COLORS[status], boxShadow: `0 0 4px ${STATUS_COLORS[status]}80` }}
              />
              <span className="text-xs text-zinc-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Count */}
      <div className="absolute top-3 right-3 z-10 rounded-lg border border-zinc-700 bg-zinc-900/90 backdrop-blur-sm px-3 py-1.5">
        <p className="text-xs text-zinc-400">
          <span className="font-bold text-zinc-200">{mappable.length}</span> з {orders.length} на карті
        </p>
      </div>

      {/* Empty state overlay */}
      {mappable.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/80">
          <p className="text-sm text-zinc-500">Немає замовлень з адресою для відображення</p>
          <p className="text-xs text-zinc-600 mt-1">Вкажіть адресу при додаванні замовлення</p>
        </div>
      )}
    </div>
  )
}
