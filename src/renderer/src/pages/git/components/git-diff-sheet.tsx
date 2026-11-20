import { useRef, useState, type ReactNode } from "react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { useDialogLayout } from "@/features/layout/use-dialog-layout"

/** A non-modal bottom sheet keeps file selection available while inspecting changes. */
export function GitDiffSheet({ children, onDockRight }: { children: ReactNode; onDockRight: () => void }) {
  const layout = useDialogLayout(true)
  const [height, setHeight] = useState(() => Math.min(420, window.innerHeight * 0.5))
  const drag = useRef<{ id: number; y: number; height: number } | null>(null)
  const clamp = (value: number) => Math.max(160, Math.min(window.innerHeight - 72, value))
  return <Sheet open modal={false} onOpenChange={(open) => { if (!open) onDockRight() }}>
    <SheetContent side="bottom" showOverlay={false} showCloseButton={false} aria-label="文件差异面板" className="vessel-git-page flex min-h-0 flex-col gap-0 overflow-hidden rounded-t-xl border-t bg-white p-0 shadow-xl dark:bg-[#22272e]" style={{ ...layout.sheetStyle, left: layout.overlayStyle.left, height, maxHeight: "calc(100dvh - 72px)" }} onInteractOutside={(event) => event.preventDefault()} onCloseAutoFocus={(event) => event.preventDefault()}>
      <SheetTitle className="sr-only">文件差异</SheetTitle><SheetDescription className="sr-only">拖动顶部边缘调整高度，或切换回右侧差异栏。</SheetDescription>
      <div role="separator" aria-label="调整差异面板高度" aria-orientation="horizontal" aria-valuemin={160} aria-valuemax={Math.max(160, window.innerHeight - 72)} aria-valuenow={Math.round(height)} tabIndex={0} className="flex h-3 shrink-0 cursor-row-resize touch-none select-none items-center justify-center hover:bg-green-50 focus-visible:outline-green-600 dark:hover:bg-white/10"
        onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); drag.current = { id:event.pointerId, y:event.clientY, height }; event.currentTarget.setPointerCapture(event.pointerId) }}
        onPointerMove={(event) => { const start = drag.current; if (start?.id === event.pointerId) setHeight(clamp(start.height + start.y - event.clientY)) }}
        onPointerUp={(event) => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
        onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}
        onKeyDown={(event) => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); setHeight((value) => clamp(value + (event.key === "ArrowUp" ? 20 : -20))) } }}>
        <span className="h-1 w-10 rounded-full bg-stone-300 dark:bg-stone-600" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </SheetContent>
  </Sheet>
}
