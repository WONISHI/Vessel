import "@/components/core/canvas/variants/code/monaco"
import { registerMonacoTheme } from "@/components/core/canvas/variants/code/theme"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogPortal } from "@/components/ui/dialog"
import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import Editor, { type OnMount } from "@monaco-editor/react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

export default function BrowserSourceDialog({ source, onClose }: { source: { url: string; text: string }; onClose: () => void }) {
  const dark = useDarkAppearance()
  const [formatting, setFormatting] = useState(true)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  const mount: OnMount = (editor) => {
    // The format action is disabled in read-only editors. Keep the surface hidden
    // until formatting finishes, then lock it for source inspection and copying.
    void (async () => {
      try {
        const model = editor.getModel()
        const action = editor.getAction("editor.action.formatDocument")
        // HTML's formatting provider loads asynchronously when the language is first used.
        const deadline = Date.now() + 5000
        while (alive.current && model && !model.isDisposed() && action && !action.isSupported() && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
        if (!alive.current || !model || model.isDisposed()) return
        if (!action?.isSupported()) throw new Error("HTML 格式化服务未就绪")
        await action.run()
        if (alive.current && !model.isDisposed()) editor.setScrollTop(0)
      } catch {
        if (alive.current) toast.error("源码格式化失败，已显示原始内容")
      } finally {
        const model = editor.getModel()
        if (alive.current && model && !model.isDisposed()) {
          editor.updateOptions({ readOnly: true })
          setFormatting(false)
        }
      }
    })()
  }
  return <Dialog open modal={false} onOpenChange={(open) => { if (!open) onClose() }}>
    <DialogPortal>
      <div aria-hidden="true" data-browser-source-overlay className="fixed top-0 right-0 bottom-8 left-[52px] z-50 bg-black/[.04] backdrop-blur-[3px]" />
    </DialogPortal>
    <DialogContent className="left-[calc(50%+26px)] flex h-[75vh] w-[calc(100%-84px)] max-w-4xl flex-col gap-3">
      <DialogHeader className="min-w-0 shrink-0 pr-5">
        <DialogTitle>网页源代码</DialogTitle>
        <DialogDescription title={source.url} className="truncate font-mono text-[10px] leading-4 font-normal">{source.url}</DialogDescription>
      </DialogHeader>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border">
        {formatting && <div role="status" className="absolute inset-0 z-10 grid place-items-center bg-background text-xs text-muted-foreground">正在格式化源码…</div>}
        <Editor language="html" value={source.text} height="100%" theme={dark ? "vessel-dark" : "light"}
          beforeMount={registerMonacoTheme} onMount={mount}
          options={{ automaticLayout: true, minimap: { enabled: false }, scrollBeyondLastLine: false,
            fontSize: 12, tabSize: 2, insertSpaces: true, wordWrap: "on", padding: { top: 12, bottom: 12 } }} />
      </div>
    </DialogContent>
  </Dialog>
}
