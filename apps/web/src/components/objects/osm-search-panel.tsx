'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Loader2, MapPin, Plus, Check, X, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { searchApi, type OsmPlace } from '@/lib/api/search'
import { objectsApi } from '@/lib/api/objects'

const OBLAST_OPTIONS = [
  'Вінницька', 'Волинська', 'Дніпропетровська', 'Донецька', 'Житомирська',
  'Закарпатська', 'Запорізька', 'Івано-Франківська', 'Київська', 'Кіровоградська',
  'Луганська', 'Львівська', 'Миколаївська', 'Одеська', 'Полтавська',
  'Рівненська', 'Сумська', 'Тернопільська', 'Харківська', 'Херсонська',
  'Хмельницька', 'Черкаська', 'Чернівецька', 'Чернігівська', 'м. Київ',
]

function placeToOblast(raw: string): string | undefined {
  return OBLAST_OPTIONS.find(o =>
    raw.toLowerCase().includes(o.toLowerCase().replace('м. ', ''))
  )
}

interface OsmSearchPanelProps {
  onClose: () => void
}

export function OsmSearchPanel({ onClose }: OsmSearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OsmPlace[]>([])
  const [searching, setSearching] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const qc = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: (place: OsmPlace) => {
      const name = place.name || place.address || place.display_name
      const oblast = place.oblast || placeToOblast(place.display_name) || ''
      return objectsApi.create({
        name: name.trim() || 'Об\'єкт з OSM',
        address: place.address || undefined,
        city: place.city || undefined,
        oblast: oblast || undefined,
        lat: place.lat ?? undefined,
        lng: place.lng ?? undefined,
        floors: place.floors ?? undefined,
        status: 'planned',
        source: 'osm',
      })
    },
    onSuccess: (_, place) => {
      setSavedIds(prev => new Set(prev).add(place.osm_id))
      qc.invalidateQueries({ queryKey: ['objects'] })
    },
  })

  const handleSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    setResults([])
    try {
      const items = await searchApi.searchPlaces(query.trim(), 20)
      setResults(items)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-brand-400" />
          <span className="text-sm font-medium text-zinc-200">Пошук через OpenStreetMap</span>
          <span className="text-xs text-zinc-500">Знайдіть будівлю і збережіть в базу</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Назва будівлі, адреса або місто (напр. ЖК Голосіївський Київ)"
            className="pl-9"
            autoFocus
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          size="sm"
          className="shrink-0 gap-1.5"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {searching ? 'Пошук...' : 'Шукати'}
        </Button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          <p className="text-xs text-zinc-500 pb-1">
            Знайдено {results.length} результатів · Натисніть <span className="text-brand-400">+</span> щоб зберегти в BuildRadar
          </p>
          {results.map((place) => {
            const isSaved = savedIds.has(place.osm_id)
            const isSaving = saveMutation.isPending && saveMutation.variables?.osm_id === place.osm_id
            const name = place.name || place.address || place.display_name
            const location = [place.city, place.oblast].filter(Boolean).join(', ')

            return (
              <div
                key={place.osm_id}
                className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 hover:border-zinc-700 transition-colors"
              >
                <MapPin className="h-4 w-4 text-zinc-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 font-medium truncate">{name}</p>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {place.display_name}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    {location && (
                      <span className="text-xs text-zinc-600">{location}</span>
                    )}
                    {place.lat != null && (
                      <span className="text-xs text-zinc-700">
                        {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                      </span>
                    )}
                    {place.floors && (
                      <span className="text-xs text-zinc-600">{place.floors} пов.</span>
                    )}
                    {place.building_type && place.building_type !== 'yes' && (
                      <span className="text-xs text-zinc-700 bg-zinc-800 px-1.5 py-0.5 rounded">
                        {place.building_type}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isSaved ? 'ghost' : 'outline'}
                  disabled={isSaved || isSaving}
                  onClick={() => saveMutation.mutate(place)}
                  className={
                    isSaved
                      ? 'h-7 w-7 p-0 text-green-400 hover:text-green-400 shrink-0'
                      : 'h-7 w-7 p-0 border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-brand-500 shrink-0'
                  }
                  title={isSaved ? 'Збережено' : 'Зберегти в BuildRadar'}
                >
                  {isSaving
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : isSaved
                      ? <Check className="h-3.5 w-3.5" />
                      : <Plus className="h-3.5 w-3.5" />
                  }
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {!searching && results.length === 0 && query && (
        <p className="text-xs text-zinc-600 text-center py-3">
          Нічого не знайдено. Спробуйте уточнити запит або додати місто.
        </p>
      )}
    </div>
  )
}
