import { afterEach, expect, it } from "vitest"
import { elementPickerScript } from "../../src/renderer/src/pages/browser/element-picker"
afterEach(() => { document.getElementById("vessel-element-picker")?.dispatchEvent(new Event("vessel-close")); document.body.replaceChildren() })
it("toggles the inspector and exits with Escape without activating the page", () => {
  const element = document.createElement("button"); element.textContent = '<script>unsafe</script>'; document.body.append(element)
  window.eval(elementPickerScript)
  element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 30, clientY: 30 }))
  expect(document.getElementById("vessel-element-picker")).toBeTruthy()
  const click = new MouseEvent("click", { bubbles: true, cancelable: true })
  element.dispatchEvent(click)
  expect(click.defaultPrevented).toBe(true)
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  expect(document.getElementById("vessel-element-picker")).toBeNull()
})
