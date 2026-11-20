import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/** Use the repository picker for branches, with an explicit option for a new name. */
export function PushBranchInput({ label, value, options, disabled, onChange }: { label: string; value: string; options: string[]; disabled: boolean; onChange: (value: string) => void }) {
  const [editing, setEditing] = useState(false)
  const branches = [...new Set([value, ...options].filter(Boolean))]
  let custom = "__vessel_custom_branch__"
  while (branches.includes(custom)) custom += "_"
  if (editing) return <Input autoFocus aria-label={label} value={value} disabled={disabled} autoComplete="off" spellCheck={false} onChange={(event) => onChange(event.target.value)} onBlur={() => setEditing(false)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") { event.preventDefault(); setEditing(false) } }} className="h-8 min-w-40 text-xs md:text-xs" />
  return <Select value={value} disabled={disabled} onValueChange={(next) => { if (!next) return; if (next === custom) setEditing(true); else onChange(next) }}>
    <SelectTrigger aria-label={label} className="h-8 min-w-40 w-full text-xs"><SelectValue placeholder="选择远程分支" /></SelectTrigger>
    <SelectContent>{branches.map((branch) => <SelectItem key={branch} value={branch} className="text-xs">{branch}</SelectItem>)}<SelectItem value={custom} className="text-xs text-muted-foreground">输入其他分支名称…</SelectItem></SelectContent>
  </Select>
}
