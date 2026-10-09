import type ScreenShot from "js-web-screen-shot"

export type Step = { x: number; y: number; number: number }
export type CutBox = { startX: number; startY: number; width: number; height: number }

export function drawStep(context: CanvasRenderingContext2D, step: Step) {
  const { x, y, number } = step
  context.save()
  context.fillStyle = "#ef4444"
  context.beginPath(); context.moveTo(x - 7, y + 10); context.lineTo(x - 19, y + 25); context.lineTo(x + 7, y + 13); context.closePath(); context.fill()
  context.beginPath(); context.arc(x, y, 17, 0, Math.PI * 2)
  context.fillStyle = "white"; context.fill(); context.lineWidth = 4; context.strokeStyle = "#ef4444"; context.stroke()
  context.fillStyle = "#ef4444"; context.font = '600 18px "Plus Jakarta Sans", sans-serif'; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(String(number), x, y + 1)
  context.restore()
}

export async function mergeSteps(base64: string, box: CutBox, steps: Step[]) {
  if (!steps.length) return base64
  const image = new Image(); image.src = base64; await image.decode()
  const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
  const context = canvas.getContext("2d")!
  context.drawImage(image, 0, 0)
  context.scale(canvas.width / box.width, canvas.height / box.height)
  context.translate(-box.startX, -box.startY)
  steps.forEach(step => drawStep(context, step))
  return canvas.toDataURL("image/png")
}

export function installSteps(plugin: ScreenShot, button: HTMLButtonElement) {
  const steps: Step[] = []
  const layer = document.createElement("canvas")
  layer.className = "shot-steps"
  layer.width = innerWidth; layer.height = innerHeight
  document.body.append(layer)
  let active = false
  const setActive = (value: boolean) => { active = value; button.setAttribute("aria-pressed", String(value)); layer.style.pointerEvents = value ? "auto" : "none" }
  button.onclick = () => setActive(!active)
  const redraw = () => {
    const context = layer.getContext("2d")!
    context.clearRect(0, 0, layer.width, layer.height)
    const box = plugin.getCutBoxInfo()
    context.save(); context.beginPath(); context.rect(box.startX, box.startY, box.width, box.height); context.clip()
    steps.forEach(step => drawStep(context, step)); context.restore()
  }
  let moving: Step | undefined
  const history: Step[][] = []
  const undo = () => { const previous = history.pop(); if (!previous) return false; steps.splice(0, steps.length, ...previous); redraw(); return true }
  layer.onpointerdown = event => {
    const box = plugin.getCutBoxInfo()
    if (event.clientX < box.startX || event.clientY < box.startY || event.clientX > box.startX + box.width || event.clientY > box.startY + box.height) return
    history.push(steps.map(step => ({ ...step })))
    moving = [...steps].reverse().find(step => Math.hypot(step.x - event.clientX, step.y - event.clientY) <= 22)
    if (!moving) { moving = { x: event.clientX, y: event.clientY, number: steps.length + 1 }; steps.push(moving) }
    layer.setPointerCapture(event.pointerId); redraw()
  }
  layer.onpointermove = event => { if (moving) { const box = plugin.getCutBoxInfo(); moving.x = Math.max(box.startX, Math.min(box.startX + box.width, event.clientX)); moving.y = Math.max(box.startY, Math.min(box.startY + box.height, event.clientY)); redraw() } }
  layer.onpointerup = layer.onpointercancel = () => { moving = undefined }
  document.addEventListener("click", event => {
    const target = event.target as HTMLElement
    if (target.closest("#toolPanel") && !button.contains(target)) setActive(false)
  })
  document.addEventListener("pointerup", redraw)
  window.addEventListener("keydown", event => {
    if (active && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.stopImmediatePropagation(); undo() }
  }, true)
  return { steps, undo, hide: () => { layer.remove(); setActive(false) } }
}

/** Sample the original bitmap, never the dark mask or annotation overlay. */
export async function installColorInspector(src: string, copy: (value: string) => Promise<void>, selected: () => boolean = () => false) {
  const image = new Image(); image.src = src; await image.decode()
  const source = document.createElement("canvas"); source.width = image.naturalWidth; source.height = image.naturalHeight
  const context = source.getContext("2d", { willReadFrequently: true })!; context.drawImage(image, 0, 0)
  const panel = document.createElement("div"); panel.className = "shot-color-inspector"; panel.hidden = true
  const zoom = document.createElement("canvas"); zoom.width = 110; zoom.height = 110
  const text = document.createElement("div"); panel.append(zoom, text); document.body.append(panel)
  let hex = "", disposed = false
  const move = (event: MouseEvent) => {
    if (disposed) return
    panel.hidden = selected() || !!(event.target as HTMLElement).closest("#toolPanel, #optionPanel, input, textarea, button, .shot-ocr")
    const x = Math.min(source.width - 1, Math.max(0, Math.floor(event.clientX * source.width / innerWidth)))
    const y = Math.min(source.height - 1, Math.max(0, Math.floor(event.clientY * source.height / innerHeight)))
    const pixel = context.getImageData(x, y, 1, 1).data
    hex = "#" + [...pixel.slice(0, 3)].map(value => value.toString(16).padStart(2, "0")).join("").toUpperCase()
    const view = zoom.getContext("2d")!; view.imageSmoothingEnabled = false; view.clearRect(0, 0, 110, 110)
    view.drawImage(source, x - 5, y - 5, 11, 11, 0, 0, 110, 110)
    view.strokeStyle = "#60a5fa"; view.lineWidth = 1; view.beginPath(); view.moveTo(55, 0); view.lineTo(55, 49); view.moveTo(55, 61); view.lineTo(55, 110); view.moveTo(0, 55); view.lineTo(49, 55); view.moveTo(61, 55); view.lineTo(110, 55); view.stroke()
    text.replaceChildren()
    for (const [label, value] of [["坐标", `${x}, ${y}`], ["色值", hex]]) { const row = document.createElement("div"), title = document.createElement("span"), content = document.createElement("strong"); title.textContent = label; content.textContent = value; row.append(title, content); text.append(row) }
    const hint = document.createElement("small"); hint.textContent = "按 C 复制色值"; text.append(hint)
    panel.style.left = `${Math.max(0, Math.min(event.clientX + 22, innerWidth - 160))}px`
    panel.style.top = `${Math.max(0, Math.min(event.clientY + 22, innerHeight - 190))}px`
  }
  const key = (event: KeyboardEvent) => {
    if (!panel.hidden && hex && event.key.toLowerCase() === "c" && !event.ctrlKey && !event.metaKey && !event.altKey && !(event.target as HTMLElement).closest("input, textarea, [contenteditable=true]")) { event.preventDefault(); void copy(hex).then(() => { text.textContent = `${hex}\n已复制色值` }) }
  }
  window.addEventListener("mousemove", move); window.addEventListener("keydown", key)
  return () => { disposed = true; panel.remove(); window.removeEventListener("mousemove", move); window.removeEventListener("keydown", key) }
}
