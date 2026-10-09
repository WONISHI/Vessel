import {useState,type ReactNode } from 'react'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './resizable-panels'

/** A shared Resizable layout for docked tools and sidebars. */
export function ResizableSplit({ children, pane, side = 'right', size, min, max, label, onResize }: {
  children: ReactNode; pane?: ReactNode; side?: 'left' | 'right' | 'bottom' | 'detached'; size: number; min: number; max: number; label: string; onResize: (size: number) => void
}) {
  const [initialSize] = useState(size)
  if (side === 'detached') return <div className="flex h-full w-full min-h-0 flex-col"><div className="min-h-0 flex-1">{children}</div>{pane}</div>
  const content = <ResizablePanel key="content" id="content" minSize="15%" className="flex min-h-0 min-w-0 flex-col">{children}</ResizablePanel>
  const tool = pane ? <ResizablePanel
  id="dock"
  defaultSize={`${initialSize}px`}
  minSize={`${min}px`}
  maxSize={`${max}px`}
  onResize={(value, _id, previous) => {
    if (previous) onResize(Math.round(value.inPixels))
  }}
>
  {pane}
</ResizablePanel> : null
  const handle = pane ? <ResizableHandle key="handle" aria-label={label} /> : null
  return <ResizablePanelGroup orientation={side === 'bottom' ? 'vertical' : 'horizontal'} className="h-full w-full">{side === 'left' ? [tool, handle, content] : [content, handle, tool]}</ResizablePanelGroup>
}
