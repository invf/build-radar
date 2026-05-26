import { create } from 'zustand'
import type { ObjectFilters } from '@/types'

interface FiltersState {
  filters: ObjectFilters
  setFilters: (filters: ObjectFilters) => void
  updateFilter: <K extends keyof ObjectFilters>(key: K, value: ObjectFilters[K]) => void
  resetFilters: () => void
  activeCount: () => number
}

const defaultFilters: ObjectFilters = {}

export const useFiltersStore = create<FiltersState>((set, get) => ({
  filters: defaultFilters,
  setFilters: (filters) => set({ filters }),
  updateFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: defaultFilters }),
  activeCount: () => {
    const f = get().filters
    return Object.values(f).filter(
      (v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
    ).length
  },
}))
