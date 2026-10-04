import * as React from 'react'
import * as Primitive from '@radix-ui/react-context-menu'
import { cn } from '@/lib/utils'
export const ContextMenu = Primitive.Root
export const ContextMenuTrigger = Primitive.Trigger
export const ContextMenuContent = React.forwardRef<React.ElementRef<typeof Primitive.Content>, React.ComponentPropsWithoutRef<typeof Primitive.Content>>(({ className, ...props }, ref) => <Primitive.Portal><Primitive.Content ref={ref} className={cn('z-[250] min-w-44 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-md', className)} {...props} /></Primitive.Portal>)
ContextMenuContent.displayName = 'ContextMenuContent'
export const ContextMenuItem = React.forwardRef<React.ElementRef<typeof Primitive.Item>, React.ComponentPropsWithoutRef<typeof Primitive.Item>>(({ className, ...props }, ref) => <Primitive.Item ref={ref} className={cn('relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none data-[highlighted]:bg-green-600 data-[highlighted]:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0', className)} {...props} />)
ContextMenuItem.displayName = 'ContextMenuItem'
