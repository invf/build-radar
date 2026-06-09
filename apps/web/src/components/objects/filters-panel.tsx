'use client'

import { useState } from 'react'
import { Filter, X, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  STATUS_LABELS,
  CATEGORY_LABELS,
  OBLAST_LABELS,
} from '@/lib/utils/format'
import { useFiltersStore } from '@/stores/filters'
import type { ObjectStatus, ObjectCategory } from '@/types'
import { cn } from '@/lib/utils/cn'

const STATUSES: ObjectStatus[] = [
  'planned', 'approved', 'under_construction', 'completed', 'suspended', 'cancelled'
]

const CATEGORIES: ObjectCategory[] = [
  'residential', 'commercial', 'industrial', 'infrastructure', 'social', 'mixed'
]

export function FiltersPanel() {
  const { filters, updateFilter, resetFilters, activeCount } = useFiltersStore()
  const [isOpen, setIsOpen] = useState(false)

  const toggleStatus = (status: ObjectStatus) => {
    const current = filters.status || []
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status]
    updateFilter('status', updated.length ? updated : undefined)
  }

  const toggleCategory = (category: ObjectCategory) => {
    const current = filters.category || []
    const updated = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category]
    updateFilter('category', updated.length ? updated : undefined)
  }

  const count = activeCount()

  return (
    <div className="space-y-3">
      {/* Filter toggle button */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'border-zinc-800 gap-2',
            count > 0 && 'border-brand-500/50 text-brand-400'
          )}
        >
          <Filter className="h-4 w-4" />
          Фільтри
          {count > 0 && (
            <Badge className="bg-brand-600 text-white text-xs px-1.5 py-0 ml-1">
              {count}
            </Badge>
          )}
          <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
        </Button>

        {count > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="text-zinc-500 hover:text-zinc-300 gap-1 text-xs"
          >
            <X className="h-3 w-3" />
            Скинути
          </Button>
        )}
      </div>

      {/* Filters panel */}
      {isOpen && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-5 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Status filter */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Статус</Label>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((status) => (
                  <button
                    key={status}
                    onClick={() => toggleStatus(status)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                      filters.status?.includes(status)
                        ? 'border-brand-500/50 bg-brand-500/10 text-brand-400'
                        : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                    )}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>

            {/* Category filter */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Категорія</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                      filters.category?.includes(cat)
                        ? 'border-brand-500/50 bg-brand-500/10 text-brand-400'
                        : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                    )}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>

            {/* Oblast filter */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Область</Label>
              <Select
                value={filters.oblast?.[0] || ''}
                onValueChange={(v) => updateFilter('oblast', v ? [v] : undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Всі регіони" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Всі регіони</SelectItem>
                  {Object.entries(OBLAST_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Floors range */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Поверхів</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="від"
                  min={1}
                  value={filters.min_floors || ''}
                  onChange={(e) => updateFilter('min_floors', e.target.value ? Number(e.target.value) : undefined)}
                  className="h-8 text-sm"
                />
                <span className="text-zinc-600">—</span>
                <Input
                  type="number"
                  placeholder="до"
                  min={1}
                  value={filters.max_floors || ''}
                  onChange={(e) => updateFilter('max_floors', e.target.value ? Number(e.target.value) : undefined)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* AI Score filter */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-zinc-500">AI Рейтинг (мін.)</Label>
              <Select
                value={filters.min_ai_score?.toString() || ''}
                onValueChange={(v) => updateFilter('min_ai_score', v ? Number(v) : undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Будь-який" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Будь-який</SelectItem>
                  <SelectItem value="0.9">90%+ (Дуже високий)</SelectItem>
                  <SelectItem value="0.75">75%+ (Високий)</SelectItem>
                  <SelectItem value="0.5">50%+ (Середній)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quick toggles */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Додатково</Label>
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-zinc-700"
                    checked={filters.has_tenders || false}
                    onChange={(e) => updateFilter('has_tenders', e.target.checked || undefined)}
                  />
                  <span className="text-sm text-zinc-400">Є тендери</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
