'use client'

import { useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuthStore } from '@/stores/auth'
import { usersApi } from '@/lib/api/users'
import type { AxiosError } from 'axios'

function isAuthError(error: unknown): boolean {
  const status = (error as AxiosError)?.response?.status
  return status === 401 || status === 403
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, logout } = useAuthStore()

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const loadUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          logout()
          return
        }
        const user = await usersApi.getMe()
        setUser(user)
      } catch (error) {
        if (isAuthError(error)) {
          logout()
        }
        console.error('[AuthProvider] loadUser failed:', error)
      }
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          try {
            const user = await usersApi.getMe()
            setUser(user)
          } catch (error) {
            if (isAuthError(error)) {
              logout()
            }
            console.error('[AuthProvider] onAuthStateChange failed:', error)
          }
        } else if (event === 'SIGNED_OUT') {
          logout()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [setUser, logout])

  return <>{children}</>
}
