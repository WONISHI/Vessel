import { CaretDown as ChevronDown } from "@phosphor-icons/react/ssr"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

export type ScreenshotMode = "copy" | "ocr" | "translate"

const SECONDARY_MODE = "mode"
const MODE_STORAGE_KEY = "vessel.screenshot.mode"
const MODE_LABELS: Record<ScreenshotMode, string> = { copy: "截图", ocr: "OCR", translate: "翻译" }

/** Read the last selected capture mode so reopening the overlay keeps the choice. */
export function readScreenshotMode(): ScreenshotMode {
  try {
    const value = localStorage.getItem(MODE_STORAGE_KEY)
    if (value === "copy" || value === "ocr" || value === "translate") return value
  } catch {}
  return "copy"
}

/** Persist the capture mode across route changes and overlay reopenings. */
export function writeScreenshotMode(mode: ScreenshotMode) {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode)
  } catch {}
}


/** Drop drawing-tool active tiles and hide the plugin option strip (secondary mutual exclusion). */
export function clearScreenshotDrawingActives(toolbar?: HTMLElement | null, except?: HTMLElement | null) {
  const root = toolbar ?? document.getElementById("toolPanel")
  if (!root) return
  root.querySelectorAll<HTMLElement>(".item-panel, .item-panel *").forEach((el) => {
    if (except && (el === except || except.contains(el))) return
    for (const name of [...el.classList]) {
      if (name.endsWith("-active")) el.classList.remove(name)
    }
  })
  root.querySelectorAll<HTMLElement>(".shot-shapes").forEach((el) => {
    if (el === except) return
    el.classList.remove("shot-shapes-active")
    el.setAttribute("aria-pressed", "false")
  })
  root.querySelectorAll<HTMLElement>(".shot-step").forEach((el) => {
    if (el !== except) el.setAttribute("aria-pressed", "false")
  })
  for (const id of ["optionPanel", "optionIcoController"]) {
    const node = document.getElementById(id)
    if (node) node.style.setProperty("display", "none")
  }
}

/** Hide the plugin option panel while our mode menu is the open secondary popup. */
function claimSecondarySlot() {
  document.body.dataset.shotSecondary = SECONDARY_MODE
  window.dispatchEvent(new CustomEvent("vessel:screenshot-secondary", { detail: SECONDARY_MODE }))
}

function releaseSecondarySlot() {
  if (document.body.dataset.shotSecondary === SECONDARY_MODE) delete document.body.dataset.shotSecondary
}

/** A separate menu keeps custom modes out of the screenshot library's command dispatch. */
export function installScreenshotModes(heading: HTMLElement, onSelect: (mode: ScreenshotMode) => void, initialMode: ScreenshotMode = readScreenshotMode()) {
  const selected = initialMode in MODE_LABELS ? initialMode : "copy"
  const trigger = document.createElement("button")
  trigger.type = "button"
  trigger.className = "shot-mode-trigger"
  trigger.setAttribute("aria-expanded", "false")
  trigger.setAttribute("aria-label", "选择截图模式")
  const label = document.createElement("span")
  label.textContent = MODE_LABELS[selected]
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
  const close = () => {
    menu.hidden = true
    trigger.setAttribute("aria-expanded", "false")
    releaseSecondarySlot()
  }
  for (const mode of ["copy", "ocr", "translate"] as const) {
    const title = MODE_LABELS[mode]
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = title
    button.dataset.mode = mode
    button.setAttribute("role", "menuitemradio")
    button.setAttribute("aria-checked", String(mode === selected))
    button.onclick = () => {
      label.textContent = title
      menu.querySelectorAll("button").forEach((item) => item.setAttribute("aria-checked", String(item === button)))
      writeScreenshotMode(mode)
      onSelect(mode)
      close()
    }
    menu.append(button)
  }
  const positionMenu = () => {
    const rect = heading.getBoundingClientRect()
    const toolbarEl = heading.closest<HTMLElement>("#toolPanel")
    const toolbar = toolbarEl?.getBoundingClientRect() || rect
    const button = trigger.getBoundingClientRect()
    clearScreenshotDrawingActives(toolbarEl)
    menu.hidden = false
    claimSecondarySlot()
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
  /** Opening a drawing-tool option panel closes the mode menu (single secondary popup). */
  const toolClick = (event: MouseEvent) => {
    if (menu.hidden) return
    const tool = (event.target as Element | null)?.closest?.("#toolPanel .item-panel")
    if (!tool || heading.contains(tool)) return
    close()
  }
  const secondary = (event: Event) => { if ((event as CustomEvent<string>).detail !== SECONDARY_MODE) close() }
  window.addEventListener("vessel:screenshot-toolbar-moved", moved)
  window.addEventListener("vessel:screenshot-secondary", secondary)
  const outside = (event: PointerEvent) => { if (!menu.contains(event.target as Node) && !heading.contains(event.target as Node)) close() }
  const key = (event: KeyboardEvent) => { if (event.key === "Escape" && !menu.hidden) { event.stopImmediatePropagation(); close(); trigger.focus() } }
  window.addEventListener("pointerdown", outside, true)
  window.addEventListener("keydown", key, true)
  document.addEventListener("click", toolClick, true)
  return () => {
    window.removeEventListener("vessel:screenshot-toolbar-moved", moved)
    window.removeEventListener("vessel:screenshot-secondary", secondary)
    menu.remove()
    releaseSecondarySlot()
    window.removeEventListener("pointerdown", outside, true)
    window.removeEventListener("keydown", key, true)
    document.removeEventListener("click", toolClick, true)
  }
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
