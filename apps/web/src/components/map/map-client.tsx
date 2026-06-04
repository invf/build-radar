'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { objectsApi } from '@/lib/api/objects'
import { useFiltersStore } from '@/stores/filters'
import type { ObjectStatus } from '@/types'

const STATUS_MAP_COLORS: Record<ObjectStatus, string> = {
  planned: '#3b82f6',
  approved: '#a855f7',
  under_construction: '#eab308',
  completed: '#22c55e',
  suspended: '#f97316',
  cancelled: '#ef4444',
}

interface MapPoint {
  id: string
  lat: number
  lng: number
  status: string
  name: string
}

interface MapClientProps {
  focusObjectId?: string
  height?: string
}

export function MapClient({ focusObjectId, height = 'calc(100vh - 56px)' }: MapClientProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const markersRef = useRef<unknown>(null)
  const [isMapReady, setIsMapReady] = useState(false)
  const { filters } = useFiltersStore()

  const { data: points } = useQuery({
    queryKey: ['map-points', filters],
    queryFn: () => objectsApi.getMapPoints(filters),
    staleTime: 2 * 60 * 1000,
  })

  // Initialize Leaflet map (client-side only)
  useEffect(() => {
    if (!mapRef.current) return

    let cancelled = false

    const initMap = async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      if (cancelled || !mapRef.current || mapInstanceRef.current) return

      // Fix default marker icon
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

      if (cancelled) {
        map.remove()
        return
      }

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

  // Update markers when points change
  useEffect(() => {
    if (!isMapReady || !points || !mapInstanceRef.current) return

    const updateMarkers = async () => {
      const L = (await import('leaflet')).default

      // Remove existing cluster group
      if (markersRef.current) {
        (mapInstanceRef.current as { removeLayer: (l: unknown) => void }).removeLayer(markersRef.current)
      }

      const map = mapInstanceRef.current as {
        addLayer: (l: unknown) => void
        setView: (coords: [number, number], zoom: number) => void
      }

      // Create marker cluster group manually with custom icons
      const markerGroup = L.featureGroup()

      points.forEach((point: MapPoint) => {
        if (!point.lat || !point.lng) return

        const color = STATUS_MAP_COLORS[point.status as ObjectStatus] || '#71717a'

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: ${color};
            border: 2px solid rgba(255,255,255,0.4);
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          "></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        })

        const marker = L.marker([point.lat, point.lng], { icon })
        marker.bindPopup(`
          <div style="font-family: system-ui, sans-serif; min-width: 200px;">
            <p style="font-weight: 600; color: #f4f4f5; margin: 0 0 6px 0; font-size: 13px; line-height: 1.3;">
              ${point.name}
            </p>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
              <span style="
                background: ${color}22;
                color: ${color};
                border: 1px solid ${color}44;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 500;
              ">${point.status}</span>
            </div>
            <a href="/objects/${point.id}" style="
              display: block;
              margin-top: 10px;
              padding: 6px 10px;
              background: #2563eb;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-size: 12px;
              text-align: center;
              font-weight: 500;
            ">Відкрити →</a>
          </div>
        `, {
          maxWidth: 260,
          className: 'buildradar-popup',
        })

        markerGroup.addLayer(marker)
      })

      markerGroup.addTo(map as unknown as Parameters<typeof markerGroup.addTo>[0])
      markersRef.current = markerGroup

      // Focus on specific object if provided
      if (focusObjectId) {
        const target = points.find((p: MapPoint) => p.id === focusObjectId)
        if (target) {
          map.setView([target.lat, target.lng], 16)
        }
      }
    }

    updateMarkers()
  }, [isMapReady, points, focusObjectId])

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={mapRef} className="absolute inset-0 z-0 rounded-xl overflow-hidden" />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-zinc-800 bg-zinc-900/90 backdrop-blur-sm p-3">
        <p className="text-xs font-medium text-zinc-400 mb-2">Статус об&apos;єктів</p>
        <div className="space-y-1.5">
          {Object.entries(STATUS_MAP_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full border border-white/20" style={{ background: color }} />
              <span className="text-xs text-zinc-500 capitalize">{status.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Points count */}
      {points && (
        <div className="absolute top-4 right-4 z-10 rounded-lg border border-zinc-800 bg-zinc-900/90 backdrop-blur-sm px-3 py-2">
          <p className="text-xs text-zinc-400">
            <span className="font-bold text-zinc-200">{points.length.toLocaleString('uk-UA')}</span> об&apos;єктів на карті
          </p>
        </div>
      )}
    </div>
  )
}
