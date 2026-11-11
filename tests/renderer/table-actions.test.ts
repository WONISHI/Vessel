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
