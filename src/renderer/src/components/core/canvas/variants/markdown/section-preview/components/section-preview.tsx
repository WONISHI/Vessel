import { PreviewBody } from "@/components/core/canvas/variants/markdown/section-preview/components/preview-body"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Portal as HoverCardPortal } from "@radix-ui/react-hover-card"
import { useState, type ReactNode } from "react"

/** Renders the section preview component. */
export function SectionPreview({ children, source, workspacePath, documentPath, onOpenChange, enabled = true }: { enabled?: boolean; children: ReactNode; source: string; workspacePath: string; documentPath: string; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <HoverCard
      openDelay={1500}
      closeDelay={300}
      open={enabled && open}
      onOpenChange={(value) => {
        setOpen(enabled && value)
        onOpenChange?.(enabled && value)
      }}
    >
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardPortal>
        <HoverCardContent
          side="left"
          className="z-30 w-[min(480px,80vw)]"
        >
          {open && (
            <PreviewBody
              source={source}
              workspacePath={workspacePath}
              documentPath={documentPath}
            />
          )}
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  )
}
