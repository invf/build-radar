'use client'

import { Bell, Search, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface TopbarProps {
  onMenuClick?: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user } = useAuthStore()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm px-4 md:px-6">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* Global Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            type="search"
            placeholder="Пошук об'єктів, компаній, адрес..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-800 text-sm"
          />
        </div>
      </form>

      <div className="flex items-center gap-2 ml-auto">
        {/* Notifications */}
        <Button variant="ghost" size="icon" onClick={() => router.push('/alerts')}>
          <Bell className="h-5 w-5 text-zinc-400" />
        </Button>

        {/* User avatar */}
        <div className="h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white cursor-pointer"
          onClick={() => router.push('/settings')}>
          {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  )
}
