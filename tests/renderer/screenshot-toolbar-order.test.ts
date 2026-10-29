import { expect, it } from "vitest"
import { arrangeScreenshotToolbar } from "@/features/screenshot/toolbar-order"

it("orders screenshot commands for both direct icon buttons and nested icon wrappers", () => {
  const initial = ["square", "round", "right-top", "brush", "mosaicPen", "text", "save", "undo-disabled", "close", "confirm", "shot-step", "shot-pin"]
  const expected = ["shot-step", "square", "round", "right-top", "text", "mosaicPen", "brush", "undo-disabled", "close", "shot-pin", "save", "confirm"]
  for (const nested of [false, true]) {
    const toolbar = document.createElement("div")
    toolbar.innerHTML = initial.map((name) => nested ? `<div class="item-panel" data-title="${name}"><span class="${name}"></span></div>` : `<div class="item-panel ${name}" data-title="${name}"></div>`).join("")
    arrangeScreenshotToolbar(toolbar)
    expect([...toolbar.children].map((node) => (node as HTMLElement).dataset.title)).toEqual(expected)
    expect([...toolbar.children].map((node) => (node as HTMLElement).style.order)).toEqual(expected.map((_, i) => String(i + 1)))
  }
})
