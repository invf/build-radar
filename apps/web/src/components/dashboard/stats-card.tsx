import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  variant?: 'default' | 'brand' | 'success' | 'warning' | 'purple'
  className?: string
}

const variantStyles = {
  default: 'border-zinc-800 bg-zinc-900/50',
  brand: 'border-brand-500/20 bg-brand-500/5',
  success: 'border-green-500/20 bg-green-500/5',
  warning: 'border-yellow-500/20 bg-yellow-500/5',
  purple: 'border-purple-500/20 bg-purple-500/5',
}

const iconStyles = {
  default: 'bg-zinc-800 text-zinc-400',
  brand: 'bg-brand-500/10 text-brand-400',
  success: 'bg-green-500/10 text-green-400',
  warning: 'bg-yellow-500/10 text-yellow-400',
  purple: 'bg-purple-500/10 text-purple-400',
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className,
}: StatsCardProps) {
  return (
    <div className={cn(
      'rounded-xl border p-5 backdrop-blur-sm',
      variantStyles[variant],
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{title}</p>
          <p className="mt-2 text-2xl font-bold text-zinc-100 tabular-nums">
            {typeof value === 'number' ? value.toLocaleString('uk-UA') : value}
          </p>
          {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
          {trend && (
            <div className={cn(
              'mt-2 inline-flex items-center gap-1 text-xs font-medium',
              trend.value >= 0 ? 'text-green-400' : 'text-red-400'
            )}>
              <span>{trend.value >= 0 ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}% {trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn('rounded-lg p-2.5 shrink-0', iconStyles[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}
