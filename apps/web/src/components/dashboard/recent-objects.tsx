'use client'

import Link from 'next/link'
import { MapPin, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { STATUS_LABELS, STATUS_COLORS, CATEGORY_LABELS } from '@/lib/utils/format'
import type { ConstructionObject } from '@/types'

interface RecentObjectsProps {
  objects: ConstructionObject[]
  isLoading?: boolean
}

export function RecentObjects({ objects, isLoading }: RecentObjectsProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-zinc-800">
            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!objects.length) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        Немає нових об&apos;єктів
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {objects.map((obj) => (
        <Link
          key={obj.id}
          href={`/objects/${obj.id}`}
          className="flex items-start gap-3 p-3 rounded-lg border border-zinc-800/50 bg-zinc-900/30 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all group"
        >
          <div className="shrink-0 h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center text-lg">
            {obj.category === 'residential' ? '🏢' :
             obj.category === 'commercial' ? '🏪' :
             obj.category === 'industrial' ? '🏭' :
             obj.category === 'infrastructure' ? '🛣️' : '🏗️'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-zinc-100">
              {obj.name}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin className="h-3 w-3 text-zinc-500 shrink-0" />
              <p className="text-xs text-zinc-500 truncate">{obj.city}, {obj.address}</p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={STATUS_COLORS[obj.status]} variant="outline">
                {STATUS_LABELS[obj.status]}
              </Badge>
              <span className="text-xs text-zinc-600">{CATEGORY_LABELS[obj.category]}</span>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400 shrink-0 mt-1 transition-colors" />
        </Link>
      ))}
    </div>
  )
}
