'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'next/navigation'

interface TopbarProps {
  onMenuClick?: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user } = useAuthStore()
  const router = useRouter()

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm px-4 md:px-6">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2 ml-auto">
        <div
          className="h-8 w-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white cursor-pointer"
          onClick={() => router.push('/settings')}
        >
          {user?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  )
}
