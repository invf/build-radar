'use client'

import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface DatePickerProps {
  value: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Оберіть дату',
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-9 w-full items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm transition-colors text-left',
            'hover:border-zinc-700 hover:bg-zinc-800/60',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-500',
            !value && 'text-zinc-500',
            value && 'text-zinc-100',
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 text-zinc-400 shrink-0" />
          <span className="flex-1">{value ? format(value, 'dd.MM.yyyy') : placeholder}</span>
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange(null) } }}
              className="text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className={cn(
            'z-50 rounded-xl border border-zinc-700 bg-zinc-900 p-3 shadow-2xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
        >
          <DayPicker
            mode="single"
            selected={value ?? undefined}
            onSelect={(day) => {
              onChange(day ?? null)
              if (day) setOpen(false)
            }}
            locale={uk}
            components={{
              Chevron: ({ orientation, ...props }) =>
                orientation === 'left' ? (
                  <ChevronLeft className="h-4 w-4" {...(props as React.SVGProps<SVGSVGElement>)} />
                ) : (
                  <ChevronRight className="h-4 w-4" {...(props as React.SVGProps<SVGSVGElement>)} />
                ),
              PreviousMonthButton: (props) => (
                <button {...props} type="button" />
              ),
              NextMonthButton: (props) => (
                <button {...props} type="button" />
              ),
            }}
            classNames={{
              root: 'select-none',
              months: 'flex flex-col',
              month: 'space-y-3',
              month_caption: 'flex justify-center relative items-center h-8',
              caption_label: 'text-sm font-medium text-zinc-100',
              nav: 'absolute inset-x-0 flex items-center justify-between',
              button_previous:
                'h-7 w-7 flex items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors',
              button_next:
                'h-7 w-7 flex items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors',
              month_grid: 'w-full border-collapse',
              weekdays: 'flex',
              weekday:
                'text-zinc-500 w-9 h-7 font-normal text-[0.8rem] flex items-center justify-center',
              weeks: 'mt-1 space-y-1',
              week: 'flex w-full',
              day: 'relative p-0 flex items-center justify-center',
              day_button:
                'h-9 w-9 rounded-md text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500',
              selected: '[&>button]:!bg-brand-600 [&>button]:!text-white [&>button]:hover:!bg-brand-500',
              today: '[&>button]:bg-zinc-800 [&>button]:text-zinc-100 [&>button]:font-semibold',
              outside: '[&>button]:text-zinc-600 opacity-40',
              disabled: '[&>button]:opacity-30 [&>button]:cursor-not-allowed',
            }}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
