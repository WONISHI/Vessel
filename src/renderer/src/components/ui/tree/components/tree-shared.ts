import { Collapsible } from "@/components/ui/collapsible"
import { type LucideIcon } from "lucide-react"
import React from "react"
export interface TreeContextProps {
  indent: number
  selectedId?: string
  handleSelect: (id: string) => void
}
export const TreeContext = React.createContext<TreeContextProps | undefined>(undefined)
export interface TreeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 每层缩进距离（px），默认 19；0 表示不缩进。 */
  indent?: number
  data?: any[]
  initialSelectedId?: string
  onSelect?: (item: any) => void
  children?: React.ReactNode
}
export interface FolderProps extends React.ComponentPropsWithoutRef<typeof Collapsible> {
  name: string
  icon?: LucideIcon
}
export interface FileProps extends React.HTMLAttributes<HTMLButtonElement> {
  id: string
  name: string
  icon?: LucideIcon
}
export interface TreeViewProps extends TreeProps {
  data: any[]
  itemClassName?: string
}
export interface VirtualTreeRow<T> {
  id: string
  depth: number
  item: T
  expanded?: boolean
}
export interface VirtualTreeProps<T> {
  rows: readonly VirtualTreeRow<T>[]
  viewport: HTMLElement | null
  /** 每层缩进距离（px），默认 12；0 表示不缩进。 */
  indent?: number
  rowHeight?: number
  overscan?: number
  selectedId?: string
  renderRow: (row: VirtualTreeRow<T>) => React.ReactNode
}
