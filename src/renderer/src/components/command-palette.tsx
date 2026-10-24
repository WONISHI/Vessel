import { WorkspaceFilePicker } from "@/components/workspace-file-picker"
import type { FilePickerWorkspace, FilePickerRequest } from "@/components/workspace-file-picker/types"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command"
import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import { openInAppBrowser, toURL } from "@/lib/app-browser"
import { applyAppearance } from "@/pages/settings/appearance"
import { useRouter } from "@vessel/react-router"
import { commandShortcutIds, matchesShortcut, shortcutLabel } from "@vessel/utils"
import { ExternalLink, Eye, EyeOff, Globe, RotateCw, FileSearch, FolderOpen, Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

/** Renders the command palette component. */
export function CommandPalette() {
  const router = useRouter()
  const dark = useDarkAppearance()
  const [finderOpen, setFinderOpen] = useState(false)
  const [finderWorkspace, setFinderWorkspace] = useState<FilePickerWorkspace | null>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [visible, setVisible] = useState(() => localStorage.getItem("vessel-control-visible") !== "false")
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

  /** Toggles light / dark appearance. */
  const toggleTheme = () => {
    setOpen(false)
    void window.electronAPI
      ?.getSettings()
      .then(async (settings) => {
        const nextTheme = document.documentElement.classList.contains("dark") ? "light" : "dark"
        const saved = await window.electronAPI.saveSettings({ ...settings, theme: nextTheme })
        applyAppearance(saved)
        window.dispatchEvent(new Event("vessel:settings-saved"))
      })
      .catch((error) => toast.error(String(error)))
  }
  const findWorkspaceFiles = () => {
    setFinderWorkspace(null)
    const provide: FilePickerRequest = Object.assign((value: FilePickerWorkspace) => {
      if ((value.scope ?? "workspace") === "workspace") setFinderWorkspace(value)
    }, { scope: "workspace" as const })
    window.dispatchEvent(new CustomEvent("vessel:request-workspace-files", { detail: provide }))
    setOpen(false)
    setFinderOpen(true)
  }
  const selectWorkspace = () => {
    setOpen(false)
    void router.push({ name: "welcome" })
  }
  const visitLink = () => {
    setFinderOpen(false)
    setSearch("https://")
    setOpen(true)
  }
  const reloadApp = () => {
    setOpen(false)
    window.location.reload()
  }
  useEffect(() => {
    const execute = (command = "command") => {
      switch (command) {
        case "command": setOpen((value) => !value); break
        case "selectWorkspace": selectWorkspace(); break
        case "findWorkspaceFiles": findWorkspaceFiles(); break
        case "visitLink": visitLink(); break
        case "reloadApp": reloadApp(); break
        case "toggleTheme": toggleTheme(); break
        case "showControls": choose(true); break
        case "hideControls": choose(false); break
      }
    }
    const key = (event: KeyboardEvent) => {
      const command = commandShortcutIds.find((id) => matchesShortcut(event, id))
      if (!command) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (!event.repeat) execute(command)
    }
    window.addEventListener("keydown", key, true)
    const off = window.electronAPI.onCommandPalette?.(execute)
    return () => {
      window.removeEventListener("keydown", key, true)
      off?.()
    }
  })
  const mac = /Mac|iPhone|iPad/.test(navigator.platform)
  const keyHint = (id: typeof commandShortcutIds[number]) => <CommandShortcut>{shortcutLabel(id, mac)}</CommandShortcut>
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
              value="选择工作区 切换工作区 欢迎页 workspace welcome"
              onSelect={selectWorkspace}
            >
              <FolderOpen />
              选择工作区
              {keyHint("selectWorkspace")}
            </CommandItem>
            <CommandItem
              value="查找工作区文件 搜索文件 find file"
              onSelect={findWorkspaceFiles}
            >
              <FileSearch />
              查找工作区文件
              {keyHint("findWorkspaceFiles")}
            </CommandItem>
            {!url && (
              <CommandItem
                value="访问链接 打开网址 url"
                onSelect={visitLink}
              >
                <Globe />
                访问链接…
                {keyHint("visitLink")}
              </CommandItem>
            )}
            <CommandItem
              value="刷新页面 reload"
              onSelect={reloadApp}
            >
              <RotateCw />
              刷新页面
              {keyHint("reloadApp")}
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="界面">
            <CommandItem
              value="切换主题 切换深色主题 切换浅色主题 theme dark light toggle"
              onSelect={toggleTheme}
            >
              {dark ? <Sun /> : <Moon />}
              切换主题
              {keyHint("toggleTheme")}
            </CommandItem>
            <CommandItem
              value="显示控制按钮"
              disabled={visible}
              onSelect={() => choose(true)}
            >
              <Eye />
              显示控制按钮
              {keyHint("showControls")}
            </CommandItem>
            <CommandItem
              value="关闭控制按钮"
              disabled={!visible}
              onSelect={() => choose(false)}
            >
              <EyeOff />
              关闭控制按钮
              {keyHint("hideControls")}
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
