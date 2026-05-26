'use client'

import Link from 'next/link'
import { MapPin, Building2, Star, FileText, ShoppingCart, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  CATEGORY_LABELS,
  formatArea,
  formatScore,
} from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import type { ConstructionObject } from '@/types'

interface ObjectCardProps {
  object: ConstructionObject
  onFavorite?: (id: string) => void
  isFavorite?: boolean
  className?: string
}

const CATEGORY_EMOJI: Record<string, string> = {
  residential: '🏢',
  commercial: '🏪',
  industrial: '🏭',
  infrastructure: '🛣️',
  social: '🏥',
  mixed: '🏗️',
}

export function ObjectCard({ object, onFavorite, isFavorite, className }: ObjectCardProps) {
  return (
    <div className={cn(
      'group rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 hover:bg-zinc-900 transition-all',
      className
    )}>
      <div className="flex items-start gap-3">
        {/* Category icon */}
        <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center text-xl shrink-0">
          {CATEGORY_EMOJI[object.category] || '🏗️'}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <Link href={`/objects/${object.id}`} className="group/link flex-1 min-w-0">
              <h3 className="font-medium text-zinc-200 group-hover/link:text-zinc-100 text-sm leading-tight truncate">
                {object.name}
              </h3>
            </Link>
            {onFavorite && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 -mt-0.5"
                onClick={(e) => { e.preventDefault(); onFavorite(object.id) }}
              >
                <Star className={cn(
                  'h-3.5 w-3.5',
                  isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-600 hover:text-zinc-400'
                )} />
              </Button>
            )}
          </div>

          {/* Address */}
          <div className="flex items-center gap-1 mt-1">
            <MapPin className="h-3 w-3 text-zinc-500 shrink-0" />
            <p className="text-xs text-zinc-500 truncate">
              {object.city}{object.address ? `, ${object.address}` : ''}
            </p>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <Badge className={cn(STATUS_COLORS[object.status], 'text-xs')} variant="outline">
              {STATUS_LABELS[object.status]}
            </Badge>
            <Badge variant="muted" className="text-xs">
              {CATEGORY_LABELS[object.category]}
            </Badge>
            {object.floors && (
              <span className="text-xs text-zinc-600">
                <Building2 className="inline h-3 w-3 mr-0.5" />
                {object.floors}П
              </span>
            )}
            {object.building_area && (
              <span className="text-xs text-zinc-600">{formatArea(object.building_area)}</span>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-3 text-xs text-zinc-600">
              {object.permits && object.permits.length > 0 && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {object.permits.length} дозволів
                </span>
              )}
              {object.tenders && object.tenders.length > 0 && (
                <span className="flex items-center gap-1 text-yellow-600">
                  <ShoppingCart className="h-3 w-3" />
                  {object.tenders.length} тендерів
                </span>
              )}
            </div>

            {/* AI Score */}
            {object.ai_score !== undefined && object.ai_score !== null && (
              <div className="flex items-center gap-2">
                <Zap className="h-3 w-3 text-purple-400" />
                <div className="flex items-center gap-1.5">
                  <Progress value={object.ai_score * 100} className="w-16 h-1.5" />
                  <span className="text-xs text-purple-400 font-medium">
                    {formatScore(object.ai_score)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
