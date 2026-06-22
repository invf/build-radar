'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Plus, Sparkles, AlertTriangle, Trash2, Search, Loader2, Globe, X, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ImageUpload } from '@/components/ui/image-upload'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { companiesApi, type CompanyCreatePayload } from '@/lib/api/companies'
import { aiEnrichApi, type CompanyEnrichResult, type WebEnrichResult } from '@/lib/api/ai-enrich'
import { searchApi, type EdrpouCompany } from '@/lib/api/search'
import { saveCompanyFormDraft, projectFromRegistryObject, type CompanyFormDraft } from '@/lib/company-form-draft'
import type { Company, CompanyContact, CompanyProject } from '@/types'

const COMPANY_ROLE_LABELS = {
  developer: 'Забудовник',
  general_contractor: 'Ген. підрядник',
  subcontractor: 'Субпідрядник',
  designer: 'Проектувальник',
  engineering: 'Інжиніринг',
  technical_supervision: 'Тех. нагляд',
  architect: 'Архітектор',
  investor: 'Інвестор',
}

const EMPTY_CONTACT: CompanyContact = {
  name: '', position: '', phone: '', email: '', telegram: '', viber: '', notes: '', photo_url: '',
}

const EMPTY_PROJECT: CompanyProject = {
  object_name: '', address: '', queue: '', deadline: '', customer: '', contractor: '', installer: '', supplier: '', designer: '', notes: '', photos: [],
}

const EMPTY_FORM: CompanyCreatePayload = {
  name: '', edrpou: '', type: '', address: '',
  phone: '', email: '', website: '', description: '',
  logo_url: '', contacts: [], projects: [],
}

const CONFIDENCE_LABELS = { high: 'висока', medium: 'середня', low: 'низька' }
const CONFIDENCE_COLORS = {
  high: 'text-green-400 border-green-500/30 bg-green-500/10',
  medium: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
  low: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
}

interface CompanyFormModalProps {
  initialData?: Company
  initialDraft?: CompanyFormDraft
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CompanyFormModal({ initialData, initialDraft, open: controlledOpen, onOpenChange }: CompanyFormModalProps = {}) {
  const isEditMode = !!initialData
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const [form, setForm] = useState<CompanyCreatePayload>(EMPTY_FORM)
  const [contacts, setContacts] = useState<CompanyContact[]>([])
  const [projects, setProjects] = useState<CompanyProject[]>([])
  const [aiResult, setAiResult] = useState<CompanyEnrichResult | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [webResult, setWebResult] = useState<WebEnrichResult | null>(null)
  const [webLoading, setWebLoading] = useState(false)
  const [showWebInput, setShowWebInput] = useState(false)
  const [webUrlInput, setWebUrlInput] = useState('')
  const [edrpouResults, setEdrpouResults] = useState<EdrpouCompany[]>([])
  const [edrpouLoading, setEdrpouLoading] = useState(false)
  const [showEdrpouDropdown, setShowEdrpouDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState<'main' | 'contacts' | 'projects'>('main')
  const qc = useQueryClient()

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v)
    else setInternalOpen(v)
  }

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM)
      setContacts([])
      setProjects([])
      setAiResult(null)
      setActiveTab('main')
      return
    }

    if (initialDraft) {
      setForm({ ...EMPTY_FORM, ...initialDraft.form })
      setContacts(initialDraft.contacts)
      setProjects(initialDraft.projects.map((p) => ({ ...EMPTY_PROJECT, ...p, photos: p.photos ?? [] })))
      setActiveTab(initialDraft.activeTab)
      return
    }

    if (initialData) {
      setForm({
        name: initialData.name || '',
        edrpou: initialData.edrpou || '',
        type: initialData.type || '',
        address: initialData.address || '',
        phone: initialData.phone || '',
        email: initialData.email || '',
        website: initialData.website || '',
        description: initialData.description || '',
        logo_url: initialData.logo_url || '',
      })
      setContacts((initialData.contacts ?? []).map(c => ({ ...EMPTY_CONTACT, ...c })))
      setProjects((initialData.projects ?? []).map(p => ({ ...EMPTY_PROJECT, ...p, photos: p.photos ?? [] })))

      companiesApi.listObjects(initialData.id).then((linked) => {
        const fromRegistry = linked.map((obj) => projectFromRegistryObject(obj))
        setProjects((prev) => {
          const existingIds = new Set(prev.map((p) => p.object_id).filter(Boolean))
          const existingNames = new Set(prev.map((p) => p.object_name.trim().toLowerCase()).filter(Boolean))
          const newOnes = fromRegistry.filter(
            (p) => !existingIds.has(p.object_id!) && !existingNames.has(p.object_name.trim().toLowerCase()),
          )
          return newOnes.length > 0 ? [...prev, ...newOnes] : prev
        })
      }).catch(() => {})
    }
  }, [open, initialData, initialDraft])

  const mutation = useMutation({
    mutationFn: async (payload: CompanyCreatePayload) => {
      const company = isEditMode
        ? await companiesApi.update(initialData!.id, payload)
        : await companiesApi.create(payload)

      const objectIds = [...new Set(
        (payload.projects ?? [])
          .map((p) => p.object_id)
          .filter((id): id is string => !!id),
      )]

      await Promise.all(objectIds.map((id) => companiesApi.linkObject(company.id, id)))
      return company
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      if (isEditMode) {
        qc.invalidateQueries({ queryKey: ['company-objects', initialData!.id] })
        qc.invalidateQueries({ queryKey: ['company', initialData!.id] })
      }
      const linkedIds = (variables.projects ?? [])
        .map((p) => p.object_id)
        .filter((id): id is string => !!id)
      if (linkedIds.length > 0) {
        qc.invalidateQueries({ queryKey: ['objects'] })
      }
      setOpen(false)
    },
  })

  const setField = (field: keyof Omit<CompanyCreatePayload, 'contacts' | 'projects'>, value: string) =>
    setForm(f => ({ ...f, [field]: value }))

  // ── Contacts helpers ────────────────────────────────────────────────────────
  const addContact = () => setContacts(c => [...c, { ...EMPTY_CONTACT }])
  const removeContact = (i: number) => setContacts(c => c.filter((_, idx) => idx !== i))
  const setContactField = (i: number, field: keyof CompanyContact, value: string) =>
    setContacts(c => c.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  // ── Projects helpers ────────────────────────────────────────────────────────
  const addProject = () => setProjects(p => [...p, { ...EMPTY_PROJECT }])
  const handleGoPickObjects = () => {
    saveCompanyFormDraft({
      form: {
        name: form.name,
        edrpou: form.edrpou,
        type: form.type,
        address: form.address,
        phone: form.phone,
        email: form.email,
        website: form.website,
        description: form.description,
        logo_url: form.logo_url,
      },
      contacts,
      projects,
      companyId: initialData?.id,
      isEditMode,
      activeTab: 'projects',
    })
    setOpen(false)
    router.push('/objects?pickFor=company')
  }
  const removeProject = (i: number) => setProjects(p => p.filter((_, idx) => idx !== i))
  const setProjectField = (i: number, field: keyof CompanyProject, value: string | string[]) =>
    setProjects(p => p.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const handleEdrpouSearch = async () => {
    const q = form.edrpou?.trim() || form.name?.trim()
    if (!q) return
    setEdrpouLoading(true)
    setEdrpouResults([])
    try {
      const items = await searchApi.searchCompanies(q)
      setEdrpouResults(items)
      setShowEdrpouDropdown(items.length > 0)
    } catch {
      setEdrpouResults([])
    } finally {
      setEdrpouLoading(false)
    }
  }

  const applyEdrpouResult = (company: EdrpouCompany) => {
    setForm(f => ({
      ...f,
      name: f.name || company.name,
      edrpou: company.edrpou || f.edrpou,
      address: f.address || company.address,
      phone: f.phone || company.phone,
      email: f.email || company.email,
      website: f.website || company.website,
      description: f.description || (company.activity ? `Діяльність: ${company.activity}` : ''),
    }))
    setShowEdrpouDropdown(false)
    setEdrpouResults([])
  }

  const handleWebEnrich = async (manualUrl?: string) => {
    if (!form.name?.trim()) return
    setWebLoading(true)
    setWebResult(null)
    setShowWebInput(false)
    try {
      const urlToUse = manualUrl || form.website || undefined
      const result = await aiEnrichApi.web(form.name.trim(), 'company', undefined, urlToUse)
      setWebResult(result)
      setForm(f => ({
        ...f,
        edrpou: f.edrpou || result.edrpou || '',
        type: f.type || result.type || '',
        address: f.address || result.address || '',
        phone: f.phone || result.phone || '',
        email: f.email || result.email || '',
        website: f.website || result.website || '',
        description: f.description || result.description || '',
        logo_url: f.logo_url || result.logo_url || '',
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
      const result = await aiEnrichApi.company(form.name.trim(), form.edrpou || undefined)
      setAiResult(result)
      setForm(f => ({
        ...f,
        edrpou: f.edrpou || result.edrpou || '',
        type: f.type || result.type || '',
        address: f.address || result.address || '',
        phone: f.phone || result.phone || '',
        email: f.email || result.email || '',
        website: f.website || result.website || '',
        description: f.description || result.description || '',
      }))
    } catch {
      setAiResult({ confidence: 'low', note: 'Помилка запиту до ШІ' })
    } finally {
      setAiLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({
      name: form.name,
      edrpou: form.edrpou || undefined,
      type: form.type || undefined,
      address: form.address || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      website: form.website || undefined,
      description: form.description || undefined,
      logo_url: form.logo_url || undefined,
      contacts,
      projects,
    })
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
            <DialogTitle>{isEditMode ? 'Редагувати компанію' : 'Нова компанія'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="mt-2">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'main' | 'contacts' | 'projects')} className="w-full">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="main" className="flex-1">Основне</TabsTrigger>
                <TabsTrigger value="contacts" className="flex-1">
                  Контакти {contacts.length > 0 && <span className="ml-1.5 rounded-full bg-brand-500/20 text-brand-400 text-xs px-1.5">{contacts.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="projects" className="flex-1">
                  Об&apos;єкти {projects.length > 0 && <span className="ml-1.5 rounded-full bg-brand-500/20 text-brand-400 text-xs px-1.5">{projects.length}</span>}
                </TabsTrigger>
              </TabsList>

              {/* ── Основне ─────────────────────────────────────────────────── */}
              <TabsContent value="main" className="space-y-4">
                {/* Logo */}
                <div className="flex items-center gap-4">
                  <ImageUpload
                    value={form.logo_url || ''}
                    onChange={url => setField('logo_url', url)}
                    shape="circle"
                    size="lg"
                    placeholder="Логотип"
                  />
                  <div className="text-xs text-zinc-500 space-y-0.5">
                    <p className="font-medium text-zinc-400">Логотип компанії</p>
                    <p>JPEG, PNG, WEBP — до 5 МБ</p>
                    <p>Натисніть для завантаження</p>
                  </div>
                </div>

                {aiResult && (
                  <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${CONFIDENCE_COLORS[aiResult.confidence || 'low']}`}>
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-medium">ШІ заповнив поля</span>
                      {' · '}впевненість: {CONFIDENCE_LABELS[aiResult.confidence || 'low']}
                      {aiResult.note && <div className="mt-0.5 opacity-80">{aiResult.note}</div>}
                      <div className="mt-0.5 opacity-70">Перевірте дані перед збереженням</div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="c-name">Назва *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="c-name"
                      value={form.name}
                      onChange={e => setField('name', e.target.value)}
                      placeholder="ТОВ «Будівельна компанія»"
                      required
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAiEnrich}
                      disabled={aiLoading || webLoading || !form.name?.trim()}
                      title="ШІ заповнює поля з навчальних даних (без інтернету). Добре для великих відомих компаній."
                      className="shrink-0 border-zinc-700 gap-1.5 text-brand-400 hover:text-brand-300 hover:border-brand-500/50"
                    >
                      <Sparkles className={`h-3.5 w-3.5 ${aiLoading ? 'animate-pulse' : ''}`} />
                      {aiLoading ? 'Шукаю в ШІ...' : 'ШІ-знання'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (form.website) { handleWebEnrich(form.website) }
                        else { setShowWebInput(v => !v); setWebResult(null) }
                      }}
                      disabled={webLoading || aiLoading || !form.name?.trim()}
                      title="Сканує сайт компанії і витягує реальні дані включно з фото і логотипом"
                      className="shrink-0 border-zinc-700 gap-1.5 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/50"
                    >
                      <Globe className={`h-3.5 w-3.5 ${webLoading ? 'animate-spin' : ''}`} />
                      {webLoading ? 'Сканую...' : 'Web-скан'}
                    </Button>
                  </div>

                  {/* URL input (shown when no website filled) */}
                  {showWebInput && !webLoading && (
                    <div className="flex gap-2 items-center rounded-lg border border-emerald-500/30 bg-emerald-950/10 px-3 py-2">
                      <Globe className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <input
                        type="url"
                        placeholder="https://company.ua  (або порожнє — знайдемо автоматично)"
                        value={webUrlInput}
                        onChange={e => setWebUrlInput(e.target.value)}
                        className="flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 outline-none"
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleWebEnrich(webUrlInput || undefined) } }}
                        autoFocus
                      />
                      <Button type="button" size="sm" variant="brand" className="h-6 px-3 text-xs shrink-0"
                        onClick={() => handleWebEnrich(webUrlInput || undefined)}>
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
                              className="text-emerald-500 hover:text-emerald-400 truncate max-w-[200px]">
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
                               webResult.confidence === 'medium' ? 'середня' : 'низька'}
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
                            <button type="button"
                              className="text-emerald-400 hover:text-emerald-300 whitespace-nowrap underline"
                              onClick={() => { setWebResult(null); setShowWebInput(true) }}>
                              Вкажіть URL вручну
                            </button>
                          )}
                        </div>
                      )}
                      {webResult.photos && webResult.photos.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs text-zinc-400">
                            Фото з сайту — натисніть для встановлення логотипу:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {webResult.photos.slice(0, 8).map((url, i) => (
                              <button key={i} type="button" onClick={() => setField('logo_url', url)}
                                className={`relative h-14 w-14 rounded-lg overflow-hidden border-2 transition-all ${
                                  form.logo_url === url ? 'border-emerald-400' : 'border-zinc-700 hover:border-zinc-500'
                                }`} title="Встановити як логотип">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt="" className="h-full w-full object-cover" />
                                {form.logo_url === url && (
                                  <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center">
                                    <Check className="h-4 w-4 text-emerald-300" />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="c-edrpou">ЄДРПОУ</Label>
                    <div className="relative">
                      <div className="flex gap-1.5">
                        <Input
                          id="c-edrpou"
                          value={form.edrpou}
                          onChange={e => setField('edrpou', e.target.value)}
                          placeholder="12345678"
                          maxLength={10}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleEdrpouSearch}
                          disabled={edrpouLoading || (!form.edrpou?.trim() && !form.name?.trim())}
                          title="Пошук у реєстрі ЄДРПОУ"
                          className="shrink-0 border-zinc-700 gap-1 text-zinc-400 hover:text-zinc-200"
                        >
                          {edrpouLoading
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Search className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                      {showEdrpouDropdown && edrpouResults.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 shadow-lg">
                          {edrpouResults.map((c, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => applyEdrpouResult(c)}
                              className="w-full px-3 py-2 text-left hover:bg-zinc-800 first:rounded-t-md last:rounded-b-md"
                            >
                              <p className="text-sm text-zinc-100 truncate">{c.name}</p>
                              <p className="text-xs text-zinc-500">{c.edrpou}{c.address ? ` · ${c.address}` : ''}</p>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setShowEdrpouDropdown(false)}
                            className="w-full px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 rounded-b-md border-t border-zinc-800"
                          >
                            Закрити
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Тип</Label>
                    <Select value={form.type} onValueChange={v => setField('type', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Оберіть тип" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(COMPANY_ROLE_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="c-address">Адреса</Label>
                  <Input
                    id="c-address"
                    value={form.address}
                    onChange={e => setField('address', e.target.value)}
                    placeholder="м. Київ, вул. Хрещатик, 1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="c-phone">Телефон</Label>
                    <Input
                      id="c-phone"
                      value={form.phone}
                      onChange={e => setField('phone', e.target.value)}
                      placeholder="+380 44 000 00 00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-email">Email</Label>
                    <Input
                      id="c-email"
                      type="email"
                      value={form.email}
                      onChange={e => setField('email', e.target.value)}
                      placeholder="info@company.ua"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="c-website">Сайт</Label>
                  <Input
                    id="c-website"
                    value={form.website}
                    onChange={e => setField('website', e.target.value)}
                    placeholder="https://company.ua"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="c-desc">Опис</Label>
                  <Textarea
                    id="c-desc"
                    value={form.description}
                    onChange={e => setField('description', e.target.value)}
                    placeholder="Короткий опис діяльності компанії..."
                    rows={3}
                  />
                </div>
              </TabsContent>

              {/* ── Контакти ────────────────────────────────────────────────── */}
              <TabsContent value="contacts" className="space-y-3">
                {contacts.length === 0 && (
                  <p className="text-sm text-zinc-500 text-center py-6">
                    Контактів ще немає. Натисніть «+» щоб додати.
                  </p>
                )}

                {contacts.map((c, i) => (
                  <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        Контакт {i + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-600 hover:text-red-400"
                        onClick={() => removeContact(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="flex items-start gap-3">
                      <ImageUpload
                        value={c.photo_url}
                        onChange={url => setContactField(i, 'photo_url', url)}
                        shape="circle"
                        size="sm"
                        placeholder="Фото"
                      />
                      <div className="flex-1 space-y-1.5">
                        <Label className="text-xs">Контакт (ПІБ)</Label>
                        <Input
                          value={c.name}
                          onChange={e => setContactField(i, 'name', e.target.value)}
                          placeholder="Іванов Іван Іванович"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <Label className="text-xs">Посада</Label>
                        <Input
                          value={c.position}
                          onChange={e => setContactField(i, 'position', e.target.value)}
                          placeholder="Директор"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Телефон</Label>
                        <Input
                          value={c.phone}
                          onChange={e => setContactField(i, 'phone', e.target.value)}
                          placeholder="+380 67 000 00 00"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Електронна адреса</Label>
                        <Input
                          type="email"
                          value={c.email}
                          onChange={e => setContactField(i, 'email', e.target.value)}
                          placeholder="name@company.ua"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Телеграм</Label>
                        <Input
                          value={c.telegram}
                          onChange={e => setContactField(i, 'telegram', e.target.value)}
                          placeholder="@username"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Вайбер</Label>
                        <Input
                          value={c.viber}
                          onChange={e => setContactField(i, 'viber', e.target.value)}
                          placeholder="+380 67 000 00 00"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Примітки</Label>
                      <Input
                        value={c.notes}
                        onChange={e => setContactField(i, 'notes', e.target.value)}
                        placeholder="Додаткова інформація..."
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addContact}
                  className="w-full border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-200 gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Додати контакт
                </Button>
              </TabsContent>

              {/* ── Об'єкти ─────────────────────────────────────────────────── */}
              <TabsContent value="projects" className="space-y-3">
                <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-brand-300">Обрати з реєстру об&apos;єктів</p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Перейдіть на сторінку об&apos;єктів і виберіть картки з уже завантажених
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGoPickObjects}
                    className="w-full gap-2 border-brand-500/40 text-brand-300 hover:text-brand-200 hover:bg-brand-500/10"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Відкрити сторінку об&apos;єктів
                  </Button>
                </div>

                {projects.length === 0 && (
                  <p className="text-sm text-zinc-500 text-center py-4">
                    Об&apos;єктів ще немає. Оберіть з реєстру або додайте вручну.
                  </p>
                )}

                {projects.map((p, i) => (
                  <div key={p.object_id ?? i} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          Об&apos;єкт {i + 1}
                        </span>
                        {p.object_id && (
                          <span className="text-[10px] font-medium text-brand-400 bg-brand-400/10 border border-brand-400/20 rounded px-1.5 py-0.5">
                            З реєстру
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-600 hover:text-red-400"
                        onClick={() => removeProject(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Назва об&apos;єкту</Label>
                      <Input
                        value={p.object_name}
                        onChange={e => setProjectField(i, 'object_name', e.target.value)}
                        placeholder="ЖК «Сонячний»"
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Адреса</Label>
                      <Input
                        value={p.address ?? ''}
                        onChange={e => setProjectField(i, 'address', e.target.value)}
                        placeholder="м. Київ, вул. Хрещатик, 1"
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Черга</Label>
                      <Input
                        value={p.queue}
                        onChange={e => setProjectField(i, 'queue', e.target.value)}
                        placeholder="Черга 1"
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Терміни здачі</Label>
                      <Input
                        type="date"
                        value={p.deadline}
                        onChange={e => setProjectField(i, 'deadline', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Замовник</Label>
                        <Input
                          value={p.customer}
                          onChange={e => setProjectField(i, 'customer', e.target.value)}
                          placeholder="Назва замовника"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Підрядник</Label>
                        <Input
                          value={p.contractor}
                          onChange={e => setProjectField(i, 'contractor', e.target.value)}
                          placeholder="Назва підрядника"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Монтажник</Label>
                        <Input
                          value={p.installer}
                          onChange={e => setProjectField(i, 'installer', e.target.value)}
                          placeholder="Назва монтажника"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Постачальник</Label>
                        <Input
                          value={p.supplier}
                          onChange={e => setProjectField(i, 'supplier', e.target.value)}
                          placeholder="Назва постачальника"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Проектувальник</Label>
                      <Input
                        value={p.designer}
                        onChange={e => setProjectField(i, 'designer', e.target.value)}
                        placeholder="Назва проектувальника"
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Примітки</Label>
                      <Input
                        value={p.notes}
                        onChange={e => setProjectField(i, 'notes', e.target.value)}
                        placeholder="Додаткова інформація..."
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Фото об&apos;єкту</Label>
                      <div className="flex flex-wrap gap-2">
                        {(p.photos ?? []).map((url, pi) => (
                          <ImageUpload
                            key={pi}
                            value={url}
                            onChange={newUrl => {
                              const next = [...(p.photos ?? [])]
                              if (newUrl) { next[pi] = newUrl } else { next.splice(pi, 1) }
                              setProjectField(i, 'photos', next)
                            }}
                            shape="square"
                            size="sm"
                          />
                        ))}
                        <ImageUpload
                          value=""
                          onChange={newUrl => {
                            if (newUrl) setProjectField(i, 'photos', [...(p.photos ?? []), newUrl])
                          }}
                          shape="square"
                          size="sm"
                          placeholder="+ фото"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addProject}
                  className="w-full border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-200 gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Додати вручну
                </Button>
              </TabsContent>
            </Tabs>

            {mutation.isError && (
              <p className="text-sm text-red-400 mt-3">
                Помилка: {(mutation.error as Error)?.message}
              </p>
            )}

            <DialogFooter className="mt-5">
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
