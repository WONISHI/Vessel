import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return <kbd data-slot="kbd" className={cn('inline-flex h-6 min-w-6 items-center justify-center rounded border border-stone-200 bg-stone-100 px-1.5 font-mono text-[11px] font-medium text-stone-600 shadow-[0_1px_0_#e7e5e4]', className)} {...props} />
}
export function KbdGroup({ className, ...props }: ComponentProps<'span'>) {
  return <span data-slot="kbd-group" className={cn('inline-flex items-center gap-1 whitespace-nowrap', className)} {...props} />
}
