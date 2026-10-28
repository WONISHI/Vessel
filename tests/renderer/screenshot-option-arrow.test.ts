import { expect, it, vi } from "vitest"
import { installOptionArrow } from "@/features/screenshot/option-arrow"
it("points to the selected tool after adding the screenshot heading", () => {
  document.body.innerHTML = '<div id="toolPanel"><div class="heading">截图</div><div class="item-panel brush" data-id="4"></div></div><div id="optionPanel"></div><div id="optionIcoController"></div>'
  const toolbar = document.getElementById("toolPanel")!
  const brush = toolbar.querySelector<HTMLElement>(".brush")!
  const arrow = document.getElementById("optionIcoController")!
  vi.spyOn(brush, "getBoundingClientRect").mockReturnValue({ left: 400, width: 36 } as DOMRect)
  const panel = document.getElementById("optionPanel")!
  vi.spyOn(toolbar, "getBoundingClientRect").mockReturnValue({ top: 100, bottom: 144 } as DOMRect)
  vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({ width: 240, height: 40 } as DOMRect)
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1 })
  const dispose = installOptionArrow(toolbar)
  brush.click()
  expect(panel.style.left).toBe("298px")
  expect(panel.style.top).toBe("154px")
  expect(arrow.style.left).toBe("409px")
  expect(arrow.style.top).toBe("146px")
  dispose()
  vi.unstubAllGlobals()
  document.body.innerHTML = ""
})

it("clamps the option surface at the right edge and flips above a low toolbar", () => {
  document.body.innerHTML = '<div id="toolPanel"><div class="item-panel text" data-id="6"></div></div><div id="optionPanel"></div><div id="optionIcoController"></div>'
  const toolbar = document.getElementById("toolPanel")!
  const tool = toolbar.firstElementChild as HTMLElement
  const panel = document.getElementById("optionPanel")!
  const arrow = document.getElementById("optionIcoController")!
  vi.stubGlobal("innerWidth", 800)
  vi.stubGlobal("innerHeight", 600)
  vi.spyOn(toolbar, "getBoundingClientRect").mockReturnValue({ top: 540, bottom: 584 } as DOMRect)
  vi.spyOn(tool, "getBoundingClientRect").mockReturnValue({ left: 740, width: 32 } as DOMRect)
  vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({ width: 240, height: 40 } as DOMRect)
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1 })
  const dispose = installOptionArrow(toolbar)
  tool.click()
  expect(panel.style.left).toBe("552px")
  expect(panel.style.top).toBe("490px")
  expect(arrow.dataset.side).toBe("top")
  expect(arrow.style.left).toBe("747px")
  dispose()
  vi.unstubAllGlobals()
  document.body.innerHTML = ""
})
