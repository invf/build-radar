'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Factory, Search, Pencil, Trash2, Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { manufacturersApi, type Manufacturer } from '@/lib/api/manufacturers'
import { ManufacturerFormModal } from '@/components/manufacturers/manufacturer-form-modal'

function ManufacturerCard({
  manufacturer,
  onEdit,
  onDelete,
}: {
  manufacturer: Manufacturer
  onEdit: (m: Manufacturer) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="group relative rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 group-hover:bg-zinc-700 transition-colors">
            <Factory className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100 truncate group-hover:text-white">{manufacturer.name}</p>
            {manufacturer.phone && <p className="text-xs text-zinc-500 mt-0.5">{manufacturer.phone}</p>}
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-100" onClick={() => onEdit(manufacturer)} title="Редагувати">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-red-400" onClick={() => onDelete(manufacturer.id)} title="Видалити">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {(manufacturer.email || manufacturer.website || manufacturer.address) && (
        <div className="mt-3 space-y-0.5">
          {manufacturer.email && <p className="text-xs text-zinc-500 truncate">{manufacturer.email}</p>}
          {manufacturer.website && (
            <a href={manufacturer.website} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-400 hover:text-brand-300 truncate block" onClick={(e) => e.stopPropagation()}>
              {manufacturer.website}
            </a>
          )}
          {manufacturer.address && <p className="text-xs text-zinc-600 truncate">{manufacturer.address}</p>}
        </div>
      )}

      {manufacturer.notes && <p className="mt-2 text-xs text-zinc-600 line-clamp-2">{manufacturer.notes}</p>}
    </div>
  )
}

export default function ManufacturersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Manufacturer | null>(null)

  const { data: manufacturers = [], isLoading } = useQuery({
    queryKey: ['manufacturers', search],
    queryFn: () => manufacturersApi.list(search || undefined),
    staleTime: 30_000,
  })

  const deleteMutation = useMutation({
    mutationFn: manufacturersApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manufacturers'] }),
  })

  const handleDelete = (id: string) => {
    if (!window.confirm('Видалити виробника? Цю дію неможливо скасувати.')) return
    deleteMutation.mutate(id)
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Виробництво</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {isLoading ? 'Завантаження...' : manufacturers.length > 0
              ? `${manufacturers.length} виробник${manufacturers.length === 1 ? '' : 'ів'}`
              : 'Виробників ще немає'}
          </p>
        </div>
        <Button variant="brand" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Додати виробника
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Пошук за назвою або адресою..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
        {search && (
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300" onClick={() => setSearch('')}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {manufacturers.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
          <Factory className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">{search ? 'Нічого не знайдено' : 'Додайте першого виробника'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {manufacturers.map((m) => (
            <ManufacturerCard key={m.id} manufacturer={m} onEdit={setEditTarget} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <ManufacturerFormModal open={addOpen} onOpenChange={setAddOpen} />

      {editTarget && (
        <ManufacturerFormModal
          open={!!editTarget}
          onOpenChange={(open) => { if (!open) setEditTarget(null) }}
          manufacturer={editTarget}
        />
      )}
    </div>
  )
}
