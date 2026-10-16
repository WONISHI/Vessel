import { type LucideIcon } from "lucide-react"

/** Renders the meta badge component. */
export function MetaBadge({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#e7e5e4] bg-white px-2.5 py-1 text-[12px] font-medium text-stone-500">
      <Icon className="h-3.5 w-3.5 text-stone-400" />
      {text}
    </span>
  )
}
