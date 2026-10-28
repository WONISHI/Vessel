import { CaretDown as ChevronDown } from "@phosphor-icons/react/ssr"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

export type ScreenshotMode = "copy" | "ocr" | "translate"

/** A separate menu keeps custom modes out of the screenshot library's command dispatch. */
export function installScreenshotModes(heading: HTMLElement, onSelect: (mode: ScreenshotMode) => void) {
  const trigger = document.createElement("button")
  trigger.type = "button"
  trigger.className = "shot-mode-trigger"
  trigger.setAttribute("aria-expanded", "false")
  trigger.setAttribute("aria-label", "选择截图模式")
  const label = document.createElement("span")
  label.textContent = "截图"
  trigger.append(label)
  const chevron = document.createElement("span")
  chevron.className = "shot-mode-chevron"
  chevron.innerHTML = renderToStaticMarkup(createElement(ChevronDown, { size: 14, weight: "regular", "aria-hidden": true }))
  trigger.append(chevron)
  heading.append(trigger)
  const menu = document.createElement("div")
  menu.className = "shot-mode-menu"
  menu.hidden = true
  menu.setAttribute("role", "menu")
  document.body.append(menu)
  const close = () => { menu.hidden = true; trigger.setAttribute("aria-expanded", "false") }
  for (const [mode, title] of [["copy", "截图"], ["ocr", "OCR"], ["translate", "翻译"]] as const) {
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = title
    button.dataset.mode = mode
    button.setAttribute("role", "menuitemradio")
    button.setAttribute("aria-checked", String(mode === "copy"))
    button.onclick = () => {
      label.textContent = title
      menu.querySelectorAll('button').forEach((item) => item.setAttribute("aria-checked", String(item === button)))
      onSelect(mode)
      close()
    }
    menu.append(button)
  }
  const positionMenu = () => {
    const rect = heading.getBoundingClientRect()
    const toolbar = heading.closest("#toolPanel")?.getBoundingClientRect() || rect
    const button = trigger.getBoundingClientRect()
    menu.hidden = false
    const left = Math.max(8, Math.min(button.left + button.width / 2 - menu.offsetWidth / 2, innerWidth - menu.offsetWidth - 8))
    const above = toolbar.bottom + menu.offsetHeight + 10 > innerHeight
    menu.dataset.side = above ? "top" : "bottom"
    menu.style.left = `${left}px`
    menu.style.top = `${above ? toolbar.top - menu.offsetHeight - 10 : toolbar.bottom + 10}px`
    menu.style.setProperty("--shot-menu-arrow", `${Math.max(18, Math.min(menu.offsetWidth - 18, button.left + button.width / 2 - left))}px`)
  }
  const moved = () => { if (!menu.hidden) positionMenu() }
  trigger.onclick = () => {
    if (!menu.hidden) return close()
    positionMenu()
    trigger.setAttribute("aria-expanded", "true")
  }
  window.addEventListener("vessel:screenshot-toolbar-moved", moved)
  const outside = (event: PointerEvent) => { if (!menu.contains(event.target as Node) && !heading.contains(event.target as Node)) close() }
  const key = (event: KeyboardEvent) => { if (event.key === "Escape" && !menu.hidden) { event.stopImmediatePropagation(); close(); trigger.focus() } }
  window.addEventListener("pointerdown", outside, true)
  window.addEventListener("keydown", key, true)
  return () => { window.removeEventListener("vessel:screenshot-toolbar-moved", moved); menu.remove(); window.removeEventListener("pointerdown", outside, true); window.removeEventListener("keydown", key, true) }
}

export function updateScreenshotToolbar(toolbar: HTMLElement, mode: ScreenshotMode) {
  toolbar.dataset.mode = mode
  document.body.dataset.screenshotMode = mode
  const confirm = toolbar.querySelector<HTMLElement>('.confirm')
  if (confirm) {
    const label = mode === "ocr" ? "提取文字" : mode === "translate" ? "翻译选区" : "完成并复制"
    confirm.title = label
    confirm.setAttribute("aria-label", label)
    confirm.dataset.actionLabel = mode === "copy" ? "" : label
  }
}
