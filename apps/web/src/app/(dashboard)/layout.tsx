'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Auto-close sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [pathname])

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = mobileSidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileSidebarOpen])

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar className="hidden md:flex" />

      {/* Mobile sidebar overlay — always rendered for smooth CSS transition */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-all duration-300 ${mobileSidebarOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!mobileSidebarOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Навігаційне меню"
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${mobileSidebarOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileSidebarOpen(false)}
        />
        {/* Sliding panel */}
        <div
          className={`absolute left-0 top-0 bottom-0 z-50 transition-transform duration-300 ease-in-out ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <Sidebar className="flex h-full" />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="h-full">{children}</div>
        </main>
      </div>
    </div>
  )
}
