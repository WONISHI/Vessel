import { Checkbox } from "@/components/ui/checkbox"
import type { ReactNode } from "react"

/** Checkbox with an inline clickable label, styled by create-tag-dialog.css inside `.git-tag-dialog`. */
export function CheckField({ id, checked, disabled, onChange, children }: { id: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void; children: ReactNode }) {
  return <div className="flex items-center gap-2">
    <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(value) => onChange(value === true)} className="git-tag-check size-4 rounded border-stone-300 dark:border-stone-600 [&_svg]:size-3" />
    <label htmlFor={id} className={disabled ? "cursor-not-allowed text-stone-400 dark:text-stone-500" : "cursor-pointer"}>{children}</label>
  </div>
}
