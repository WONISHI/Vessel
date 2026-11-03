import { expect, it, vi } from "vitest"
import { clearScreenshotDrawingActives, installScreenshotModes } from "@/features/screenshot/mode-menu"
import { installShapeMenu } from "@/features/screenshot/shape-menu"
import { installOptionArrow } from "@/features/screenshot/option-arrow"

it("clears plugin active tiles and hides the option strip", () => {
  document.body.innerHTML = `
    <div id="toolPanel">
      <button class="item-panel shot-step" aria-pressed="true"></button>
      <div class="item-panel" data-id="3"><div class="right-top right-top-active"></div></div>
      <button class="item-panel shot-shapes shot-shapes-active" aria-pressed="true" aria-expanded="true"></button>
    </div>
    <div id="optionPanel" style="display:flex"></div>
    <div id="optionIcoController" style="display:block"></div>
  `
  const toolbar = document.getElementById("toolPanel")!
  const step = toolbar.querySelector<HTMLElement>(".shot-step")!
  clearScreenshotDrawingActives(toolbar, step)
  expect(toolbar.querySelector(".right-top-active")).toBeNull()
  expect(toolbar.querySelector(".shot-shapes-active")).toBeNull()
  expect(toolbar.querySelector(".shot-shapes")?.getAttribute("aria-pressed")).toBe("false")
  expect(step.getAttribute("aria-pressed")).toBe("true")
  expect(document.getElementById("optionPanel")?.style.display).toBe("none")
  document.body.innerHTML = ""
})

it("closes the mode secondary and drops expanded active when a drawing tool is chosen", () => {
  document.body.innerHTML = `
    <div id="toolPanel">
      <div class="shot-toolbar-heading"></div>
      <div class="item-panel right-top" data-id="3" data-title="right-top"></div>
    </div>
    <div id="optionPanel"></div>
    <div id="optionIcoController"></div>
  `
  const toolbar = document.getElementById("toolPanel")!
  const heading = toolbar.querySelector<HTMLElement>(".shot-toolbar-heading")!
  const tool = toolbar.querySelector<HTMLElement>(".item-panel")!
  const disposeMode = installScreenshotModes(heading, vi.fn())
  const disposeArrow = installOptionArrow(toolbar)
  const trigger = heading.querySelector("button")!
  trigger.click()
  expect(trigger.getAttribute("aria-expanded")).toBe("true")
  expect(document.body.dataset.shotSecondary).toBe("mode")
  tool.click()
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
  expect(document.body.dataset.shotSecondary).toBeUndefined()
  disposeArrow()
  disposeMode()
  document.body.innerHTML = ""
  document.querySelector(".shot-mode-menu")?.remove()
})

it("dismisses the shape secondary active tile when options secondary is claimed", () => {
  document.body.innerHTML = `
    <div id="toolPanel">
      <button type="button" class="item-panel shot-shapes" data-title="形状"></button>
      <div class="item-panel" data-id="3" data-title="right-top"></div>
      <div class="item-panel square" data-title="square"></div>
      <div class="item-panel round" data-title="round"></div>
    </div>
  `
  const toolbar = document.getElementById("toolPanel")!
  const trigger = toolbar.querySelector<HTMLElement>(".shot-shapes")!
  const menu = installShapeMenu(toolbar, trigger, vi.fn())
  trigger.click()
  expect(trigger.getAttribute("aria-expanded")).toBe("true")
  expect(trigger.classList.contains("shot-shapes-active")).toBe(true)
  window.dispatchEvent(new CustomEvent("vessel:screenshot-secondary", { detail: "options" }))
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
  expect(trigger.classList.contains("shot-shapes-active")).toBe(false)
  expect(trigger.getAttribute("aria-pressed")).toBe("false")
  menu.dispose()
  document.body.innerHTML = ""
  document.querySelector(".shot-shape-menu")?.remove()
})
