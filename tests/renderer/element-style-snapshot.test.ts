import { afterEach, expect, it, vi } from "vitest"
import { readElementStyles } from "../../src/renderer/src/pages/browser/element-style-snapshot"

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); document.querySelectorAll("style[data-snapshot-test]").forEach(style => style.remove()) })

it("separates matching page rules, inline shorthands and inherited typography from remaining computed values", () => {
  const style = document.createElement("style")
  style.dataset.snapshotTest = ""
  style.textContent = ".parent { color: rgb(12, 34, 56); display:flex } .selected { margin: 4px; font-size: 18px } .other { opacity:.3 }"
  document.head.append(style)
  document.body.innerHTML = '<div class="parent"><span class="selected" style="padding:2px">Text</span></div>'
  const target = document.querySelector("span")!
  // jsdom omits inherited/default properties; supply the values a browser computes.
  const computed = document.createElement("div").style
  const actual = window.getComputedStyle(target)
  for (const name of Array.from(actual)) computed.setProperty(name, actual.getPropertyValue(name))
  computed.setProperty("color", "rgb(12, 34, 56)")
  computed.setProperty("display", "inline")
  vi.spyOn(window, "getComputedStyle").mockReturnValue(computed)
  const snapshot = readElementStyles(target)
  const user = new Map(snapshot.user), system = new Map(snapshot.system)
  expect(user.get("color")).toBe("rgb(12, 34, 56)")
  expect(user.get("font-size")).toBe("18px")
  expect(user.get("margin-top")).toBe("4px")
  expect(user.get("padding-left")).toBe("2px")
  expect(user.has("display")).toBe(false)
  expect(user.has("opacity")).toBe(false)
  expect(system.size).toBeGreaterThan(0)
  expect(snapshot.user.every(([name]) => !system.has(name))).toBe(true)
  expect(snapshot.unreadableSheets).toBe(false)
})

it("keeps calculated values and marks unreadable stylesheet provenance", () => {
  const element = document.createElement("div")
  document.body.append(element)
  const protectedSheet = { disabled: false, get cssRules() { throw new DOMException("Protected", "SecurityError") } }
  const documentSheets = Object.getOwnPropertyDescriptor(document, "styleSheets")
  Object.defineProperty(document, "styleSheets", { configurable: true, value: [protectedSheet] })
  try {
    const result = readElementStyles(element)
    expect(result.unreadableSheets).toBe(true)
    expect(result.system.length).toBeGreaterThan(0)
  } finally {
    if (documentSheets) Object.defineProperty(document, "styleSheets", documentSheets)
    else delete (document as unknown as Record<string, unknown>).styleSheets
  }
})
