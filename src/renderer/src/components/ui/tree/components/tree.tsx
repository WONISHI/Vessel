import { TreeContext, TreeProps } from "@/components/ui/tree/components/tree-shared"
import { cn } from "@/lib/utils"
import React from "react"

/** Renders the tree component. */
export const Tree = React.forwardRef<HTMLDivElement, TreeProps>(({ className, initialSelectedId, onSelect, children, indent = 19, ...props }, ref) => {
  const [selectedId, setSelectedId] = React.useState<string | undefined>(initialSelectedId)

  /** Handles select events. */
  const handleSelect = React.useCallback(
    (id: string) => {
      setSelectedId(id)
      if (onSelect) {
        onSelect(id)
      }
    },
    [onSelect]
  )

  return (
    <TreeContext.Provider value={{ selectedId, handleSelect, indent: Number.isFinite(indent) ? Math.max(0, indent) : 19 }}>
      <div
        ref={ref}
        className={cn("grid gap-1", className)}
        {...props}
      >
        {children}
      </div>
    </TreeContext.Provider>
  )
})

Tree.displayName = "Tree"
