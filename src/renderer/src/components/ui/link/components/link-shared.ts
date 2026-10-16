import { type ComponentPropsWithoutRef, type ReactNode } from "react"
export const linkClassName = "text-primary underline underline-offset-4 hover:opacity-80 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
export interface LinkAction {
  /** 操作的稳定标识。 */
  id: string
  label: string
  icon?: ReactNode
  onSelect: (href: string) => void | Promise<void>
}
export interface LinkProps extends ComponentPropsWithoutRef<"a"> {
  /** 扩展右键操作，例如“在工作区中打开”。 */
  actions?: readonly LinkAction[]
}
