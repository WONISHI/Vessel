import type { ScreenshotShape } from "./shape-menu"
import { isCustomScreenshotShape } from "./shape-menu"

const BLANK_ICON = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
const CUSTOM: ScreenshotShape[] = ["triangle", "line", "diamond"]
const BRUSH_SIZES: Record<string, number> = { small: 2, medium: 5, big: 10 }
const PLUGIN_COLORS = ["#F53440", "#F65E95", "#D254CF", "#12A9D7", "#30A345", "#FACF50", "#F66632", "#989998", "#000000", "#FEFFFF"]

export type ShapeStroke = { color: string; width: number }
type Stroke = ShapeStroke
type Draft = { shape: ScreenshotShape; startX: number; startY: number; currentX: number; currentY: number; color: string; width: number }
type ShapePayload = { kind: ScreenshotShape; color: string; borderWidth: number; startX?: number; startY?: number; endX?: number; endY?: number }

type CustomElement = {
  id: string
  x: number
  y: number
  width: number
  height: number
  toolId?: number
  toolName?: string
  payload?: unknown
  customType: "custom"
}

type CustomElementApi = {
  // Plugin types are stricter; we only need addElement at runtime.
  addElement: (input: any) => unknown
  updateElement: (element: CustomElement) => void
  removeElement: (id: string) => void
  selectElement: (id: string) => boolean
  getElement: (id: string) => unknown
  getActiveElement: () => unknown
  redraw: () => void
}

function asPayload(element: CustomElement): ShapePayload {
  const payload = (element.payload || {}) as Partial<ShapePayload>
  return {
    kind: (payload.kind || element.toolName || "triangle") as ScreenshotShape,
    color: payload.color || "#F53340",
    borderWidth: payload.borderWidth || 2,
    startX: payload.startX,
    startY: payload.startY,
    endX: payload.endX,
    endY: payload.endY
  }
}

function strokeShape(
  context: CanvasRenderingContext2D,
  shape: ScreenshotShape,
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  color: string,
  width: number
) {
  context.save()
  context.strokeStyle = color
  context.lineWidth = width
  context.lineJoin = "round"
  context.lineCap = "round"
  if (shape === "line") {
    context.beginPath()
    context.moveTo(startX, startY)
    context.lineTo(currentX, currentY)
    context.stroke()
  } else if (shape === "triangle") {
    const x = Math.min(startX, currentX)
    const y = Math.min(startY, currentY)
    const w = Math.abs(currentX - startX)
    const h = Math.abs(currentY - startY)
    context.beginPath()
    context.moveTo(x + w / 2, y)
    context.lineTo(x, y + h)
    context.lineTo(x + w, y + h)
    context.closePath()
    context.stroke()
  } else if (shape === "diamond") {
    const x = Math.min(startX, currentX)
    const y = Math.min(startY, currentY)
    const w = Math.abs(currentX - startX)
    const h = Math.abs(currentY - startY)
    context.beginPath()
    context.moveTo(x + w / 2, y)
    context.lineTo(x + w, y + h / 2)
    context.lineTo(x + w / 2, y + h)
    context.lineTo(x, y + h / 2)
    context.closePath()
    context.stroke()
  }
  context.restore()
}

function drawElement(element: CustomElement, context: CanvasRenderingContext2D) {
  const payload = asPayload(element)
  if (payload.kind === "line") {
    strokeShape(
      context,
      "line",
      payload.startX ?? element.x,
      payload.startY ?? element.y,
      payload.endX ?? element.x + element.width,
      payload.endY ?? element.y + element.height,
      payload.color,
      payload.borderWidth
    )
    return
  }
  strokeShape(context, payload.kind, element.x, element.y, element.x + element.width, element.y + element.height, payload.color, payload.borderWidth)
}

/** Push thickness / color into js-web-screen-shot's hidden optionPanel so square / ellipse match. */
function syncPluginStroke(stroke: Stroke) {
  const panel = document.getElementById("optionPanel")
  if (!panel) return
  const index = PLUGIN_COLORS.findIndex((color) => color.toLowerCase() === stroke.color.toLowerCase())
  if (index >= 0) {
    panel.querySelector<HTMLElement>(`.color-item[data-color-index="${index + 1}"]`)?.click()
  }
  const brush = stroke.width <= 3 ? "small" : stroke.width <= 7 ? "medium" : "big"
  panel.querySelector<HTMLElement>(`[data-brush-size="${brush}"]`)?.click()
}

/** Watch the plugin option panel so custom shapes reuse the same color and width. */
export function installShapeStrokeTracker(initial?: ShapeStroke) {
  let stroke: Stroke = { color: initial?.color || "#F53440", width: initial?.width || 4 }
  let syncing = false
  const read = (event: Event) => {
    if (syncing) return
    const target = event.target as Element | null
    const color = target?.closest?.<HTMLElement>("#optionPanel .color-item")
    if (color) {
      const index = Number(color.dataset.colorIndex)
      if (index >= 1 && index <= PLUGIN_COLORS.length) stroke = { ...stroke, color: PLUGIN_COLORS[index - 1] }
      else {
        const value = color.style.backgroundColor || getComputedStyle(color).backgroundColor
        if (value) stroke = { ...stroke, color: value }
      }
    }
    const brush = target?.closest?.<HTMLElement>("#optionPanel .brush-select-panel .item-panel, #optionPanel [data-brush-size]")
    const size = brush?.dataset.brushSize
    if (size && BRUSH_SIZES[size]) stroke = { ...stroke, width: BRUSH_SIZES[size] }
  }
  document.addEventListener("click", read, true)
  return {
    current: () => stroke,
    set: (next: Partial<ShapeStroke>) => {
      stroke = { ...stroke, ...next }
      syncing = true
      try {
        syncPluginStroke(stroke)
      } finally {
        syncing = false
      }
    },
    dispose: () => document.removeEventListener("click", read, true)
  }
}

/** Hidden userToolbar entries so js-web-screen-shot routes drawing through canvasEvents. */
export function screenshotShapeToolbarItems(
  onActivate: (shape: ScreenshotShape, context: CanvasRenderingContext2D) => void
) {
  return CUSTOM.map((shape) => ({
    title: shape,
    icon: BLANK_ICON,
    activeIcon: BLANK_ICON,
    clickFn: ({ screenShotCanvas }: { screenShotCanvas: CanvasRenderingContext2D }) => onActivate(shape, screenShotCanvas)
  }))
}

export function screenshotShapeAdapters() {
  return CUSTOM.map((shape) => ({
    toolName: shape,
    draw: drawElement,
    hitTest: (element: CustomElement, point: { x: number; y: number }) => {
      const pad = Math.max(4, asPayload(element).borderWidth)
      return point.x >= element.x - pad && point.x <= element.x + element.width + pad && point.y >= element.y - pad && point.y <= element.y + element.height + pad
    },
    move: (element: CustomElement, delta: { x: number; y: number }) => {
      const payload = asPayload(element)
      return {
        ...element,
        x: element.x + delta.x,
        y: element.y + delta.y,
        payload:
          payload.kind === "line"
            ? {
                ...payload,
                startX: (payload.startX ?? element.x) + delta.x,
                startY: (payload.startY ?? element.y) + delta.y,
                endX: (payload.endX ?? element.x + element.width) + delta.x,
                endY: (payload.endY ?? element.y + element.height) + delta.y
              }
            : payload
      }
    }
  }))
}

/** Draw triangle / line / diamond while a hidden custom toolbar tool is active. */
export function createShapeCanvasEvents(
  getStroke: () => Stroke,
  getContext: () => CanvasRenderingContext2D | null,
  getShape: () => ScreenshotShape | null
) {
  let draft: Draft | null = null
  return {
    mouseDownFn: (_event: MouseEvent | TouchEvent, mouseX: number, mouseY: number, addHistory: () => void, _api: CustomElementApi) => {
      const shape = getShape()
      if (!shape || !isCustomScreenshotShape(shape)) return
      const stroke = getStroke()
      addHistory()
      draft = { shape, startX: mouseX, startY: mouseY, currentX: mouseX, currentY: mouseY, color: stroke.color, width: stroke.width }
    },
    mouseMoveFn: (
      _event: MouseEvent | TouchEvent,
      info: { startX: number; startY: number; currentX: number; currentY: number },
      showLastHistory: (context: CanvasRenderingContext2D) => void,
      _api: CustomElementApi
    ) => {
      if (!draft) return
      const context = getContext()
      if (!context) return
      draft.currentX = info.currentX
      draft.currentY = info.currentY
      showLastHistory(context)
      strokeShape(context, draft.shape, draft.startX, draft.startY, draft.currentX, draft.currentY, draft.color, draft.width)
    },
    mouseUpFn: (_showLastHistory: (context: CanvasRenderingContext2D) => void, api: CustomElementApi) => {
      if (!draft) return
      const { shape, startX, startY, currentX, currentY, color, width } = draft
      draft = null
      if (Math.abs(currentX - startX) < 2 && Math.abs(currentY - startY) < 2) return
      const x = Math.min(startX, currentX)
      const y = Math.min(startY, currentY)
      const boxWidth = Math.abs(currentX - startX)
      const boxHeight = Math.abs(currentY - startY)
      api.addElement({
        x,
        y,
        width: Math.max(1, boxWidth),
        height: Math.max(1, boxHeight),
        toolName: shape,
        payload: {
          kind: shape,
          color,
          borderWidth: width,
          startX,
          startY,
          endX: currentX,
          endY: currentY
        } satisfies ShapePayload
      })
    }
  }
}
