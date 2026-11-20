import { waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { elementPickerScript } from "@/pages/browser/element-picker"
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.getElementById("vessel-element-picker")?.dispatchEvent(new Event("vessel-close"))
  document.body.replaceChildren()
})
it("toggles the inspector and exits with Escape without activating the page", () => {
  const element = document.createElement("button")
  element.textContent = "<script>unsafe</script>"
  document.body.append(element)
  window.eval(elementPickerScript)
  element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 30, clientY: 30 }))
  expect(document.getElementById("vessel-element-picker")).toBeTruthy()
  const click = new MouseEvent("click", { bubbles: true, cancelable: true })
  element.dispatchEvent(click)
  expect(click.defaultPrevented).toBe(true)
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  expect(document.getElementById("vessel-element-picker")).toBeNull()
})

function openActions() {
  const attach = Element.prototype.attachShadow
  vi.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, options) {
    return attach.call(this, { ...options, mode: "open" })
  })
  const element = document.createElement("button")
  element.id = "target"
  element.textContent = "Example"
  element.style.cssText = "color:rgb(12, 34, 56); visibility:visible!important"
  document.body.append(element)
  window.eval(elementPickerScript)
  element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, composed: true }))
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, cancelable: true }))
  const root = document.getElementById("vessel-element-picker")!.shadowRoot!
  root.querySelector<HTMLButtonElement>('[aria-label="操作当前元素"]')!.click()
  return { element, root }
}

it("opens shadcn styles controls, highlights values, and reversibly hides the target", async () => {
  const { element, root } = openActions()
  expect(root.querySelector<HTMLElement>(".actions")!.hidden).toBe(false)
  const trigger = root.querySelector<HTMLButtonElement>(".styles-trigger")!
  expect(trigger.getAttribute("aria-expanded")).toBe("true")
  expect(root.querySelectorAll(".tools button svg")).toHaveLength(4)
  const user = root.querySelector('[data-source="user"]')!
  const system = root.querySelector('[data-source="system"]')!
  expect(user.querySelector(".style-source-trigger")!.getAttribute("aria-expanded")).toBe("true")
  expect(system.querySelector(".style-source-trigger")!.getAttribute("aria-expanded")).toBe("false")
  expect(Array.from(root.querySelectorAll(".tools button"), button => button.getAttribute("data-title"))).toEqual(["复制元素", "隐藏元素", "删除元素", "关闭元素操作"])
  const initialGroups = Array.from(user.querySelectorAll<HTMLButtonElement>(".style-group-trigger"))
  expect(initialGroups.length).toBeGreaterThan(0)
  expect(initialGroups.every(group => group.getAttribute("aria-expanded") === "false")).toBe(true)
  initialGroups.forEach(group => group.click())
  await waitFor(() => expect(root.querySelector(".style-property")).toBeTruthy())
  expect(root.querySelector('[data-vessel-scroll="area"]')).toBeTruthy()
  expect(root.querySelector('[data-radix-scroll-area-viewport]')).toBeTruthy()
  expect(root.querySelector(".all-styles")!.textContent).toContain("rgb(12, 34, 56)")
  expect(root.querySelector(".style-property")!.textContent).toBeTruthy()
  expect(root.querySelector(".style-token-color")!.textContent).toBe("rgb(12, 34, 56)")
  const headers = Array.from(root.querySelectorAll<HTMLButtonElement>(".style-group-trigger"))
  expect(headers.some(header => header.textContent?.includes("视觉效果"))).toBe(true)
  expect(headers.some(header => header.textContent?.includes("背景与颜色"))).toBe(true)
  const properties = Array.from(root.querySelectorAll(".style-property"), node => node.textContent)
  expect(new Set(properties).size).toBe(properties.length)
  headers[0].click()
  await waitFor(() => expect(headers[0].getAttribute("aria-expanded")).toBe("false"))
  root.querySelector<HTMLButtonElement>('[aria-label="隐藏元素"]')!.click()
  expect(element.style.visibility).toBe("hidden")
  root.querySelector<HTMLButtonElement>('[aria-label="显示元素"]')!.click()
  expect(element.style.visibility).toBe("visible")
  expect(element.style.getPropertyPriority("visibility")).toBe("important")
  root.querySelector<HTMLButtonElement>('[aria-label="删除元素"]')!.click()
  expect(element.isConnected).toBe(false)
  expect(document.body.isConnected).toBe(true)
})

it("copies the selected element in each requested format through a secondary menu", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
  const { element, root } = openActions()
  const labels = ["复制元素", "复制 outerHTML", "复制 selector", "复制 JS 路径", "复制样式", "复制 XPath", "复制完整 XPath"]
  const expected = [element.outerHTML, element.outerHTML, "#target", 'document.querySelector("#target")', "color:", '//*[@id="target"]', "/html[1]/body[1]/button[1]"]
  for (let i = 0; i < labels.length; i++) {
    root.querySelector<HTMLButtonElement>('.tools [aria-label="复制元素"]')!.click()
    expect(root.querySelector<HTMLElement>(".copy-menu")!.hidden).toBe(false)
    const button = Array.from(root.querySelectorAll<HTMLButtonElement>(".copy-menu button")).find(item => item.textContent === labels[i])!
    button.click()
    await Promise.resolve()
    expect(writeText.mock.calls.at(-1)![0]).toContain(expected[i])
    expect(root.querySelector<HTMLElement>(".copy-menu")!.hidden).toBe(true)
  }
})

it("clears the selected element and interceptors when closing operations", () => {
  const { root, element } = openActions()
  expect(root.querySelector(".tools .danger")?.getAttribute("aria-label")).toBe("删除元素")
  root.querySelector<HTMLButtonElement>('[aria-label="关闭元素操作"]')!.click()
  expect(document.getElementById("vessel-element-picker")).toBeNull()
  const click = new MouseEvent("click", { bubbles: true, cancelable: true })
  element.dispatchEvent(click)
  expect(click.defaultPrevented).toBe(false)
})

it("opens DevTools at the exact retained node when clicking a style value", async () => {
  const inspect = vi.fn()
  Object.defineProperty(window, "vesselInspectStyle", { configurable: true, value: inspect })
  const { root, element } = openActions()
  const group = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-source="user"] .style-group-trigger')).find(button => button.textContent?.includes("背景与颜色"))!
  group.click()
  await waitFor(() => expect(root.querySelector('[aria-label="在控制台中定位 color"]')).toBeTruthy())
  root.querySelector<HTMLButtonElement>('[aria-label="在控制台中定位 color"]')!.click()
  expect(inspect).toHaveBeenCalledWith({ property: "color", targetKey: expect.stringMatching(/^__vesselStyleTarget_/) })
  const key = inspect.mock.calls[0][0].targetKey
  expect((window as unknown as Record<string, unknown>)[key]).toBe(element)
  expect(document.getElementById("vessel-element-picker")).toBeNull()
  Reflect.deleteProperty(window, key)
  Reflect.deleteProperty(window, "vesselInspectStyle")
})

it("shows complete, safe JSON for the selected element and refreshes it when reopening the view", async () => {
  const { element, root } = openActions()
  element.setAttribute("data-example", '<img src=x onerror="alert(1)">')
  const toggle = root.querySelector<HTMLButtonElement>('[aria-label="JSON 视图"]')!
  toggle.click()
  await waitFor(() => expect(root.querySelector(".element-json")).toBeTruthy())
  const json = root.querySelector(".element-json")!
  const data = JSON.parse(json.textContent!)
  expect(data.element.tagName).toBe("button")
  expect(data.element.attributes.id).toBe("target")
  expect(data.element.attributes["data-example"]).toBe('<img src=x onerror="alert(1)">')
  expect(data.element.text).toBe("Example")
  expect(data.element.outerHTML).toBe(element.outerHTML)
  expect(data.element.bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  expect(data.userStyles.color).toBe("rgb(12, 34, 56)")
  expect(Object.keys(data.systemStyles).length).toBeGreaterThan(0)
  expect(json.querySelector("img")).toBeNull()
  expect(json.querySelector(".json-token-property")).toBeTruthy()
  expect(json.querySelector(".json-token-string")).toBeTruthy()
  expect(json.querySelector(".system-json .json-token-string")).toBeNull()
  toggle.click()
  await waitFor(() => expect(root.querySelector(".element-json")).toBeNull())
  element.style.color = "rgb(99, 88, 77)"
  toggle.click()
  await waitFor(() => expect(JSON.parse(root.querySelector(".element-json")!.textContent!).userStyles.color).toBe("rgb(99, 88, 77)"))
})
