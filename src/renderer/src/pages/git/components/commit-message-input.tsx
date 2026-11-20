import { useLayoutEffect, useRef, useState, type MutableRefObject } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"

/** Keeps typing local so repository lists and diffs do not rerender per keystroke. */
export function CommitMessageInput({ draft, resetVersion, onSubmit }: { draft: MutableRefObject<string>; resetVersion: number; onSubmit: () => void }) {
  const [previousDraft, setPreviousDraft] = useState(draft)
  const [generation, setGeneration] = useState(0)
  if (previousDraft !== draft) { setPreviousDraft(draft); setGeneration(generation + 1) }
  return <CommitMessageEditor key={`${generation}:${resetVersion}`} draft={draft} onSubmit={onSubmit} />
}

function CommitMessageEditor({ draft: draftRef, onSubmit }: { draft: MutableRefObject<string>; onSubmit: () => void }) {
  // The repository draft is an imperative store, snapshotted only when this keyed editor mounts.
  // eslint-disable-next-line react-hooks/refs
  const [value, setValue] = useState(() => draftRef.current)
  const input = useRef<HTMLTextAreaElement>(null)
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const revealCaret = () => {
    const element = input.current
    if (!element || !viewport || document.activeElement !== element) return
    // A full-height textarea has no internal scroll range. Measure the caret's
    // wrapped line so keyboard navigation scrolls the surrounding Radix viewport.
    const style = getComputedStyle(element)
    const mirror = document.createElement("div")
    mirror.style.cssText = "position:fixed;left:-10000px;top:0;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;"
    mirror.style.width = `${element.clientWidth}px`
    mirror.style.font = style.font
    mirror.style.lineHeight = style.lineHeight
    mirror.style.letterSpacing = style.letterSpacing
    mirror.style.padding = style.padding
    mirror.textContent = element.value.slice(0, element.selectionDirection === "backward" ? element.selectionStart : element.selectionEnd)
    const caret = document.createElement("span")
    caret.textContent = "\u200b"
    mirror.append(caret); document.body.append(mirror)
    const top = caret.offsetTop, bottom = top + (parseFloat(style.lineHeight) || 20)
    mirror.remove()
    if (top < viewport.scrollTop) viewport.scrollTo({ top: Math.max(0, top - 8) })
    else if (bottom > viewport.scrollTop + viewport.clientHeight) viewport.scrollTo({ top: bottom - viewport.clientHeight + 8 })
  }
  useLayoutEffect(() => {
    const element = input.current
    if (!element || !viewport) return
    const resize = () => {
      element.style.height = "0px"
      element.style.height = `${Math.max(viewport.clientHeight, element.scrollHeight)}px`
      revealCaret()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [value, viewport])
  return (
    <ScrollArea viewportRef={setViewport} className="min-h-0 flex-1 rounded-[10px] border border-stone-200 bg-white focus-within:border-green-600 focus-within:shadow-[0_0_0_3px_#16a34a1a] dark:border-[#30353c] dark:bg-[#1c2025] [&_[data-radix-scroll-area-viewport]>div]:!block">
      <textarea
        ref={input}
        rows={3}
        aria-label="提交信息"
        value={value}
        onChange={(event) => {
          draftRef.current = event.target.value
          setValue(event.target.value)
        }}
        onSelect={revealCaret}
        placeholder="输入提交信息 (Commit message)…"
        className="block w-full resize-none overflow-hidden border-0 bg-transparent p-2 pr-4 text-xs leading-5 outline-none focus:ring-0"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) {
            event.preventDefault()
            onSubmit()
          }
        }}
      />
    </ScrollArea>
  )
}
