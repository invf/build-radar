'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
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
import { permitsApi, type PermitCreatePayload } from '@/lib/api/permits'

const PERMIT_TYPE_LABELS = {
  construction_permit: 'Дозвіл на будівництво',
  readiness_declaration: 'Декларація готовності',
  urban_planning_conditions: 'Містобудівні умови',
  technical_conditions: 'Технічні умови',
  design_approval: 'Погодження проекту',
  expert_examination: 'Експертиза',
}

type FormState = {
  object_id: string
  permit_number: string
  permit_type: string
  series: string
  issued_date: string
  valid_until: string
  issuing_authority: string
  document_url: string
}

const EMPTY: FormState = {
  object_id: '', permit_number: '', permit_type: '',
  series: '', issued_date: '', valid_until: '',
  issuing_authority: '', document_url: '',
}

export function PermitFormModal() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: permitsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permits'] })
      setOpen(false)
      setForm(EMPTY)
    },
  })

  const set = (field: keyof FormState, value: string) =>
    setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: PermitCreatePayload = {
      object_id: form.object_id,
      permit_number: form.permit_number,
      permit_type: form.permit_type,
      series: form.series || undefined,
      issued_date: form.issued_date || undefined,
      valid_until: form.valid_until || undefined,
      issuing_authority: form.issuing_authority || undefined,
      document_url: form.document_url || undefined,
    }
    mutation.mutate(payload)
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-4 w-4" />
        Додати
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новий дозвіл</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-object">ID об&apos;єкту *</Label>
              <Input
                id="p-object"
                value={form.object_id}
                onChange={e => set('object_id', e.target.value)}
                placeholder="UUID будівельного об'єкту"
                required
              />
              <p className="text-xs text-zinc-600">Відкрийте картку об&apos;єкту, щоб скопіювати його ID з URL</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-number">Номер дозволу *</Label>
                <Input
                  id="p-number"
                  value={form.permit_number}
                  onChange={e => set('permit_number', e.target.value)}
                  placeholder="ІV-123-456789"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-series">Серія</Label>
                <Input
                  id="p-series"
                  value={form.series}
                  onChange={e => set('series', e.target.value)}
                  placeholder="КВ"
                  maxLength={20}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Тип дозволу *</Label>
              <Select value={form.permit_type} onValueChange={v => set('permit_type', v)} required>
                <SelectTrigger><SelectValue placeholder="Оберіть тип" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PERMIT_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-issued">Дата видачі</Label>
                <Input id="p-issued" type="date" value={form.issued_date} onChange={e => set('issued_date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-valid">Дійсний до</Label>
                <Input id="p-valid" type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-authority">Орган видачі</Label>
              <Input
                id="p-authority"
                value={form.issuing_authority}
                onChange={e => set('issuing_authority', e.target.value)}
                placeholder="ДАБІ України"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-docurl">Посилання на документ</Label>
              <Input
                id="p-docurl"
                value={form.document_url}
                onChange={e => set('document_url', e.target.value)}
                placeholder="https://..."
              />
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
              <Button type="submit" disabled={mutation.isPending || !form.permit_number || !form.permit_type || !form.object_id}>
                {mutation.isPending ? 'Збереження...' : 'Зберегти'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
