import { cn } from "@/lib/utils"
import { type LucideIcon } from "lucide-react"

/** Renders the stat card component. */
export function StatCard({ label, value, icon: Icon, iconBg, iconColor, valueColor }: { label: string; value: number; icon: LucideIcon; iconBg: string; iconColor: string; valueColor: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#e7e5e4] bg-white p-4">
      <div>
        <div className="text-[12px] font-medium text-stone-400">{label}</div>
        <div className={cn("mt-1.5 text-[26px] font-bold leading-none", valueColor)}>{value}</div>
      </div>
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", iconBg)}>
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>
    </div>
  )
}
