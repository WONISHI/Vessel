import { cn } from "@/lib/utils"
import { type LucideIcon } from "lucide-react"

/** Renders the status badge component. */
export function StatusBadge({ tone, icon: Icon, text }: { tone: "red" | "green"; icon: LucideIcon; text: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold", tone === "red" && "bg-red-50 text-red-600", tone === "green" && "bg-green-50 text-green-600")}>
      <Icon className="h-3 w-3" />
      {text}
    </span>
  )
}
