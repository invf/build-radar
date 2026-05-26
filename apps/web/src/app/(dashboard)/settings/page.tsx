'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { User, Bell, Shield, Save } from 'lucide-react'
import { apiFetch } from '@/lib/api/client'
import { usersApi } from '@/lib/api/users'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [saved, setSaved] = useState(false)

  const { data: notifSettings, isLoading: notifLoading } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: () => apiFetch<{
      email_enabled: boolean
      telegram_enabled: boolean
      push_enabled: boolean
      telegram_chat_id?: string
      digest_frequency: string
    }>('/notifications/settings'),
  })

  const [emailEnabled, setEmailEnabled] = useState<boolean | undefined>(undefined)
  const [telegramEnabled, setTelegramEnabled] = useState<boolean | undefined>(undefined)
  const [digestFreq, setDigestFreq] = useState<string | undefined>(undefined)

  const profileMutation = useMutation({
    mutationFn: () => usersApi.updateMe({ full_name: fullName }),
    onSuccess: (data) => {
      setUser(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const notifMutation = useMutation({
    mutationFn: () =>
      apiFetch('/notifications/settings', {
        method: 'PATCH',
        data: {
          email_enabled: emailEnabled ?? notifSettings?.email_enabled,
          telegram_enabled: telegramEnabled ?? notifSettings?.telegram_enabled,
          digest_frequency: digestFreq ?? notifSettings?.digest_frequency,
        },
      }),
  })

  const emailOn = emailEnabled ?? notifSettings?.email_enabled ?? true
  const telegramOn = telegramEnabled ?? notifSettings?.telegram_enabled ?? false
  const freq = digestFreq ?? notifSettings?.digest_frequency ?? 'daily'

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl">
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

      {/* Notifications */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="h-4 w-4 text-zinc-400" />
            Сповіщення
          </CardTitle>
          <CardDescription>Налаштуйте як ви хочете отримувати сповіщення</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notifLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border border-zinc-800 p-3">
                <div>
                  <p className="text-sm text-zinc-200">Email сповіщення</p>
                  <p className="text-xs text-zinc-500">Отримувати на {user?.email}</p>
                </div>
                <button
                  onClick={() => setEmailEnabled(!emailOn)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${emailOn ? 'bg-brand-600' : 'bg-zinc-700'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow ${emailOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-zinc-800 p-3">
                <div>
                  <p className="text-sm text-zinc-200">Telegram сповіщення</p>
                  <p className="text-xs text-zinc-500">Підключіть бот BuildRadar</p>
                </div>
                <button
                  onClick={() => setTelegramEnabled(!telegramOn)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${telegramOn ? 'bg-brand-600' : 'bg-zinc-700'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow ${telegramOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-zinc-400">Частота дайджесту</p>
                <div className="flex gap-2">
                  {[
                    { value: 'immediate', label: 'Миттєво' },
                    { value: 'daily', label: 'Щодня' },
                    { value: 'weekly', label: 'Щотижня' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setDigestFreq(value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        freq === value
                          ? 'bg-brand-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => notifMutation.mutate()}
                disabled={notifMutation.isPending}
                size="sm"
                variant="outline"
                className="border-zinc-800 gap-1.5"
              >
                <Save className="h-4 w-4" />
                {notifMutation.isPending ? 'Зберігаємо...' : 'Зберегти налаштування'}
              </Button>
            </>
          )}
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
