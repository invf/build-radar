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
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          logout()
          return
        }

        // Populate immediately from JWT — no round-trip to Render needed
        const su = session.user
        setUser({
          id: su.id,
          email: su.email ?? '',
          full_name: su.user_metadata?.full_name ?? su.user_metadata?.name ?? null,
          avatar_url: su.user_metadata?.avatar_url ?? null,
          role: 'viewer',
          is_active: true,
          created_at: su.created_at ?? new Date().toISOString(),
        })

        // Refresh with full profile (role, etc.) in background
        usersApi.getMe().then(setUser).catch(() => {})
      } catch (error) {
        console.error('[AuthProvider] loadUser failed:', error)
        if (isAuthError(error)) logout()
      }
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const su = session.user
          setUser({
            id: su.id,
            email: su.email ?? '',
            full_name: su.user_metadata?.full_name ?? su.user_metadata?.name ?? null,
            avatar_url: su.user_metadata?.avatar_url ?? null,
            role: 'viewer',
            is_active: true,
            created_at: su.created_at ?? new Date().toISOString(),
          })
          usersApi.getMe().then(setUser).catch(() => {})
        } else if (event === 'SIGNED_OUT') {
          logout()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [setUser, setLoading, logout])

  return <>{children}</>
}
