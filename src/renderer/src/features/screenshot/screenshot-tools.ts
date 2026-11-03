import { matchesShortcut } from "@vessel/utils"
import { clearScreenshotDrawingActives } from "./mode-menu"
import { SHAPE_STROKE_COLORS } from "./shape-menu"
import type ScreenShot from "js-web-screen-shot"

export type Step = { x: number; y: number; number: number; tipX?: number; tipY?: number; text?: string; color?: string }
export type CutBox = { startX: number; startY: number; width: number; height: number }

const SECONDARY_STEPS = "steps"
const STEP_COLOR_STORAGE_KEY = "vessel.screenshot.stepColor"
export const STEP_COLORS = SHAPE_STROKE_COLORS
export const DEFAULT_STEP_COLOR = STEP_COLORS[0]

/** Read the last step-marker color so reopening the overlay keeps the choice. */
export function readScreenshotStepColor(): string {
  try {
    const value = localStorage.getItem(STEP_COLOR_STORAGE_KEY)
    if (typeof value === "string") {
      const match = STEP_COLORS.find((item) => item.toLowerCase() === value.toLowerCase())
      if (match) return match
    }
  } catch {}
  return DEFAULT_STEP_COLOR
}

/** Persist the step-marker color across screenshot sessions. */
export function writeScreenshotStepColor(color: string) {
  try {
    localStorage.setItem(STEP_COLOR_STORAGE_KEY, color)
  } catch {}
}

function mixHex(hex: string, toward: number, amount: number) {
  const raw = hex.replace("#", "")
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw.padEnd(6, "0").slice(0, 6)
  const channel = (start: number) => Number.parseInt(full.slice(start, start + 2), 16) || 0
  const mix = (value: number) => Math.round(value + (toward - value) * amount)
  return `#${[mix(channel(0)), mix(channel(2)), mix(channel(4))]
    .map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0"))
    .join("")}`
}

function lightenHex(hex: string, amount: number) {
  return mixHex(hex, 255, amount)
}

function darkenHex(hex: string, amount: number) {
  return mixHex(hex, 0, amount)
}

function isLightHex(hex: string) {
  const raw = hex.replace("#", "")
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw.padEnd(6, "0").slice(0, 6)
  const r = Number.parseInt(full.slice(0, 2), 16) || 0
  const g = Number.parseInt(full.slice(2, 4), 16) || 0
  const b = Number.parseInt(full.slice(4, 6), 16) || 0
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 200
}

/** Default pointer length for new markers; tip stays independently draggable. */
function stepPointer(step: Step) {
  const angle = Math.atan2((step.tipY ?? step.y + 34) - step.y, (step.tipX ?? step.x + 23) - step.x)
  const length = step.tipX !== undefined && step.tipY !== undefined
    ? Math.max(28, Math.hypot(step.tipX - step.x, step.tipY - step.y))
    : 48
  return { x: step.x + Math.cos(angle) * length, y: step.y + Math.sin(angle) * length }
}

/**
 * Organic callout matching the blue reference: one outer silhouette (no arc under the
 * pointer), G1-smooth joins into a curved beak, thick concentric ring, soft shadow + light sheen.
 *
 * Join fix: cubic handles follow the canvas-clockwise circle tangent (toward the tip for
 * true tangent attach points). The previous handles used the opposite tangent, which
 * reversed direction at both joins and read as kinks/creases.
 */
function fillStepBadge(context: CanvasRenderingContext2D, tipX: number, tipY: number, outer: number, color: string) {
  const tipLen = Math.hypot(tipX, tipY)
  const angle = Math.atan2(tipY, tipX)
  const reach = Math.max(tipLen, outer + 6)
  const tx = Math.cos(angle) * reach
  const ty = Math.sin(angle) * reach
  // Full tangent span, then narrow the mouth so the beak reads thinner (blue-ref slender taper).
  // Attach points stay on the circle; G1 still uses the circle tangent at those points.
  const alpha = Math.acos(Math.min(0.999, outer / reach))
  const spread = alpha * 0.62
  const a1 = angle - spread
  const a2 = angle + spread
  const p1x = Math.cos(a1) * outer
  const p1y = Math.sin(a1) * outer
  const p2x = Math.cos(a2) * outer
  const p2y = Math.sin(a2) * outer
  // Canvas clockwise unit tangent dp/dθ = (−sin θ, cos θ); for true tangents this points tip-ward.
  const t1x = -Math.sin(a1)
  const t1y = Math.cos(a1)
  const t2x = -Math.sin(a2)
  const t2y = Math.cos(a2)
  // Moderate handles: soft curvature blend without inflating the tip-side ring.
  const hRing = outer * 0.48
  const hTip = Math.min(reach * 0.36, outer * 1.05)
  const ax = Math.cos(angle)
  const ay = Math.sin(angle)

  context.shadowColor = "rgba(15, 23, 42, 0.28)"
  context.shadowBlur = 7
  context.shadowOffsetX = 0.5
  context.shadowOffsetY = 2.5

  context.beginPath()
  // p1 → tip → p2 → clockwise major arc back to p1 (arrival tangent matches leave-to-tip).
  context.moveTo(p1x, p1y)
  context.bezierCurveTo(
    p1x + t1x * hRing,
    p1y + t1y * hRing,
    tx - ax * hTip,
    ty - ay * hTip,
    tx,
    ty
  )
  context.bezierCurveTo(
    tx - ax * hTip,
    ty - ay * hTip,
    p2x - t2x * hRing,
    p2y - t2y * hRing,
    p2x,
    p2y
  )
  context.arc(0, 0, outer, a2, a1, false)
  context.closePath()

  const sheen = context.createRadialGradient(-outer * 0.08, -outer * 0.12, outer * 0.04, 0, 0, outer)
  sheen.addColorStop(0, lightenHex(color, 0.1))
  sheen.addColorStop(0.55, color)
  sheen.addColorStop(1, darkenHex(color, 0.03))
  context.fillStyle = sheen
  context.fill()

  context.shadowColor = "transparent"
  context.shadowBlur = 0
  context.shadowOffsetX = 0
  context.shadowOffsetY = 0

  const inner = outer * (2 / 3)
  context.beginPath()
  context.arc(0, 0, inner, 0, Math.PI * 2)
  context.fillStyle = "#ffffff"
  context.fill()
}

/** Draws step. */
export function drawStep(context: CanvasRenderingContext2D, step: Step) {
  const { x, y, number } = step
  const color = step.color || DEFAULT_STEP_COLOR
  context.save()
  const { x: tipX, y: tipY } = stepPointer(step)
  const outer = 20
  context.translate(x, y)
  fillStepBadge(context, tipX - x, tipY - y, outer, color)

  context.fillStyle = isLightHex(color) ? "#171717" : color
  context.font = '700 16px "Plus Jakarta Sans", sans-serif'
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillText(String(number), 0, 0)
  context.restore()

  if (step.text) {
    context.save()
    context.font = '500 14px "Plus Jakarta Sans", "PingFang SC", sans-serif'
    context.fillStyle = "#171717"
    context.textAlign = "left"
    context.textBaseline = "top"
    let line = "", row = 0
    for (const char of step.text) {
      if (char === "\n" || (line && context.measureText(line + char).width > 180)) {
        context.fillText(line, x + 27, y - 10 + row++ * 20)
        line = char === "\n" ? "" : char
      } else line += char
    }
    context.fillText(line, x + 27, y - 10 + row * 20)
    context.restore()
  }
}

/** Merges steps. */
export async function mergeSteps(base64: string, box: CutBox, steps: Step[]) {
  if (!steps.length) return base64
  const image = new Image()
  image.src = base64
  await image.decode()
  const canvas = document.createElement("canvas")
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext("2d")!
  context.drawImage(image, 0, 0)
  context.scale(canvas.width / box.width, canvas.height / box.height)
  context.translate(-box.startX, -box.startY)
  steps.forEach((step) => drawStep(context, step))
  return canvas.toDataURL("image/png")
}

/** Performs the install steps operation. */
export function installSteps(plugin: ScreenShot, button: HTMLButtonElement) {
  const steps: Step[] = []
  const history: Step[][] = []
  const layer = document.createElement("canvas")
  layer.className = "shot-steps"
  layer.width = innerWidth
  layer.height = innerHeight
  document.body.append(layer)
  const editor = document.createElement("textarea")
  editor.className = "shot-step-caption"
  editor.placeholder = "添加说明…"
  editor.setAttribute("aria-label", "步骤标注说明")
  editor.maxLength = 500
  editor.hidden = true
  document.body.append(editor)
  const menu = document.createElement("div")
  menu.className = "shot-step-menu"
  menu.hidden = true
  menu.setAttribute("role", "group")
  menu.setAttribute("aria-label", "步骤标注颜色")
  document.body.append(menu)
  const colors = document.createElement("div")
  colors.className = "shot-shape-colors"
  colors.setAttribute("role", "group")
  colors.setAttribute("aria-label", "标注颜色")
  const activeColor = document.createElement("span")
  activeColor.className = "shot-shape-color-active"
  activeColor.setAttribute("aria-hidden", "true")
  menu.append(colors, activeColor)
  let active = false
  let selected: Step | undefined
  let moving: Step | undefined
  let dragTip = false
  let focusText = ""
  let currentColor = readScreenshotStepColor()
  const snapshot = () => history.push(steps.map((step) => ({ ...step })))
  const tip = stepPointer
  const paintColor = () => {
    activeColor.style.background = currentColor
    colors.querySelectorAll<HTMLButtonElement>("button[data-color]").forEach((item) => {
      item.setAttribute("aria-checked", String(item.dataset.color?.toLowerCase() === currentColor.toLowerCase()))
    })
  }
  const applyColor = (color: string) => {
    currentColor = color
    writeScreenshotStepColor(color)
    paintColor()
    redraw()
  }
  for (const color of STEP_COLORS) {
    const swatch = document.createElement("button")
    swatch.type = "button"
    swatch.dataset.color = color
    swatch.title = color
    swatch.setAttribute("role", "menuitemradio")
    swatch.setAttribute("aria-label", `标注颜色 ${color}`)
    swatch.setAttribute("aria-checked", String(color.toLowerCase() === currentColor.toLowerCase()))
    swatch.style.background = color
    swatch.onclick = (event) => {
      event.preventDefault()
      event.stopPropagation()
      applyColor(color)
    }
    colors.append(swatch)
  }
  paintColor()
  const positionMenu = () => {
    const toolbar = button.closest<HTMLElement>("#toolPanel")
    if (!toolbar || menu.hidden) return
    const bar = toolbar.getBoundingClientRect()
    const anchor = button.getBoundingClientRect()
    const left = Math.max(8, Math.min(anchor.left + anchor.width / 2 - menu.offsetWidth / 2, innerWidth - menu.offsetWidth - 8))
    const above = bar.bottom + menu.offsetHeight + 10 > innerHeight
    menu.dataset.side = above ? "top" : "bottom"
    menu.style.left = `${left}px`
    menu.style.top = `${above ? bar.top - menu.offsetHeight - 10 : bar.bottom + 10}px`
    menu.style.setProperty("--shot-menu-arrow", `${Math.max(18, Math.min(menu.offsetWidth - 18, anchor.left + anchor.width / 2 - left))}px`)
  }
  const claimSecondarySlot = () => {
    document.body.dataset.shotSecondary = SECONDARY_STEPS
    window.dispatchEvent(new CustomEvent("vessel:screenshot-secondary", { detail: SECONDARY_STEPS }))
  }
  const releaseSecondarySlot = () => {
    if (document.body.dataset.shotSecondary === SECONDARY_STEPS) delete document.body.dataset.shotSecondary
  }
  const showMenu = () => {
    menu.hidden = false
    claimSecondarySlot()
    positionMenu()
  }
  const hideMenu = () => {
    menu.hidden = true
    releaseSecondarySlot()
  }
  const redraw = () => {
    const context = layer.getContext("2d")!
    context.clearRect(0, 0, layer.width, layer.height)
    const box = plugin.getCutBoxInfo()
    context.save()
    context.beginPath()
    context.rect(box.startX, box.startY, box.width, box.height)
    context.clip()
    steps.forEach((step) => drawStep(context, active && step === selected ? { ...step, text: "" } : step))
    if (active && selected) {
      const end = tip(selected)
      context.beginPath()
      context.arc(end.x, end.y, 4, 0, Math.PI * 2)
      context.fillStyle = "#fff"
      context.fill()
      context.strokeStyle = "#168bfa"
      context.lineWidth = 1.5
      context.stroke()
    }
    context.restore()
    editor.hidden = !active || !selected
    if (selected) {
      editor.style.left = `${selected.x + 27}px`
      editor.style.top = `${selected.y - 15}px`
      editor.style.width = `${Math.max(30, Math.min(192, box.startX + box.width - selected.x - 27))}px`
      if (document.activeElement !== editor) editor.value = selected.text || ""
    }
    document.querySelector("#toolPanel .undo, #toolPanel .undo-disabled")?.classList.toggle("shot-can-undo", history.length > 0)
  }
  const setActive = (value: boolean) => {
    active = value
    button.setAttribute("aria-pressed", String(value))
    layer.style.pointerEvents = value ? "auto" : "none"
    if (value) {
      const toolbar = button.closest<HTMLElement>("#toolPanel")
      clearScreenshotDrawingActives(toolbar, button)
      showMenu()
    } else {
      hideMenu()
    }
    redraw()
  }
  button.onclick = () => setActive(!active)
  editor.onfocus = () => { focusText = selected?.text || "" }
  editor.oninput = () => {
    if (!selected) return
    if ((selected.text || "") === focusText) snapshot()
    selected.text = editor.value
    redraw()
  }
  const undo = () => {
    const previous = history.pop()
    if (!previous) return false
    const number = selected?.number
    steps.splice(0, steps.length, ...previous)
    selected = steps.find((step) => step.number === number)
    editor.blur()
    redraw()
    return true
  }
  layer.onpointerdown = (event) => {
    const box = plugin.getCutBoxInfo()
    if (event.clientX < box.startX || event.clientY < box.startY || event.clientX > box.startX + box.width || event.clientY > box.startY + box.height) return
    const onBorder = Math.min(Math.abs(event.clientX - box.startX), Math.abs(event.clientX - box.startX - box.width), Math.abs(event.clientY - box.startY), Math.abs(event.clientY - box.startY - box.height)) <= 12
    const pointed = [...steps].reverse().find((step) => Math.hypot(tip(step).x - event.clientX, tip(step).y - event.clientY) <= 10)
    if (onBorder && !pointed) return
    snapshot()
    moving = pointed || [...steps].reverse().find((step) => Math.hypot(step.x - event.clientX, step.y - event.clientY) <= 22)
    dragTip = !!pointed
    if (!moving) {
      moving = { x: event.clientX, y: event.clientY, number: steps.length + 1, color: currentColor }
      steps.push(moving)
    }
    selected = moving
    editor.blur()
    layer.setPointerCapture(event.pointerId)
    redraw()
  }
  layer.onpointermove = (event) => {
    if (!moving) return
    const box = plugin.getCutBoxInfo()
    const x = Math.max(box.startX, Math.min(box.startX + box.width, event.clientX))
    const y = Math.max(box.startY, Math.min(box.startY + box.height, event.clientY))
    if (dragTip) {
      const end = stepPointer({ ...moving, tipX: x, tipY: y })
      moving.tipX = end.x
      moving.tipY = end.y
    }
    else {
      if (moving.tipX !== undefined) moving.tipX += x - moving.x
      if (moving.tipY !== undefined) moving.tipY += y - moving.y
      moving.x = x
      moving.y = y
    }
    redraw()
  }
  layer.onpointerup = layer.onpointercancel = () => { moving = undefined }
  const syncPointer = (event: PointerEvent) => {
    if (!active || moving) return
    const box = plugin.getCutBoxInfo()
    const onBorder = Math.min(Math.abs(event.clientX - box.startX), Math.abs(event.clientX - box.startX - box.width), Math.abs(event.clientY - box.startY), Math.abs(event.clientY - box.startY - box.height)) <= 12
    layer.style.pointerEvents = onBorder ? "none" : "auto"
  }
  const toolClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    if (!active) return
    // Mode / shape triggers live in the toolbar but are not always .item-panel children of interest.
    if (target.closest("#toolPanel") && !button.contains(target)) setActive(false)
  }
  const secondary = (event: Event) => {
    if ((event as CustomEvent<string>).detail !== SECONDARY_STEPS && active) setActive(false)
  }
  const moved = () => {
    if (active) positionMenu()
  }
  const keydown = (event: KeyboardEvent) => {
    if (active && document.activeElement !== editor && matchesShortcut(event, "undo")) {
      event.preventDefault()
      event.stopImmediatePropagation()
      undo()
    }
  }
  window.addEventListener("pointermove", syncPointer)
  document.addEventListener("click", toolClick)
  window.addEventListener("vessel:screenshot-secondary", secondary)
  window.addEventListener("vessel:screenshot-toolbar-moved", moved)
  document.addEventListener("pointerup", redraw)
  window.addEventListener("keydown", keydown, true)
  return {
    steps, undo,
    hide: () => {
      window.removeEventListener("pointermove", syncPointer)
      document.removeEventListener("click", toolClick)
      window.removeEventListener("vessel:screenshot-secondary", secondary)
      window.removeEventListener("vessel:screenshot-toolbar-moved", moved)
      document.removeEventListener("pointerup", redraw)
      window.removeEventListener("keydown", keydown, true)
      hideMenu()
      layer.remove()
      editor.remove()
      menu.remove()
      active = false
      button.setAttribute("aria-pressed", "false")
    }
  }
}

/** Show the plugin cut-box size badge while the mouse is still down selecting. */
export function installLiveCutSize(selected: () => boolean = () => false) {
  let origin: { x: number; y: number } | null = null

  /** Reads panel. */
  const panel = () => document.getElementById("cutBoxSizePanel")

  /** Writes size. */
  const write = (width: number, height: number, startX: number, startY: number) => {
    const el = panel()
    if (!el || width < 1 || height < 1) return
    const label = `${Math.floor(width)} * ${Math.floor(height)}`
    const child = el.firstChild as HTMLElement | null
    if (child && child.nodeType === Node.ELEMENT_NODE) child.textContent = label
    else {
      const p = document.createElement("p")
      p.textContent = label
      el.replaceChildren(p)
    }
    el.style.display = "flex"
    el.style.left = `${startX}px`
    el.style.top = `${Math.max(0, startY - 35)}px`
  }

  /** Performs the down operation. */
  const down = (event: PointerEvent) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest("#toolPanel, #optionPanel, input, textarea, button, .shot-ocr")) return
    origin = selected() ? null : { x: event.clientX, y: event.clientY }
  }

  /** Performs the move operation. */
  const move = (event: PointerEvent) => {
    if (!origin || (event.buttons & 1) === 0 || selected()) return
    write(Math.abs(event.clientX - origin.x), Math.abs(event.clientY - origin.y), Math.min(origin.x, event.clientX), Math.min(origin.y, event.clientY))
  }

  /** Performs the up operation. */
  const up = () => {
    origin = null
  }

  window.addEventListener("pointerdown", down, true)
  // Bubble after js-web-screen-shot hides the badge on mousemove so the label stays live.
  window.addEventListener("pointermove", move)
  window.addEventListener("pointerup", up, true)
  window.addEventListener("pointercancel", up, true)
  return () => {
    origin = null
    window.removeEventListener("pointerdown", down, true)
    window.removeEventListener("pointermove", move)
    window.removeEventListener("pointerup", up, true)
    window.removeEventListener("pointercancel", up, true)
  }
}

/** Sample the original bitmap, never the dark mask or annotation overlay. */
export async function installColorInspector(src: string, copy: (value: string) => Promise<void>, selected: () => boolean = () => false) {
  const image = new Image()
  image.src = src
  await image.decode()
  const source = document.createElement("canvas")
  source.width = image.naturalWidth
  source.height = image.naturalHeight
  const context = source.getContext("2d", { willReadFrequently: true })!
  context.drawImage(image, 0, 0)
  const panel = document.createElement("div")
  panel.className = "shot-color-inspector"
  panel.hidden = true
  const zoom = document.createElement("canvas")
  const previewSize = 156
  const pixelRatio = window.devicePixelRatio || 1
  zoom.width = Math.round(previewSize * pixelRatio)
  zoom.height = Math.round(previewSize * pixelRatio)
  const text = document.createElement("div")
  panel.append(zoom, text)
  document.body.append(panel)
  let hex = "",
    disposed = false
  let dragOrigin: { x: number; y: number } | null = null

  /** Starts drag size tracking for the loupe. */
  const onDragDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest("#toolPanel, #optionPanel, input, textarea, button, .shot-ocr")) return
    dragOrigin = selected() ? null : { x: event.clientX, y: event.clientY }
  }

  /** Clears drag size tracking. */
  const onDragUp = () => {
    dragOrigin = null
  }

  /** Moves move. */
  const move = (event: MouseEvent) => {
    if (disposed) return
    panel.hidden = selected() || !!(event.target as HTMLElement).closest("#toolPanel, #optionPanel, input, textarea, button, .shot-ocr")
    const x = Math.min(source.width - 1, Math.max(0, Math.floor((event.clientX * source.width) / innerWidth)))
    const y = Math.min(source.height - 1, Math.max(0, Math.floor((event.clientY * source.height) / innerHeight)))
    const pixel = context.getImageData(x, y, 1, 1).data
    hex =
      "#" +
      [...pixel.slice(0, 3)]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
    const view = zoom.getContext("2d")!
    // Keep the preview at 3× the desktop size, independently of Retina scaling.
    const sampleWidth = (previewSize / 3) * source.width / innerWidth
    const sampleHeight = (previewSize / 3) * source.height / innerHeight
    view.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    view.imageSmoothingEnabled = false
    view.clearRect(0, 0, previewSize, previewSize)
    view.drawImage(source, x - sampleWidth / 2, y - sampleHeight / 2, sampleWidth, sampleHeight, 0, 0, previewSize, previewSize)
    view.strokeStyle = "#60a5fa"
    // One CSS pixel stays clear on Retina displays without the old canvas upscaling.
    view.lineWidth = 1
    const strokePixels = Math.max(1, Math.round(pixelRatio))
    const center = (Math.floor(previewSize * pixelRatio / 2) + (strokePixels % 2 ? 0.5 : 0)) / pixelRatio
    const gap = 2
    view.beginPath()
    view.moveTo(center, 0)
    view.lineTo(center, center - gap)
    view.moveTo(center, center + gap)
    view.lineTo(center, previewSize)
    view.moveTo(0, center)
    view.lineTo(center - gap, center)
    view.moveTo(center + gap, center)
    view.lineTo(previewSize, center)
    view.stroke()
    text.replaceChildren()
    const rows: [string, string][] = []
    if (dragOrigin && (event.buttons & 1) !== 0) {
      const width = Math.floor(Math.abs(event.clientX - dragOrigin.x))
      const height = Math.floor(Math.abs(event.clientY - dragOrigin.y))
      if (width > 0 && height > 0) rows.push(["尺寸", `${width} x ${height}`])
    }
    rows.push(["坐标", `${x}, ${y}`], ["色值", hex])
    for (const [label, value] of rows) {
      const row = document.createElement("div"),
        title = document.createElement("span"),
        content = document.createElement("strong")
      title.textContent = label
      content.textContent = value
      row.append(title, content)
      text.append(row)
    }
    const hint = document.createElement("small")
    hint.textContent = "按 C 复制色值"
    text.append(hint)
    panel.style.left = `${Math.max(0, Math.min(event.clientX + 22, innerWidth - 160))}px`
    panel.style.top = `${Math.max(0, Math.min(event.clientY + 22, innerHeight - 210))}px`
  }

  /** Performs the key operation. */
  const key = (event: KeyboardEvent) => {
    if (!panel.hidden && hex && matchesShortcut(event, "copyColor") && !(event.target as HTMLElement).closest("input, textarea, [contenteditable=true]")) {
      event.preventDefault()
      void copy(hex).then(() => {
        text.textContent = `${hex}\n已复制色值`
      })
    }
  }
  window.addEventListener("pointerdown", onDragDown, true)
  window.addEventListener("pointerup", onDragUp, true)
  window.addEventListener("pointercancel", onDragUp, true)
  window.addEventListener("mousemove", move)
  window.addEventListener("keydown", key)
  return () => {
    disposed = true
    panel.remove()
    window.removeEventListener("pointerdown", onDragDown, true)
    window.removeEventListener("pointerup", onDragUp, true)
    window.removeEventListener("pointercancel", onDragUp, true)
    window.removeEventListener("mousemove", move)
    window.removeEventListener("keydown", key)
  }
}
