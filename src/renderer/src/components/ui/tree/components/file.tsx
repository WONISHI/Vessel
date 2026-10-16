import { FileProps, TreeContext } from "@/components/ui/tree/components/tree-shared"
import { cn } from "@/lib/utils"
import { File as FileIcon } from "lucide-react"
import React from "react"

/** Renders the file component. */
export const File = React.forwardRef<HTMLButtonElement, FileProps>(({ className, id, name, icon: Icon = FileIcon, ...props }, ref) => {
  const context = React.useContext(TreeContext)
  const isSelected = context?.selectedId === id

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => context?.handleSelect(id)}
      className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors", isSelected ? "bg-white text-teal-700 shadow-sm ring-1 ring-zinc-200" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900", className)}
      {...props}
    >
      <Icon className={cn("h-4 w-4", isSelected ? "text-teal-600" : "text-zinc-400")} />
      <span className="flex-1 text-left truncate">{name}</span>
    </button>
  )
})

File.displayName = "File"
