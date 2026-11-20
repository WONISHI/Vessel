import { expect, it } from "vitest"
import { createStepAt, stepCaptionLayout, stepPointer } from "@/features/screenshot/step-geometry"

const box = { startX: 100, startY: 80, width: 360, height: 220 }
it.each([[100, 80], [460, 80], [100, 300], [460, 300], [280, 80], [280, 300], [100, 190], [460, 190], [280, 190]])("anchors the tip at (%s, %s) and keeps the badge and caption in the crop", (x, y) => {
  const step = createStepAt({ x, y }, box, 1, "#168bfa")
  expect(stepPointer(step)).toEqual({ x, y })
  expect(step.x - step.radius!).toBeGreaterThanOrEqual(box.startX)
  expect(step.x + step.radius!).toBeLessThanOrEqual(box.startX + box.width)
  expect(step.y - step.radius!).toBeGreaterThanOrEqual(box.startY)
  expect(step.y + step.radius!).toBeLessThanOrEqual(box.startY + box.height)
  const caption = stepCaptionLayout({ ...step, text: "标注说明\n第二行" }, box, (text) => text.length * 12)
  expect(caption.x).toBeGreaterThanOrEqual(box.startX)
  expect(caption.y).toBeGreaterThanOrEqual(box.startY)
  expect(caption.x + caption.width).toBeLessThanOrEqual(box.startX + box.width)
  expect(caption.y + caption.height).toBeLessThanOrEqual(box.startY + box.height)
})

it("preserves short explicit pointers and fits a very small crop without negative dimensions", () => {
  const tiny = { startX: 10, startY: 20, width: 16, height: 12 }
  const step = createStepAt({ x: 10, y: 20 }, tiny, 1, "red")
  expect(stepPointer({ ...step, tipX: step.x + 1, tipY: step.y + 1 })).toEqual({ x: step.x + 1, y: step.y + 1 })
  const caption = stepCaptionLayout(step, tiny, (text) => text.length * 6)
  expect(caption.width).toBeGreaterThan(0)
  expect(caption.height).toBeGreaterThan(0)
  expect(caption.x + caption.width).toBeLessThanOrEqual(26)
  expect(caption.y + caption.height).toBeLessThanOrEqual(32)
})
