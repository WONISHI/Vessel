import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { MoreVertical } from "lucide-react"

import { STATUS_OPTIONS } from "./todo-table-model"

export function StatusCell({ status, onUpdateStatus }: { status?: { key: string; label: string; colorClass?: string }; onUpdateStatus: (st: { key: string; label: string; colorClass?: string }) => void }) {
  const current = status || { key: "doing", label: "进行中", colorClass: "bg-blue-50 text-blue-600 border-blue-200" }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="group flex items-center gap-1.5 cursor-pointer">
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-normal border transition-colors", current.colorClass || "bg-blue-50 text-blue-600 border-blue-200")}>
            <span className={cn("size-1.5 rounded-full", current.key === "done" ? "bg-emerald-600" : current.key === "doing" ? "bg-blue-600" : current.key === "overdue" ? "bg-red-600" : "bg-stone-400")} />
            {current.label}
          </span>
          <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-stone-100 text-stone-400 transition-opacity">
            <MoreVertical className="size-3" />
          </button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-36 bg-white z-[200]"
      >
        <div className="px-2 py-1 text-[10px] font-bold text-stone-400 uppercase">更改状态/颜色</div>
        {STATUS_OPTIONS.map((st) => (
          <DropdownMenuItem
            key={st.key}
            onClick={() => onUpdateStatus({ key: st.key, label: st.label, colorClass: st.colorClass })}
            className="text-xs flex items-center gap-2"
          >
            <span className={cn("size-2 rounded-full", st.dotClass)} />
            {st.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
