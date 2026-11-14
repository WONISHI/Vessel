import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ArrowLeft, ArrowRight, Code, Download, RotateCw, SquareDashedMousePointer } from "lucide-react"
import { toast } from "sonner"
import { withGuest } from "@/pages/browser/guest-lifecycle"
import type { BrowserPageModel } from "./hooks/use-browser-page"

const BrowserSourceDialog = lazy(() => import("./browser-source-dialog"))

const itemClassName = "rounded-md text-xs [&_svg]:size-3.5"

type Point = { tabId: string; guestId: number; x: number; y: number; left: number; top: number }
export function BrowserContextMenu({ b, visible }: { b: BrowserPageModel; visible: boolean }) {
  // Keep the last anchor after closing; clearing it during exit moves the menu to (0, 0).
  const [point, setPoint] = useState<Point | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const sourceRequest = useRef(0)
  const [source, setSource] = useState<{ url: string; text: string } | null>(null)
  useEffect(() => {
    if (!visible) return
    const show = (event: Event) => {
      const next = (event as CustomEvent<Point>).detail
      if (next.tabId === b.tab.id) { setPoint(next); setMenuOpen(true) }
    }
    window.addEventListener("vessel-browser-context-menu", show)
    return () => {
      sourceRequest.current++
      window.removeEventListener("vessel-browser-context-menu", show)
    }
  }, [visible, b.tab.id])
  const action = async (name: string) => {
    if (!point) return
    const request = ++sourceRequest.current
    setMenuOpen(false)
    try {
      const text = await window.electronAPI.browserPageAction(point.guestId, name, { x: point.x, y: point.y })
      if (name === "source" && request === sourceRequest.current && text !== undefined) setSource({ url: b.tab.url, text })
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)) }
  }
  const move = (forward: boolean) => withGuest(b.views.current.get(b.tab.id), (guest) => forward ? guest.goForward() : guest.goBack())
  return <>
    <DropdownMenu modal={false} open={visible && menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild><span data-browser-context-anchor aria-hidden="true" style={{ position: "fixed", left: point?.left ?? 0, top: point?.top ?? 0, width: 1, height: 1, pointerEvents: "none" }} /></DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={0} data-radix-context-menu-content="" className="w-48 z-[510] rounded-lg data-[state=closed]:animate-none" onCloseAutoFocus={(event) => event.preventDefault()}>
        <DropdownMenuItem className={itemClassName} disabled={!b.tab.back} onSelect={() => move(false)}><ArrowLeft />后退</DropdownMenuItem>
        <DropdownMenuItem className={itemClassName} disabled={!b.tab.forward} onSelect={() => move(true)}><ArrowRight />前进</DropdownMenuItem>
        <DropdownMenuItem className={itemClassName} onSelect={() => b.reloadTab(b.tab.id)}><RotateCw />重新加载</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={itemClassName} onSelect={() => void action("save")}><Download />存储为…</DropdownMenuItem>
        <DropdownMenuItem className={itemClassName} onSelect={() => void action("source")}><Code />显示网页源代码</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={itemClassName} onSelect={() => { if (point) b.inspectPage({ x: point.x, y: point.y }) }}><SquareDashedMousePointer />检查</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {source && visible && <Suspense fallback={null}>
      <BrowserSourceDialog source={source} onClose={() => setSource(null)} />
    </Suspense>}
  </>
}
