'use client'

import { useState, useEffect } from 'react'
import { Bell, Search, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'next/navigation'
import { GlobalSearchModal } from '@/components/search/global-search-modal'

interface TopbarProps {
  onMenuClick?: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user } = useAuthStore()
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm px-4 md:px-6">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>

        {/* Search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex flex-1 max-w-md items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-500 hover:border-zinc-700 hover:text-zinc-400 transition-colors"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Пошук об&apos;єктів, компаній...</span>
          <kbd className="hidden md:inline-flex items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-600">
            Ctrl K
          </kbd>
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="ghost" size="icon" onClick={() => router.push('/alerts')}>
            <Bell className="h-5 w-5 text-zinc-400" />
          </Button>

          <div
            className="h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white cursor-pointer"
            onClick={() => router.push('/settings')}
          >
            {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>
      </header>

      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
