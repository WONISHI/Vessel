import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ChevronRight, ChevronUp, ExternalLink, Link2, Search } from "lucide-react"
import { useMemo, useState } from "react"
import type { BrowserPageModel } from "@/pages/browser/components/browser-page/hooks/use-browser-page"

function isOpenableUrl(value: string | undefined | null): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

/** 底部状态栏左侧信息 */
export function BrowserStatusLeft({ b }: { b: BrowserPageModel }) {
  const { toolbarCollapsed, setToolbarCollapsed, setFindOpen, findInput, setFindPosition, tab } = b
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const openable = useMemo(() => isOpenableUrl(tab.url), [tab.url])

  return (
            <>
              <button
                aria-label={toolbarCollapsed ? "展开浏览器工具栏" : "折叠浏览器工具栏"}
                aria-expanded={!toolbarCollapsed}
                onClick={() => setToolbarCollapsed((value) => !value)}
                className="shrink-0 rounded p-1 !bg-transparent text-stone-500 hover:!bg-stone-200 hover:text-stone-800"
              >
                {toolbarCollapsed ? <ChevronUp size={13} /> : <ChevronRight size={13} />}
              </button>
              <button
                className="flex shrink-0 items-center gap-1 rounded px-2 py-1 hover:bg-stone-200"
                onClick={() => {
                  setFindPosition(null)
                  setFindOpen(true)
                  requestAnimationFrame(() => findInput.current?.focus())
                }}
              >
                <Search size={13} />
                搜索
              </button>
              <span className="mx-1 h-4 border-l border-stone-300" />
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="在默认浏览器中打开"
                      disabled={!openable}
                      onClick={() => {
                        if (!openable) return
                        setError(undefined)
                        setConfirmOpen(true)
                      }}
                      className="shrink-0 rounded p-1 text-stone-500 hover:bg-stone-200 hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-stone-500"
                    >
                      <ExternalLink size={13} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={6}
                    className="font-['Plus_Jakarta_Sans',sans-serif] text-xs"
                  >
                    {openable ? "在默认浏览器中打开" : "当前没有可打开的链接"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex min-w-0 max-w-[360px] cursor-default items-center gap-1.5 px-1 font-['Plus_Jakarta_Sans',sans-serif] text-[11.5px] text-stone-500">
                      <Link2
                        size={13}
                        className="shrink-0"
                      />
                      <span className="truncate">{tab.loading ? "正在加载…" : tab.url || "就绪"}</span>
                    </span>
                  </TooltipTrigger>
                  {tab.url ? (
                    <TooltipContent
                      side="top"
                      sideOffset={6}
                      className="max-w-[480px] break-all font-['Plus_Jakarta_Sans',sans-serif] text-xs"
                    >
                      {tab.url}
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              </TooltipProvider>
              <ConfirmDialog
                open={confirmOpen}
                onOpenChange={(open) => {
                  if (!busy) {
                    setConfirmOpen(open)
                    if (!open) setError(undefined)
                  }
                }}
                title="在默认浏览器中打开"
                description={
                  openable ? (
                    <>
                      确定使用系统默认浏览器打开以下链接吗？
                      <br />
                      <strong>{tab.url}</strong>
                    </>
                  ) : null
                }
                confirmText={busy ? "打开中…" : "打开"}
                busy={busy}
                error={error}
                tone="primary"
                onConfirm={() => {
                  if (!openable || busy) return
                  setBusy(true)
                  setError(undefined)
                  void window.electronAPI
                    .openExternal(tab.url)
                    .then(() => {
                      setConfirmOpen(false)
                    })
                    .catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : String(err))
                    })
                    .finally(() => {
                      setBusy(false)
                    })
                }}
              />
            </>
  )
}
