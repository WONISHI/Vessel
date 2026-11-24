import "./resizable-split-motion.css"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable-panels"
import type { PanelImperativeHandle } from "react-resizable-panels"
import { useRef, useState, type ReactNode } from "react"

/** A shared Resizable layout for docked tools and sidebars. */
export function ResizableSplit({ children, pane, side = "right", size, min, max, label, onResize, paneOpen }: { children: ReactNode; pane?: ReactNode; paneOpen?: boolean; side?: "left" | "right" | "bottom" | "detached"; size: number; min: number; max: number; label: string; onResize: (size: number) => void }) {
  const [initialSize] = useState(size)
  const dockRef = useRef<PanelImperativeHandle | null>(null)
  const motion = paneOpen !== undefined && Boolean(pane) && side !== "detached"
  const detached = side === "detached"
  const content = (
    <ResizablePanel
      key="content"
      id="content"
      minSize="15%"
      className="flex min-h-0 min-w-0 flex-col"
    >
      {children}
    </ResizablePanel>
  )
  const tool = pane && !detached ? (
    <ResizablePanel
      key="dock"
      id="dock"
      panelRef={dockRef}
      defaultSize={`${initialSize}px`}
      minSize={`${min}px`}
      maxSize={`${max}px`}
      onResize={(value, _id, previous) => {
        if (previous && !motion) onResize(Math.round(value.inPixels))
      }}
    >
      {motion ? <div className="resizable-split-pane-content" aria-hidden={!paneOpen} inert={!paneOpen} style={{ width: size, height: "100%" }}>{pane}</div> : pane}
    </ResizablePanel>
  ) : null
  const handle = pane && !detached ? (
    <ResizableHandle
      key="handle"
      aria-label={label}
      disabled={motion && !paneOpen}
    />
  ) : null
  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-1 flex-col">
      {/* Keep the content in the same panel so changing docks preserves webviews. */}
      <ResizablePanelGroup
        orientation={side === "bottom" ? "vertical" : "horizontal"}
        className={motion ? "resizable-split-motion min-h-0 w-full flex-1" : "min-h-0 w-full flex-1"}
        data-pane-open={motion ? String(paneOpen) : undefined}
        data-pane-side={motion ? side : undefined}
        onLayoutChanged={(_layout, meta) => {
          if (motion && paneOpen && meta.isUserInteraction) {
            const pixels = dockRef.current?.getSize().inPixels
            if (pixels) onResize(Math.round(pixels))
          }
        }}
      >
        {side === "left" ? [tool, handle, content] : [content, handle, tool]}
      </ResizablePanelGroup>
      {detached && pane}
    </div>
  )
}
