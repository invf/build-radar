'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import { Combobox, ComboboxOption } from '@/components/ui/combobox'
import { useOrdersStore, Order, OrderStatus } from '@/stores/orders'
import { useManufacturersStore } from '@/stores/manufacturers'
import { companiesApi } from '@/lib/api/companies'
import { objectsApi } from '@/lib/api/objects'
import { geocodeAddress } from '@/lib/geocode'

interface OrderFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order?: Order
  defaultStatus?: 'in_progress' | 'planned'
}

type FormState = {
  date: Date | null
  customer: string
  objectName: string
  address: string
  equipmentCount: string
  manufacturer: string
  productionDate: Date | null
  notes: string
}

function orderToForm(order: Order): FormState {
  return {
    date: order.date ? new Date(order.date) : null,
    customer: order.customer,
    objectName: order.objectName,
    address: order.address,
    equipmentCount: order.equipmentCount,
    manufacturer: order.manufacturer ?? '',
    productionDate: order.productionDate ? new Date(order.productionDate) : null,
    notes: order.notes,
  }
}

const emptyForm: FormState = {
  date: null,
  customer: '',
  objectName: '',
  address: '',
  equipmentCount: '',
  manufacturer: '',
  productionDate: null,
  notes: '',
}

export function OrderFormModal({
  open,
  onOpenChange,
  order,
  defaultStatus = 'in_progress',
}: OrderFormModalProps) {
  const isEdit = !!order
  const [form, setForm] = useState<FormState>(isEdit ? orderToForm(order!) : emptyForm)
  const [saving, setSaving] = useState(false)
  const { addOrder, updateOrder } = useOrdersStore()
  const manufacturers = useManufacturersStore((s) => s.manufacturers)

  // Coordinates pre-filled from a selected object (skips geocoding)
  const objectCoords = useRef<{ lat: number; lng: number } | null>(null)

  // Fetch companies for Замовник combobox (max page_size=100 per API constraint)
  const { data: companiesData } = useQuery({
    queryKey: ['companies-for-order'],
    queryFn: () => companiesApi.list({ page_size: 100, sort_by: 'name', sort_order: 'asc' }),
    staleTime: 5 * 60_000,
    enabled: open,
  })

  // Fetch objects for Об'єкт combobox
  const { data: objectsData } = useQuery({
    queryKey: ['objects-for-order'],
    queryFn: () => objectsApi.list({ page_size: 100, sort_by: 'updated_at', sort_order: 'desc' }),
    staleTime: 5 * 60_000,
    enabled: open,
  })

  const companyOptions: ComboboxOption[] = (companiesData?.items ?? []).map((c) => ({
    value: c.name,
    label: c.name,
  }))

  const objectOptions: ComboboxOption[] = (objectsData?.items ?? []).map((o) => ({
    value: o.name,
    label: [o.name, o.city].filter(Boolean).join(' — '),
  }))

  // Map name → object for quick address/coords lookup on selection
  const objectsByName = useMemo(
    () => new Map((objectsData?.items ?? []).map((o) => [o.name, o])),
    [objectsData]
  )

  const manufacturerOptions: ComboboxOption[] = manufacturers.map((m) => ({
    value: m.name,
    label: m.name,
  }))

  // Reset form (and cached coords) when modal opens
  useEffect(() => {
    if (open) {
      setForm(isEdit ? orderToForm(order!) : emptyForm)
      objectCoords.current = null
    }
  }, [open, isEdit, order])

  const set =
    <K extends keyof FormState>(field: K) =>
    (val: FormState[K]) =>
      setForm((prev) => ({ ...prev, [field]: val }))

  // When an object is selected from the dropdown — auto-fill address and cache coords
  const handleObjectNameChange = (name: string) => {
    set('objectName')(name)
    const obj = objectsByName.get(name)
    if (obj) {
      const addr = [obj.address, obj.city].filter(Boolean).join(', ')
      if (addr) set('address')(addr)
      objectCoords.current =
        obj.coordinates ? { lat: obj.coordinates.lat, lng: obj.coordinates.lng } : null
    } else {
      objectCoords.current = null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customer.trim() && !form.objectName.trim()) return
    setSaving(true)

    let lat: number | null = isEdit ? (order!.lat ?? null) : null
    let lng: number | null = isEdit ? (order!.lng ?? null) : null

    if (objectCoords.current) {
      // Use coordinates from the selected object — no geocoding needed
      lat = objectCoords.current.lat
      lng = objectCoords.current.lng
    } else {
      const addressChanged = !isEdit || form.address !== order!.address
      if (form.address.trim() && addressChanged) {
        const coords = await geocodeAddress(form.address)
        if (coords) { lat = coords.lat; lng = coords.lng }
      }
    }

    const payload = {
      date: form.date ? form.date.toISOString() : null,
      customer: form.customer,
      objectName: form.objectName,
      address: form.address,
      equipmentCount: form.equipmentCount,
      manufacturer: form.manufacturer,
      productionDate: form.productionDate ? form.productionDate.toISOString() : null,
      notes: form.notes,
      lat,
      lng,
    }

    if (isEdit) {
      updateOrder(order!.id, payload)
    } else {
      addOrder({ ...payload, status: defaultStatus })
    }

    setSaving(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редагувати замовлення' : 'Нове замовлення'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Дата</Label>
              <DatePicker
                value={form.date}
                onChange={set('date')}
                placeholder="Дата замовлення"
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Замовник <span className="text-red-400">*</span>
              </Label>
              <Combobox
                options={companyOptions}
                value={form.customer}
                onChange={set('customer')}
                placeholder="Оберіть або введіть компанію"
                emptyText="Компаній не знайдено"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Об&apos;єкт <span className="text-red-400">*</span>
            </Label>
            <Combobox
              options={objectOptions}
              value={form.objectName}
              onChange={handleObjectNameChange}
              placeholder="Оберіть об'єкт або введіть назву"
              emptyText="Об'єктів не знайдено"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Адреса</Label>
            <Input
              placeholder="Підтягується з об'єкту або вкажіть вручну"
              value={form.address}
              onChange={(e) => set('address')(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Кількість обладнання</Label>
              <Input
                type="number"
                min="0"
                placeholder="шт."
                value={form.equipmentCount}
                onChange={(e) => set('equipmentCount')(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Виробництво</Label>
              <Combobox
                options={manufacturerOptions}
                value={form.manufacturer}
                onChange={set('manufacturer')}
                placeholder="Оберіть або введіть виробника"
                emptyText="Виробників не знайдено. Додайте в розділі Виробництво."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Дата виготовлення</Label>
            <DatePicker
              value={form.productionDate}
              onChange={set('productionDate')}
              placeholder="Планова дата"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Примітки</Label>
            <Textarea
              placeholder="Додаткова інформація..."
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes')(e.target.value)}
              className="resize-none"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Скасувати
            </Button>
            <Button type="submit" variant="brand" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Зберегти зміни' : 'Додати'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
