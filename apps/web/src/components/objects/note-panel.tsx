'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { StickyNote, Save, Loader2, Tag, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { NOTE_STATUS_LABELS, NOTE_STATUS_COLORS } from '@/lib/utils/format'
import { notesApi } from '@/lib/api/notes'
import type { NoteStatus } from '@/types'

const NOTE_STATUSES: NoteStatus[] = [
  'interesting', 'contact_later', 'active_lead', 'in_progress', 'not_relevant'
]

interface NotePanelProps {
  objectId: string
}

export function NotePanel({ objectId }: NotePanelProps) {
  const qc = useQueryClient()

  const { data: note, isLoading } = useQuery({
    queryKey: ['note', objectId],
    queryFn: () => notesApi.getForObject(objectId),
    retry: false,
  })

  const [noteText, setNoteText] = useState(note?.note_text || '')
  const [status, setStatus] = useState<NoteStatus | ''>(note?.status || '')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(note?.tags || [])
  const [reminderDate, setReminderDate] = useState(note?.reminder_date?.split('T')[0] || '')

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        note_text: noteText,
        status: (status || undefined) as NoteStatus | undefined,
        tags,
        reminder_date: reminderDate || undefined,
      }
      return note?.id
        ? notesApi.update(note.id, payload)
        : notesApi.create(objectId, payload)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['note', objectId] }),
  })

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) {
      setTags([...tags, t])
      setTagInput('')
    }
  }

  if (isLoading) return null

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <StickyNote className="h-4 w-4 text-yellow-400" />
        <h3 className="text-sm font-semibold text-zinc-200">Особова нотатка</h3>
        <span className="text-xs text-zinc-600">(тільки ви бачите)</span>
      </div>

      <div className="space-y-3">
        <Textarea
          placeholder="Ваші нотатки про цей об'єкт..."
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={4}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Статус</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as NoteStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Не вказано" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Не вказано</SelectItem>
                {NOTE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{NOTE_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              <Bell className="inline h-3 w-3 mr-1" />
              Нагадування
            </Label>
            <Input
              type="date"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <Label className="text-xs">
            <Tag className="inline h-3 w-3 mr-1" />
            Теги
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="Додати тег..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
              className="text-sm"
            />
            <Button variant="outline" size="sm" onClick={addTag} className="border-zinc-700">
              +
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                  className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
                >
                  #{tag} ×
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          className="w-full bg-brand-600 hover:bg-brand-700 text-white"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !noteText.trim()}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {note ? 'Оновити нотатку' : 'Зберегти нотатку'}
        </Button>

        {status && (
          <div className={`rounded-lg px-3 py-2 text-xs text-center ${NOTE_STATUS_COLORS[status as NoteStatus]}`}>
            Статус: {NOTE_STATUS_LABELS[status as NoteStatus]}
          </div>
        )}
      </div>
    </div>
  )
}
