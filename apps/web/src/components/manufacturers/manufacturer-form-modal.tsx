'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useManufacturersStore, Manufacturer } from '@/stores/manufacturers'

type FormState = {
  name: string
  phone: string
  email: string
  website: string
  address: string
  notes: string
}

const emptyForm: FormState = {
  name: '',
  phone: '',
  email: '',
  website: '',
  address: '',
  notes: '',
}

function manufacturerToForm(m: Manufacturer): FormState {
  return {
    name: m.name,
    phone: m.phone,
    email: m.email,
    website: m.website,
    address: m.address,
    notes: m.notes,
  }
}

interface ManufacturerFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  manufacturer?: Manufacturer
  readOnly?: boolean
}

export function ManufacturerFormModal({
  open,
  onOpenChange,
  manufacturer,
  readOnly = false,
}: ManufacturerFormModalProps) {
  const isEdit = !!manufacturer
  const { addManufacturer, updateManufacturer } = useManufacturersStore()
  const [form, setForm] = useState<FormState>(
    manufacturer ? manufacturerToForm(manufacturer) : emptyForm
  )

  const field =
    <K extends keyof FormState>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || readOnly) return
    if (isEdit) {
      updateManufacturer(manufacturer.id, form)
    } else {
      addManufacturer(form)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {readOnly ? manufacturer?.name : isEdit ? 'Редагувати виробника' : 'Новий виробник'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {!readOnly && (
            <div className="space-y-1.5">
              <Label>
                Назва <span className="text-red-400">*</span>
              </Label>
              <Input
                placeholder="Назва виробника"
                value={form.name}
                onChange={field('name')}
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Телефон</Label>
              <Input
                placeholder="+38 (0XX) XXX-XX-XX"
                value={form.phone}
                onChange={field('phone')}
                readOnly={readOnly}
                className={readOnly ? 'opacity-70 cursor-default' : ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="info@company.ua"
                value={form.email}
                onChange={field('email')}
                readOnly={readOnly}
                className={readOnly ? 'opacity-70 cursor-default' : ''}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Сайт</Label>
            {readOnly && form.website ? (
              <a
                href={form.website}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-brand-400 hover:text-brand-300 py-1"
              >
                {form.website}
              </a>
            ) : (
              <Input
                placeholder="https://company.ua"
                value={form.website}
                onChange={field('website')}
                readOnly={readOnly}
                className={readOnly ? 'opacity-70 cursor-default' : ''}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Адреса</Label>
            <Input
              placeholder="Вулиця, місто"
              value={form.address}
              onChange={field('address')}
              readOnly={readOnly}
              className={readOnly ? 'opacity-70 cursor-default' : ''}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Примітки</Label>
            <Textarea
              placeholder="Додаткова інформація..."
              rows={3}
              value={form.notes}
              onChange={field('notes')}
              readOnly={readOnly}
              className={`resize-none${readOnly ? ' opacity-70 cursor-default' : ''}`}
            />
          </div>

          <DialogFooter>
            {readOnly ? (
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Закрити
              </Button>
            ) : (
              <>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Скасувати
                </Button>
                <Button type="submit" variant="brand">
                  {isEdit ? 'Зберегти зміни' : 'Додати'}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
