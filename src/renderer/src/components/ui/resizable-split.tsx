import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable-panels"
import { useState, type ReactNode } from "react"

/** A shared Resizable layout for docked tools and sidebars. */
export function ResizableSplit({ children, pane, side = "right", size, min, max, label, onResize }: { children: ReactNode; pane?: ReactNode; side?: "left" | "right" | "bottom" | "detached"; size: number; min: number; max: number; label: string; onResize: (size: number) => void }) {
  const [initialSize] = useState(size)
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
      defaultSize={`${initialSize}px`}
      minSize={`${min}px`}
      maxSize={`${max}px`}
      onResize={(value, _id, previous) => {
        if (previous) onResize(Math.round(value.inPixels))
      }}
    >
      {pane}
    </ResizablePanel>
  ) : null
  const handle = pane && !detached ? (
    <ResizableHandle
      key="handle"
      aria-label={label}
    />
  ) : null
  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-1 flex-col">
      {/* Keep the content in the same panel so changing docks preserves webviews. */}
      <ResizablePanelGroup
        orientation={side === "bottom" ? "vertical" : "horizontal"}
        className="min-h-0 w-full flex-1"
      >
        {side === "left" ? [tool, handle, content] : [content, handle, tool]}
      </ResizablePanelGroup>
      {detached && pane}
    </div>
  )
}
