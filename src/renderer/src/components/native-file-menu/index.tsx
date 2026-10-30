import type { FileMenuCommand, FileMenuState } from "@vessel/type"
import type { FilePickerWorkspace } from "@/components/workspace-file-picker/types"
import { codeEditors } from "@/components/core/canvas/variants/code/search-bridge"
import { markdownDocuments } from "./document-bridge"
import { useRouter } from "@vessel/react-router"
import { useLocation } from "react-router-dom"
import { useEffect } from "react"
import { toast } from "sonner"

type RecentEntry = FileMenuState["recent"][number]
const recentKey = "native-file-menu-recent"
const filename = (path: string) => path.split(/[\\/]/).pop() || path

function workspace(): FilePickerWorkspace | null {
  const route = window.location.hash.slice(1).split("?")[0]
  if (!/^\/(editor|resources)(\/|$)/.test(route)) return null
  const scope = route.startsWith("/resources") ? "resources" : "workspace"
  let result: FilePickerWorkspace | null = null
  window.dispatchEvent(new CustomEvent("vessel:request-workspace-files", { detail: (value: FilePickerWorkspace) => { if ((value.scope ?? "workspace") === scope) result = value } }))
  return result
}

/** Connect the native menu to the visible workspace and its live document draft. */
export function NativeFileMenu() {
  const router = useRouter()
  const location = useLocation()
  useEffect(() => {
    if (!window.electronAPI.onFileMenuCommand) return
    let disposed = false
    let busy = false
    let recentFiles: RecentEntry[] = []
    let recentWorkspaces: RecentEntry[] = []
    const current = () => {
      const context = workspace()
      const path = /\/(editor|resources)\/file$/.test(location.pathname) ? context?.activePath || "" : ""
      const markdown = markdownDocuments.get(path)
      const code = codeEditors.get(path)
      return { context, path, markdown, code }
    }
    const update = () => {
      if (disposed) return
      const { context, path, markdown, code } = current()
      window.electronAPI.updateFileMenu({ canCreate: Boolean(context), hasDocument: Boolean(path), canSave: Boolean(path && (markdown || code)), canExport: Boolean(markdown), recent: [...recentFiles, ...recentWorkspaces].slice(0, 12) })
    }
    const remember = async (entry: RecentEntry) => {
      recentFiles = [entry, ...recentFiles.filter((item) => item.path !== entry.path)].slice(0, 8)
      await window.electronAPI.setAppState(recentKey, recentFiles)
      update()
    }
    const openFile = async (path: string) => {
      const entry = await window.electronAPI.getExternalPathInfo(path)
      const context = workspace()
      if (entry.kind !== "file") throw new Error("请选择文件")
      const normalized = entry.path.replace(/\\/g, "/")
      const root = context?.root.replace(/\\/g, "/").replace(/\/$/, "")
      if (context && root && normalized.startsWith(root + "/")) context.openFile({ path: entry.path, name: entry.name })
      else if (/\.(pdf|docx?|docs|xlsx?|pptx?|odt|ods|odp|csv)$/i.test(entry.name)) {
        const pending = JSON.parse(sessionStorage.getItem("office-pending-paths") || "[]") as string[]
        sessionStorage.setItem("office-pending-paths", JSON.stringify([...pending, entry.path]))
        window.dispatchEvent(new Event("vessel:office-open"))
        await router.push("/office")
      } else await router.push(`/editor/file?external=${encodeURIComponent(entry.path)}`)
      await remember({ path: entry.path, name: entry.name, kind: "file" })
    }
    const openWorkspace = async (path?: string) => {
      const entry = path ? await window.electronAPI.getExternalPathInfo(path) : null
      const next = path ? { name: entry!.name, path, files: [] } : await window.electronAPI.openDirectory()
      if (!next) return
      if (path && entry?.kind !== "directory") throw new Error("工作区目录不存在")
      localStorage.setItem("app_current_workspace", JSON.stringify(next))
      window.dispatchEvent(new Event("vessel:workspace-changed"))
      await window.electronAPI.setAppState("workspace-last", next)
      await router.push("/editor")
      await remember({ path: next.path, name: next.name, kind: "workspace" })
    }
    const execute = async (command: FileMenuCommand | "recent", recentPath?: string, kind?: "file" | "workspace") => {
      const { context, path, markdown, code } = current()
      if (command === "workspace") return openWorkspace()
      if (command === "recent" && recentPath) return kind === "workspace" ? openWorkspace(recentPath) : openFile(recentPath)
      if (command === "open") {
        const selected = await window.electronAPI.fileMenuDialog({ action: "open" })
        if (selected) await openFile(selected)
        return
      }
      if (command === "new" && context) {
        const separator = context.root.includes("\\") ? "\\" : "/"
        const selected = await window.electronAPI.fileMenuDialog({ action: "save", defaultPath: `${context.root}${separator}未命名.md`, content: "", markdown: true })
        if (selected) await openFile(selected)
        return
      }
      if (!path || !context) return
      if (command === "close-tab") { context.closeFile?.(path); return }
      const content = markdown?.content() ?? code?.getValue()
      if (content === undefined) return
      if (command === "save") { await window.electronAPI.saveContent(path, content); toast.success("已保存"); return }
      if (command === "export-pdf" && markdown) {
        const selected = await window.electronAPI.fileMenuDialog({ action: "pdf", defaultPath: path.replace(/\.[^.\\/]+$/, ".pdf"), html: await markdown.html() })
        if (selected) toast.success("PDF 已导出")
        return
      }
      if (command === "save-as" || (command === "export-markdown" && markdown)) {
        const selected = await window.electronAPI.fileMenuDialog({ action: "save", defaultPath: command === "export-markdown" ? path.replace(/\.[^.\\/]+$/, "-导出.md") : path, content, markdown: Boolean(markdown) })
        if (selected) {
          if (command === "save-as") await openFile(selected)
          toast.success(command === "save-as" ? "已另存为" : "Markdown 已导出")
        }
      }
    }
    const off = window.electronAPI.onFileMenuCommand((...args) => {
      if (busy) return
      busy = true
      void execute(...args).catch((error) => toast.error(String(error))).finally(() => { busy = false; update() })
    })
    void Promise.all([window.electronAPI.getAppState<RecentEntry[]>(recentKey), window.electronAPI.getRecentWorkspaces(4)]).then(([files, entries]) => {
      if (disposed) return
      recentFiles = Array.isArray(files) ? files.slice(0, 8) : []
      recentWorkspaces = entries.map((entry) => ({ path: entry.path, name: entry.name, kind: "workspace" }))
      const { path } = current()
      if (path) {
        recentFiles = [{ path, name: filename(path), kind: "file" as const }, ...recentFiles.filter((entry) => entry.path !== path)].slice(0, 8)
        void window.electronAPI.setAppState(recentKey, recentFiles).catch(() => {})
      }
      update()
    }).catch(() => update())
    window.addEventListener("vessel:file-menu-refresh", update)
    window.addEventListener("focus", update)
    update()
    return () => { disposed = true; off(); window.removeEventListener("vessel:file-menu-refresh", update); window.removeEventListener("focus", update) }
  }, [location.pathname, location.key, router])
  return null
}
