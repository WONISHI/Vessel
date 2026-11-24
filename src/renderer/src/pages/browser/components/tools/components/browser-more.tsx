import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DownloadsSheet } from "@/pages/browser/components/downloads-sheet"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { HistorySheet } from "@/pages/browser/components/history-sheet"
import type { HistoryEntry } from "@vessel/type"
import type { WebviewTag } from "electron"
import { VenetianMask, UserRound, X, Download, Bookmark, KeyRound, History, MoreHorizontal, Printer, Search, Smartphone, ZoomIn, ZoomOut } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

/** Renders the browser more component. */
export function BrowserMore({ visible = true, zoom, zoomFactor, onFind, onNavigate, guest, deviceMode, onDevice, bookmarksVisible, onToggleBookmarks, incognito = false, hasIncognito = false, onEnterIncognito, onCloseIncognito, onSwitchUserWindow }: { incognito?: boolean; hasIncognito?: boolean; onEnterIncognito?: () => Promise<void>; onCloseIncognito?: () => Promise<void>; onSwitchUserWindow?: () => void; bookmarksVisible: boolean; onToggleBookmarks: () => void; visible?: boolean; zoomFactor: number; zoom: (delta: number) => void; onFind: () => void; onNavigate: (url: string) => void; guest: () => WebviewTag | undefined; deviceMode: boolean; onDevice: () => void }) {
  const [open, setOpen] = useState(false)
  const openingPanel = useRef(false)
  const [confirmCloseIncognito, setConfirmCloseIncognito] = useState(false)
  const [closingIncognito, setClosingIncognito] = useState(false)
  const [closeIncognitoError, setCloseIncognitoError] = useState("")
  const [downloadsOpen, setDownloadsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => { setOpen(false); setHistoryOpen(false); setDownloadsOpen(false); setConfirmCloseIncognito(false) }, 0)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [visible])

  /** Refreshes refresh. */
  const refresh = () =>
    window.electronAPI
      .listBrowserHistory()
      .then(setHistory)
      .catch((error) => setError(String(error)))

  /** Runs run. */
  const run = (action: () => void) => {
    setOpen(false)
    action()
  }
  const itemClass =
    "group browser-more-item gap-2.5 rounded-md px-2.5 py-2 text-xs font-normal text-[#44403c] dark:text-stone-400 focus:!bg-green-600 dark:focus:!bg-[#327f73] focus:!text-white data-[highlighted]:!bg-green-600 dark:data-[highlighted]:!bg-[#327f73] data-[highlighted]:!text-white [&>svg]:size-4 [&>svg]:text-stone-600 dark:[&>svg]:text-stone-400 data-[highlighted]:[&>svg]:!text-white focus:[&>svg]:!text-white"
  return (
    <>
      <DropdownMenu
        open={visible && open}
        onOpenChange={setOpen}
        modal={false}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="浏览器更多"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          onCloseAutoFocus={(event) => {
            if (!openingPanel.current) return
            openingPanel.current = false
            event.preventDefault()
          }}
          align="end"
          sideOffset={8}
          className="vessel-browser-more-popup z-[250] w-60 rounded-xl border-stone-200 bg-white p-1.5 shadow-lg"
        >
          <div className="flex items-center justify-between gap-3 px-2.5 py-2">
            <span className="text-xs text-stone-700 dark:text-stone-400">页面缩放</span>
            <div className="flex items-center rounded-md border border-stone-200 bg-stone-50 p-0.5">
              <button
                aria-label="缩小"
                data-title="缩小"
                disabled={zoomFactor <= 0.25}
                onClick={() => zoom(-0.1)}
                className="flex size-6 items-center justify-center rounded text-stone-700 dark:text-stone-400 hover:bg-green-600 dark:hover:bg-[#327f73] hover:text-white disabled:opacity-30"
              >
                <ZoomOut size={15} />
              </button>
              <span className="w-11 text-center text-[11px] tabular-nums text-stone-700 dark:text-stone-400">{Math.round(zoomFactor * 100)}%</span>
              <button
                aria-label="放大"
                data-title="放大"
                disabled={zoomFactor >= 3}
                onClick={() => zoom(0.1)}
                className="flex size-6 items-center justify-center rounded text-stone-700 dark:text-stone-400 hover:bg-green-600 dark:hover:bg-[#327f73] hover:text-white disabled:opacity-30"
              >
                <ZoomIn size={15} />
              </button>
            </div>
          </div>
          <DropdownMenuSeparator className="mx-1 my-1 bg-stone-100" />
          <DropdownMenuItem className={itemClass} onSelect={() => run(() => {
            if (incognito) onSwitchUserWindow?.()
            else void onEnterIncognito?.().catch(error => toast.error(String(error)))
          })}>
            {incognito ? <UserRound /> : <VenetianMask />}
            {incognito ? "切换用户窗口" : hasIncognito ? "进入无痕窗口" : "打开无痕窗口"}
          </DropdownMenuItem>
          {hasIncognito && <DropdownMenuItem className={itemClass} onSelect={() => {
            openingPanel.current = true
            setCloseIncognitoError("")
            run(() => requestAnimationFrame(() => setConfirmCloseIncognito(true)))
          }}>
            <X />关闭无痕窗口
          </DropdownMenuItem>}

          <DropdownMenuItem
            className={itemClass}
            onSelect={() => run(onFind)}
          >
            <Search />
            查找<DropdownMenuShortcut className="text-[10px] text-stone-500 dark:text-stone-400 opacity-100 group-focus:text-white group-data-[highlighted]:text-white">⌘/Ctrl F</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            className={itemClass}
            onSelect={() =>
              run(() => {
                setHistoryOpen(true)
                setError("")
                void refresh()
              })
            }
          >
            <History />
            历史记录
          </DropdownMenuItem>
          <DropdownMenuItem className={itemClass} onSelect={() => run(() => setDownloadsOpen(true))}>
            <Download />下载历史
          </DropdownMenuItem>
          <DropdownMenuItem className={itemClass} onSelect={() => {
            openingPanel.current = true
            run(() => requestAnimationFrame(() => window.dispatchEvent(new Event("vessel-open-password-vault"))))
          }}>
            <KeyRound />账号和密码
          </DropdownMenuItem>
          <DropdownMenuItem
            className={itemClass}
            onSelect={() =>
              run(() => {
                try {
                  const view = guest()
                  if (view) void window.electronAPI.printBrowserPage(view.getWebContentsId()).catch((e) => toast.error(String(e)))
                } catch (e) {
                  toast.error(String(e))
                }
              })
            }
          >
            <Printer />
            打印
          </DropdownMenuItem>
          <DropdownMenuSeparator className="mx-1 my-1 bg-stone-100" />
          <DropdownMenuItem className={itemClass} onSelect={() => run(onToggleBookmarks)}>
            <Bookmark />
            {bookmarksVisible ? "隐藏" : "显示"}书签栏
          </DropdownMenuItem>
          <DropdownMenuItem
            className={itemClass}
            onSelect={() => run(onDevice)}
          >
            <Smartphone />
            {deviceMode ? "隐藏" : "显示"}设备工具栏
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog activityBarAccessible statusBarAccessible open={visible && confirmCloseIncognito} onOpenChange={setConfirmCloseIncognito}
        title="确认关闭无痕窗口？" description="将关闭所有无痕标签页并清除本次无痕会话数据，未保存的内容将无法恢复。关闭后返回用户窗口。"
        confirmText="确认关闭" busy={closingIncognito} error={closeIncognitoError}
        onConfirm={() => {
          if (closingIncognito) return
          setClosingIncognito(true)
          setCloseIncognitoError("")
          void Promise.resolve().then(() => onCloseIncognito?.()).then(() => setConfirmCloseIncognito(false))
            .catch(error => setCloseIncognitoError(String(error))).finally(() => setClosingIncognito(false))
        }} />
      <DownloadsSheet open={visible && downloadsOpen} onOpenChange={setDownloadsOpen} />
      <HistorySheet
        open={visible && historyOpen}
        onOpenChange={setHistoryOpen}
        entries={history}
        error={error}
        onNavigate={onNavigate}
        onDelete={(id) => {
          void window.electronAPI
            .deleteBrowserHistory(id)
            .then(refresh)
            .catch((e) => setError(String(e)))
        }}
      />
    </>
  )
}
