'use client'

import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { FiltersPanel } from '@/components/objects/filters-panel'
import { Skeleton } from '@/components/ui/skeleton'

const MapClient = dynamic(
  () => import('@/components/map/map-client').then((m) => m.MapClient),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-[calc(100vh-56px-120px)] rounded-xl" />,
  }
)

export default function MapPage() {
  const searchParams = useSearchParams()
  const focusObjectId = searchParams.get('object') || undefined

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-2 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Карта об&apos;єктів</h1>
            <p className="text-xs text-zinc-500">Всі будівельні об&apos;єкти України</p>
          </div>
        </div>
        <FiltersPanel />
      </div>

      <div className="flex-1 p-4 pt-3">
        <MapClient focusObjectId={focusObjectId} height="calc(100vh - 200px)" />
      </div>
    </div>
  )
}
