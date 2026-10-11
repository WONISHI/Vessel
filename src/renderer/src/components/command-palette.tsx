import { useEffect, useState } from "react"
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command"
import { Eye, EyeOff } from "lucide-react"
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(() => localStorage.getItem("vessel-control-visible") !== "false")
  useEffect(() => {
    const show = () => setOpen(value => !value)
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") { event.preventDefault(); event.stopPropagation(); show() }
    }
    window.addEventListener("keydown", key, true)
    const off = window.electronAPI.onCommandPalette?.(show)
    return () => { window.removeEventListener("keydown", key, true); off?.() }
  }, [])
  const choose = (value: boolean) => {
    localStorage.setItem("vessel-control-visible", String(value)); setVisible(value)
    window.dispatchEvent(new Event("vessel-control-visibility")); setOpen(false)
  }
  return <CommandDialog open={open} onOpenChange={setOpen}>
    <CommandInput autoFocus placeholder="输入命令…" />
    <CommandList><CommandEmpty>没有匹配的命令</CommandEmpty>
      <CommandGroup heading="界面">
        <CommandItem value="显示控制按钮" disabled={visible} onSelect={() => choose(true)}><Eye />显示控制按钮</CommandItem>
        <CommandItem value="关闭控制按钮" disabled={!visible} onSelect={() => choose(false)}><EyeOff />关闭控制按钮</CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
}
