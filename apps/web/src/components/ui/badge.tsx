import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        success: 'border-transparent bg-green-500/10 text-green-400 border-green-500/20',
        warning: 'border-transparent bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        info: 'border-transparent bg-blue-500/10 text-blue-400 border-blue-500/20',
        purple: 'border-transparent bg-purple-500/10 text-purple-400 border-purple-500/20',
        muted: 'border-transparent bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
        brand: 'border-transparent bg-brand-600/10 text-brand-400 border-brand-600/20',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
