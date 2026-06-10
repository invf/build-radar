'use client'

import { useRef, useState } from 'react'
import { Camera, ImageIcon, X, Loader2 } from 'lucide-react'
import { uploadImage } from '@/lib/api/upload'
import { cn } from '@/lib/utils/cn'

async function compressImage(file: File, maxPx = 1920, quality = 0.82): Promise<File> {
  if (file.size < 300 * 1024) return file
  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        const ratio = Math.min(maxPx / width, maxPx / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file),
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file) }
    img.src = objectUrl
  })
}

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
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const toUpload = await compressImage(file)
      const url = await uploadImage(toUpload)
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
      if (galleryRef.current) galleryRef.current.value = ''
      if (cameraRef.current) cameraRef.current.value = ''
    }
  }

  const rounded = shape === 'circle' ? 'rounded-full' : 'rounded-xl'

  return (
    <div className={cn('relative group inline-block', className)}>
      <div className={cn(SIZE_MAP[size], rounded, 'relative overflow-hidden border border-zinc-700 bg-zinc-800')}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center gap-1 text-zinc-600">
            <Camera className="h-5 w-5" />
            {placeholder && <span className="text-[10px] text-center px-1 leading-tight">{placeholder}</span>}
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className={cn('absolute inset-0 flex items-center justify-center bg-black/60', rounded)}>
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          </div>
        )}

        {/* Action buttons overlay — always visible on touch, hover on desktop */}
        {!loading && (
          <div className={cn(
            'absolute inset-0 flex items-end justify-center gap-2 pb-2',
            rounded,
            'bg-black/50 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity',
          )}>
            <button
              type="button"
              title="Вибрати з галереї"
              onClick={() => { setError(''); galleryRef.current?.click() }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors"
            >
              <ImageIcon className="h-3.5 w-3.5 text-white" />
            </button>
            <button
              type="button"
              title="Сфотографувати"
              onClick={() => { setError(''); cameraRef.current?.click() }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors"
            >
              <Camera className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        )}
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

      {error && <p className="text-[10px] text-red-400 mt-1 text-center max-w-[theme(spacing.24)]">{error}</p>}

      {/* Gallery picker */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      {/* Camera capture */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}
