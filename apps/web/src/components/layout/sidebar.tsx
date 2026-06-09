'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Map,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Building,
  ShoppingCart,
  BarChart3,
  Shield,
  ClipboardList,
  Factory,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useAuthStore } from '@/stores/auth'
import { signOut } from '@/lib/auth/supabase'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const navigation = [
  { name: 'Дашборд', href: '/', icon: LayoutDashboard },
  { name: 'Замовлення', href: '/orders', icon: ClipboardList },
  { name: 'Об\'єкти', href: '/objects', icon: Building2 },
  { name: 'Мапа', href: '/map', icon: Map },
  { name: 'Компанії', href: '/companies', icon: Building },
  { name: 'Виробництво', href: '/manufacturers', icon: Factory },
  { name: 'Тендери', href: '/tenders', icon: ShoppingCart },
  { name: 'B2B Контакти', href: '/contacts', icon: Users },
  { name: 'Аналітика', href: '/analytics', icon: BarChart3 },
]

const adminNavigation = [
  { name: 'Адмін панель', href: '/admin', icon: Shield },
]

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    await signOut()
    logout()
    router.push('/login')
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-zinc-800 bg-zinc-950 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b border-zinc-800 py-4',
        collapsed ? 'justify-center px-3' : 'px-5 gap-3'
      )}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <span className="text-sm font-bold text-zinc-100">BuildRadar</span>
            <p className="text-[10px] text-zinc-500 leading-none mt-0.5">Construction Intel</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive(item.href)
                ? 'bg-brand-600/10 text-brand-400 border border-brand-600/20'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
              collapsed && 'justify-center'
            )}
            title={collapsed ? item.name : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.name}</span>}
          </Link>
        ))}

        {user?.role === 'admin' && (
          <>
            <div className={cn(
              'mt-4 mb-2',
              collapsed ? 'border-t border-zinc-800' : 'px-3'
            )}>
              {!collapsed && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  Адмін
                </p>
              )}
            </div>
            {adminNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-purple-600/10 text-purple-400 border border-purple-600/20'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
                  collapsed && 'justify-center'
                )}
                title={collapsed ? item.name : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User section */}
      <div className="border-t border-zinc-800 p-2 space-y-1">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors',
            collapsed && 'justify-center'
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Налаштування</span>}
        </Link>

        {!collapsed && user && (
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="h-7 w-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {user.full_name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-zinc-200 truncate">{user.full_name || user.email}</p>
              <p className="text-[10px] text-zinc-500 capitalize">{user.role}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-red-900/20 hover:text-red-400 transition-colors',
            collapsed && 'justify-center'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Вийти</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg p-2 text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  )
}
