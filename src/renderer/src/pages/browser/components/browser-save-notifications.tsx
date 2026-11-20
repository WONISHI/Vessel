import { useEffect } from "react"
import { useRouter } from "@vessel/react-router"
import { toast } from "@/components/ui/sonner"
import { openInAppBrowser } from "@/lib/app-browser"
import { browserFilePreview } from "../../../../../shared/browser-preview"

/** Global listener: saved files can finish while the browser tab or route is in the background. */
export function BrowserSaveNotifications() {
  const router = useRouter()
  useEffect(() => window.electronAPI.onBrowserFileSaved?.((file) => {
    const preview = browserFilePreview(file.name)
    if (!preview) return
    try { if (new URL(file.url).protocol !== "file:") return } catch { return }
    if ((preview.kind === "audio" || preview.kind === "video") && !document.createElement(preview.kind).canPlayType(preview.mime)) return
    toast.success(file.source === "download" ? "文件下载成功" : "文件保存成功", {
      id: `browser-file-saved:${file.url}`,
      className: "vessel-browser-save-toast",
      description: file.name,
      position: "bottom-right",
      duration: 8000,
      action: { label: "预览", onClick: () => openInAppBrowser(file.url, (path) => router.push(path)) },
      cancel: { label: "暂不", onClick: () => undefined }
    })
  }), [router])
  return null
}
