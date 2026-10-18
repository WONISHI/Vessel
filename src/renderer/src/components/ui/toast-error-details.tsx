import { ScrollArea } from "@/components/ui/scroll-area"
import { useLayoutEffect, useRef, useState } from "react"

/** Collapses error logs after six rendered lines and scrolls expanded details. */
export function ToastErrorDetails({ text, onExpandedChange }: { text: string; onExpandedChange?: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [overflow, setOverflow] = useState(false)
  const preview = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = preview.current
    if (!element) return
    /** Detects wrapped overflow as the notification width changes. */
    const measure = () => setOverflow(element.scrollHeight > element.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [text, expanded])

  return (
    <div className="toast-error-details">
      {expanded ? (
        <ScrollArea className="toast-error-scroll" aria-label="完整错误信息">
          <div className="toast-error-text">{text}</div>
        </ScrollArea>
      ) : (
        <div ref={preview} className="toast-error-text toast-error-preview">{text}</div>
      )}
      {(overflow || expanded) && (
        <button type="button" className="toast-error-toggle" aria-expanded={expanded} onClick={() => { setExpanded(!expanded); onExpandedChange?.() }}>
          {expanded ? "收起" : "展开完整错误信息"}
        </button>
      )}
    </div>
  )
}
