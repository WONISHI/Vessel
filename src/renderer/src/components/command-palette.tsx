import { useEffect, useState } from "react"
import { Command } from "cmdk"
import { Eye, EyeOff, Search } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
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
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="z-[400] gap-0 overflow-hidden p-0" overlayClassName="z-[399] bg-black/20">
    <DialogTitle className="sr-only">命令菜单</DialogTitle><DialogDescription className="sr-only">搜索并执行界面命令</DialogDescription>
    <Command label="命令菜单" className="bg-white text-stone-700">
      <div className="flex items-center gap-2 border-b px-4"><Search className="size-4 text-stone-400" /><Command.Input autoFocus placeholder="输入命令…" className="h-12 w-full border-0 bg-transparent text-sm outline-none" /></div>
      <Command.List className="max-h-72 overflow-auto p-2"><Command.Empty className="p-5 text-center text-xs text-stone-400">没有匹配的命令</Command.Empty>
        <Command.Group heading="界面" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-stone-400">
          <Command.Item value="显示控制按钮" disabled={visible} onSelect={() => choose(true)} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-emerald-50 data-[disabled=true]:opacity-40"><Eye className="size-4" />显示控制按钮</Command.Item>
          <Command.Item value="关闭控制按钮" disabled={!visible} onSelect={() => choose(false)} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-emerald-50 data-[disabled=true]:opacity-40"><EyeOff className="size-4" />关闭控制按钮</Command.Item>
        </Command.Group>
      </Command.List>
    </Command>
  </DialogContent></Dialog>
}
