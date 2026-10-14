import * as React from 'react'
import * as Primitive from '@radix-ui/react-context-menu'
import { cn } from '@/lib/utils'
export const ContextMenu = Primitive.Root
export const ContextMenuTrigger = Primitive.Trigger
export const ContextMenuSub = Primitive.Sub
export const ContextMenuSubTrigger = React.forwardRef<React.ElementRef<typeof Primitive.SubTrigger>, React.ComponentPropsWithoutRef<typeof Primitive.SubTrigger>>(({ className, children, ...props }, ref) => <Primitive.SubTrigger ref={ref} className={cn('flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none data-[highlighted]:bg-green-600 data-[highlighted]:!text-white data-[highlighted]:[&_*]:!text-white data-[highlighted]:[&_svg]:!text-white data-[state=open]:bg-green-600 data-[state=open]:!text-white data-[state=open]:[&_*]:!text-white data-[state=open]:[&_svg]:!text-white [&_svg]:size-3.5', className)} {...props}>{children}<span aria-hidden className="ml-auto">›</span></Primitive.SubTrigger>)
ContextMenuSubTrigger.displayName = 'ContextMenuSubTrigger'
export const ContextMenuSubContent = React.forwardRef<React.ElementRef<typeof Primitive.SubContent>, React.ComponentPropsWithoutRef<typeof Primitive.SubContent>>(({ className, ...props }, ref) => <Primitive.Portal><Primitive.SubContent ref={ref} className={cn('z-[250] min-w-44 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-md', className)} {...props} /></Primitive.Portal>)
ContextMenuSubContent.displayName = 'ContextMenuSubContent'
export const ContextMenuContent = React.forwardRef<React.ElementRef<typeof Primitive.Content>, React.ComponentPropsWithoutRef<typeof Primitive.Content>>(({ className, ...props }, ref) => <Primitive.Portal><Primitive.Content ref={ref} className={cn('z-[250] min-w-44 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-md', className)} {...props} /></Primitive.Portal>)
ContextMenuContent.displayName = 'ContextMenuContent'
export const ContextMenuItem = React.forwardRef<React.ElementRef<typeof Primitive.Item>, React.ComponentPropsWithoutRef<typeof Primitive.Item>>(({ className, ...props }, ref) => <Primitive.Item ref={ref} className={cn('relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none data-[highlighted]:bg-green-600 data-[highlighted]:!text-white data-[highlighted]:[&_*]:!text-white data-[highlighted]:[&_svg]:!text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0', className)} {...props} />)
ContextMenuItem.displayName = 'ContextMenuItem'
export const ContextMenuSeparator = React.forwardRef<React.ElementRef<typeof Primitive.Separator>, React.ComponentPropsWithoutRef<typeof Primitive.Separator>>(({ className, ...props }, ref) => <Primitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-stone-200', className)} {...props} />)
ContextMenuSeparator.displayName = 'ContextMenuSeparator'

