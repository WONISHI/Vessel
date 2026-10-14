import { matchesShortcut } from "../../../shared/shortcuts"
import { useEffect, useState } from "react"
import { useRouter } from "@vessel/react-router"
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command"
import { Eye, EyeOff, Globe, RotateCw, ExternalLink } from "lucide-react"
import { openInAppBrowser, toURL } from "@/lib/app-browser"
export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [visible, setVisible] = useState(() => localStorage.getItem("vessel-control-visible") !== "false")
  useEffect(() => {
    const show = () => setOpen(value => !value)
    const key = (event: KeyboardEvent) => {
      if (matchesShortcut(event, "command")) { event.preventDefault(); event.stopPropagation(); show() }
    }
    window.addEventListener("keydown", key, true)
    const off = window.electronAPI.onCommandPalette?.(show)
    return () => { window.removeEventListener("keydown", key, true); off?.() }
  }, [])
  useEffect(() => { if (!open) setSearch("") }, [open])
  const choose = (value: boolean) => {
    localStorage.setItem("vessel-control-visible", String(value)); setVisible(value)
    window.dispatchEvent(new Event("vessel-control-visibility")); setOpen(false)
  }
  const url = toURL(search)
  return <CommandDialog open={open} onOpenChange={setOpen}>
    <CommandInput autoFocus placeholder="输入命令或链接…" value={search} onValueChange={setSearch} />
    <CommandList><CommandEmpty>没有匹配的命令</CommandEmpty>
      {url && <CommandGroup heading="链接" forceMount>
        <CommandItem forceMount value={`访问链接 ${search}`} onSelect={() => { setOpen(false); openInAppBrowser(url, path => router.push(path)) }}><Globe /><span className="min-w-0 flex-1 truncate">在内置浏览器访问 <span className="text-stone-400">{url}</span></span></CommandItem>
        <CommandItem forceMount value={`默认浏览器打开 ${search}`} onSelect={() => { setOpen(false); void window.electronAPI.openExternal(url) }}><ExternalLink /><span className="min-w-0 flex-1 truncate">在默认浏览器打开</span></CommandItem>
      </CommandGroup>}
      <CommandGroup heading="常用">
        {!url && <CommandItem value="访问链接 打开网址 url" onSelect={() => setSearch("https://")}><Globe />访问链接…</CommandItem>}
        <CommandItem value="刷新页面 reload" onSelect={() => { setOpen(false); window.location.reload() }}><RotateCw />刷新页面</CommandItem>
      </CommandGroup>
      <CommandGroup heading="界面">
        <CommandItem value="显示控制按钮" disabled={visible} onSelect={() => choose(true)}><Eye />显示控制按钮</CommandItem>
        <CommandItem value="关闭控制按钮" disabled={!visible} onSelect={() => choose(false)}><EyeOff />关闭控制按钮</CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
}
