'use client'

import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Sparkles, AlertTriangle, MapPin, Loader2, Globe, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ImageUpload } from '@/components/ui/image-upload'
import { objectsApi, type ObjectCreatePayload } from '@/lib/api/objects'
import { aiEnrichApi, type ObjectEnrichResult, type WebEnrichResult } from '@/lib/api/ai-enrich'
import { searchApi, type OsmPlace } from '@/lib/api/search'
import type { ConstructionObject } from '@/types'

const STATUS_LABELS = {
  planned: 'Заплановано',
  approved: 'Затверджено',
  under_construction: 'Будується',
  completed: 'Завершено',
  suspended: 'Призупинено',
  cancelled: 'Скасовано',
}

const CATEGORY_LABELS = {
  residential: 'Житлова',
  commercial: 'Комерційна',
  industrial: 'Промислова',
  infrastructure: 'Інфраструктура',
  social: 'Соціальна',
  mixed: 'Змішана',
}

const TYPE_LABELS = {
  apartment_building: 'Багатоквартирний будинок',
  private_house: 'Приватний будинок',
  office: 'Офіс',
  shopping_center: 'ТРЦ',
  warehouse: 'Склад',
  factory: 'Завод',
  hospital: 'Лікарня',
  school: 'Школа',
  hotel: 'Готель',
  infrastructure: 'Інфраструктура',
  other: 'Інше',
}

const OBLAST_OPTIONS = [
  'Вінницька', 'Волинська', 'Дніпропетровська', 'Донецька', 'Житомирська',
  'Закарпатська', 'Запорізька', 'Івано-Франківська', 'Київська', 'Кіровоградська',
  'Луганська', 'Львівська', 'Миколаївська', 'Одеська', 'Полтавська',
  'Рівненська', 'Сумська', 'Тернопільська', 'Харківська', 'Херсонська',
  'Хмельницька', 'Черкаська', 'Чернівецька', 'Чернігівська', 'м. Київ',
]

type FormState = Omit<ObjectCreatePayload, 'photos' | 'floors' | 'building_area' | 'land_area' | 'lat' | 'lng'> & {
  photos: string[]
  floors: string
  building_area: string
  land_area: string
  lat: string
  lng: string
}

const EMPTY: FormState = {
  name: '', address: '', city: '', oblast: '', district: '',
  lat: '', lng: '', status: 'planned', category: '', object_type: '',
  floors: '', building_area: '', land_area: '', construction_stage: '',
  planned_completion: '', description: '', photos: [],
  customer: '', general_contractor: '', designer: '', installer: '',
  website: '',
  source: 'manual',
}

const CONFIDENCE_COLORS = {
  high: 'text-green-400 border-green-500/30 bg-green-500/10',
  medium: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
  low: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
}

function objectToFormState(obj: ConstructionObject): FormState {
  return {
    name: obj.name || '',
    address: obj.address || '',
    city: obj.city || '',
    oblast: obj.oblast || '',
    district: obj.district || '',
    lat: obj.coordinates?.lat != null ? String(obj.coordinates.lat) : '',
    lng: obj.coordinates?.lng != null ? String(obj.coordinates.lng) : '',
    status: obj.status || 'planned',
    category: obj.category || '',
    object_type: obj.object_type || '',
    floors: obj.floors != null ? String(obj.floors) : '',
    building_area: obj.building_area != null ? String(obj.building_area) : '',
    land_area: obj.land_area != null ? String(obj.land_area) : '',
    construction_stage: obj.construction_stage || '',
    planned_completion: obj.planned_completion ? obj.planned_completion.split('T')[0] : '',
    description: obj.description || '',
    photos: obj.photos || [],
    customer: obj.customer || '',
    general_contractor: obj.general_contractor || '',
    designer: obj.designer || '',
    installer: obj.installer || '',
    website: obj.website || '',
    source: obj.source || 'manual',
  }
}

interface ObjectFormModalProps {
  initialData?: ConstructionObject
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: (obj: ConstructionObject) => void
}

export function ObjectFormModal({ initialData, open: controlledOpen, onOpenChange, onSuccess }: ObjectFormModalProps = {}) {
  const isEditMode = !!initialData
  const [internalOpen, setInternalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [aiResult, setAiResult] = useState<ObjectEnrichResult | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [webResult, setWebResult] = useState<WebEnrichResult | null>(null)
  const [webLoading, setWebLoading] = useState(false)
  const [webUrlInput, setWebUrlInput] = useState('')
  const [showWebInput, setShowWebInput] = useState(false)
  const [osmResults, setOsmResults] = useState<OsmPlace[]>([])
  const [osmLoading, setOsmLoading] = useState(false)
  const [showOsmDropdown, setShowOsmDropdown] = useState(false)
  const osmDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const qc = useQueryClient()

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v)
    else setInternalOpen(v)
  }

  useEffect(() => {
    if (open && initialData) {
      setForm(objectToFormState(initialData))
    } else if (!open) {
      setForm(EMPTY)
      setAiResult(null)
    }
  }, [open, initialData])

  const mutation = useMutation({
    mutationFn: (payload: ObjectCreatePayload) =>
      isEditMode
        ? objectsApi.update(initialData!.id, payload)
        : objectsApi.create(payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['objects'] })
      onSuccess?.(data)
      setOpen(false)
    },
  })

  const handleAddressInput = (value: string) => {
    set('address', value)
    if (osmDebounce.current) clearTimeout(osmDebounce.current)
    if (value.trim().length < 4) { setShowOsmDropdown(false); return }
    osmDebounce.current = setTimeout(async () => {
      setOsmLoading(true)
      try {
        const query = [value, form.city, form.oblast].filter(Boolean).join(', ')
        const items = await searchApi.searchPlaces(query)
        setOsmResults(items)
        setShowOsmDropdown(items.length > 0)
      } catch {
        setOsmResults([])
      } finally {
        setOsmLoading(false)
      }
    }, 500)
  }

  const applyOsmPlace = (place: OsmPlace) => {
    setForm(f => ({
      ...f,
      address: place.address || f.address,
      city: place.city || f.city,
      oblast: place.oblast || f.oblast,
      lat: place.lat != null ? String(place.lat) : f.lat,
      lng: place.lng != null ? String(place.lng) : f.lng,
      floors: f.floors || (place.floors != null ? String(place.floors) : ''),
    }))
    setShowOsmDropdown(false)
    setOsmResults([])
  }

  const handleWebEnrich = async (manualUrl?: string) => {
    if (!form.name?.trim()) return
    setWebLoading(true)
    setWebResult(null)
    setShowWebInput(false)
    try {
      const result = await aiEnrichApi.web(
        form.name.trim(), 'object',
        form.city || undefined,
        manualUrl || form.website || undefined
      )
      setWebResult(result)
      // Auto-fill empty fields
      setForm(f => ({
        ...f,
        address: f.address || result.address || '',
        city: f.city || result.city || '',
        oblast: f.oblast || result.oblast || '',
        status: f.status || result.status || f.status,
        category: f.category || result.category || '',
        object_type: f.object_type || result.object_type || '',
        floors: f.floors || (result.floors != null ? String(result.floors) : ''),
        building_area: f.building_area || (result.building_area != null ? String(result.building_area) : ''),
        description: f.description || result.description || '',
        website: f.website || result.website || '',
        customer: f.customer || result.customer || '',
        general_contractor: f.general_contractor || result.general_contractor || '',
        designer: f.designer || result.designer || '',
        planned_completion: f.planned_completion || result.planned_completion || '',
        // Add photos from web
        photos: result.photos?.length
          ? [...new Set([...f.photos, ...result.photos.slice(0, 6)])]
          : f.photos,
      }))
    } catch {
      setWebResult({ confidence: 'low', note: 'Помилка пошуку в мережі' })
    } finally {
      setWebLoading(false)
    }
  }

  const handleAiEnrich = async () => {
    if (!form.name?.trim()) return
    setAiLoading(true)
    setAiResult(null)
    try {
      const result = await aiEnrichApi.object(
        form.name.trim(),
        form.address || undefined,
        form.city || undefined,
      )
      setAiResult(result)
      setForm(f => ({
        ...f,
        address:    f.address    || result.address    || '',
        city:       f.city       || result.city       || '',
        oblast:     f.oblast     || result.oblast     || '',
        district:   f.district   || result.district   || '',
        status:     f.status !== 'planned' ? f.status : (result.status || f.status),
        category:   f.category   || result.category   || '',
        object_type: f.object_type || result.object_type || '',
        floors:     f.floors     || (result.floors != null ? String(result.floors) : ''),
        building_area: f.building_area || (result.building_area != null ? String(result.building_area) : ''),
        land_area:  f.land_area  || (result.land_area  != null ? String(result.land_area)  : ''),
        construction_stage: f.construction_stage || result.construction_stage || '',
        description: f.description || result.description || '',
        lat:  f.lat  || (result.lat  != null ? String(result.lat)  : ''),
        lng:  f.lng  || (result.lng  != null ? String(result.lng)  : ''),
      }))
    } catch {
      setAiResult({ confidence: 'low', note: 'Помилка запиту до ШІ' })
    } finally {
      setAiLoading(false)
    }
  }

  const set = (field: keyof FormState, value: string) =>
    setForm(f => ({ ...f, [field]: value }))

  const setPhotos = (photos: string[]) => setForm(f => ({ ...f, photos }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: ObjectCreatePayload = {
      name: form.name,
      address: form.address || undefined,
      city: form.city || undefined,
      oblast: form.oblast || undefined,
      district: form.district || undefined,
      lat: form.lat ? parseFloat(form.lat) : undefined,
      lng: form.lng ? parseFloat(form.lng) : undefined,
      status: form.status || 'planned',
      category: form.category || undefined,
      object_type: form.object_type || undefined,
      floors: form.floors ? parseInt(form.floors) : undefined,
      building_area: form.building_area ? parseFloat(form.building_area) : undefined,
      land_area: form.land_area ? parseFloat(form.land_area) : undefined,
      construction_stage: form.construction_stage || undefined,
      planned_completion: form.planned_completion || undefined,
      description: form.description || undefined,
      photos: form.photos.length > 0 ? form.photos : undefined,
      customer: form.customer || undefined,
      general_contractor: form.general_contractor || undefined,
      designer: form.designer || undefined,
      installer: form.installer || undefined,
      website: form.website || undefined,
      source: 'manual',
    }
    mutation.mutate(payload)
  }

  return (
    <>
      {!isEditMode && (
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Додати
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Редагувати об'єкт" : "Новий будівельний об'єкт"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 mt-2">
            {aiResult && (
              <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${CONFIDENCE_COLORS[aiResult.confidence || 'low']}`}>
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium">ШІ заповнив поля</span>
                  {' · '}впевненість: {{ high: 'висока', medium: 'середня', low: 'низька' }[aiResult.confidence || 'low']}
                  {aiResult.note && <div className="mt-0.5 opacity-80">{aiResult.note}</div>}
                  <div className="mt-0.5 opacity-70">Перевірте дані перед збереженням</div>
                </div>
              </div>
            )}

            {/* Основна інформація */}
            <section className="space-y-3">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Основна інформація</p>
              <div className="space-y-1.5">
                <Label htmlFor="o-name">Назва *</Label>
                <div className="flex gap-2">
                  <Input
                    id="o-name"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="ЖК «Зоряний»"
                    required
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAiEnrich}
                    disabled={aiLoading || webLoading || !form.name?.trim()}
                    title="ШІ заповнює поля на основі своїх навчальних даних (без інтернету). Корисно для відомих ЖК і об'єктів."
                    className="shrink-0 border-zinc-700 gap-1.5 text-brand-400 hover:text-brand-300 hover:border-brand-500/50"
                  >
                    <Sparkles className={`h-3.5 w-3.5 ${aiLoading ? 'animate-pulse' : ''}`} />
                    {aiLoading ? 'Шукаю в ШІ...' : 'ШІ-знання'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowWebInput(v => !v); setWebResult(null) }}
                    disabled={webLoading || aiLoading || !form.name?.trim()}
                    title="Скрапінг сайту об'єкту — витягує реальні дані і фото з офіційного сайту"
                    className="shrink-0 border-zinc-700 gap-1.5 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/50"
                  >
                    <Globe className={`h-3.5 w-3.5 ${webLoading ? 'animate-spin' : ''}`} />
                    {webLoading ? 'Сканую...' : 'Web-скан'}
                  </Button>
                </div>

                {/* URL input panel */}
                {showWebInput && !webLoading && (
                  <div className="flex gap-2 items-center rounded-lg border border-emerald-500/30 bg-emerald-950/10 px-3 py-2">
                    <Globe className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <input
                      type="url"
                      placeholder="https://site.ua  (або залиште порожнім — знайдемо автоматично)"
                      value={webUrlInput}
                      onChange={e => setWebUrlInput(e.target.value)}
                      className="flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 outline-none"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleWebEnrich(webUrlInput || undefined) } }}
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="brand"
                      className="h-6 px-3 text-xs shrink-0"
                      onClick={() => handleWebEnrich(webUrlInput || undefined)}
                    >
                      Сканувати
                    </Button>
                    <button type="button" onClick={() => setShowWebInput(false)} className="text-zinc-600 hover:text-zinc-400">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Web result panel */}
                {webResult && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <Globe className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span className="font-medium text-emerald-300">Web-скан завершено</span>
                        {webResult.website && (
                          <a href={webResult.website} target="_blank" rel="noopener noreferrer"
                            className="text-emerald-500 hover:text-emerald-400 truncate max-w-[220px]">
                            {webResult.website.replace(/^https?:\/\/(www\.)?/, '')}
                          </a>
                        )}
                        {webResult.confidence && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            webResult.confidence === 'high' ? 'bg-green-500/20 text-green-400' :
                            webResult.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-zinc-700 text-zinc-400'
                          }`}>
                            {webResult.confidence === 'high' ? 'висока точність' :
                             webResult.confidence === 'medium' ? 'середня точність' : 'низька точність'}
                          </span>
                        )}
                      </div>
                      <button type="button" onClick={() => setWebResult(null)} className="text-zinc-500 hover:text-zinc-300 shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {webResult.note && (
                      <div className="text-xs text-zinc-500 flex items-start gap-1.5">
                        <span>{webResult.note}</span>
                        {webResult.note.includes('не знайдено') && (
                          <button
                            type="button"
                            className="text-emerald-400 hover:text-emerald-300 whitespace-nowrap underline"
                            onClick={() => { setWebResult(null); setShowWebInput(true) }}
                          >
                            Вкажіть URL вручну
                          </button>
                        )}
                      </div>
                    )}
                    {webResult.photos && webResult.photos.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-zinc-400">
                          Знайдено {webResult.photos.length} фото — додано до картки:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {webResult.photos.slice(0, 6).map((url, i) => (
                            <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border border-emerald-500/40">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setForm(f => ({ ...f, photos: f.photos.filter(p => p !== url) }))}
                                className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white hover:bg-red-600/80"
                                title="Прибрати фото"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Статус</Label>
                  <Select value={form.status} onValueChange={v => set('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Категорія</Label>
                  <Select value={form.category} onValueChange={v => set('category', v)}>
                    <SelectTrigger><SelectValue placeholder="Оберіть" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Тип об&apos;єкту</Label>
                <Select value={form.object_type} onValueChange={v => set('object_type', v)}>
                  <SelectTrigger><SelectValue placeholder="Оберіть тип" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            {/* Розташування */}
            <section className="space-y-3">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Розташування</p>
              <div className="space-y-1.5">
                <Label htmlFor="o-address">Адреса</Label>
                <div className="relative">
                  <div className="relative">
                    <Input
                      id="o-address"
                      value={form.address}
                      onChange={e => handleAddressInput(e.target.value)}
                      onFocus={() => osmResults.length > 0 && setShowOsmDropdown(true)}
                      placeholder="вул. Будівельна, 10"
                      className="pr-7"
                    />
                    {osmLoading && (
                      <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-zinc-500 pointer-events-none" />
                    )}
                    {!osmLoading && form.address && (
                      <MapPin className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600 pointer-events-none" />
                    )}
                  </div>
                  {showOsmDropdown && osmResults.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 shadow-lg max-h-52 overflow-y-auto">
                      {osmResults.map((place, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => applyOsmPlace(place)}
                          className="w-full px-3 py-2 text-left hover:bg-zinc-800 first:rounded-t-md"
                        >
                          <p className="text-sm text-zinc-100 truncate">
                            {place.address || place.name}
                          </p>
                          <p className="text-xs text-zinc-500 truncate">
                            {[place.city, place.oblast].filter(Boolean).join(', ')}
                            {place.lat ? ` · ${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}` : ''}
                          </p>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setShowOsmDropdown(false)}
                        className="w-full px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 rounded-b-md border-t border-zinc-800"
                      >
                        Закрити
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="o-city">Місто</Label>
                  <Input id="o-city" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Київ" />
                </div>
                <div className="space-y-1.5">
                  <Label>Область</Label>
                  <Select value={form.oblast} onValueChange={v => set('oblast', v)}>
                    <SelectTrigger><SelectValue placeholder="Оберіть" /></SelectTrigger>
                    <SelectContent>
                      {OBLAST_OPTIONS.map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-district">Район</Label>
                <Input id="o-district" value={form.district} onChange={e => set('district', e.target.value)} placeholder="Голосіївський" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="o-lat">Широта</Label>
                  <Input id="o-lat" value={form.lat} onChange={e => set('lat', e.target.value)} placeholder="50.4501" type="number" step="any" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="o-lng">Довгота</Label>
                  <Input id="o-lng" value={form.lng} onChange={e => set('lng', e.target.value)} placeholder="30.5234" type="number" step="any" />
                </div>
              </div>
            </section>

            {/* Технічні характеристики */}
            <section className="space-y-3">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Технічні характеристики</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="o-floors">Поверхів</Label>
                  <Input id="o-floors" value={form.floors} onChange={e => set('floors', e.target.value)} placeholder="25" type="number" min="1" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="o-barea">Площа будівлі, м²</Label>
                  <Input id="o-barea" value={form.building_area} onChange={e => set('building_area', e.target.value)} placeholder="15000" type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="o-larea">Площа ділянки, м²</Label>
                  <Input id="o-larea" value={form.land_area} onChange={e => set('land_area', e.target.value)} placeholder="5000" type="number" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="o-stage">Стадія будівництва</Label>
                  <Input id="o-stage" value={form.construction_stage} onChange={e => set('construction_stage', e.target.value)} placeholder="Нульовий цикл" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="o-completion">Планова дата завершення</Label>
                  <Input id="o-completion" value={form.planned_completion} onChange={e => set('planned_completion', e.target.value)} type="date" />
                </div>
              </div>
            </section>

            {/* Учасники */}
            <section className="space-y-3">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Учасники</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="o-customer">Замовник</Label>
                  <Input id="o-customer" value={form.customer} onChange={e => set('customer', e.target.value)} placeholder="Назва замовника" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="o-gc">Генпідрядник</Label>
                  <Input id="o-gc" value={form.general_contractor} onChange={e => set('general_contractor', e.target.value)} placeholder="Назва генпідрядника" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="o-designer">Проектувальник</Label>
                  <Input id="o-designer" value={form.designer} onChange={e => set('designer', e.target.value)} placeholder="Назва проектувальника" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="o-installer">Монтажник</Label>
                  <Input id="o-installer" value={form.installer} onChange={e => set('installer', e.target.value)} placeholder="Назва монтажника" />
                </div>
              </div>
            </section>

            {/* Сайт */}
            <section className="space-y-3">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Контакти</p>
              <div className="space-y-1.5">
                <Label htmlFor="o-website">Сайт</Label>
                <Input
                  id="o-website"
                  type="url"
                  value={form.website}
                  onChange={e => set('website', e.target.value)}
                  placeholder="https://object-site.ua"
                />
              </div>
            </section>

            {/* Опис */}
            <section className="space-y-3">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Опис</p>
              <Textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Детальний опис об'єкту..."
                rows={3}
              />
            </section>

            {/* Фото */}
            <section className="space-y-3">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Фото</p>
              <div className="flex flex-wrap gap-2">
                {form.photos.map((url, i) => (
                  <ImageUpload
                    key={i}
                    value={url}
                    onChange={newUrl => {
                      const next = [...form.photos]
                      if (newUrl) { next[i] = newUrl } else { next.splice(i, 1) }
                      setPhotos(next)
                    }}
                    shape="square"
                    size="md"
                  />
                ))}
                <ImageUpload
                  value=""
                  onChange={newUrl => { if (newUrl) setPhotos([...form.photos, newUrl]) }}
                  shape="square"
                  size="md"
                  placeholder="+ фото"
                />
              </div>
            </section>

            {mutation.isError && (
              <p className="text-sm text-red-400">
                Помилка: {(mutation.error as Error)?.message}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-zinc-700">
                Скасувати
              </Button>
              <Button type="submit" disabled={mutation.isPending || !form.name}>
                {mutation.isPending ? 'Збереження...' : isEditMode ? 'Зберегти зміни' : 'Зберегти'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
