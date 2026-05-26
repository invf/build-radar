'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { signIn } from '@/lib/auth/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

const loginSchema = z.object({
  email: z.string().email('Невірний email'),
  password: z.string().min(6, 'Мінімум 6 символів'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/'
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginFormData) => {
    setError(null)
    const { error: authError } = await signIn(data.email, data.password)
    if (authError) {
      setError('Невірний email або пароль')
      return
    }
    router.push(redirectTo)
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 mb-4">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">BuildRadar</h1>
          <p className="text-zinc-500 text-sm mt-1">Платформа будівельної розвідки</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
          <h2 className="text-lg font-semibold text-zinc-100 mb-6">Вхід до системи</h2>

          {error && (
            <div className="mb-4 rounded-lg border border-red-900/50 bg-red-900/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-end">
              <Link
                href="/forgot-password"
                className="text-xs text-brand-400 hover:text-brand-300"
              >
                Забули пароль?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full bg-brand-600 hover:bg-brand-700 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Увійти
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-zinc-500">
            Доступ лише за запрошенням.{' '}
            <a href="mailto:admin@buildradar.ua" className="text-brand-400 hover:underline">
              Запросити доступ
            </a>
          </p>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          © {new Date().getFullYear()} BuildRadar. Усі права захищено.
        </p>
      </div>
    </div>
  )
}
