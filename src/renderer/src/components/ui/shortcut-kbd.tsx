import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { shortcutLabel, type ShortcutId } from "@vessel/utils"

/** Uses the same shortcut registry as the keyboard handlers and settings. */
export function ShortcutKbd({ id }: { id: ShortcutId }) {
  const label = shortcutLabel(id, navigator.platform.includes("Mac"))
  return <KbdGroup aria-label={label} className="shrink-0 gap-0.5">
    {label.split(/\s*\+\s*/).map((key) => <Kbd key={key} className="h-4 min-w-4 rounded-[3px] px-1 text-[9px] shadow-none">{key}</Kbd>)}
  </KbdGroup>
}
