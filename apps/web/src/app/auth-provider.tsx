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
  const { setUser, setLoading, logout } = useAuthStore()

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Fire-and-forget ping to wake Render before the real API call
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`).catch(() => {})

    const loadUser = async () => {
      const hardStop = setTimeout(() => {
        console.warn('[AuthProvider] loadUser timed out — stopping spinner')
        setLoading(false)
      }, 12000)

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          logout()
          return
        }
        const user = await usersApi.getMe()
        setUser(user)
      } catch (error) {
        console.error('[AuthProvider] loadUser failed:', error)
        if (isAuthError(error)) {
          logout()
        } else {
          setLoading(false)
        }
      } finally {
        clearTimeout(hardStop)
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
            } else {
              setLoading(false)
            }
            console.error('[AuthProvider] onAuthStateChange failed:', error)
          }
        } else if (event === 'SIGNED_OUT') {
          logout()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [setUser, setLoading, logout])

  return <>{children}</>
}
