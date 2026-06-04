import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type OrderStatus = 'in_progress' | 'planned' | 'completed'

export interface Order {
  id: string
  date: string | null
  customer: string
  objectName: string
  address: string
  equipmentCount: string
  manufacturer: string
  productionDate: string | null
  notes: string
  status: OrderStatus
  lat: number | null
  lng: number | null
  createdAt: string
}

interface OrdersStore {
  orders: Order[]
  addOrder: (order: Omit<Order, 'id' | 'createdAt'>) => void
  updateOrder: (id: string, updates: Partial<Omit<Order, 'id' | 'createdAt'>>) => void
  completeOrder: (id: string) => void
  restoreOrder: (id: string, status: 'in_progress' | 'planned') => void
  deleteOrder: (id: string) => void
}

export const useOrdersStore = create<OrdersStore>()(
  persist(
    (set) => ({
      orders: [],
      addOrder: (order) =>
        set((state) => ({
          orders: [
            { ...order, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
            ...state.orders,
          ],
        })),
      updateOrder: (id, updates) =>
        set((state) => ({
          orders: state.orders.map((o) => (o.id === id ? { ...o, ...updates } : o)),
        })),
      completeOrder: (id) =>
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id ? { ...o, status: 'completed' } : o
          ),
        })),
      restoreOrder: (id, status) =>
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === id ? { ...o, status } : o
          ),
        })),
      deleteOrder: (id) =>
        set((state) => ({
          orders: state.orders.filter((o) => o.id !== id),
        })),
    }),
    { name: 'buildradar-orders' }
  )
)
