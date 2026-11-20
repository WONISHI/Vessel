import { useState } from "react"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { isOpenableUrl } from "@/pages/browser/openable-url"

/** Shares the default-browser confirmation between the status bar and page menu. */
export function BrowserExternalDialog({ url, open, onOpenChange }: { url: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const openable = isOpenableUrl(url)
  return (
    <ConfirmDialog
      activityBarAccessible
      open={open}
      onOpenChange={(open) => {
        if (!busy) {
          onOpenChange(open)
          if (!open) setError(undefined)
        }
      }}
      title="在默认浏览器中打开"
      description={
        openable ? (
          <>
            确定使用系统默认浏览器打开以下链接吗？
            <ScrollArea className="mt-1.5 max-h-24 min-w-0 rounded-md border border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-800 [&_[data-radix-scroll-area-viewport]]:max-h-24 [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:min-w-0">
              <span className="block px-2 py-1.5 font-mono text-[11px] font-normal leading-normal text-stone-600 select-text [overflow-wrap:anywhere] [word-break:normal] dark:text-stone-300">{url}</span>
            </ScrollArea>
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
          .openExternal(url)
          .then(() => {
            onOpenChange(false)
          })
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : String(err))
          })
          .finally(() => {
            setBusy(false)
          })
      }}
    />
  )
}
