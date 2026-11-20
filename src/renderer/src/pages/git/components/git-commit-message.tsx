import { useId, useLayoutEffect, useRef, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

/** Keep the commit's paragraphs intact, with separate compact subject/body previews. */
export function GitCommitMessage({ message }: { message: string }) {
  const normalized = message.replace(/\r\n?/g, "\n")
  const firstBreak = normalized.indexOf("\n")
  const subject = firstBreak < 0 ? normalized : normalized.slice(0, firstBreak)
  const body = firstBreak < 0 ? "" : normalized.slice(firstBreak + 1).replace(/^\n+/, "")
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const hostRef = useRef<HTMLDivElement>(null)
  const subjectRef = useRef<HTMLParagraphElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const contentId = useId()
  useLayoutEffect(() => {
    if (expanded) return
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const nodes = [subjectRef.current, bodyRef.current]
        setOverflowing(nodes.some((node) => node && node.scrollHeight > node.clientHeight + 1))
      })
    }
    const observer = new ResizeObserver(measure)
    if (hostRef.current) observer.observe(hostRef.current)
    measure()
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [message, expanded])
  const collapsible = expanded || overflowing || body.includes("\n")
  return <section className="mb-2 min-w-0">
    <div id={contentId} ref={hostRef} className="min-w-0 space-y-1.5">
      <p ref={subjectRef} aria-label="提交标题" className={`whitespace-pre-wrap break-words font-semibold leading-5 text-stone-800 [overflow-wrap:anywhere] ${expanded ? "" : "line-clamp-2"}`}>{subject}</p>
      {body && <div ref={bodyRef} aria-label="提交说明" className={`whitespace-pre-wrap break-words leading-5 text-stone-600 [overflow-wrap:anywhere] ${expanded ? "" : "line-clamp-1"}`}>{body}</div>}
    </div>
    {collapsible && <button type="button" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded((value) => !value)} className="mt-1 inline-flex items-center gap-0.5 text-[11px] text-green-700 hover:underline">
      {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}{expanded ? "收起说明" : "展开说明"}
    </button>}
  </section>
}
