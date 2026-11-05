import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { toast } from "@/components/ui/sonner"
import { Switch } from "@/components/ui/switch"
import { Icon } from "@/pages/browser/components/extensions/components/icon"
import type { BrowserExtension } from "@vessel/type"
import { Box, ExternalLink, Folder, Pin, Puzzle, Shield, Trash2, TriangleAlert, Upload } from "lucide-react"
import { useEffect, useRef, useState } from "react"

/** Renders the browser extensions component. */
const POPUP_SIZE_KEY = "browser-extension-popup-sizes"
const popupSizes = new Map<string, { width?: number; height?: number }>()

/** Reads the last locked popup size for an extension (memory first, then localStorage). */
function readPopupSize(key: string) {
  if (popupSizes.has(key)) return popupSizes.get(key)
  try {
    const saved = JSON.parse(localStorage.getItem(POPUP_SIZE_KEY) || "{}")[key]
    if (saved && typeof saved.width === "number") {
      popupSizes.set(key, saved)
      return saved as { width?: number; height?: number }
    }
  } catch {}
  return undefined
}

/** Remembers a locked popup size so reopening shows instantly at the right size. */
function writePopupSize(key: string, size: { width?: number; height?: number }) {
  popupSizes.set(key, size)
  try {
    const all = JSON.parse(localStorage.getItem(POPUP_SIZE_KEY) || "{}")
    all[key] = size
    localStorage.setItem(POPUP_SIZE_KEY, JSON.stringify(all))
  } catch {}
}

export function BrowserExtensions({ visible = true, onOpenDevtools, getActivePageData, onOpenStore }: { onOpenStore?: (url: string) => void; visible?: boolean; onOpenDevtools?: () => void; getActivePageData?: () => Promise<any> }) {
  const [popup, setPopup] = useState<BrowserExtension | null>(null)
  const popupArea = useRef<HTMLDivElement>(null)
  const scrollViewport = useRef<HTMLDivElement>(null)
  const [scrollHeight, setScrollHeight] = useState(0)
  // Preferred popup size reported by the extension document (Chrome clamps action popups to 25..800 x 25..600).
  const [preferred, setPreferred] = useState<{ width?: number; height?: number }>({})
  // Width locks after two equal readings; height only grows. Both prevent resize feedback loops.
  const sizing = useRef<{ lastWidth?: number; locked: boolean }>({ locked: false })
  // The dialog and native view stay hidden until the final size is known, so the popup appears in one step.
  const [sized, setSized] = useState(false)
  const sizedRef = useRef(false)
  const [items, setItems] = useState<BrowserExtension[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [menu, setMenu] = useState<BrowserExtension | null>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [permissions, setPermissions] = useState<BrowserExtension | null>(null)

  const visibility = useRef(visible)
  visibility.current = visible
  useEffect(() => {
    if (!visible) {
      setOpen(false)
      setPopup(null)
      setMenu(null)
      setPermissions(null)
      void window.electronAPI.closeBrowserExtension()
    }
  }, [visible])

  useEffect(() => window.electronAPI.onWebStoreInstall((status) => {
    const pending = ["preparing", "confirming", "installing"].includes(status.phase)
    const options = { id: "browser-web-store-install" }
    setBusy(pending)
    if (pending) toast.loading(status.message, options)
    else if (status.phase === "complete") toast.success(status.message, options)
    else if (status.phase === "error") toast.error(status.message, options)
    else toast.info(status.message, options)
    if (visibility.current) setOpen(true)
    if (status.phase === "complete" || status.phase === "error") {
      void window.electronAPI.listBrowserExtensions().then(setItems).catch(reason => setError(String(reason)))
    }
  }), [])

  /** Runs run. */
  const run = async (operation: () => Promise<BrowserExtension[]>) => {
    setBusy(true)
    setError("")
    try {
      setItems(await operation())
    } catch (reason) {
      setError(String(reason))
      if (visibility.current) setOpen(true)
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    let active = true
    void window.electronAPI.listBrowserExtensions().then(
      (items) => {
        if (active) setItems(items)
      },
      (reason) => {
        if (active) setError(String(reason))
      }
    )
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    const stop = window.electronAPI.onBrowserExtensionClosed(() => setPopup(null))
    return () => {
      stop()
      void window.electronAPI.closeBrowserExtension()
    }
  }, [])
  useEffect(() => {
    const cached = popup ? readPopupSize(popup.key) : undefined
    setPreferred(cached ?? {})
    sizing.current = { locked: !!cached }
    sizedRef.current = !!cached
    setSized(!!cached)
    if (!popup) return

    /** Positions the native view over the popup area once the final size is known. */
    const resize = () => {
      if (!sizedRef.current) return
      const rect = popupArea.current?.getBoundingClientRect()
      if (rect) void window.electronAPI.resizeBrowserExtension({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
    }
    /** Reveals the dialog at its final size (measured, cached, or the 440x360 fallback). */
    const reveal = () => {
      if (sizedRef.current) return
      sizedRef.current = true
      setSized(true)
    }
    const observer = new ResizeObserver(resize)
    let viewport: HTMLDivElement | null = null
    const frame = requestAnimationFrame(() => {
      if (popupArea.current) observer.observe(popupArea.current)
      viewport = scrollViewport.current
      viewport?.addEventListener("scroll", onScroll)
      resize()
    })
    const fallback = window.setTimeout(reveal, 600)
    let alive = true
    let syncing = false
    let timer = 0

    /** Updates scroll and, until locked, the measured size. */
    const updateScroll = async () => {
      if (syncing) return
      syncing = true
      try {
        const metrics = await window.electronAPI.extensionScroll()
        if (!alive) return
        setScrollHeight(metrics.height)
        const lock = sizing.current
        const height = metrics.naturalHeight ? Math.min(metrics.naturalHeight, 600) : undefined
        if (!lock.locked && metrics.width && metrics.width >= 25) {
          if (lock.lastWidth !== undefined && Math.abs(lock.lastWidth - metrics.width) <= 1) {
            lock.locked = true
            const size = { width: metrics.width, height }
            setPreferred(size)
            writePopupSize(popup.key, size)
            reveal()
          }
          lock.lastWidth = metrics.width
        } else if (lock.locked && height) {
          setPreferred((current) => {
            if (current.height && height <= current.height + 4) return current
            const next = { ...current, height }
            writePopupSize(popup.key, next)
            return next
          })
        }
        if (scrollViewport.current && Math.abs(scrollViewport.current.scrollTop - metrics.top) > 1) scrollViewport.current.scrollTop = metrics.top
      } finally {
        syncing = false
      }
    }
    /** Polls quickly until the width locks, then at the normal scroll-sync rate. */
    const tick = () => {
      void updateScroll()
        .catch(() => {})
        .finally(() => {
          if (alive) timer = window.setTimeout(tick, sizing.current.locked ? 150 : 50)
        })
    }
    tick()

    /** Handles scroll events. */
    const onScroll = () => {
      if (viewport) void window.electronAPI.extensionScroll(viewport.scrollTop).catch(() => {})
    }
    window.addEventListener("resize", resize)
    return () => {
      alive = false
      window.clearTimeout(timer)
      window.clearTimeout(fallback)
      viewport?.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", resize)
    }
  }, [popup])
  // Once revealed, place the native view at the final bounds (the observer may not fire if the area size is unchanged).
  useEffect(() => {
    if (!sized || !popup) return
    const frame = requestAnimationFrame(() => {
      const rect = popupArea.current?.getBoundingClientRect()
      if (rect) void window.electronAPI.resizeBrowserExtension({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
    })
    return () => cancelAnimationFrame(frame)
  }, [sized, popup])

  /** Performs the launch operation. */
  const launch = async (item: BrowserExtension, mode: "open" | "options" | "inspect" = "open") => {
    setError("")
    try {
      let pageData: Record<string, unknown> | undefined
      if (getActivePageData && (item.key.includes("clipper") || item.name.includes("剪藏"))) {
        pageData = await getActivePageData() || undefined
      }
      if (!visibility.current) return
      const result = await window.electronAPI.openBrowserExtension(item.key, mode, pageData)
      if (!visibility.current) {
        void window.electronAPI.closeBrowserExtension()
        return
      }
      if (result.kind === "dialog") {
        setOpen(false)
        setPopup(item)
      }
      if (result.kind === "devtools") {
        onOpenDevtools?.()
        setOpen(false)
      }
      if (result.message) {
        setError(result.message)
        if (visibility.current) setOpen(true)
      }
    } catch (reason) {
      setError(String(reason))
      if (visibility.current) setOpen(true)
    }
  }

  /** Performs the context operation. */
  const context = (event: React.MouseEvent, item: BrowserExtension) => {
    event.preventDefault()
    setPosition({ x: event.clientX, y: event.clientY })
    setMenu(item)
  }
  // Scrollbar column depends on height only, with a few px of hysteresis.
  const scrollable = scrollHeight > (preferred.height ? Math.min(preferred.height, 600) : (popupArea.current?.clientHeight ?? Infinity)) + 4
  return (
    <>
      <Dialog
        open={visible && !!popup}
        onOpenChange={(value) => {
          if (!value) {
            setPopup(null)
            void window.electronAPI.closeBrowserExtension()
          }
        }}
      >
        <DialogContent
          overlayClassName="bg-transparent"
          className="gap-0 overflow-hidden rounded-2xl border-stone-200 p-0 !animate-none shadow-[0_8px_30px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] sm:max-w-[440px] [&>button]:right-[18px] [&>button]:top-[14px] [&>button]:flex [&>button]:size-7 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-md [&>button]:text-stone-400 [&>button:hover]:bg-stone-100 [&>button:focus]:ring-0 [&>button:focus]:ring-offset-0 [&>button:focus]:outline-none [&>button:focus-visible]:bg-stone-100 dark:border-border dark:bg-background dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)] dark:[&>button]:text-muted-foreground dark:[&>button:hover]:bg-muted dark:[&>button:hover]:text-foreground dark:[&>button:focus-visible]:bg-muted"
          aria-describedby={undefined}
          style={{ ...(preferred.width ? { width: Math.min(Math.max(preferred.width, 25), 800) + (scrollable ? 14 : 0), maxWidth: "calc(100vw - 32px)" } : {}), visibility: sized ? "visible" : "hidden", transition: "none" }}
        >
          <DialogTitle className="flex h-14 items-center gap-2 border-b border-[#f0efed] px-[18px] text-[15px] font-bold text-stone-900 dark:border-border dark:text-foreground">
            <span className="flex size-[22px] items-center justify-center rounded-md bg-green-50 dark:bg-green-500/15">
              <Shield className="size-[13px] text-green-600 dark:text-green-400" />
            </span>
            {popup?.name}
          </DialogTitle>
          <div className="relative max-h-[70vh] w-full dark:bg-background" style={{ height: preferred.height ? Math.min(Math.max(preferred.height, 25), 600) : 360 }}>
            <ScrollArea
              type="auto"
              viewportRef={scrollViewport}
              className="h-full w-full"
            >
              <div style={{ height: scrollHeight }} />
            </ScrollArea>
            <div
              ref={popupArea}
              className={`pointer-events-none absolute left-0 top-0 bottom-0 ${scrollable ? "right-3.5" : "right-0"}`}
            />
          </div>
        </DialogContent>
      </Dialog>
      {items
        .filter((item) => item.pinned && item.enabled)
        .map((item) => (
          <Button
            key={item.key}
            className="browser-extension-button"
            variant="ghost"
            size="icon"
            data-title={item.name}
            aria-label={`打开 ${item.name}`}
            onClick={() => void launch(item)}
            onContextMenu={(event) => context(event, item)}
          >
            <Icon item={item} />
          </Button>
        ))}
      <Button
        variant="ghost"
        size="icon"
        aria-label="管理浏览器扩展"
        data-title="管理浏览器扩展"
        onClick={() => {
          setOpen(!open)
          void run(() => window.electronAPI.listBrowserExtensions())
        }}
      >
        <Puzzle />
      </Button>
      <Sheet
        modal={false}
        open={visible && open}
        onOpenChange={setOpen}
      >
        <SheetContent
          showOverlay={false}
          className="z-[200] flex w-[380px] max-w-[100vw] flex-col gap-0 p-0 text-xs text-foreground sm:max-w-[380px]"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <SheetHeader className="border-b px-5 py-4 text-left">
            <SheetTitle className="text-base flex items-center gap-2 dark:text-white">
              <Box className="size-5 text-green-600" />
              浏览器扩展
            </SheetTitle>
            <SheetDescription className="pr-4 text-xs leading-5 dark:text-[#9BA1A9]">支持 CRX、ZIP（含 CRX 的压缩包）和包含 manifest.json 的解压目录。支持部分 Chrome 扩展和 DevTools 扩展，在内置浏览器打开 Chrome 应用商店，点击“添加至 Vessel”可安装商店扩展。</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-auto p-5">
            <div className="mb-4 grid grid-cols-2 gap-2">
              <Button
                className="h-9 px-2 text-xs bg-green-600 text-white hover:bg-green-700"
                disabled={busy}
                onClick={() => void run(() => window.electronAPI.installBrowserExtension("archive"))}
              >
                <Upload />
                安装 CRX / ZIP
              </Button>
              <Button
                className="h-9 px-2 text-xs dark:text-[#9BA1A9] hover:bg-stone-100 hover:text-foreground dark:hover:bg-stone-800"
                variant="outline"
                disabled={busy}
                onClick={() => void run(() => window.electronAPI.installBrowserExtension("directory"))}
              >
                <Folder />
                加载解压目录
              </Button>
              {onOpenStore && (
                <Button variant="outline" className="col-span-2 h-9 text-xs hover:bg-stone-100 hover:text-foreground dark:hover:bg-stone-800" onClick={() => {
                  setOpen(false)
                  onOpenStore("https://chromewebstore.google.com/category/extensions?utm_source=ext_sidebar&hl=zh-CN")
                }}>
                  <ExternalLink />
                  打开 Chrome 应用商店
                </Button>
              )}
            </div>
            {error && (
              <p
                role="status"
                className="mb-4 text-sm text-amber-700"
              >
                {error}
              </p>
            )}
            <div className="mb-3 flex justify-between text-xs text-muted-foreground dark:text-[#9BA1A9]">
              <span>已安装扩展</span>
              <span className="rounded-full bg-muted px-2">{items.length}</span>
            </div>
            {!items.length && <p className="py-8 text-center text-sm text-muted-foreground dark:text-[#9BA1A9]">{busy ? "正在读取扩展…" : "尚未安装扩展"}</p>}
            <div className="space-y-3">
              {items.map((item) => {
                const displayPath = item.path.replace(/\/packages\/clipper\/dist$/, "/packages/@vessel/clipper/dist")
                const displayError = item.error?.includes("/packages/clipper/dist") ? undefined : item.error
                return (
                <div
                  key={item.key}
                  onContextMenu={(event) => context(event, item)}
                  className={`rounded-xl border bg-muted/20 p-3 ${item.enabled ? "" : "opacity-60"}`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      disabled={!item.enabled || busy}
                      aria-label={`打开 ${item.name}`}
                      onClick={() => void launch(item)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-green-600 ${item.key.includes("clipper") || item.name.includes("剪藏") ? "overflow-hidden" : "border bg-background"}`}>
                        <Icon item={item} className={item.key.includes("clipper") || item.name.includes("剪藏") ? "size-full object-contain" : undefined} />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <strong className="truncate text-xs text-stone-900 dark:text-white">{item.name}</strong>
                          <span className="rounded border bg-background px-1 text-[10px] text-muted-foreground dark:text-[#9BA1A9]">{item.version}</span>
                        </span>
                        <span
                          className="block truncate text-xs text-muted-foreground dark:text-[#9BA1A9]"
                          data-title={displayPath}
                        >
                          {displayPath}
                        </span>
                      </span>
                    </button>
                    <Switch
                      aria-label={`启用 ${item.name}`}
                      checked={item.enabled}
                      disabled={busy}
                      onCheckedChange={(enabled) => void run(() => window.electronAPI.setBrowserExtensionEnabled(item.key, enabled))}
                    />
                    <button
                      disabled={busy}
                      aria-label={`移除 ${item.name}`}
                      className="text-muted-foreground hover:text-red-600 dark:text-[#9BA1A9]"
                      onClick={() => void run(() => window.electronAPI.removeBrowserExtension(item.key))}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <button
                    disabled={busy}
                    className="mt-2 flex items-center gap-1 text-xs text-muted-foreground dark:text-[#9BA1A9]"
                    onClick={() => void run(() => window.electronAPI.pinBrowserExtension(item.key, !item.pinned))}
                  >
                    <Pin size={12} />
                    {item.pinned ? "取消固定" : "固定到工具栏"}
                  </button>
                  {displayError && <p className="mt-2 break-all text-xs text-red-600">加载失败：{displayError}</p>}
                </div>
              )})}
            </div>
            {permissions && (
              <section className="mt-4 rounded-lg border p-3 text-sm">
                <div className="flex justify-between">
                  <strong>{permissions.name} 声明的权限</strong>
                  <button onClick={() => setPermissions(null)}>关闭</button>
                </div>
                <ul className="mt-2 break-all text-xs text-muted-foreground">
                  {permissions.permissions?.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">此处展示扩展声明，不代表 Electron 支持全部权限；暂不支持按网站修改授权。</p>
              </section>
            )}
          </div>
          <footer className="flex gap-2 border-t bg-muted/20 px-5 py-3 text-[11px] leading-5 text-muted-foreground">
            <TriangleAlert className="mt-1 size-4 shrink-0 text-amber-600" />
            安装或启停后请刷新网页；DevTools 扩展需重新打开网页控制台。下次启动会自动恢复已启用的扩展。
          </footer>
        </SheetContent>
      </Sheet>
      <DropdownMenu
        modal={false}
        open={visible && !!menu}
        onOpenChange={(value) => {
          if (!value) setMenu(null)
        }}
      >
        <DropdownMenuTrigger
          className="pointer-events-none fixed !size-0 overflow-hidden !bg-transparent p-0 opacity-0"
          style={{ left: position.x, top: position.y, width: 0, height: 0 }}
          aria-label="扩展菜单"
        />
        <DropdownMenuContent
          align="start"
          className="z-[260] w-64"
        >
          <DropdownMenuLabel>{menu?.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setPermissions(menu)
              if (visibility.current) setOpen(true)
            }}
          >
            可读取和更改的网站数据
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => menu && void run(() => window.electronAPI.removeBrowserExtension(menu.key))}>从 Vessel 中移除</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => menu && void run(() => window.electronAPI.pinBrowserExtension(menu.key, !menu.pinned))}>{menu?.pinned ? "取消固定" : "固定到工具栏"}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setOpen(true)}>管理扩展程序</DropdownMenuItem>
          <DropdownMenuItem
            disabled={!menu?.optionsPage}
            onSelect={() => menu && void launch(menu, "options")}
          >
            扩展选项
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setPermissions(menu)
              if (visibility.current) setOpen(true)
            }}
          >
            查看网站权限
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!menu?.enabled || !menu.popup}
            onSelect={() => menu && void launch(menu, "inspect")}
          >
            审查弹出内容
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
