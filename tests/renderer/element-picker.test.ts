import { afterEach, expect, it } from "vitest"
import { elementPickerScript } from "../../src/renderer/src/pages/browser/element-picker"

afterEach(() => { document.getElementById("vessel-element-picker")?.dispatchEvent(new Event("vessel-close")); document.body.replaceChildren() })

it("picks and freezes elements inside an iframe and cleans up on Escape", () => {
  const frame = document.createElement("iframe")
  document.body.append(frame)
  const doc = frame.contentDocument!
  doc.body.innerHTML = '<button id="inside">Frame button</button>'
  const button = doc.querySelector("button")!
  window.eval(elementPickerScript)
  button.dispatchEvent(new (doc.defaultView!.MouseEvent)("mousemove", { bubbles: true, composed: true, clientX: 20, clientY: 30 }))
  const click = new (doc.defaultView!.MouseEvent)("click", { bubbles: true, cancelable: true, composed: true })
  button.dispatchEvent(click)
  expect(click.defaultPrevented).toBe(true)
  button.dispatchEvent(new (doc.defaultView!.KeyboardEvent)("keydown", { key: "Escape", bubbles: true }))
  expect(document.getElementById("vessel-element-picker")).toBeNull()
  const after = new (doc.defaultView!.MouseEvent)("click", { bubbles: true, cancelable: true })
  button.dispatchEvent(after)
  expect(after.defaultPrevented).toBe(false)
})
