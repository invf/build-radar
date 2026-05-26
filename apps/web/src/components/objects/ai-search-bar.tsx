'use client'

import { useState } from 'react'
import { Sparkles, Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface AISearchBarProps {
  onSearch: (query: string) => void
  onClear: () => void
  isLoading?: boolean
  intentSummary?: string
}

export function AISearchBar({ onSearch, onClear, isLoading, intentSummary }: AISearchBarProps) {
  const [value, setValue] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim().length >= 3) onSearch(value.trim())
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-400" />
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Наприклад: великі ЖК у Харкові що будуються..."
            className="pl-9 border-brand-800 bg-brand-950/20 focus:border-brand-600"
          />
        </div>
        <Button
          type="submit"
          disabled={value.trim().length < 3 || isLoading}
          className="bg-brand-600 hover:bg-brand-700 text-white gap-1.5"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          ШІ-пошук
        </Button>
        {intentSummary && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => { setValue(''); onClear() }}
            className="text-zinc-500 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </form>

      {intentSummary && (
        <p className="text-xs text-brand-400 flex items-center gap-1.5 pl-1">
          <Sparkles className="h-3 w-3" />
          {intentSummary}
        </p>
      )}
    </div>
  )
}
