import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { FolderProps, TreeContext } from "@/components/ui/tree/components/tree-shared"
import { cn } from "@/lib/utils"
import { ChevronRight, Folder as FolderIcon } from "lucide-react"
import React from "react"

/** Renders the folder component. */
export const Folder = React.forwardRef<HTMLDivElement, FolderProps>(({ className, name, icon: Icon = FolderIcon, children, ...props }, ref) => {
  const indent = React.useContext(TreeContext)?.indent ?? 19
  return (
    <Collapsible
      ref={ref}
      className={cn("group/folder w-full", className)}
      {...props}
    >
      <CollapsibleTrigger asChild>
        <button className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-zinc-100", "text-zinc-600 transition-colors")}>
          <Icon className="h-4 w-4 text-teal-600/60" />
          <span className="flex-1 text-left truncate">{name}</span>
          <ChevronRight className="h-4 w-4 text-zinc-400 transition-transform duration-200 group-data-[state=open]/folder:rotate-90" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div
          className="relative flex flex-col gap-1 py-1"
          style={{ paddingLeft: indent }}
        >
          {indent > 0 && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 border-l border-zinc-200/60"
              style={{ left: Math.max(0, indent - 9) }}
            />
          )}
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
})

Folder.displayName = "Folder"
