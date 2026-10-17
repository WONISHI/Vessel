import { WorkspaceFilePicker } from "@/components/workspace-file-picker"
import type { FilePickerWorkspace } from "@/components/workspace-file-picker/types"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { openInAppBrowser, toURL } from "@/lib/app-browser"
import { useRouter } from "@vessel/react-router"
import { matchesShortcut } from "@vessel/utils"
import { ExternalLink, Eye, EyeOff, Globe, RotateCw, FileSearch } from "lucide-react"
import { useEffect, useState } from "react"

/** Renders the command palette component. */
export function CommandPalette() {
  const router = useRouter()
  const [finderOpen, setFinderOpen] = useState(false)
  const [finderWorkspace, setFinderWorkspace] = useState<FilePickerWorkspace | null>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [visible, setVisible] = useState(() => localStorage.getItem("vessel-control-visible") !== "false")
  useEffect(() => {
    /** Shows show. */
    const show = () => setOpen((value) => !value)

    /** Performs the key operation. */
    const key = (event: KeyboardEvent) => {
      if (matchesShortcut(event, "command")) {
        event.preventDefault()
        event.stopPropagation()
        show()
      }
    }
    window.addEventListener("keydown", key, true)
    const off = window.electronAPI.onCommandPalette?.(show)
    return () => {
      window.removeEventListener("keydown", key, true)
      off?.()
    }
  }, [])
  useEffect(() => {
    if (!open) setSearch("")
  }, [open])

  /** Performs the choose operation. */
  const choose = (value: boolean) => {
    localStorage.setItem("vessel-control-visible", String(value))
    setVisible(value)
    window.dispatchEvent(new Event("vessel-control-visibility"))
    setOpen(false)
  }
  const url = toURL(search)
  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
      >
        <CommandInput
          autoFocus
          placeholder="输入命令或链接…"
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>没有匹配的命令</CommandEmpty>
          {url && (
            <CommandGroup
              heading="链接"
              forceMount
            >
              <CommandItem
                forceMount
                value={`访问链接 ${search}`}
                onSelect={() => {
                  setOpen(false)
                  openInAppBrowser(url, (path) => router.push(path))
                }}
              >
                <Globe />
                <span className="min-w-0 flex-1 truncate">
                  在内置浏览器访问 <span className="text-stone-400">{url}</span>
                </span>
              </CommandItem>
              <CommandItem
                forceMount
                value={`默认浏览器打开 ${search}`}
                onSelect={() => {
                  setOpen(false)
                  void window.electronAPI.openExternal(url)
                }}
              >
                <ExternalLink />
                <span className="min-w-0 flex-1 truncate">在默认浏览器打开</span>
              </CommandItem>
            </CommandGroup>
          )}
          <CommandGroup heading="常用">
            <CommandItem
              value="查找工作区文件 搜索文件 find file"
              onSelect={() => {
                setFinderWorkspace(null)
                window.dispatchEvent(new CustomEvent("vessel:request-workspace-files", { detail: setFinderWorkspace }))
                setOpen(false)
                setFinderOpen(true)
              }}
            >
              <FileSearch />
              查找工作区文件
            </CommandItem>
            {!url && (
              <CommandItem
                value="访问链接 打开网址 url"
                onSelect={() => setSearch("https://")}
              >
                <Globe />
                访问链接…
              </CommandItem>
            )}
            <CommandItem
              value="刷新页面 reload"
              onSelect={() => {
                setOpen(false)
                window.location.reload()
              }}
            >
              <RotateCw />
              刷新页面
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="界面">
            <CommandItem
              value="显示控制按钮"
              disabled={visible}
              onSelect={() => choose(true)}
            >
              <Eye />
              显示控制按钮
            </CommandItem>
            <CommandItem
              value="关闭控制按钮"
              disabled={!visible}
              onSelect={() => choose(false)}
            >
              <EyeOff />
              关闭控制按钮
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      {finderOpen && (
        <WorkspaceFilePicker
          workspace={finderWorkspace}
          onClose={() => setFinderOpen(false)}
        />
      )}
    </>
  )
}
