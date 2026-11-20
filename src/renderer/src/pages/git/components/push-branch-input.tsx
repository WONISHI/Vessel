import { useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandItem, CommandList } from "@/components/ui/command"

/** Editable branch name with the same shadcn picker used by other Git dialogs. */
export function PushBranchInput({ label, value, options, disabled, onChange }: { label: string; value: string; options: string[]; disabled: boolean; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  return <Popover open={open && !disabled} onOpenChange={setOpen}>
    <PopoverAnchor asChild>
      <div className="relative min-w-40">
        <Input aria-label={label} value={value} disabled={disabled} autoComplete="off" spellCheck={false} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "ArrowDown" && options.length) { event.preventDefault(); setOpen(true) } }} className={`h-8 pr-8 text-xs md:text-xs ${open ? "border-green-600 ring-2 ring-green-600/10" : ""}`} />
        <PopoverTrigger asChild><button type="button" aria-label={`选择${label}`} disabled={disabled || !options.length} className="absolute right-1 top-1 grid size-6 place-items-center rounded text-stone-400 hover:bg-stone-100 disabled:opacity-40 dark:hover:bg-stone-700"><ChevronDown className="size-3.5" /></button></PopoverTrigger>
      </div>
    </PopoverAnchor>
    <PopoverContent align="start" sideOffset={4} className="z-[60] w-[var(--radix-popover-trigger-width)] min-w-40 rounded-md p-1 shadow-md">
      <Command defaultValue={value}>
        <CommandList className="max-h-48">
          {options.map((branch) => <CommandItem key={branch} value={branch} data-current={value === branch} onSelect={() => { onChange(branch); setOpen(false) }} className="relative min-h-7 rounded-sm py-1.5 pl-8 pr-2 text-xs data-[selected=true]:bg-green-600 data-[selected=true]:text-white data-[current=true]:bg-green-600 data-[current=true]:text-white"><Check className={`absolute left-2 size-4 ${value === branch ? "" : "opacity-0"}`} /><span className="truncate">{branch}</span></CommandItem>)}
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
}
