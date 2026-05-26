'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { useAuthStore } from '@/stores/auth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

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
