import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { type LucideIcon } from "lucide-react"

/** Renders the monitor switch component. */
export function MonitorSwitch({ icon: Icon, iconBg, iconColor, label, checked, onChange }: { icon?: LucideIcon; iconBg?: string; iconColor?: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", iconBg)}>
            <Icon className={cn("h-3.5 w-3.5", iconColor)} />
          </div>
        )}
        <span className="text-[13.5px] font-medium text-stone-700">{label}</span>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
      />
    </div>
  )
}
