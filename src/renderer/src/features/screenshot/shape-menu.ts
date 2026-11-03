import { Circle, Diamond, LineSegment, Square, Triangle } from "@phosphor-icons/react/ssr"
import { createElement, type ComponentType } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { ShapeStroke } from "./shape-draw"
import { clearScreenshotDrawingActives } from "./mode-menu"

export type ScreenshotShape = "square" | "round" | "triangle" | "line" | "diamond"

const SECONDARY_SHAPES = "shapes"
const SHAPE_STORAGE_KEY = "vessel.screenshot.shape"
const STROKE_STORAGE_KEY = "vessel.screenshot.shapeStroke"
const CUSTOM_SHAPES = new Set<ScreenshotShape>(["triangle", "line", "diamond"])

/** Match js-web-screen-shot color-item indices 1..10. */
export const SHAPE_STROKE_COLORS = [
  "#F53440",
  "#F65E95",
  "#D254CF",
  "#12A9D7",
  "#30A345",
  "#FACF50",
  "#F66632",
  "#989998",
  "#000000",
  "#FEFFFF"
] as const

/** Pixel widths for the shape secondary thickness dropdown. */
export const SHAPE_STROKE_WIDTHS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16] as const

type ShapeIcon = ComponentType<{ size?: number | string; color?: string; weight?: "regular" | "bold"; "aria-hidden"?: boolean }>

export const SCREENSHOT_SHAPES: { id: ScreenshotShape; label: string; Icon: ShapeIcon }[] = [
  { id: "square", label: "矩形", Icon: Square },
  { id: "round", label: "椭圆", Icon: Circle },
  { id: "triangle", label: "三角形", Icon: Triangle },
  { id: "line", label: "直线", Icon: LineSegment },
  { id: "diamond", label: "菱形", Icon: Diamond }
]

export type ShapeStrokeController = {
  current: () => ShapeStroke
  set: (next: Partial<ShapeStroke>) => void
}

/** Read the last selected annotation shape so the merged control restores it. */
export function readScreenshotShape(): ScreenshotShape {
  try {
    const value = localStorage.getItem(SHAPE_STORAGE_KEY)
    if (SCREENSHOT_SHAPES.some((shape) => shape.id === value)) return value as ScreenshotShape
  } catch {}
  return "square"
}

/** Persist the shape choice across screenshot sessions. */
export function writeScreenshotShape(shape: ScreenshotShape) {
  try {
    localStorage.setItem(SHAPE_STORAGE_KEY, shape)
  } catch {}
}

export function readScreenshotShapeStroke(): ShapeStroke {
  try {
    const raw = localStorage.getItem(STROKE_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ShapeStroke>
      const color = typeof parsed.color === "string" && SHAPE_STROKE_COLORS.some((item) => item.toLowerCase() === parsed.color!.toLowerCase())
        ? SHAPE_STROKE_COLORS.find((item) => item.toLowerCase() === parsed.color!.toLowerCase()) || "#F53440"
        : "#F53440"
      const width = typeof parsed.width === "number" && SHAPE_STROKE_WIDTHS.includes(parsed.width as (typeof SHAPE_STROKE_WIDTHS)[number])
        ? parsed.width
        : 4
      return { color, width }
    }
  } catch {}
  return { color: "#F53440", width: 4 }
}

export function writeScreenshotShapeStroke(stroke: ShapeStroke) {
  try {
    localStorage.setItem(STROKE_STORAGE_KEY, JSON.stringify(stroke))
  } catch {}
}

export function isCustomScreenshotShape(shape: ScreenshotShape) {
  return CUSTOM_SHAPES.has(shape)
}

function claimSecondarySlot() {
  document.body.dataset.shotSecondary = SECONDARY_SHAPES
  window.dispatchEvent(new CustomEvent("vessel:screenshot-secondary", { detail: SECONDARY_SHAPES }))
}

function releaseSecondarySlot() {
  if (document.body.dataset.shotSecondary === SECONDARY_SHAPES) delete document.body.dataset.shotSecondary
}

/** Phosphor icon as a CSS toolbar background, matching installToolbarIcons. */
export function screenshotShapeIcon(shape: ScreenshotShape, color = "#171717") {
  const entry = SCREENSHOT_SHAPES.find((item) => item.id === shape) || SCREENSHOT_SHAPES[0]
  const svg = renderToStaticMarkup(createElement(entry.Icon, { size: 20, color, weight: "regular", "aria-hidden": true }))
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
}

/** Click the library or hidden custom tool that owns this shape. */
export function activateScreenshotShape(toolbar: HTMLElement, shape: ScreenshotShape) {
  writeScreenshotShape(shape)
  if (isCustomScreenshotShape(shape)) {
    document.body.dataset.shotShape = shape
    const custom = toolbar.querySelector<HTMLElement>(`.item-panel[data-title="${shape}"]`)
    custom?.click()
    return
  }
  delete document.body.dataset.shotShape
  const builtIn = toolbar.querySelector<HTMLElement>(`.item-panel.${shape}, .item-panel:has(.${shape})`)
  builtIn?.click()
}

/** Merge square + ellipse into one control with a glass secondary popup for more shapes + stroke options. */
export function installShapeMenu(
  toolbar: HTMLElement,
  trigger: HTMLElement,
  onSelect: (shape: ScreenshotShape) => void,
  initialShape: ScreenshotShape = readScreenshotShape(),
  stroke?: ShapeStrokeController
) {
  let selected = SCREENSHOT_SHAPES.some((shape) => shape.id === initialShape) ? initialShape : "square"
  let strokeState: ShapeStroke = stroke?.current() || readScreenshotShapeStroke()
  let activating = false
  trigger.classList.add("shot-shapes")
  trigger.setAttribute("aria-expanded", "false")
  trigger.setAttribute("aria-haspopup", "menu")
  trigger.setAttribute("aria-label", "形状")
  trigger.dataset.title = "形状"
  const menu = document.createElement("div")
  menu.className = "shot-shape-menu"
  menu.hidden = true
  menu.setAttribute("role", "menu")
  document.body.append(menu)

  const options = document.createElement("div")
  options.className = "shot-shape-options"
  const width = document.createElement("details")
  width.className = "shot-shape-width"
  const widthSummary = document.createElement("summary")
  widthSummary.className = "shot-shape-width-trigger"
  widthSummary.setAttribute("aria-label", "边框粗细")
  const widthList = document.createElement("div")
  widthList.className = "shot-shape-width-menu"
  widthList.setAttribute("role", "listbox")
  widthList.setAttribute("aria-label", "边框粗细")
  width.append(widthSummary, widthList)

  const colors = document.createElement("div")
  colors.className = "shot-shape-colors"
  colors.setAttribute("role", "group")
  colors.setAttribute("aria-label", "边框颜色")
  const activeColor = document.createElement("span")
  activeColor.className = "shot-shape-color-active"
  activeColor.setAttribute("aria-hidden", "true")

  const shapes = document.createElement("div")
  shapes.className = "shot-shape-list"
  shapes.setAttribute("role", "group")
  shapes.setAttribute("aria-label", "形状")

  const divider = document.createElement("span")
  divider.className = "shot-shape-divider"
  divider.setAttribute("aria-hidden", "true")

  options.append(width, colors, activeColor)
  menu.append(options, divider, shapes)

  const paintTrigger = (shape: ScreenshotShape) => {
    const dark = matchMedia("(prefers-color-scheme: dark)").matches
    trigger.style.backgroundImage = screenshotShapeIcon(shape, dark ? "#f1f5f9" : "#171717")
    trigger.style.backgroundSize = "20px 20px"
    trigger.style.backgroundPosition = "center"
    trigger.style.backgroundRepeat = "no-repeat"
    trigger.setAttribute("aria-label", SCREENSHOT_SHAPES.find((item) => item.id === shape)?.label || "形状")
  }

  const paintStroke = () => {
    widthSummary.textContent = `${strokeState.width} px`
    activeColor.style.background = strokeState.color
    colors.querySelectorAll<HTMLButtonElement>("button[data-color]").forEach((item) => {
      item.setAttribute("aria-checked", String(item.dataset.color?.toLowerCase() === strokeState.color.toLowerCase()))
    })
    widthList.querySelectorAll<HTMLButtonElement>("button[data-width]").forEach((item) => {
      item.setAttribute("aria-checked", String(Number(item.dataset.width) === strokeState.width))
    })
  }

  const applyStroke = (next: Partial<ShapeStroke>) => {
    strokeState = { ...strokeState, ...next }
    writeScreenshotShapeStroke(strokeState)
    stroke?.set(strokeState)
    paintStroke()
  }

  const close = () => {
    width.open = false
    menu.hidden = true
    trigger.setAttribute("aria-expanded", "false")
    releaseSecondarySlot()
  }

  /** Another toolbar control took focus — close the popup and drop the held active tile. */
  const dismiss = () => {
    close()
    trigger.classList.remove("shot-shapes-active")
    trigger.setAttribute("aria-pressed", "false")
  }

  const choose = (shape: ScreenshotShape) => {
    selected = shape
    shapes.querySelectorAll("button").forEach((item) => item.setAttribute("aria-checked", String(item.dataset.shape === shape)))
    paintTrigger(shape)
    onSelect(shape)
    activating = true
    try {
      activateScreenshotShape(toolbar, shape)
    } finally {
      queueMicrotask(() => {
        activating = false
      })
    }
    // Keep the secondary open so thickness / color stay available while drawing.
    if (menu.hidden) {
      positionMenu()
      trigger.setAttribute("aria-expanded", "true")
    } else {
      claimSecondarySlot()
    }
  }

  for (const value of SHAPE_STROKE_WIDTHS) {
    const button = document.createElement("button")
    button.type = "button"
    button.dataset.width = String(value)
    button.textContent = `${value} px`
    button.setAttribute("role", "option")
    button.setAttribute("aria-checked", String(value === strokeState.width))
    button.onclick = (event) => {
      event.preventDefault()
      event.stopPropagation()
      applyStroke({ width: value })
      width.open = false
      widthSummary.focus()
    }
    widthList.append(button)
  }

  for (const color of SHAPE_STROKE_COLORS) {
    const button = document.createElement("button")
    button.type = "button"
    button.dataset.color = color
    button.title = color
    button.setAttribute("role", "menuitemradio")
    button.setAttribute("aria-label", `边框颜色 ${color}`)
    button.setAttribute("aria-checked", String(color.toLowerCase() === strokeState.color.toLowerCase()))
    button.style.background = color
    button.onclick = (event) => {
      event.preventDefault()
      event.stopPropagation()
      applyStroke({ color })
    }
    colors.append(button)
  }

  for (const shape of SCREENSHOT_SHAPES) {
    const button = document.createElement("button")
    button.type = "button"
    button.dataset.shape = shape.id
    button.title = shape.label
    button.setAttribute("role", "menuitemradio")
    button.setAttribute("aria-checked", String(shape.id === selected))
    button.setAttribute("aria-label", shape.label)
    button.innerHTML = renderToStaticMarkup(createElement(shape.Icon, { size: 16, weight: "regular", "aria-hidden": true }))
    button.onclick = (event) => {
      event.preventDefault()
      event.stopPropagation()
      choose(shape.id)
    }
    shapes.append(button)
  }

  const positionMenu = () => {
    const button = trigger.getBoundingClientRect()
    const bar = toolbar.getBoundingClientRect()
    clearScreenshotDrawingActives(toolbar, trigger)
    trigger.classList.add("shot-shapes-active")
    trigger.setAttribute("aria-pressed", "true")
    menu.hidden = false
    claimSecondarySlot()
    const left = Math.max(8, Math.min(button.left + button.width / 2 - menu.offsetWidth / 2, innerWidth - menu.offsetWidth - 8))
    const above = bar.bottom + menu.offsetHeight + 10 > innerHeight
    menu.dataset.side = above ? "top" : "bottom"
    menu.style.left = `${left}px`
    menu.style.top = `${above ? bar.top - menu.offsetHeight - 10 : bar.bottom + 10}px`
    menu.style.setProperty("--shot-menu-arrow", `${Math.max(18, Math.min(menu.offsetWidth - 18, button.left + button.width / 2 - left))}px`)
  }

  const moved = () => {
    if (!menu.hidden) positionMenu()
  }
  trigger.addEventListener("click", (event) => {
    event.preventDefault()
    event.stopPropagation()
    // Second click only toggles the options panel closed; keep draw mode.
    if (!menu.hidden) return close()
    // Enter draw mode with the current/default shape immediately — matching
    // step-tool behaviour — while still opening the secondary for changes.
    choose(selected)
  })

  /** Opening another tool or the mode menu closes this shapes popup. */
  const toolClick = (event: MouseEvent) => {
    if (menu.hidden || activating) return
    const tool = (event.target as Element | null)?.closest?.("#toolPanel .item-panel, .shot-mode-trigger")
    if (!tool || trigger === tool || trigger.contains(tool as Node)) return
    const item = tool as HTMLElement
    const title = item.dataset.title || ""
    if (
      item.classList.contains("shot-shapes") ||
      item.classList.contains("square") ||
      item.classList.contains("round") ||
      title === "形状" ||
      title === "square" ||
      title === "round" ||
      title === "triangle" ||
      title === "line" ||
      title === "diamond" ||
      item.querySelector(".square, .round")
    ) {
      return
    }
    dismiss()
  }
  const outside = (event: PointerEvent) => {
    if (menu.hidden) return
    if (!menu.contains(event.target as Node) && !trigger.contains(event.target as Node)) close()
  }
  const key = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !menu.hidden) {
      if (width.open) {
        event.preventDefault()
        event.stopImmediatePropagation()
        width.open = false
        widthSummary.focus()
        return
      }
      event.stopImmediatePropagation()
      close()
      trigger.focus()
    }
  }
  const secondary = (event: Event) => {
    if ((event as CustomEvent<string>).detail !== SECONDARY_SHAPES) dismiss()
  }
  const scheme = () => paintTrigger(selected)

  paintTrigger(selected)
  paintStroke()
  // Seed plugin / custom stroke with the restored thickness and color.
  stroke?.set(strokeState)
  window.addEventListener("vessel:screenshot-toolbar-moved", moved)
  window.addEventListener("vessel:screenshot-secondary", secondary)
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", scheme)
  window.addEventListener("pointerdown", outside, true)
  window.addEventListener("keydown", key, true)
  document.addEventListener("click", toolClick, true)

  return {
    shape: () => selected,
    select: choose,
    dispose: () => {
      window.removeEventListener("vessel:screenshot-toolbar-moved", moved)
      window.removeEventListener("vessel:screenshot-secondary", secondary)
      matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", scheme)
      window.removeEventListener("pointerdown", outside, true)
      window.removeEventListener("keydown", key, true)
      document.removeEventListener("click", toolClick, true)
      menu.remove()
      releaseSecondarySlot()
    }
  }
}
