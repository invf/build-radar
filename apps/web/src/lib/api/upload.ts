import { apiClient } from './client'

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const response = await apiClient.post<{ url: string }>('/upload', form, {
    headers: { 'Content-Type': undefined },
  })
  return response.data.url
}
