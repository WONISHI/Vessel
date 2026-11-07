import { ClipboardPaste, FolderOpen } from "lucide-react"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

/** Adds an image-source picker while retaining the editor selection. */
export function bindImageToolbarMenu(toolbar: HTMLElement, editableHost: HTMLElement, clipboard: () => void, local: () => void) {
  const button = toolbar.querySelector<HTMLElement>('[data-type="insert-image"]')
  if (!button?.parentElement) return () => {}
  const panel = document.createElement("div")
  panel.className = "vditor-panel vessel-image-menu"
  panel.style.display = "none"
  panel.setAttribute("role", "menu")
  let saved: Range | null = null
  const close = () => { panel.style.display = "none"; saved = null; button.setAttribute("aria-expanded", "false") }
  const preserve = (event: Event) => {
    event.preventDefault()
    const selection = window.getSelection()
    if (selection?.rangeCount && editableHost.contains(selection.anchorNode)) saved = selection.getRangeAt(0).cloneRange()
  }
  const toggle = (event: Event) => {
    event.preventDefault()
    event.stopImmediatePropagation()
    if (panel.style.display !== "none") { close(); return }
    toolbar.querySelectorAll<HTMLElement>(".vditor-panel, .vditor-hint").forEach((other) => {
      if (other !== panel) other.style.display = "none"
    })
    panel.style.display = "block"
    button.setAttribute("aria-expanded", "true")
  }
  for (const [label, Icon, action] of [
    ["粘贴剪贴板图片", ClipboardPaste, clipboard],
    ["从本机选择图片", FolderOpen, local]
  ] as const) {
    const item = document.createElement("button")
    item.type = "button"
    item.setAttribute("role", "menuitem")
    item.innerHTML = renderToStaticMarkup(createElement(Icon, { size: 14 })) + `<span>${label}</span>`
    item.onmousedown = (event) => event.preventDefault()
    item.onclick = (event) => {
      event.preventDefault()
      event.stopPropagation()
      const range = saved
      close()
      editableHost.querySelector<HTMLElement>('[contenteditable="true"]')?.focus({ preventScroll: true })
      if (range && editableHost.contains(range.commonAncestorContainer)) {
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      action()
    }
    panel.append(item)
  }
  const outside = (event: Event) => {
    if (event.target instanceof Node && !button.parentElement?.contains(event.target)) close()
  }
  const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close() }
  button.parentElement.append(panel)
  button.setAttribute("aria-haspopup", "menu")
  button.addEventListener("mousedown", preserve)
  button.addEventListener("click", toggle, true)
  document.addEventListener("pointerdown", outside, true)
  document.addEventListener("keydown", escape)
  return () => {
    close()
    panel.remove()
    button.removeEventListener("mousedown", preserve)
    button.removeEventListener("click", toggle, true)
    document.removeEventListener("pointerdown", outside, true)
    document.removeEventListener("keydown", escape)
  }
}
