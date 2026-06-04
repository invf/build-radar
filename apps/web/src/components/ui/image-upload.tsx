'use client'

import { useRef, useState } from 'react'
import { Camera, X, Loader2 } from 'lucide-react'
import { uploadImage } from '@/lib/api/upload'
import { cn } from '@/lib/utils/cn'

interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  shape?: 'circle' | 'square'
  size?: 'sm' | 'md' | 'lg'
  placeholder?: string
  className?: string
}

const SIZE_MAP = {
  sm: 'h-16 w-16',
  md: 'h-24 w-24',
  lg: 'h-32 w-32',
}

export function ImageUpload({
  value,
  onChange,
  shape = 'square',
  size = 'md',
  placeholder,
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleClick = () => {
    setError('')
    inputRef.current?.click()
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const url = await uploadImage(file)
      onChange(url)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      let msg: string
      if (typeof detail === 'string') {
        msg = detail
      } else if (Array.isArray(detail) && detail.length > 0) {
        msg = (detail[0] as { msg?: string })?.msg ?? 'Помилка завантаження'
      } else {
        msg = (err as Error)?.message ?? 'Помилка завантаження'
      }
      setError(msg)
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={cn('relative group inline-block', className)}>
      <div
        onClick={handleClick}
        className={cn(
          SIZE_MAP[size],
          shape === 'circle' ? 'rounded-full' : 'rounded-xl',
          'relative overflow-hidden cursor-pointer border border-zinc-700 bg-zinc-800',
          'flex items-center justify-center transition-all',
          'hover:border-zinc-500',
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-zinc-600">
            <Camera className="h-5 w-5" />
            {placeholder && <span className="text-[10px] text-center px-1 leading-tight">{placeholder}</span>}
          </div>
        )}

        {/* Overlay on hover */}
        <div className={cn(
          'absolute inset-0 flex items-center justify-center',
          shape === 'circle' ? 'rounded-full' : 'rounded-xl',
          'bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity',
        )}>
          {loading
            ? <Loader2 className="h-5 w-5 text-white animate-spin" />
            : <Camera className="h-5 w-5 text-white" />
          }
        </div>
      </div>

      {/* Clear button */}
      {value && !loading && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange('') }}
          className={cn(
            'absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-zinc-700 border border-zinc-600',
            'flex items-center justify-center text-zinc-300 hover:text-white hover:bg-red-600 transition-colors',
          )}
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {error && <p className="text-[10px] text-red-400 mt-1 text-center">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}
