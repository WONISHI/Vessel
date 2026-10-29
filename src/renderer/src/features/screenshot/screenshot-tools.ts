import { matchesShortcut } from "@vessel/utils"
import type ScreenShot from "js-web-screen-shot"

export type Step = { x: number; y: number; number: number; tipX?: number; tipY?: number; text?: string }
export type CutBox = { startX: number; startY: number; width: number; height: number }

/** Draws step. */
export function drawStep(context: CanvasRenderingContext2D, step: Step) {
  const { x, y, number } = step
  context.save()
  context.fillStyle = "#ef4444"
  const tipX = step.tipX ?? x + 23
  const tipY = step.tipY ?? y + 34
  const angle = Math.atan2(tipY - y, tipX - x)
  const side = 0.58
  context.beginPath()
  context.moveTo(x + Math.cos(angle - side) * 15, y + Math.sin(angle - side) * 15)
  context.quadraticCurveTo(x + Math.cos(angle) * 19, y + Math.sin(angle) * 19, tipX, tipY)
  context.quadraticCurveTo(x + Math.cos(angle + side) * 22, y + Math.sin(angle + side) * 22, x + Math.cos(angle + side) * 15, y + Math.sin(angle + side) * 15)
  context.closePath()
  context.fill()
  context.beginPath()
  context.arc(x, y, 17, 0, Math.PI * 2)
  context.fillStyle = "white"
  context.fill()
  context.lineWidth = 4
  context.strokeStyle = "#ef4444"
  context.stroke()
  context.fillStyle = "#ef4444"
  context.font = '600 18px "Plus Jakarta Sans", sans-serif'
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillText(String(number), x, y + 1)
  if (step.text) {
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
  }
  context.restore()
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
  let active = false
  let selected: Step | undefined
  let moving: Step | undefined
  let dragTip = false
  let focusText = ""
  const snapshot = () => history.push(steps.map((step) => ({ ...step })))
  const tip = (step: Step) => ({ x: step.tipX ?? step.x + 23, y: step.tipY ?? step.y + 34 })
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
      moving = { x: event.clientX, y: event.clientY, number: steps.length + 1 }
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
    if (dragTip) { moving.tipX = x; moving.tipY = y }
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
    if (target.closest("#toolPanel") && !button.contains(target)) setActive(false)
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
  document.addEventListener("pointerup", redraw)
  window.addEventListener("keydown", keydown, true)
  return {
    steps, undo,
    hide: () => {
      window.removeEventListener("pointermove", syncPointer)
      document.removeEventListener("click", toolClick)
      document.removeEventListener("pointerup", redraw)
      window.removeEventListener("keydown", keydown, true)
      layer.remove()
      editor.remove()
      active = false
      button.setAttribute("aria-pressed", "false")
    }
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
    for (const [label, value] of [
      ["坐标", `${x}, ${y}`],
      ["色值", hex]
    ]) {
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
    panel.style.top = `${Math.max(0, Math.min(event.clientY + 22, innerHeight - 190))}px`
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
  window.addEventListener("mousemove", move)
  window.addEventListener("keydown", key)
  return () => {
    disposed = true
    panel.remove()
    window.removeEventListener("mousemove", move)
    window.removeEventListener("keydown", key)
  }
}
