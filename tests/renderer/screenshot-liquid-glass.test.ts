import { expect, it } from "vitest"
import { glassDisplacement } from "@/features/screenshot/liquid-glass"
it("confines the refraction normal map to the rim while leaving its center neutral", () => {
  const width = 200, height = 44
  const data = glassDisplacement(width, height)
  const at = (x: number, y: number) => [...data.slice((y * width + x) * 4, (y * width + x) * 4 + 4)]
  expect(at(100, 22)).toEqual([128, 128, 128, 255])
  expect(at(100, 1)[2]).toBeLessThan(128)
  expect(at(100, 42)[2]).toBeGreaterThan(128)
  expect(at(1, 22)[0]).toBeLessThan(128)
  expect(at(198, 22)[0]).toBeGreaterThan(128)
})
