'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { useAuthStore } from '@/stores/auth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [slowLoad, setSlowLoad] = useState(false)

  useEffect(() => {
    if (!isLoading) { setSlowLoad(false); return }
    const t = setTimeout(() => setSlowLoad(true), 8000)
    return () => clearTimeout(t)
  }, [isLoading])

  if (!user && isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        {slowLoad && (
          <p className="text-zinc-500 text-sm text-center max-w-xs">
            Сервер прокидається після сну…<br />
            <span className="text-zinc-600 text-xs">Зазвичай займає до 60 секунд</span>
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <Sidebar className="hidden md:flex" />

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <Sidebar className="fixed left-0 top-0 bottom-0 z-50 flex" />
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <Topbar onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="h-full">{children}</div>
        </main>
      </div>
    </div>
  )
}
