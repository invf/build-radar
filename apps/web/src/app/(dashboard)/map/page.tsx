'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { ordersApi } from '@/lib/api/orders'
import { objectsApi } from '@/lib/api/objects'
import type { MapPoint } from '@/components/map/combined-map-client'

const CombinedMapClient = dynamic(
  () => import('@/components/map/combined-map-client').then((m) => m.CombinedMapClient),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full rounded-xl" style={{ height: 'calc(100vh - 130px)' }} />,
  }
)

export default function MapPage() {
  const router = useRouter()

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.list(),
    staleTime: 30_000,
  })

  const { data: mapPoints = [] } = useQuery<MapPoint[]>({
    queryKey: ['map-points'],
    queryFn: () => objectsApi.getMapPoints() as Promise<MapPoint[]>,
    staleTime: 2 * 60_000,
  })

  const totalMarkers =
    mapPoints.length + orders.filter((o) => o.lat && o.lng).length

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-3 border-b border-zinc-800 bg-zinc-950 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="md:hidden flex items-center justify-center h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors shrink-0"
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Мапа</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Об&apos;єкти і замовлення на одній карті &mdash; {totalMarkers} маркерів
          </p>
        </div>
      </div>

      <div className="flex-1 p-4 pt-3">
        <CombinedMapClient
          orders={orders}
          mapPoints={mapPoints}
          height="calc(100vh - 130px)"
        />
      </div>
    </div>
  )
}
