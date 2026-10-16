import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { HistorySheet } from "@/pages/browser/components/history-sheet"
import type { HistoryEntry } from "@vessel/type"
import type { WebviewTag } from "electron"
import { History, MoreHorizontal, Printer, Search, Smartphone, ZoomIn, ZoomOut } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

/** Renders the browser more component. */
export function BrowserMore({ zoom, zoomFactor, onFind, onNavigate, guest, deviceMode, onDevice }: { zoomFactor: number; zoom: (delta: number) => void; onFind: () => void; onNavigate: (url: string) => void; guest: () => WebviewTag | undefined; deviceMode: boolean; onDevice: () => void }) {
  const [open, setOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [error, setError] = useState("")

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
    "browser-more-item gap-2.5 rounded-md px-2.5 py-2 text-xs font-normal text-stone-600 focus:!bg-[#327f73] focus:!text-white data-[highlighted]:!bg-[#327f73] data-[highlighted]:!text-white [&>svg]:size-4 [&>svg]:text-stone-400 data-[highlighted]:[&>svg]:!text-white focus:[&>svg]:!text-white"
  return (
    <>
      <DropdownMenu
        open={open}
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
          align="end"
          sideOffset={8}
          className="z-[250] w-60 rounded-xl border-stone-200 bg-white p-1.5 shadow-lg"
        >
          <div className="flex items-center justify-between gap-3 px-2.5 py-2">
            <span className="text-xs text-stone-500">页面缩放</span>
            <div className="flex items-center rounded-md border border-stone-200 bg-stone-50 p-0.5">
              <button
                aria-label="缩小"
                title="缩小"
                disabled={zoomFactor <= 0.25}
                onClick={() => zoom(-0.1)}
                className="flex size-6 items-center justify-center rounded text-stone-500 hover:bg-[#327f73] hover:text-white disabled:opacity-30"
              >
                <ZoomOut size={15} />
              </button>
              <span className="w-11 text-center text-[11px] tabular-nums text-stone-600">{Math.round(zoomFactor * 100)}%</span>
              <button
                aria-label="放大"
                title="放大"
                disabled={zoomFactor >= 3}
                onClick={() => zoom(0.1)}
                className="flex size-6 items-center justify-center rounded text-stone-500 hover:bg-[#327f73] hover:text-white disabled:opacity-30"
              >
                <ZoomIn size={15} />
              </button>
            </div>
          </div>
          <DropdownMenuSeparator className="mx-1 my-1 bg-stone-100" />
          <DropdownMenuItem
            className={itemClass}
            onSelect={() => run(onFind)}
          >
            <Search />
            查找<DropdownMenuShortcut className="text-[10px]">⌘/Ctrl F</DropdownMenuShortcut>
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
          <DropdownMenuItem
            className={itemClass}
            onSelect={() => run(onDevice)}
          >
            <Smartphone />
            {deviceMode ? "隐藏" : "显示"}设备工具栏
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <HistorySheet
        open={historyOpen}
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
