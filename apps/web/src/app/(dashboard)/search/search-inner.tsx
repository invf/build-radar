'use client'

import { useEffect, useRef, useState, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  Search, Loader2, Building, MapPin, Calendar,
  ExternalLink, ChevronDown, ChevronUp, AlertCircle,
  SlidersHorizontal, X, Plus, Bookmark, BookmarkCheck, Pencil, Globe,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api/client'
import { formatCurrency } from '@/lib/utils/format'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UniversalTenderResult {
  id: string
  source: string
  title: string
  status: string
  amount?: number
  currency: string
  deadline?: string
  date_modified?: string
  published_at?: string
  procuring_entity?: string
  procuring_entity_edrpou?: string
  city?: string
  oblast?: string
  country?: string
  region?: string
  donor?: string
  sector?: string
  cpv_codes: string[]
  prozorro_id?: string
  prozorro_url?: string
  source_url?: string
  priority: string
  supply_match: string
}

// raw shape returned by the Prozorro backend
interface ProzorroApiResult {
  prozorro_id: string
  title: string
  status: string
  amount?: number
  currency: string
  deadline?: string
  date_modified?: string
  procuring_entity?: string
  procuring_entity_edrpou?: string
  city?: string
  oblast?: string
  cpv_codes: string[]
  prozorro_url: string
  priority: string
  supply_match: string
}

interface TenderFilters {
  minBudget: string
  maxBudget: string
  oblast: string
  country: string
  donor: string
  sector: string
  priority: string
  supplyMatch: string
  deadlineFrom: string
  deadlineTo: string
  relevantOnly: boolean
}

interface SavedBlock {
  id: string
  name: string
  terms: string[]
}

// ── LocalStorage helpers ──────────────────────────────────────────────────────

const LS_KEY = 'buildaradar_search_blocks'

function loadBlocks(): SavedBlock[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveBlocks(blocks: SavedBlock[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(blocks))
}

// ── API ───────────────────────────────────────────────────────────────────────

async function searchProzorro(terms: string[], filters: TenderFilters): Promise<UniversalTenderResult[]> {
  const params = new URLSearchParams({ q: terms.join(','), limit: '30' })
  if (filters.deadlineFrom) params.set('deadline_from', filters.deadlineFrom)
  if (filters.deadlineTo)   params.set('deadline_to',   filters.deadlineTo)
  const raw = await apiFetch<ProzorroApiResult[]>(`/prozorro/search?${params}`, { timeout: 90_000 })
  return raw.map(r => ({ ...r, id: r.prozorro_id, source: 'prozorro', source_url: r.prozorro_url }))
}

async function searchInternational(terms: string[], filters: TenderFilters): Promise<UniversalTenderResult[]> {
  const params = new URLSearchParams({ q: terms.join(','), limit: '50' })
  if (filters.country)      params.set('country', filters.country)
  if (filters.donor)        params.set('donor', filters.donor)
  if (filters.sector)       params.set('sector', filters.sector)
  if (filters.relevantOnly) params.set('relevant_only', 'true')
  if (filters.deadlineFrom) params.set('deadline_from', filters.deadlineFrom)
  if (filters.deadlineTo)   params.set('deadline_to',   filters.deadlineTo)
  if (filters.minBudget)    params.set('min_budget', filters.minBudget)
  if (filters.maxBudget)    params.set('max_budget', filters.maxBudget)
  return apiFetch<UniversalTenderResult[]>(`/international/search?${params}`, { timeout: 30_000 })
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SUGGESTIONS = ['ІТП', 'Тепловий пункт', 'Теплообмінник', 'Насосна станція', 'Котельня', 'ЦТП', 'Водопостачання']
const INTL_SUGGESTIONS = ['Heat Exchanger', 'Water Supply', 'District Heating', 'Heating Equipment', 'ITP', 'Boiler', 'Pumping Station', 'Heat Substation']

const INTL_DONORS = ['NEFCO', 'GIZ', 'EBRD', 'World Bank', 'EIB', 'KfW', 'UNDP', 'UNICEF', 'UNOPS', 'USAID', 'AFD', 'European Commission', 'IFC']
const INTL_COUNTRIES = ['Ukraine', 'Moldova', 'Georgia', 'Armenia', 'Azerbaijan', 'Kyrgyzstan', 'Tajikistan', 'Uzbekistan', 'Belarus']
const INTL_SECTORS = [
  'District Heating', 'Heat Substations', 'Water Supply',
  'Water & Sanitation', 'Energy Efficiency', 'Heating Equipment',
  'Water & Heating', 'Energy Resilience', 'Heat Exchange',
]

const PRIORITY_CONFIG: Record<string, { label: string; cls: string; dotCls: string }> = {
  high:   { label: 'Високий пріоритет',  cls: 'border-green-500/40 text-green-400 bg-green-500/8',    dotCls: 'text-green-400'  },
  medium: { label: 'Середній пріоритет', cls: 'border-yellow-500/40 text-yellow-400 bg-yellow-500/8', dotCls: 'text-yellow-400' },
  low:    { label: 'Низький пріоритет',  cls: 'border-red-500/40 text-red-400 bg-red-500/8',          dotCls: 'text-red-400'    },
}

const SUPPLY_CONFIG: Record<string, { label: string; icon: string; cls: string }> = {
  full:    { label: 'Повна відповідність',    icon: '✅', cls: 'border-green-500/30 text-green-400'  },
  partial: { label: 'Часткова відповідність', icon: '⚠',  cls: 'border-yellow-500/30 text-yellow-400' },
  none:    { label: 'Не відповідає',          icon: '❌', cls: 'border-red-500/30 text-red-500'       },
}

const UKRAINE_OBLASTS = [
  'Вінницька', 'Волинська', 'Дніпропетровська', 'Донецька', 'Житомирська',
  'Закарпатська', 'Запорізька', 'Івано-Франківська', 'Київська', 'Кіровоградська',
  'Луганська', 'Львівська', 'Миколаївська', 'Одеська', 'Полтавська',
  'Рівненська', 'Сумська', 'Тернопільська', 'Харківська', 'Херсонська',
  'Хмельницька', 'Черкаська', 'Чернівецька', 'Чернігівська', 'м. Київ',
]

const DEFAULT_FILTERS: TenderFilters = {
  minBudget: '', maxBudget: '',
  oblast: '', country: '', donor: '', sector: '',
  priority: '', supplyMatch: '',
  deadlineFrom: '', deadlineTo: '',
  relevantOnly: false,
}

// ── Badges ────────────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority]
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border ${cfg.cls}`}>
      <span className={cfg.dotCls}>●</span>{cfg.label}
    </span>
  )
}

function SupplyBadge({ supplyMatch }: { supplyMatch: string }) {
  const cfg = SUPPLY_CONFIG[supplyMatch]
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

// ── Stats Widget ──────────────────────────────────────────────────────────────

function StatsWidget({ tenders }: { tenders: UniversalTenderResult[] }) {
  const high   = tenders.filter((t) => t.priority === 'high').length
  const medium = tenders.filter((t) => t.priority === 'medium').length
  const low    = tenders.filter((t) => t.priority === 'low').length
  const totalBudget = tenders.reduce((s, t) => s + (t.amount || 0), 0)

  const stats = [
    { label: 'Знайдено тендерів',  value: String(tenders.length), cls: 'text-zinc-100'  },
    { label: 'Високий пріоритет',  value: String(high),           cls: 'text-green-400' },
    { label: 'Середній пріоритет', value: String(medium),         cls: 'text-yellow-400'},
    { label: 'Низький пріоритет',  value: String(low),            cls: 'text-red-400'   },
    { label: 'Загальний бюджет',   value: formatCurrency(totalBudget), cls: 'text-zinc-100' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px rounded-xl border border-zinc-800 overflow-hidden bg-zinc-800">
      {stats.map((s) => (
        <div key={s.label} className="bg-zinc-900/80 px-4 py-3 flex flex-col gap-0.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider leading-none">{s.label}</span>
          <span className={`text-lg font-semibold leading-tight ${s.cls}`}>{s.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Tender Card ───────────────────────────────────────────────────────────────

interface TenderCardProps {
  t: UniversalTenderResult
  searchTerms: string[]
  onConsider?: () => void
  isSaving?: boolean
  isSaved?: boolean
}

function TenderCard({ t, searchTerms, onConsider, isSaving, isSaved }: TenderCardProps) {
  const [expanded, setExpanded] = useState(false)

  const deadline  = t.deadline      ? new Date(t.deadline).toLocaleDateString('uk-UA')      : null
  const modified  = t.date_modified ? new Date(t.date_modified).toLocaleDateString('uk-UA') : null
  const published = t.published_at  ? new Date(t.published_at).toLocaleDateString('uk-UA')  : null
  const dateLabel = modified ? `оновлено ${modified}` : published ? `опубліковано ${published}` : null

  const matchedTerms = searchTerms.filter((term) =>
    (t.title || '').toLowerCase().includes(term.toLowerCase())
  )

  const tenderUrl = t.source_url || t.prozorro_url || undefined
  const isIntl = t.source !== 'prozorro'

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden hover:border-zinc-700 transition-all">
      <div className="p-4 space-y-2.5">
        <div className="flex items-start gap-3">
          {tenderUrl ? (
            <a href={tenderUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 text-sm font-medium text-zinc-100 hover:text-brand-300 transition-colors leading-snug line-clamp-2">
              {t.title}
            </a>
          ) : (
            <span className="flex-1 text-sm font-medium text-zinc-100 leading-snug line-clamp-2">
              {t.title}
            </span>
          )}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <PriorityBadge priority={t.priority} />
            <SupplyBadge supplyMatch={t.supply_match} />
          </div>
        </div>

        {matchedTerms.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {matchedTerms.map((term) => (
              <span key={term}
                className="text-[10px] px-1.5 py-0.5 rounded bg-brand-600/15 text-brand-400 border border-brand-600/20">
                {term}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
          {t.amount != null && (
            <span className="font-semibold text-zinc-300 text-sm">
              {formatCurrency(t.amount, t.currency)}
            </span>
          )}
          {isIntl && t.donor && (
            <span className="flex items-center gap-1 text-blue-400">
              <Globe className="h-3 w-3" />
              {t.donor}
            </span>
          )}
          {(isIntl ? (t.country || t.region) : (t.city || t.oblast)) && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {isIntl
                ? [t.country, t.region].filter(Boolean).join(' · ')
                : [t.city, t.oblast].filter(Boolean).join(', ')
              }
            </span>
          )}
          {isIntl && t.sector && (
            <span className="text-zinc-500">{t.sector}</span>
          )}
          {deadline && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />до {deadline}
            </span>
          )}
          {dateLabel && (
            <span className="text-zinc-600">{dateLabel}</span>
          )}
          {t.cpv_codes.length > 0 && (
            <span className="font-mono text-zinc-600">{t.cpv_codes[0]}</span>
          )}
        </div>

        {expanded && t.procuring_entity && (
          <div className="flex items-start gap-2 pt-1 border-t border-zinc-800">
            <Building className="h-3.5 w-3.5 text-zinc-600 shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-400">
              {t.procuring_entity}
              {t.procuring_entity_edrpou && (
                <span className="font-mono text-brand-400/70 ml-2">ЄДРПОУ {t.procuring_entity_edrpou}</span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-3">
            {tenderUrl ? (
              <a href={tenderUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                title={isIntl ? `Портал закупівель ${t.source || ''}` : `Відкрити на Prozorro`}>
                <ExternalLink className="h-3 w-3" />
                {isIntl ? `${t.source || 'Джерело'} ↗` : 'Prozorro'}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
                <ExternalLink className="h-3 w-3" />
                {t.source || 'Джерело'}
              </span>
            )}
            {onConsider && (
              <button
                type="button"
                onClick={onConsider}
                disabled={isSaving || isSaved}
                className={`inline-flex items-center gap-1 text-xs transition-colors ${
                  isSaved
                    ? 'text-green-400 cursor-default'
                    : 'text-zinc-500 hover:text-brand-400'
                }`}
                title={isSaved ? 'Додано до тендерів' : 'Зберегти до тендерів'}
              >
                {isSaving
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : isSaved
                  ? <BookmarkCheck className="h-3 w-3" />
                  : <Bookmark className="h-3 w-3" />
                }
                {isSaved ? 'Розглянуто' : 'Розглянути'}
              </button>
            )}
          </div>
          {t.procuring_entity && (
            <button onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 flex items-center gap-0.5">
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Менше' : 'Замовник'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Term Tag ──────────────────────────────────────────────────────────────────

function TermTag({ term, onRemove }: { term: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-brand-600/20 text-brand-300 border border-brand-600/30 rounded-full pl-2.5 pr-1 py-0.5 text-sm">
      {term}
      <button
        type="button"
        onClick={onRemove}
        className="flex items-center justify-center h-4 w-4 rounded-full hover:bg-brand-500/30 transition-colors"
        title={`Прибрати «${term}»`}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  )
}

// ── Saved Blocks Panel ────────────────────────────────────────────────────────

interface SavedBlocksPanelProps {
  blocks: SavedBlock[]
  activeTerms: string[]
  onApply: (terms: string[]) => void
  onMerge: (terms: string[]) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onSaveCurrent: (name: string) => void
}

function SavedBlocksPanel({
  blocks, activeTerms, onApply, onMerge, onDelete, onRename, onSaveCurrent,
}: SavedBlocksPanelProps) {
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const saveInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const handleSave = () => {
    const name = newName.trim()
    if (!name) return
    onSaveCurrent(name)
    setNewName('')
    setSaving(false)
  }

  const handleSaveKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave() }
    if (e.key === 'Escape') { setSaving(false); setNewName('') }
  }

  const startRename = (block: SavedBlock) => {
    setRenamingId(block.id)
    setRenameValue(block.name)
    setTimeout(() => renameInputRef.current?.focus(), 0)
  }

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }

  const handleRenameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitRename() }
    if (e.key === 'Escape') setRenamingId(null)
  }

  const isCurrentSaved = blocks.some(
    (b) => b.terms.length === activeTerms.length &&
      b.terms.every((t) => activeTerms.map((a) => a.toLowerCase()).includes(t.toLowerCase()))
  )

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
          <Bookmark className="h-3 w-3" />
          Збережені набори
        </span>

        {/* Save current terms button */}
        {activeTerms.length > 0 && !isCurrentSaved && !saving && (
          <button
            onClick={() => { setSaving(true); setTimeout(() => saveInputRef.current?.focus(), 0) }}
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-brand-400 transition-colors"
          >
            <Plus className="h-3 w-3" />Зберегти поточний набір
          </button>
        )}
        {activeTerms.length > 0 && isCurrentSaved && (
          <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
            <BookmarkCheck className="h-3 w-3" />збережено
          </span>
        )}
      </div>

      {/* Inline name input for saving */}
      {saving && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-brand-600/30 bg-brand-600/5">
          <Bookmark className="h-3.5 w-3.5 text-brand-400 shrink-0" />
          <span className="text-xs text-zinc-500 shrink-0">Назва:</span>
          <input
            ref={saveInputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleSaveKeyDown}
            placeholder="напр. Насоси та арматура"
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
          />
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={handleSave}
              disabled={!newName.trim()}
              className="px-2 py-1 rounded text-xs bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 transition-colors">
              Зберегти
            </button>
            <button onClick={() => { setSaving(false); setNewName('') }}
              className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Preview terms being saved */}
          <div className="flex flex-wrap gap-1 mt-0 ml-1">
            {activeTerms.map((t) => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Block cards */}
      {blocks.length === 0 && !saving ? (
        <p className="text-xs text-zinc-600 italic py-1">
          Немає збережених наборів — додайте терміни до пошуку і натисніть «Зберегти поточний набір»
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {blocks.map((block) => {
            const isActive = block.terms.length === activeTerms.length &&
              block.terms.every((t) => activeTerms.map((a) => a.toLowerCase()).includes(t.toLowerCase()))

            return (
              <div
                key={block.id}
                className={`group flex items-stretch rounded-lg border transition-all overflow-hidden ${
                  isActive
                    ? 'border-brand-500/50 bg-brand-600/10'
                    : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                }`}
              >
                {/* Main clickable area — apply block */}
                <button
                  type="button"
                  onClick={() => onApply(block.terms)}
                  className="flex flex-col items-start px-3 py-2 gap-1 text-left min-w-0"
                  title={`Застосувати набір «${block.name}»`}
                >
                  {renamingId === block.id ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      onBlur={commitRename}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-transparent text-sm font-medium text-zinc-100 outline-none border-b border-brand-500 w-full"
                    />
                  ) : (
                    <span className={`text-sm font-medium leading-none ${isActive ? 'text-brand-300' : 'text-zinc-200'}`}>
                      {block.name}
                    </span>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {block.terms.slice(0, 4).map((t) => (
                      <span key={t} className="text-[10px] text-zinc-500">{t}</span>
                    ))}
                    {block.terms.length > 4 && (
                      <span className="text-[10px] text-zinc-600">+{block.terms.length - 4}</span>
                    )}
                  </div>
                </button>

                {/* Action buttons */}
                <div className="flex flex-col border-l border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Merge — add to current without replacing */}
                  <button
                    type="button"
                    onClick={() => onMerge(block.terms)}
                    className="flex-1 px-2 flex items-center justify-center text-zinc-600 hover:text-brand-400 hover:bg-brand-600/10 transition-colors"
                    title={`Додати до поточного пошуку`}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  {/* Rename */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); startRename(block) }}
                    className="flex-1 px-2 flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors border-t border-zinc-800"
                    title="Перейменувати"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => onDelete(block.id)}
                    className="flex-1 px-2 flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors border-t border-zinc-800"
                    title="Видалити набір"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

function parseTermsFromUrl(q: string): string[] {
  return q.split(',').map((t) => t.trim()).filter(Boolean)
}

export function SearchPageInner({
  initialQ,
  basePath = '/search',
  showHeader = true,
  source = 'prozorro',
}: {
  initialQ: string
  basePath?: string
  showHeader?: boolean
  source?: 'prozorro' | 'international'
}) {
  const router = useRouter()

  const [terms, setTerms] = useState<string[]>(() => parseTermsFromUrl(initialQ))
  const [inputValue, setInputValue] = useState('')
  const [submittedTerms, setSubmittedTerms] = useState<string[]>(() => parseTermsFromUrl(initialQ))

  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<TenderFilters>(DEFAULT_FILTERS)
  const inputRef = useRef<HTMLInputElement>(null)

  // Consider (save to tenders DB)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [saveError, setSaveError] = useState<string | null>(null)

  const considerTender = async (t: UniversalTenderResult) => {
    if (savedIds.has(t.id)) return
    setSavingId(t.id)
    setSaveError(null)
    try {
      await apiFetch('/tenders', {
        method: 'POST',
        data: {
          prozorro_id: t.prozorro_id || t.id,
          title: t.title,
          status: t.status,
          amount: t.amount,
          currency: t.currency,
          deadline: t.deadline,
          procuring_entity: t.procuring_entity,
          procuring_entity_edrpou: t.procuring_entity_edrpou,
          source: t.source || 'prozorro',
          source_url: t.source_url || t.prozorro_url,
          country: t.country,
          donor: t.donor,
          sector: t.sector,
        },
      })
      setSavedIds(prev => new Set([...prev, t.id]))
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        // already saved — mark as such
        setSavedIds(prev => new Set([...prev, t.id]))
      } else {
        setSaveError('Не вдалось зберегти тендер. Спробуйте ще раз.')
      }
    } finally {
      setSavingId(null)
    }
  }

  // Saved blocks — persisted in localStorage
  const [savedBlocks, setSavedBlocks] = useState<SavedBlock[]>([])

  // Load from localStorage after hydration
  useEffect(() => {
    setSavedBlocks(loadBlocks())
  }, [])

  // Persist on change
  useEffect(() => {
    saveBlocks(savedBlocks)
  }, [savedBlocks])

  // Sync URL params → state on browser back/forward
  useEffect(() => {
    const parsed = parseTermsFromUrl(initialQ)
    setTerms(parsed)
    setSubmittedTerms(parsed)
  }, [initialQ])

  // ── Term helpers ──────────────────────────────────────────────────────────

  const addTerm = (raw: string) => {
    const value = raw.trim()
    if (!value) return
    const newTerms = value.split(',').map((t) => t.trim()).filter(Boolean)
    setTerms((prev) => {
      const unique = newTerms.filter((t) => !prev.map((p) => p.toLowerCase()).includes(t.toLowerCase()))
      return [...prev, ...unique]
    })
    setInputValue('')
  }

  const removeTerm = (index: number) => {
    setTerms((prev) => prev.filter((_, i) => i !== index))
  }

  const mergeTerms = (newTerms: string[]) => {
    setTerms((prev) => {
      const prevLower = prev.map((p) => p.toLowerCase())
      const unique = newTerms.filter((t) => !prevLower.includes(t.toLowerCase()))
      return [...prev, ...unique]
    })
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (inputValue.trim()) {
        addTerm(inputValue)
      } else if (terms.length > 0) {
        doSearch(terms)
      }
    } else if (e.key === ',') {
      e.preventDefault()
      addTerm(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && terms.length > 0) {
      setTerms((prev) => prev.slice(0, -1))
    }
  }

  const doSearch = (searchTerms: string[]) => {
    if (searchTerms.length === 0 && source === 'prozorro') return
    setSubmittedTerms(searchTerms)
    router.push(`${basePath}?q=${encodeURIComponent(searchTerms.join(','))}`, { scroll: false })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const allTerms = inputValue.trim()
      ? [...terms, ...inputValue.split(',').map((t) => t.trim()).filter(Boolean)]
      : terms
    const unique = [...new Set(allTerms)]
    setTerms(unique)
    setInputValue('')
    doSearch(unique)
  }

  // ── Block helpers ─────────────────────────────────────────────────────────

  const saveCurrentAsBlock = (name: string) => {
    const block: SavedBlock = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      terms: [...terms],
    }
    setSavedBlocks((prev) => [block, ...prev])
  }

  const deleteBlock = (id: string) => {
    setSavedBlocks((prev) => prev.filter((b) => b.id !== id))
  }

  const renameBlock = (id: string, name: string) => {
    setSavedBlocks((prev) => prev.map((b) => b.id === id ? { ...b, name } : b))
  }

  const applyBlock = (blockTerms: string[]) => {
    setTerms(blockTerms)
    setInputValue('')
    doSearch(blockTerms)
  }

  // ── Misc ──────────────────────────────────────────────────────────────────

  const activeSuggestions = source === 'international' ? INTL_SUGGESTIONS : SUGGESTIONS

  const handleSuggestion = (s: string) => {
    setTerms([s])
    setInputValue('')
    doSearch([s])
  }

  const addSuggestionToTerms = (s: string) => {
    setTerms((prev) => {
      if (prev.map((p) => p.toLowerCase()).includes(s.toLowerCase())) return prev
      return [...prev, s]
    })
    inputRef.current?.focus()
  }

  // For international, always enabled (shows all tenders on mount); for Prozorro require a query
  const enabled = source === 'international' ? true : submittedTerms.length > 0
  const activeFilterCount = Object.values(filters).filter(Boolean).length

  const queryKey = source === 'international'
    ? [
        'intl-search', submittedTerms.join(','),
        filters.country, filters.donor, filters.sector, String(filters.relevantOnly),
        filters.deadlineFrom, filters.deadlineTo, filters.minBudget, filters.maxBudget,
      ]
    : ['prozorro-search', submittedTerms.join(','), filters.deadlineFrom, filters.deadlineTo]

  const { data: results = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: () =>
      source === 'international'
        ? searchInternational(submittedTerms, filters)
        : searchProzorro(submittedTerms, filters),
    enabled,
    staleTime: 60_000,
    retry: 1,
  })

  const filtered = results.filter((t) => {
    if (filters.minBudget && (t.amount ?? 0) < Number(filters.minBudget)) return false
    if (filters.maxBudget && (t.amount ?? 0) > Number(filters.maxBudget)) return false
    if (source === 'prozorro' && filters.oblast && !(t.oblast ?? '').toLowerCase().includes(filters.oblast.toLowerCase())) return false
    if (filters.priority    && t.priority     !== filters.priority)    return false
    if (filters.supplyMatch && t.supply_match !== filters.supplyMatch) return false
    return true
  })

  return (
    <div className={showHeader ? 'p-4 md:p-6 space-y-4 md:space-y-5 animate-fade-in' : 'space-y-4 md:space-y-5'}>
      {showHeader && (
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            {source === 'international' ? 'Міжнародні тендери' : 'Пошук тендерів'}
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {source === 'international'
              ? 'NEFCO · GIZ · EBRD · World Bank · USAID · UNDP · EIB · KfW та інші'
              : 'Prozorro · кілька термінів одночасно · автоматична оцінка пріоритету'
            }
          </p>
        </div>
      )}

      {/* Search bar with tags */}
      <form onSubmit={handleSubmit} className="space-y-2 max-w-3xl">
        <div
          className="flex flex-wrap items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 focus-within:border-brand-500 transition-colors cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          <Search className="h-4 w-4 text-zinc-500 shrink-0" />

          {terms.map((term, i) => (
            <TermTag key={i} term={term} onRemove={() => removeTerm(i)} />
          ))}

          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              terms.length === 0
                ? (source === 'international'
                    ? 'Heat exchanger, water supply, ITP... (Enter or comma — add term)'
                    : 'ІТП, теплообмінник, насосна станція... (Enter або кома — додати)')
                : 'Додати термін...'
            }
            className="flex-1 min-w-[180px] bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none py-0.5"
          />

          {(terms.length > 0 || inputValue) && (
            <button
              type="button"
              onClick={() => { setTerms([]); setInputValue(''); router.push(basePath, { scroll: false }) }}
              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors ml-auto"
              title="Очистити всі терміни"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-600">
            Enter або кома — додати термін&ensp;·&ensp;Backspace — видалити останній&ensp;·&ensp;{' '}
            {terms.length > 1
              ? <span className="text-brand-400">шукає де є хоча б один з {terms.length} термінів</span>
              : <span>можна додати кілька для ширшого охоплення</span>
            }
          </p>
          <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white h-9 px-5 shrink-0">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Знайти'}
          </Button>
        </div>
      </form>

      {/* Saved blocks */}
      <SavedBlocksPanel
        blocks={savedBlocks}
        activeTerms={terms}
        onApply={applyBlock}
        onMerge={mergeTerms}
        onDelete={deleteBlock}
        onRename={renameBlock}
        onSaveCurrent={saveCurrentAsBlock}
      />

      {/* Quick suggestions (when no terms yet) */}
      {terms.length === 0 && !inputValue && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-600 uppercase tracking-wider">Популярні терміни</p>
          <div className="flex flex-wrap gap-2">
            {activeSuggestions.map((s) => (
              <button key={s} onClick={() => handleSuggestion(s)}
                className="rounded-full border border-zinc-800 px-3 py-1 text-sm text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add-to-search chips when already have terms */}
      {terms.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-600">Додати до пошуку:</span>
          {activeSuggestions
            .filter((s) => !terms.map((t) => t.toLowerCase()).includes(s.toLowerCase()))
            .slice(0, 5)
            .map((s) => (
              <button key={s} onClick={() => addSuggestionToTerms(s)}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-800 pl-2 pr-2 py-0.5 text-xs text-zinc-500 hover:border-brand-600/40 hover:text-brand-400 transition-colors">
                <Plus className="h-3 w-3" />{s}
              </button>
            ))}
        </div>
      )}

      {/* Results area */}
      {enabled && (
        <div className="space-y-4">
          {!isLoading && !error && filtered.length > 0 && (
            <StatsWidget tenders={filtered} />
          )}

          <div className="flex items-center justify-between">
            <button onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Фільтри
              {activeFilterCount > 0 && (
                <span className="bg-brand-600 text-white rounded-full text-[10px] px-1.5 py-0.5 leading-none">
                  {activeFilterCount}
                </span>
              )}
              {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {activeFilterCount > 0 && (
              <button onClick={() => setFilters(DEFAULT_FILTERS)}
                className="text-xs text-zinc-600 hover:text-zinc-400 flex items-center gap-1">
                <X className="h-3 w-3" />Скинути
              </button>
            )}
          </div>

          {/* Prozorro filters */}
          {showFilters && source === 'prozorro' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2 p-3 rounded-xl border border-zinc-800 bg-zinc-900/50">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Мін. бюджет</label>
                <Input placeholder="0" type="number" value={filters.minBudget}
                  onChange={(e) => setFilters((f) => ({ ...f, minBudget: e.target.value }))}
                  className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Макс. бюджет</label>
                <Input placeholder="∞" type="number" value={filters.maxBudget}
                  onChange={(e) => setFilters((f) => ({ ...f, maxBudget: e.target.value }))}
                  className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Дедлайн від</label>
                <Input type="date" value={filters.deadlineFrom}
                  onChange={(e) => setFilters((f) => ({ ...f, deadlineFrom: e.target.value }))}
                  className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Дедлайн до</label>
                <Input type="date" value={filters.deadlineTo}
                  onChange={(e) => setFilters((f) => ({ ...f, deadlineTo: e.target.value }))}
                  className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Область</label>
                <select value={filters.oblast}
                  onChange={(e) => setFilters((f) => ({ ...f, oblast: e.target.value }))}
                  className="w-full h-8 text-xs rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 px-2 focus:outline-none focus:ring-1 focus:ring-brand-500">
                  <option value="">Всі</option>
                  {UKRAINE_OBLASTS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Пріоритет</label>
                <select value={filters.priority}
                  onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
                  className="w-full h-8 text-xs rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 px-2 focus:outline-none focus:ring-1 focus:ring-brand-500">
                  <option value="">Всі</option>
                  <option value="high">🟢 Високий</option>
                  <option value="medium">🟡 Середній</option>
                  <option value="low">🔴 Низький</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Відповідність</label>
                <select value={filters.supplyMatch}
                  onChange={(e) => setFilters((f) => ({ ...f, supplyMatch: e.target.value }))}
                  className="w-full h-8 text-xs rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 px-2 focus:outline-none focus:ring-1 focus:ring-brand-500">
                  <option value="">Будь-яка</option>
                  <option value="full">✅ Повна</option>
                  <option value="partial">⚠ Часткова</option>
                  <option value="none">❌ Не відповідає</option>
                </select>
              </div>
            </div>
          )}

          {/* International filters */}
          {showFilters && source === 'international' && (
            <div className="space-y-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/50">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Мін. бюджет</label>
                  <Input placeholder="0" type="number" value={filters.minBudget}
                    onChange={(e) => setFilters((f) => ({ ...f, minBudget: e.target.value }))}
                    className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Макс. бюджет</label>
                  <Input placeholder="∞" type="number" value={filters.maxBudget}
                    onChange={(e) => setFilters((f) => ({ ...f, maxBudget: e.target.value }))}
                    className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Дедлайн від</label>
                  <Input type="date" value={filters.deadlineFrom}
                    onChange={(e) => setFilters((f) => ({ ...f, deadlineFrom: e.target.value }))}
                    className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Дедлайн до</label>
                  <Input type="date" value={filters.deadlineTo}
                    onChange={(e) => setFilters((f) => ({ ...f, deadlineTo: e.target.value }))}
                    className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Країна</label>
                  <select value={filters.country}
                    onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
                    className="w-full h-8 text-xs rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 px-2 focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="">Всі</option>
                    {INTL_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Донор</label>
                  <select value={filters.donor}
                    onChange={(e) => setFilters((f) => ({ ...f, donor: e.target.value }))}
                    className="w-full h-8 text-xs rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 px-2 focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="">Всі</option>
                    {INTL_DONORS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Сектор</label>
                  <select value={filters.sector}
                    onChange={(e) => setFilters((f) => ({ ...f, sector: e.target.value }))}
                    className="w-full h-8 text-xs rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 px-2 focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="">Всі</option>
                    {INTL_SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Пріоритет</label>
                  <select value={filters.priority}
                    onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
                    className="w-full h-8 text-xs rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 px-2 focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="">Всі</option>
                    <option value="high">🟢 Високий</option>
                    <option value="medium">🟡 Середній</option>
                    <option value="low">🔴 Низький</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Відповідність</label>
                  <select value={filters.supplyMatch}
                    onChange={(e) => setFilters((f) => ({ ...f, supplyMatch: e.target.value }))}
                    className="w-full h-8 text-xs rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 px-2 focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="">Будь-яка</option>
                    <option value="full">✅ Повна</option>
                    <option value="partial">⚠ Часткова</option>
                    <option value="none">❌ Не відповідає</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filters.relevantOnly}
                  onChange={(e) => setFilters((f) => ({ ...f, relevantOnly: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800 accent-brand-600"
                />
                <span className="text-xs text-zinc-400">
                  Лише релевантні нашій продукції (опалення, водопостачання)
                </span>
              </label>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {source === 'international'
                ? 'Не вдалось завантажити міжнародні тендери. Спробуйте пізніше.'
                : 'Prozorro тимчасово недоступний. Спробуйте пізніше або перевірте підключення.'
              }
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <span className="block text-zinc-500 text-sm">
                {results.length > 0
                  ? `Знайдено ${results.length} тендерів, але всі відфільтровані — змініть фільтри`
                  : source === 'international'
                  ? 'Не знайдено міжнародних тендерів за цим запитом'
                  : 'Prozorro не повернув результатів за цими запитами'
                }
              </span>
              <span className="block text-zinc-600 text-xs mt-1">
                {source === 'international'
                  ? 'Спробуйте: Heat Exchanger, Water Supply, District Heating'
                  : 'Спробуйте: тепловий пункт, ІТП, теплообмінник, насосна станція'
                }
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {saveError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400 flex items-center justify-between gap-2">
                  <span>{saveError}</span>
                  <button type="button" onClick={() => setSaveError(null)} className="text-red-400/60 hover:text-red-300">✕</button>
                </div>
              )}
              {filtered.map((t) => (
                <TenderCard
                  key={t.id}
                  t={t}
                  searchTerms={submittedTerms}
                  onConsider={() => considerTender(t)}
                  isSaving={savingId === t.id}
                  isSaved={savedIds.has(t.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
