import { apiFetch } from './client'
import type { User, Invitation, UserRole, PaginatedResponse } from '@/types'

export const usersApi = {
  getMe: () => apiFetch<User>('/users/me'),

  updateMe: (payload: Partial<Pick<User, 'full_name'>>) =>
    apiFetch<User>('/users/me', { method: 'PATCH', data: payload }),

  list: (params?: { page?: number; search?: string; role?: UserRole }) =>
    apiFetch<PaginatedResponse<User>>('/admin/users', { params }),

  invite: (email: string, role: UserRole) =>
    apiFetch<Invitation>('/admin/users/invite', {
      method: 'POST',
      data: { email, role },
    }),

  setActive: (userId: string, is_active: boolean) =>
    apiFetch<User>(`/admin/users/${userId}/active`, {
      method: 'PATCH',
      data: { is_active },
    }),

  setRole: (userId: string, role: UserRole) =>
    apiFetch<User>(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      data: { role },
    }),
}
