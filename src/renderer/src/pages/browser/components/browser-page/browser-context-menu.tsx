import { isManagedSourcePage } from "@/pages/browser/managed-source-project"
import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ArrowLeft, ArrowRight, Copy, Code, CodeXml, Download, ExternalLink, FolderOpen, QrCode, RotateCw, Search, SquareDashedMousePointer } from "lucide-react"
import { toast } from "sonner"
import { mobilePageURL } from "@/pages/browser/mobile-page-url"
import { withGuest } from "@/pages/browser/guest-lifecycle"
import { effectiveSiteColor } from "@/pages/browser/favicon-color"
import type { CSSProperties } from "react"
import type { BrowserPageModel } from "./hooks/use-browser-page"

import BrowserMobileDialog from "./browser-mobile-dialog"
import { BrowserExternalDialog } from "./browser-external-dialog"
import { isLocalFileUrl, isOpenableUrl } from "@/pages/browser/openable-url"
const BrowserSourceDialog = lazy(() => import("./browser-source-dialog"))

const itemClassName = "rounded-md text-xs [&_svg]:size-3.5"

type Point = { imageDocument?: boolean; tabId: string; guestId: number; x: number; y: number; left: number; top: number }
export function BrowserContextMenu({ b, visible }: { b: BrowserPageModel; visible: boolean }) {
  // Keep the last anchor after closing; clearing it during exit moves the menu to (0, 0).
  const [point, setPoint] = useState<Point | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobile, setMobile] = useState<{ tabId: string; url: string } | null>(null)
  const [external, setExternal] = useState<{ tabId: string; url: string } | null>(null)
  const pendingDialog = useRef<{ kind: "mobile" | "external"; tabId: string; url: string } | null>(null)
  const pendingFind = useRef(false)
  const shareURL = mobilePageURL(b.tab.url)
  const debugRequest = useRef(0)
  const [debugPage, setDebugPage] = useState<{ tabId: string; url: string } | null>(null)
  const sourceRequest = useRef(0)
  const [source, setSource] = useState<{ url: string; text: string } | null>(null)
  useEffect(() => {
    if (!visible) return
    const show = (event: Event) => {
      const next = (event as CustomEvent<Point>).detail
      if (next.tabId === b.tab.id) {
        setPoint(next); setMenuOpen(true); setDebugPage(null)
        const request = ++debugRequest.current
        void window.electronAPI.sourceProjectStatus?.().then((project) => {
          if (request === debugRequest.current && isManagedSourcePage(b.tab.url, project)) setDebugPage({ tabId: b.tab.id, url: b.tab.url })
        }).catch(() => {})
      }
    }
    window.addEventListener("vessel-browser-context-menu", show)
    return () => {
      pendingDialog.current = null
      pendingFind.current = false
      sourceRequest.current++
      debugRequest.current++
      window.removeEventListener("vessel-browser-context-menu", show)
    }
  }, [visible, b.tab.id, b.tab.url])
  const action = async (name: string) => {
    if (!point) return
    const request = ++sourceRequest.current
    setMenuOpen(false)
    try {
      const text = await window.electronAPI.browserPageAction(point.guestId, name, { x: point.x, y: point.y })
      if (name === "source" && request === sourceRequest.current && text !== undefined) setSource({ url: b.tab.url, text })
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)) }
  }
  const debug = async () => {
    setMenuOpen(false)
    const request = debugRequest.current
    try {
      const project = await window.electronAPI.sourceProjectStatus()
      if (request !== debugRequest.current) return
      const view = b.views.current.get(b.tab.id)
      const url = withGuest(view, (guest) => guest.getURL())
      if (!url || !isManagedSourcePage(url, project)) { toast.info("当前页面不属于 Vessel 正在运行的调试项目"); return }
      const available = await withGuest(view, (guest) => guest.executeJavaScript("(() => { const inspector = window.__VESSEL_SOURCE_INSPECTOR__; if (typeof inspector?.toggle !== 'function') return false; inspector.toggle(); return true })()"))
      if (!available) toast.info("当前页面尚未加载源码定位工具，请刷新页面后重试")
    } catch (error) { toast.error(`无法启动本地项目调试：${String(error)}`) }
  }
  const move = (forward: boolean) => withGuest(b.views.current.get(b.tab.id), (guest) => forward ? guest.goForward() : guest.goBack())
  return <>
    <DropdownMenu modal={false} open={visible && menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild><span data-browser-context-anchor aria-hidden="true" style={{ position: "fixed", left: point?.left ?? 0, top: point?.top ?? 0, width: 1, height: 1, pointerEvents: "none" }} /></DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={0} data-radix-context-menu-content="" data-browser-site-menu="" style={{ "--browser-site-color": effectiveSiteColor(b.tab.faviconColor) } as CSSProperties} className="w-48 z-[510] rounded-lg data-[state=closed]:animate-none" onCloseAutoFocus={(event) => {
        event.preventDefault()
        // Wait for the menu's FocusScope to finish unmounting before opening
        // another non-modal focus scope. The selecting click must not dismiss it.
        const next = pendingDialog.current
        pendingDialog.current = null
        const request = sourceRequest.current
        if (pendingFind.current) {
          pendingFind.current = false
          queueMicrotask(() => {
            if (request !== sourceRequest.current) return
            b.setFindPosition(null)
            b.setFindOpen(true)
            requestAnimationFrame(() => b.findInput.current?.focus())
          })
        }
        if (next) queueMicrotask(() => {
          if (request !== sourceRequest.current) return
          if (next.kind === "mobile") setMobile(next)
          else setExternal(next)
        })
      }}>
        <DropdownMenuItem className={itemClassName} disabled={!b.tab.back} onSelect={() => move(false)}><ArrowLeft />后退</DropdownMenuItem>
        <DropdownMenuItem className={itemClassName} disabled={!b.tab.forward} onSelect={() => move(true)}><ArrowRight />前进</DropdownMenuItem>
        <DropdownMenuItem className={itemClassName} onSelect={() => b.reloadTab(b.tab.id)}><RotateCw />重新加载</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={itemClassName} onSelect={() => { pendingFind.current = true; setMenuOpen(false) }}><Search />搜索</DropdownMenuItem>
        {point?.imageDocument && <>
          <DropdownMenuItem className={itemClassName} onSelect={() => void action("copy-image")}><Copy />复制图片</DropdownMenuItem>
          <DropdownMenuItem className={itemClassName} onSelect={() => void action("download-image")}><Download />下载图片</DropdownMenuItem>
          <DropdownMenuSeparator />
        </>}
        <DropdownMenuItem className={itemClassName} onSelect={() => void action("save")}><Download />存储为…</DropdownMenuItem>
        <DropdownMenuItem className={itemClassName} disabled={!isOpenableUrl(b.tab.url)} onSelect={() => { pendingDialog.current = { kind: "external", tabId: b.tab.id, url: b.tab.url }; setMenuOpen(false) }}><ExternalLink />在默认浏览器中打开</DropdownMenuItem>
        {isLocalFileUrl(b.tab.url) && <DropdownMenuItem className={itemClassName} onSelect={() => void action("reveal")}><FolderOpen />在资源管理器中显示</DropdownMenuItem>}
        {shareURL && <DropdownMenuItem className={itemClassName} onSelect={() => { pendingDialog.current = { kind: "mobile", tabId: b.tab.id, url: shareURL }; setMenuOpen(false) }}><QrCode />手机访问…</DropdownMenuItem>}
        {debugPage?.tabId === b.tab.id && debugPage.url === b.tab.url && <DropdownMenuItem className={itemClassName} data-title="选择页面元素，定位项目源码（Esc 退出）" onSelect={() => void debug()}><CodeXml />本地项目调试</DropdownMenuItem>}
        <DropdownMenuItem className={itemClassName} onSelect={() => void action("source")}><Code />显示网页源代码</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={itemClassName} onSelect={() => { if (point) b.inspectPage({ x: point.x, y: point.y }) }}><SquareDashedMousePointer />检查</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {mobile && visible && mobile.tabId === b.tab.id && mobile.url === shareURL && <BrowserMobileDialog url={mobile.url} onClose={() => setMobile(null)} />}
    {external && visible && external.tabId === b.tab.id && external.url === b.tab.url && <BrowserExternalDialog url={external.url} open onOpenChange={(open) => { if (!open) setExternal(null) }} />}
    {source && visible && <Suspense fallback={null}>
      <BrowserSourceDialog source={source} onClose={() => setSource(null)} />
    </Suspense>}
  </>
}
