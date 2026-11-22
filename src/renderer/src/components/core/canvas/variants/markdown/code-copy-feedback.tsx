import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { createRoot } from "react-dom/client"

const active = new Map<HTMLButtonElement, () => void>()

/** Render feedback outside Vditor so tooltip text never enters Markdown serialization. */
export function showCodeCopyFeedback(button: HTMLButtonElement) {
  active.get(button)?.()
  if (!button.isConnected) return
  const layer = document.createElement("div")
  document.body.append(layer)
  const root = createRoot(layer)
  const bounds = button.getBoundingClientRect()
  button.dataset.copied = "true"
  button.removeAttribute("data-title")
  button.setAttribute("aria-label", "已复制代码")
  let disposed = false
  const observer = new MutationObserver(() => { if (!button.isConnected) dispose() })
  const dispose = () => {
    if (disposed) return
    disposed = true
    clearTimeout(timer)
    observer.disconnect()
    document.removeEventListener("scroll", dispose, true)
    window.removeEventListener("resize", dispose)
    active.delete(button)
    delete button.dataset.copied
    button.dataset.title = "复制代码"
    button.setAttribute("aria-label", "复制代码")
    // Editor cleanup can run inside another React root's commit.
    queueMicrotask(() => root.unmount())
    layer.remove()
  }
  active.set(button, dispose)
  observer.observe(document.body, { childList: true, subtree: true })
  document.addEventListener("scroll", dispose, true)
  window.addEventListener("resize", dispose)
  root.render(
    <TooltipProvider delayDuration={0}>
      <Tooltip open>
        <TooltipTrigger asChild>
          <span aria-hidden="true" style={{ position: "fixed", left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height, pointerEvents: "none" }} />
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} onPointerDownOutside={event => event.preventDefault()}>已复制</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
  const timer = setTimeout(dispose, 1000)
}

export function clearCodeCopyFeedback(editor: HTMLElement) {
  for (const [button, dispose] of active) if (editor.contains(button) || !button.isConnected) dispose()
}
