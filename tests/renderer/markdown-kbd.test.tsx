import { describe, expect, it } from "vitest"
import { decorateKeyboardShortcuts } from "@/components/core/canvas/variants/markdown/decorate-kbd"
import { renderTaggedText } from "@/components/core/canvas/variants/markdown/markdown-document/components/render-tagged-text"
import { render, screen } from "@testing-library/react"

describe("decorateKeyboardShortcuts", () => {
  it("decorates shift + Delete and Ctrl + D into Kbd components", () => {
    const root = document.createElement("div")
    root.innerHTML = "<p>• shift + Delete : 删除当前行</p><p>• Ctrl + D : 复制当前行</p><pre><code>shift + Delete</code></pre>"
    const before = root.textContent

    decorateKeyboardShortcuts(root)

    // Should create 2 kbd groups
    const groups = root.querySelectorAll('[data-slot="kbd-group"]')
    expect(groups).toHaveLength(2)

    // Shift + Delete has 2 kbd elements
    const kbds = root.querySelectorAll('kbd[data-slot="kbd"]')
    expect(kbds).toHaveLength(4)
    expect(kbds[0].textContent).toBe("shift")
    expect(kbds[1].textContent).toBe("Delete")
    expect(kbds[2].textContent).toBe("Ctrl")
    expect(kbds[3].textContent).toBe("D")

    // Retains source text content without distortion
    expect(root.textContent).toBe(before)

    // Does not touch code block
    expect(root.querySelector("code [data-slot='kbd-group']")).toBeNull()
  })

  it("decorates Chinese key shortcuts like 按键1 + 按键2", () => {
    const root = document.createElement("div")
    root.innerHTML = "<p>按键1 + 按键2 这种格式可以解析</p>"

    decorateKeyboardShortcuts(root)

    const kbds = root.querySelectorAll('kbd[data-slot="kbd"]')
    expect(kbds).toHaveLength(2)
    expect(kbds[0].textContent).toBe("按键1")
    expect(kbds[1].textContent).toBe("按键2")
  })
})

describe("renderTaggedText with Kbd", () => {
  it("renders keyboard shortcuts with Kbd components in React", () => {
    const { container } = render(<div>{renderTaggedText("• shift + Delete : 删除当前行")}</div>)

    expect(container.querySelectorAll('[data-slot="kbd-group"]')).toHaveLength(1)
    const kbds = container.querySelectorAll('kbd[data-slot="kbd"]')
    expect(kbds).toHaveLength(2)
    expect(kbds[0].textContent).toBe("shift")
    expect(kbds[1].textContent).toBe("Delete")
  })
})
