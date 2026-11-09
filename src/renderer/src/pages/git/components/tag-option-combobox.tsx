import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command"

/** Boolean options use the shadcn Popover + Command combobox pattern. */
export function TagOptionCombobox({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  return <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
    <span>{label}</span>
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-label={label} aria-expanded={open && !disabled} disabled={disabled} className="tag-option-trigger h-7 w-20 shrink-0 justify-between text-xs">{value ? "开启" : "关闭"}<ChevronsUpDown className="size-3 opacity-50" /></Button></PopoverTrigger>
      <PopoverContent align="end" className="w-40 p-1">
        <Command>
          <CommandInput placeholder="搜索选项…" />
          <CommandList>
            <CommandEmpty>没有匹配选项</CommandEmpty>
            {[false, true].map((option) => <CommandItem key={String(option)} value={option ? "开启" : "关闭"} onSelect={() => { onChange(option); setOpen(false) }}><Check className={value === option ? "opacity-100" : "opacity-0"} />{option ? "开启" : "关闭"}</CommandItem>)}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>
}
