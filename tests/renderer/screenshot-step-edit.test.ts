import { expect, it, vi } from "vitest"
import { DEFAULT_STEP_COLOR, drawStep, installSteps } from "@/features/screenshot/screenshot-tools"

it("edits a step pointer and caption, renders both for export, and supports undo", () => {
  const gradient = { addColorStop: vi.fn() }
  const context = Object.fromEntries([
    "save",
    "restore",
    "beginPath",
    "moveTo",
    "lineTo",
    "bezierCurveTo",
    "quadraticCurveTo",
    "closePath",
    "fill",
    "arc",
    "stroke",
    "fillText",
    "clearRect",
    "rect",
    "clip",
    "translate",
    "rotate"
  ].map((name) => [name, vi.fn()])) as any
  context.createRadialGradient = vi.fn(() => gradient)
  context.createLinearGradient = vi.fn()
  context.measureText = (text: string) => ({ width: text.length * 10 })
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
  Object.defineProperty(HTMLCanvasElement.prototype, "setPointerCapture", { configurable: true, value: vi.fn() })
  const button = document.createElement("button")
  button.className = "shot-step"
  document.body.append(button)
  const tools = installSteps({ getCutBoxInfo: () => ({ startX: 0, startY: 0, width: 500, height: 400 }) } as any, button)
  button.click()
  expect(document.body.dataset.shotSecondary).toBe("steps")
  expect(document.querySelector(".shot-step-menu:not([hidden])")).toBeTruthy()
  const layer = document.querySelector<HTMLCanvasElement>(".shot-steps")!
  const pointer = (x: number, y: number) => ({ clientX: x, clientY: y, pointerId: 1 }) as PointerEvent
  layer.onpointerdown!(pointer(100, 100))
  layer.onpointerup!(pointer(100, 100))
  // Default beak tip lands near (118, 126); drag that handle to (50, 160).
  layer.onpointerdown!(pointer(127, 140))
  layer.onpointermove!(pointer(50, 160))
  layer.onpointerup!(pointer(50, 160))
  expect(tools.steps[0]).toMatchObject({ x: 100, y: 100, color: DEFAULT_STEP_COLOR })
  const step = tools.steps[0]
  expect(step.tipX).toBeCloseTo(50)
  expect(step.tipY).toBeCloseTo(160)
  expect(Math.hypot(step.tipX! - step.x, step.tipY! - step.y)).toBeGreaterThan(48)
  expect(step.tipX).toBeLessThan(step.x)
  expect(step.tipY).toBeGreaterThan(step.y)
  const editor = document.querySelector<HTMLTextAreaElement>(".shot-step-caption")!
  editor.focus()
  editor.value = "说明文字"
  editor.dispatchEvent(new Event("input"))
  expect(tools.steps[0].text).toBe("说明文字")
  context.bezierCurveTo.mockClear()
  context.quadraticCurveTo.mockClear()
  context.arc.mockClear()
  context.rotate.mockClear()
  context.fillText.mockClear()
  context.createRadialGradient.mockClear()
  context.fill.mockClear()
  drawStep(context, tools.steps[0])
  // Organic beak: cubics + major arc; digit upright; subtle sheen allowed.
  expect(context.rotate).not.toHaveBeenCalled()
  expect(context.bezierCurveTo).toHaveBeenCalled()
  expect(context.arc).toHaveBeenCalled()
  const outerArc = context.arc.mock.calls.find((args: number[]) => args[2] === 20)
  expect(outerArc).toBeTruthy()
  expect(outerArc[5]).toBe(false)
  expect(context.createRadialGradient).toHaveBeenCalled()
  expect(context.translate).toHaveBeenCalledWith(100, 100)
  expect(context.fillText).toHaveBeenCalledWith("1", 0, 0)
  expect(context.fillText).toHaveBeenCalledWith("说明文字", 127, 90)
  expect(tools.undo()).toBe(true)
  expect(tools.steps[0].text).toBeUndefined()
  const blue = document.querySelector<HTMLButtonElement>('.shot-step-menu button[data-color="#12A9D7"]')!
  blue.click()
  expect(localStorage.getItem("vessel.screenshot.stepColor")).toBe("#12A9D7")
  layer.onpointerdown!(pointer(200, 200))
  layer.onpointerup!(pointer(200, 200))
  expect(tools.steps[1]).toMatchObject({ x: 200, y: 200, color: "#12A9D7" })
  expect(tools.steps[0].color).toBe(DEFAULT_STEP_COLOR)
  tools.hide()
  expect(document.querySelector(".shot-step-caption")).toBeNull()
  expect(document.querySelector(".shot-step-menu")).toBeNull()
  expect(document.body.dataset.shotSecondary).toBeUndefined()
  button.remove()
  delete (HTMLCanvasElement.prototype as any).setPointerCapture
  vi.restoreAllMocks()
})
