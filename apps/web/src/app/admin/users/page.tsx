'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users,
  UserPlus,
  Shield,
  Ban,
  CheckCircle,
  Loader2,
  Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { usersApi } from '@/lib/api/users'
import { formatDateTime, formatRelative } from '@/lib/utils/format'
import type { UserRole } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { redirect } from 'next/navigation'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Адміністратор',
  manager: 'Менеджер',
  viewer: 'Перегляд',
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  manager: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  viewer: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuthStore()
  const qc = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('viewer')

  if (currentUser?.role !== 'admin') redirect('/')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => usersApi.list(),
  })

  const inviteMutation = useMutation({
    mutationFn: () => usersApi.invite(inviteEmail, inviteRole),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setInviteOpen(false)
      setInviteEmail('')
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ userId, is_active }: { userId: string; is_active: boolean }) =>
      usersApi.setActive(userId, is_active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const setRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      usersApi.setRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Управління користувачами
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {data?.total || 0} користувачів у системі
          </p>
        </div>
        <Button
          className="bg-brand-600 hover:bg-brand-700 text-white gap-2"
          onClick={() => setInviteOpen(true)}
        >
          <UserPlus className="h-4 w-4" />
          Запросити
        </Button>
      </div>

      {/* Users table */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Користувач</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Роль</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Статус</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Останній вхід</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Додано</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-5 w-24 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data?.items.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {u.full_name?.charAt(0).toUpperCase() || u.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-200">{u.full_name || '—'}</p>
                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                          <Mail className="h-3 w-3" />{u.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={u.role}
                      onValueChange={(role) => setRoleMutation.mutate({ userId: u.id, role: role as UserRole })}
                      disabled={u.id === currentUser?.id}
                    >
                      <SelectTrigger className="w-36 h-7 text-xs border-zinc-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                          <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={u.is_active
                        ? 'border-green-500/20 bg-green-500/10 text-green-400'
                        : 'border-red-500/20 bg-red-500/10 text-red-400'
                      }
                    >
                      {u.is_active ? 'Активний' : 'Заблоковано'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {u.last_login ? formatRelative(u.last_login) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {formatDateTime(u.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {u.id !== currentUser?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={u.is_active
                            ? 'text-zinc-500 hover:text-red-400 text-xs gap-1'
                            : 'text-zinc-500 hover:text-green-400 text-xs gap-1'
                          }
                          onClick={() => toggleActiveMutation.mutate({ userId: u.id, is_active: !u.is_active })}
                          disabled={toggleActiveMutation.isPending}
                        >
                          {u.is_active
                            ? <><Ban className="h-3 w-3" /> Блокувати</>
                            : <><CheckCircle className="h-3 w-3" /> Активувати</>
                          }
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-brand-400" />
              Запросити користувача
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Email адреса</Label>
              <Input
                type="email"
                placeholder="user@company.ua"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Роль</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => (
                    <SelectItem key={role} value={role}>
                      <div className="flex items-center gap-2">
                        <Shield className="h-3 w-3" />
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-500">
              <p>Запрошення буде надіслано на вказану адресу. Посилання дійсне 48 годин.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} className="border-zinc-800">
              Скасувати
            </Button>
            <Button
              className="bg-brand-600 hover:bg-brand-700 text-white gap-2"
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail || inviteMutation.isPending}
            >
              {inviteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Надіслати запрошення
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
