import { Portal as HoverCardPortal } from "@radix-ui/react-hover-card"
import { useRef, useState, type ReactNode } from "react"
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card"
import { VditorEditor } from "./vditor-editor"
import { WikiLinkPreview } from "./wiki-link-preview"

export function PreviewBody({ source, workspacePath, documentPath }: { source: string; workspacePath: string; documentPath: string }) {
  const host = useRef<HTMLDivElement>(null)
  return <div ref={host} className="vessel-hover-preview h-80 min-h-0 text-xs">
    <VditorEditor value={source} workspacePath={workspacePath} documentPath={documentPath} readOnly onChange={() => {}} />
    <WikiLinkPreview host={host} workspacePath={workspacePath} />
  </div>
}
export function SectionPreview({ children, source, workspacePath, documentPath, onOpenChange, enabled = true }: { enabled?: boolean; children: ReactNode; source: string; workspacePath: string; documentPath: string; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false)
  return <HoverCard openDelay={1500} closeDelay={300} open={enabled && open} onOpenChange={(value) => { setOpen(enabled && value); onOpenChange?.(enabled && value) }}>
    <HoverCardTrigger asChild>{children}</HoverCardTrigger>
    <HoverCardPortal><HoverCardContent side="left" className="z-[80] w-[min(480px,80vw)]">{open && <PreviewBody source={source} workspacePath={workspacePath} documentPath={documentPath} />}</HoverCardContent></HoverCardPortal>
  </HoverCard>
}
