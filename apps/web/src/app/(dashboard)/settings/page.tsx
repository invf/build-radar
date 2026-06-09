'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { User, Shield, Save } from 'lucide-react'
import { usersApi } from '@/lib/api/users'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [saved, setSaved] = useState(false)

  const profileMutation = useMutation({
    mutationFn: () => usersApi.updateMe({ full_name: fullName }),
    onSuccess: (data) => {
      setUser(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Налаштування</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Профіль та параметри акаунту</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4 text-zinc-400" />
            Профіль
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs text-zinc-500">Email</Label>
            <Input
              id="email"
              value={user?.email || ''}
              disabled
              className="bg-zinc-900/50 text-zinc-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-xs text-zinc-400">Повне ім&apos;я</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ваше ім'я та прізвище"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-brand-600 flex items-center justify-center text-sm font-bold text-white">
              {user?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm text-zinc-300">{user?.full_name || user?.email}</p>
              <p className="text-xs text-zinc-500 capitalize">
                Роль: {user?.role === 'admin' ? 'Адміністратор' : user?.role === 'manager' ? 'Менеджер' : 'Спостерігач'}
              </p>
            </div>
          </div>
          <Button
            onClick={() => profileMutation.mutate()}
            disabled={profileMutation.isPending || fullName === user?.full_name}
            size="sm"
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            {saved ? 'Збережено!' : profileMutation.isPending ? 'Зберігаємо...' : 'Зберегти'}
          </Button>
        </CardContent>
      </Card>

      {/* Security info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-zinc-400" />
            Безпека
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
            Аутентифікація через Supabase Auth. Управління паролем доступне через email.
          </p>
          <p className="text-xs text-zinc-600 mt-2">
            Акаунт створено: {user?.created_at ? new Date(user.created_at).toLocaleDateString('uk-UA') : '—'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
