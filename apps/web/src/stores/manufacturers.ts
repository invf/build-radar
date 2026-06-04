import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Manufacturer {
  id: string
  name: string
  phone: string
  email: string
  website: string
  address: string
  notes: string
  createdAt: string
}

interface ManufacturersStore {
  manufacturers: Manufacturer[]
  addManufacturer: (m: Omit<Manufacturer, 'id' | 'createdAt'>) => void
  updateManufacturer: (id: string, updates: Partial<Omit<Manufacturer, 'id' | 'createdAt'>>) => void
  deleteManufacturer: (id: string) => void
}

export const useManufacturersStore = create<ManufacturersStore>()(
  persist(
    (set) => ({
      manufacturers: [],
      addManufacturer: (m) =>
        set((state) => ({
          manufacturers: [
            { ...m, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
            ...state.manufacturers,
          ],
        })),
      updateManufacturer: (id, updates) =>
        set((state) => ({
          manufacturers: state.manufacturers.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        })),
      deleteManufacturer: (id) =>
        set((state) => ({
          manufacturers: state.manufacturers.filter((m) => m.id !== id),
        })),
    }),
    { name: 'buildradar-manufacturers' }
  )
)
