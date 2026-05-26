import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { createBrowserClient } from '@supabase/ssr'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: `${API_URL}/api/v1`,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  })

  client.interceptors.request.use(async (config) => {
    if (typeof window !== 'undefined') {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`
      }
    }
    return config
  })

  client.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(error)
  )

  return client
}

export const apiClient = createApiClient()

export async function apiFetch<T>(
  path: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await apiClient.request<T>({ url: path, ...config })
  return response.data
}
