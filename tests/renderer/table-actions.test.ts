import { afterEach, expect, it, vi } from "vitest"
import { bindTableActions } from "@/components/core/canvas/variants/markdown/table-actions"
afterEach(() => document.body.replaceChildren())
it("uses the ordinary table menu only outside advanced table components", () => {
  const root = document.createElement("div")
  root.innerHTML = '<div class="vditor-ir"><div contenteditable="true"><table id="plain"><tbody><tr><td>普通</td></tr></tbody></table><div class="vessel-table-container" contenteditable="false"><div class="vessel-markdown-table-wrapper"><table id="advanced"><tbody><tr><td>高级</td></tr></tbody></table></div></div></div></div>'
  document.body.append(root)
  const stop = bindTableActions(root, vi.fn())
  try {
    const native = new MouseEvent("contextmenu", { bubbles: true, cancelable: true })
    root.querySelector("#plain td")!.dispatchEvent(native)
    expect(native.defaultPrevented).toBe(true)
    const menu = document.querySelector<HTMLElement>(".vessel-table-menu")!
    expect(menu.hidden).toBe(false)
    expect(menu.textContent).toContain("转换为高级表格")
    const ownMenu = vi.fn()
    root.querySelector("#advanced td")!.addEventListener("contextmenu", ownMenu)
    const embedded = new MouseEvent("contextmenu", { bubbles: true, cancelable: true })
    root.querySelector("#advanced td")!.dispatchEvent(embedded)
    expect(menu.hidden).toBe(true)
    expect(ownMenu).toHaveBeenCalledOnce()
    expect(embedded.defaultPrevented).toBe(false)
  } finally { stop() }
})

it("offers formatted paste and expands the table from the context cell in one undoable edit", async () => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = '<table><tbody><tr><td>keep</td><td>old</td></tr></tbody></table>'
  document.body.append(root)
  const readText = vi.fn().mockResolvedValue("Alpha   12\nBeta\t34")
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { readText } })
  const command = vi.fn()
  Object.defineProperty(document, "execCommand", { configurable: true, value: command })
  const stop = bindTableActions(root)
  try {
    root.querySelectorAll("td")[1].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }))
    Array.from(document.querySelectorAll<HTMLButtonElement>(".vessel-table-menu button")).find(button => button.textContent === "格式化粘贴")!.click()
    await vi.waitFor(() => expect(command).toHaveBeenCalledOnce())
    const replacement = new DOMParser().parseFromString(command.mock.calls[0][2], "text/html").querySelector("table")!
    expect(Array.from(replacement.rows, row => Array.from(row.cells, cell => cell.textContent))).toEqual([["keep", "Alpha", "12"], ["", "Beta", "34"]])
  } finally { stop() }
})

it("closes on other-cell clicks even when the editor intercepts pointer events", () => {
  const root = document.createElement("div")
  root.innerHTML = '<table><tbody><tr><td>first</td><td>second</td></tr></tbody></table>'
  document.body.append(root)
  const block = (event: Event) => event.stopImmediatePropagation()
  document.addEventListener("pointerdown", block, true)
  const stop = bindTableActions(root)
  try {
    const cells = root.querySelectorAll("td")
    const open = () => cells[0].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }))
    const menu = document.querySelector<HTMLElement>(".vessel-table-menu")!
    open()
    expect(menu.hidden).toBe(false)
    cells[1].dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }))
    expect(menu.hidden).toBe(true)
    open()
    cells[1].click()
    expect(menu.hidden).toBe(true)
    open()
    menu.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }))
    expect(menu.hidden).toBe(false)
  } finally { stop(); document.removeEventListener("pointerdown", block, true) }
})
