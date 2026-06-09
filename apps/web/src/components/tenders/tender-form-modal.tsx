'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { tendersApi, type TenderCreatePayload, type TenderUpdatePayload } from '@/lib/api/tenders'
import type { Tender } from '@/types'

const STATUS_LABELS = {
  active: 'Активний',
  complete: 'Завершено',
  cancelled: 'Скасовано',
  unsuccessful: 'Не відбувся',
}

type FormState = {
  prozorro_id: string
  title: string
  status: string
  object_id: string
  amount: string
  currency: string
  deadline: string
  procuring_entity: string
  procuring_entity_edrpou: string
  source_url: string
  country: string
  donor: string
  sector: string
}

const EMPTY: FormState = {
  prozorro_id: '', title: '', status: 'active',
  object_id: '', amount: '', currency: 'UAH',
  deadline: '', procuring_entity: '', procuring_entity_edrpou: '',
  source_url: '', country: '', donor: '', sector: '',
}

function tenderToForm(t: Tender): FormState {
  return {
    prozorro_id: t.prozorro_id,
    title: t.title,
    status: t.status,
    object_id: t.object_id ?? '',
    amount: t.amount != null ? String(t.amount) : '',
    currency: t.currency ?? 'UAH',
    deadline: t.deadline ? t.deadline.slice(0, 10) : '',
    procuring_entity: t.procuring_entity ?? '',
    procuring_entity_edrpou: '',
    source_url: t.source_url ?? '',
    country: t.country ?? '',
    donor: t.donor ?? '',
    sector: t.sector ?? '',
  }
}

interface TenderFormModalProps {
  tender?: Tender
  trigger?: React.ReactNode
}

export function TenderFormModal({ tender, trigger }: TenderFormModalProps = {}) {
  const isEdit = !!tender
  const isIntl = isEdit && !!tender && !!tender.source && tender.source !== 'prozorro'
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const qc = useQueryClient()

  useEffect(() => {
    if (open) {
      setForm(isEdit ? tenderToForm(tender) : EMPTY)
    }
  }, [open, isEdit, tender])

  const createMutation = useMutation({
    mutationFn: (payload: TenderCreatePayload) => tendersApi.create(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenders'] }); setOpen(false) },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: TenderUpdatePayload) => tendersApi.update(tender!.id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenders'] }); setOpen(false) },
  })

  const mutation = isEdit ? updateMutation : createMutation
  const set = (field: keyof FormState, value: string) =>
    setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEdit) {
      const payload: TenderUpdatePayload = {
        title: form.title || undefined,
        status: form.status || undefined,
        object_id: form.object_id || undefined,
        amount: form.amount ? parseFloat(form.amount) : undefined,
        currency: form.currency || undefined,
        deadline: form.deadline || undefined,
        procuring_entity: form.procuring_entity || undefined,
        procuring_entity_edrpou: form.procuring_entity_edrpou || undefined,
        source_url: form.source_url || undefined,
        country: form.country || undefined,
        donor: form.donor || undefined,
        sector: form.sector || undefined,
      }
      updateMutation.mutate(payload)
    } else {
      const payload: TenderCreatePayload = {
        prozorro_id: form.prozorro_id,
        title: form.title,
        status: form.status || 'active',
        object_id: form.object_id || undefined,
        amount: form.amount ? parseFloat(form.amount) : undefined,
        currency: form.currency || 'UAH',
        deadline: form.deadline || undefined,
        procuring_entity: form.procuring_entity || undefined,
        procuring_entity_edrpou: form.procuring_entity_edrpou || undefined,
      }
      createMutation.mutate(payload)
    }
  }

  const defaultTrigger = isEdit ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
      title="Редагувати"
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  ) : (
    <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
      <Plus className="h-4 w-4" />
      Додати
    </Button>
  )

  return (
    <>
      {trigger
        ? <span onClick={() => setOpen(true)} className="cursor-pointer">{trigger}</span>
        : defaultTrigger
      }

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Редагувати тендер' : 'Новий тендер'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-title">Назва тендеру *</Label>
              <Input
                id="t-title"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Будівництво житлового комплексу..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {!isIntl && (
                <div className="space-y-1.5">
                  <Label htmlFor="t-prozorro">Prozorro ID *</Label>
                  <Input
                    id="t-prozorro"
                    value={form.prozorro_id}
                    onChange={e => set('prozorro_id', e.target.value)}
                    placeholder="UA-2024-01-01-000001-a"
                    required={!isEdit}
                    disabled={isEdit}
                  />
                </div>
              )}
              {isIntl && (
                <div className="space-y-1.5">
                  <Label>Джерело</Label>
                  <p className="h-9 px-3 py-2 text-sm text-zinc-400 border border-zinc-800 rounded-md bg-zinc-900/50 font-mono">
                    {tender!.source}
                  </p>
                </div>
              )}
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
            </div>

            {isIntl && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="t-source-url">URL тендеру</Label>
                  <Input
                    id="t-source-url"
                    value={form.source_url}
                    onChange={e => set('source_url', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="t-country">Країна</Label>
                    <Input
                      id="t-country"
                      value={form.country}
                      onChange={e => set('country', e.target.value)}
                      placeholder="Україна"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="t-donor">Донор</Label>
                    <Input
                      id="t-donor"
                      value={form.donor}
                      onChange={e => set('donor', e.target.value)}
                      placeholder="EBRD, UNDP..."
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-sector">Сектор</Label>
                  <Input
                    id="t-sector"
                    value={form.sector}
                    onChange={e => set('sector', e.target.value)}
                    placeholder="Energy, Infrastructure..."
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="t-amount">Сума</Label>
                <Input
                  id="t-amount"
                  value={form.amount}
                  onChange={e => set('amount', e.target.value)}
                  placeholder="1000000"
                  type="number"
                  min="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Валюта</Label>
                <Select value={form.currency} onValueChange={v => set('currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UAH">UAH</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-deadline">Дедлайн подачі</Label>
              <Input id="t-deadline" type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-entity">Замовник</Label>
              <Input
                id="t-entity"
                value={form.procuring_entity}
                onChange={e => set('procuring_entity', e.target.value)}
                placeholder="Назва організації-замовника"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="t-edrpou">ЄДРПОУ замовника</Label>
                <Input
                  id="t-edrpou"
                  value={form.procuring_entity_edrpou}
                  onChange={e => set('procuring_entity_edrpou', e.target.value)}
                  placeholder="12345678"
                  maxLength={10}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-object">ID об&apos;єкту (опційно)</Label>
                <Input
                  id="t-object"
                  value={form.object_id}
                  onChange={e => set('object_id', e.target.value)}
                  placeholder="UUID об'єкту"
                />
              </div>
            </div>

            {mutation.isError && (
              <p className="text-sm text-red-400">
                Помилка: {(mutation.error as Error)?.message}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-zinc-700">
                Скасувати
              </Button>
              <Button type="submit" disabled={mutation.isPending || !form.title || (!isEdit && !form.prozorro_id)}>
                {mutation.isPending ? 'Збереження...' : isEdit ? 'Зберегти зміни' : 'Зберегти'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
