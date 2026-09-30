import { Portal as HoverCardPortal } from "@radix-ui/react-hover-card"
import { useState, type ReactNode } from "react"
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card"
import { MarkdownDocument } from "./markdown-document"
import { parseMarkdownDocument } from "./parse-markdown"

export function PreviewBody({ source }: { source: string }) {
  return <div className="max-h-80 overflow-auto text-xs"><MarkdownDocument document={parseMarkdownDocument(source)} /></div>
}
export function SectionPreview({ children, source }: { children: ReactNode; source: string }) {
  const [open, setOpen] = useState(false)
  return <HoverCard openDelay={3000} closeDelay={150} open={open} onOpenChange={setOpen}>
    <HoverCardTrigger asChild>{children}</HoverCardTrigger>
    <HoverCardPortal><HoverCardContent side="left" className="w-[min(480px,80vw)]">{open && <PreviewBody source={source} />}</HoverCardContent></HoverCardPortal>
  </HoverCard>
}
