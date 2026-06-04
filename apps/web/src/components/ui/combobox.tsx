'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  className?: string
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Виберіть або введіть...',
  emptyText = 'Нічого не знайдено',
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  // When dropdown opens, seed query with current value label
  const handleFocus = () => {
    setQuery(value)
    setOpen(true)
  }

  const handleSelect = (option: ComboboxOption) => {
    onChange(option.value)
    setQuery(option.label)
    setOpen(false)
    inputRef.current?.blur()
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setQuery('')
    inputRef.current?.focus()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    onChange(e.target.value)
    setOpen(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
    if (e.key === 'Enter' && filtered.length === 1) {
      e.preventDefault()
      handleSelect(filtered[0])
    }
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        // If user typed something not matching any option, keep as free text
        if (!options.find((o) => o.label === query)) {
          setQuery(value)
        }
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [options, query, value])

  // Sync display when value changes externally
  useEffect(() => {
    if (!open) {
      const match = options.find((o) => o.value === value)
      setQuery(match ? match.label : value)
    }
  }, [value, options, open])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            'flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 pr-8 text-sm text-zinc-100',
            'placeholder:text-zinc-500 outline-none focus:border-zinc-600 transition-colors'
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
          onClick={value ? handleClear : () => { inputRef.current?.focus(); setOpen(true) }}
        >
          {value ? <X className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {open && (
        <div
          id={listId}
          className={cn(
            'absolute z-50 mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 shadow-xl',
            'max-h-52 overflow-auto'
          )}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-zinc-500">{emptyText}</div>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  'flex w-full items-center px-3 py-2 text-sm text-left transition-colors',
                  'hover:bg-zinc-800',
                  option.value === value ? 'text-brand-400 bg-zinc-800/60' : 'text-zinc-200'
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(option)
                }}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
