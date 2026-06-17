'use client'

import Link from 'next/link'
import { MapPin, Map, Building2, Star, ShoppingCart, Zap, Pencil, Trash2, Globe, HardHat } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
  onEdit?: (obj: ConstructionObject) => void
  onDelete?: (id: string) => void
  onQuickView?: (obj: ConstructionObject) => void
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

export function ObjectCard({ object, onFavorite, isFavorite, onEdit, onDelete, onQuickView, className }: ObjectCardProps) {
  const mainPhoto = object.photos?.[0]

  return (
    <div className={cn(
      'group rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900 transition-all overflow-hidden',
      className
    )}>
      {/* Photo header — клік відкриває попап, якщо є onQuickView */}
      <div
        className="block relative w-full h-36 bg-zinc-800 cursor-pointer"
        onClick={() => onQuickView ? onQuickView(object) : undefined}
      >
        {mainPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mainPhoto} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">{CATEGORY_EMOJI[object.category] || '🏗️'}</span>
          </div>
        )}

        {/* Action buttons overlay */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={(e) => { e.preventDefault(); onEdit(object) }}
              className="rounded-md bg-black/60 hover:bg-black/80 p-1.5"
              title="Редагувати"
            >
              <Pencil className="h-3 w-3 text-white" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.preventDefault(); onDelete(object.id) }}
              className="rounded-md bg-black/60 hover:bg-red-500/80 p-1.5"
              title="Видалити"
            >
              <Trash2 className="h-3 w-3 text-white" />
            </button>
          )}
          {onFavorite && (
            <button
              onClick={(e) => { e.preventDefault(); onFavorite(object.id) }}
              className="rounded-md bg-black/60 hover:bg-black/80 p-1.5"
            >
              <Star className={cn('h-3 w-3', isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-white')} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Name */}
        <Link href={`/objects/${object.id}`}>
          <h3 className="font-medium text-zinc-200 hover:text-zinc-100 text-sm leading-tight line-clamp-2">
            {object.name}
          </h3>
        </Link>

        {/* Address + Map */}
        <div className="flex items-center gap-1">
          <MapPin className="h-3 w-3 text-zinc-500 shrink-0" />
          <p className="text-xs text-zinc-500 truncate flex-1">
            {object.city}{object.address ? `, ${object.address}` : ''}
          </p>
          {(object.city || object.address) && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([object.address, object.city].filter(Boolean).join(', '))}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 flex items-center gap-0.5 text-[10px] text-brand-400 hover:text-brand-300 border border-brand-400/30 rounded px-1.5 py-0.5 transition-colors"
            >
              <Map className="h-2.5 w-2.5" />
              Мапа
            </a>
          )}
        </div>

        {/* Website */}
        {object.website && (
          <a
            href={object.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors truncate"
          >
            <Globe className="h-3 w-3 shrink-0" />
            <span className="truncate">{object.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
          </a>
        )}

        {/* General contractor */}
        {object.general_contractor && (
          <div className="flex items-center gap-1 min-w-0">
            <HardHat className="h-3 w-3 text-zinc-500 shrink-0" />
            <span className="text-xs text-zinc-500 shrink-0">Генпідрядник:</span>
            <span className="text-xs text-zinc-300 truncate">{object.general_contractor}</span>
          </div>
        )}

        {/* Description */}
        {object.description && (
          <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{object.description}</p>
        )}

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1">
          <Badge className={cn('text-xs', STATUS_COLORS[object.status])} variant="outline">
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

        {/* Footer: permits/tenders + AI score */}
        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
          <div className="flex items-center gap-2.5 text-xs text-zinc-600">
            {object.tenders && object.tenders.length > 0 && (
              <span className="flex items-center gap-0.5 text-yellow-600">
                <ShoppingCart className="h-3 w-3" />
                {object.tenders.length}
              </span>
            )}
          </div>

          {object.ai_score !== undefined && object.ai_score !== null && (
            <div className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-purple-400" />
              <Progress value={object.ai_score * 100} className="w-12 h-1" />
              <span className="text-xs text-purple-400 font-medium">
                {formatScore(object.ai_score)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
