import { apiFetch } from './client'
import type { ObjectNote, NoteStatus } from '@/types'

export interface CreateNotePayload {
  note_text: string
  status?: NoteStatus
  tags?: string[]
  reminder_date?: string
}

export const notesApi = {
  getForObject: (objectId: string) =>
    apiFetch<ObjectNote>(`/notes/object/${objectId}`),

  create: (objectId: string, payload: CreateNotePayload) =>
    apiFetch<ObjectNote>(`/notes/object/${objectId}`, {
      method: 'POST',
      data: payload,
    }),

  update: (noteId: string, payload: Partial<CreateNotePayload>) =>
    apiFetch<ObjectNote>(`/notes/${noteId}`, {
      method: 'PATCH',
      data: payload,
    }),

  delete: (noteId: string) =>
    apiFetch<void>(`/notes/${noteId}`, { method: 'DELETE' }),

  getMyNotes: (params?: { status?: NoteStatus; page?: number }) =>
    apiFetch<ObjectNote[]>('/notes/my', { params }),
}
