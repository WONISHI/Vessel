import { expect, it, vi } from "vitest"
import { drawStep, installSteps } from "@/features/screenshot/screenshot-tools"

it("edits a step pointer and caption, renders both for export, and supports undo", () => {
  const context = Object.fromEntries(["save", "restore", "beginPath", "moveTo", "lineTo", "quadraticCurveTo", "closePath", "fill", "arc", "stroke", "fillText", "clearRect", "rect", "clip"].map((name) => [name, vi.fn()])) as any
  context.measureText = (text: string) => ({ width: text.length * 10 })
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
  Object.defineProperty(HTMLCanvasElement.prototype, "setPointerCapture", { configurable: true, value: vi.fn() })
  const button = document.createElement("button")
  document.body.append(button)
  const tools = installSteps({ getCutBoxInfo: () => ({ startX: 0, startY: 0, width: 500, height: 400 }) } as any, button)
  button.click()
  const layer = document.querySelector<HTMLCanvasElement>(".shot-steps")!
  const pointer = (x: number, y: number) => ({ clientX: x, clientY: y, pointerId: 1 }) as PointerEvent
  layer.onpointerdown!(pointer(100, 100))
  layer.onpointerup!(pointer(100, 100))
  layer.onpointerdown!(pointer(123, 134))
  layer.onpointermove!(pointer(50, 160))
  layer.onpointerup!(pointer(50, 160))
  expect(tools.steps[0]).toMatchObject({ x: 100, y: 100 })
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
  context.quadraticCurveTo.mockClear()
  context.fillText.mockClear()
  drawStep(context, tools.steps[0])
  expect(context.quadraticCurveTo).not.toHaveBeenCalled()
  expect(context.lineTo).toHaveBeenCalledWith(step.tipX, step.tipY)
  expect(context.fillText).toHaveBeenCalledWith("说明文字", 127, 90)
  expect(tools.undo()).toBe(true)
  expect(tools.steps[0].text).toBeUndefined()
  tools.hide()
  expect(document.querySelector(".shot-step-caption")).toBeNull()
  button.remove()
  delete (HTMLCanvasElement.prototype as any).setPointerCapture
  vi.restoreAllMocks()
})
