import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}

export async function signIn(email: string, password: string) {
  const supabase = getSupabaseClient()
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  const supabase = getSupabaseClient()
  return supabase.auth.signOut()
}

export async function resetPassword(email: string) {
  const supabase = getSupabaseClient()
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
}

export async function getSession() {
  const supabase = getSupabaseClient()
  return supabase.auth.getSession()
}
