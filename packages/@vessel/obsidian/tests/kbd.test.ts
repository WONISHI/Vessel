import { describe, expect, it } from "vitest"
import { isKeyboardShortcut, parseKeyboardShortcutParts, parseKeyboardShortcuts } from "../src/kbd/index"

describe("parseKeyboardShortcuts", () => {
  it("parses shift + Delete and Ctrl + D from screenshot examples", () => {
    const text = `• shift + Delete : 删除当前行\n• Ctrl + D : 复制当前行`
    const shortcuts = parseKeyboardShortcuts(text)

    expect(shortcuts).toHaveLength(2)

    expect(shortcuts[0].raw).toBe("shift + Delete")
    expect(shortcuts[0].keys).toEqual(["shift", "Delete"])
    expect(text.slice(shortcuts[0].start, shortcuts[0].end)).toBe("shift + Delete")

    expect(shortcuts[1].raw).toBe("Ctrl + D")
    expect(shortcuts[1].keys).toEqual(["Ctrl", "D"])
    expect(text.slice(shortcuts[1].start, shortcuts[1].end)).toBe("Ctrl + D")
  })

  it("parses Chinese key format: 按键1 + 按键2", () => {
    const text = "按键1 + 按键2 这种格式可以解析成Kbd"
    const shortcuts = parseKeyboardShortcuts(text)

    expect(shortcuts).toHaveLength(1)
    expect(shortcuts[0].raw).toBe("按键1 + 按键2")
    expect(shortcuts[0].keys).toEqual(["按键1", "按键2"])
    expect(text.slice(shortcuts[0].start, shortcuts[0].end)).toBe("按键1 + 按键2")
  })

  it("parses multiple modifier combinations like Ctrl + Shift + P", () => {
    const text = "按 Ctrl + Shift + P 打开命令面板"
    const shortcuts = parseKeyboardShortcuts(text)

    expect(shortcuts).toHaveLength(1)
    expect(shortcuts[0].raw).toBe("Ctrl + Shift + P")
    expect(shortcuts[0].keys).toEqual(["Ctrl", "Shift", "P"])
  })

  it("parses symbol modifiers like ⌘ + K", () => {
    const text = "使用 ⌘ + K 快速搜索"
    const shortcuts = parseKeyboardShortcuts(text)

    expect(shortcuts).toHaveLength(1)
    expect(shortcuts[0].raw).toBe("⌘ + K")
    expect(shortcuts[0].keys).toEqual(["⌘", "K"])
  })

  it("does not match arithmetic expressions like 1 + 2 = 3 or variable additions like a + b", () => {
    expect(parseKeyboardShortcuts("1 + 2 = 3")).toHaveLength(0)
    expect(parseKeyboardShortcuts("a + b = c")).toHaveLength(0)
    expect(parseKeyboardShortcuts("width + height")).toHaveLength(0)
  })

  it("does not match when plus lacks spaces, e.g. a+b or C++", () => {
    expect(parseKeyboardShortcuts("Ctrl+D")).toHaveLength(0)
    expect(parseKeyboardShortcuts("C++")).toHaveLength(0)
  })

  it("excludes shortcuts inside code blocks and inline code", () => {
    const markdown = "```bash\nshift + Delete\n```\n这里有 `Ctrl + D` 和真正的 shift + Delete 快捷键"
    const shortcuts = parseKeyboardShortcuts(markdown)

    expect(shortcuts).toHaveLength(1)
    expect(shortcuts[0].raw).toBe("shift + Delete")
  })

  it("isKeyboardShortcut checks full string", () => {
    expect(isKeyboardShortcut("shift + Delete")).toBe(true)
    expect(isKeyboardShortcut("Ctrl + D")).toBe(true)
    expect(isKeyboardShortcut("按键1 + 按键2")).toBe(true)
    expect(isKeyboardShortcut("1 + 2")).toBe(false)
    expect(isKeyboardShortcut("shift + Delete : 说明")).toBe(false)
  })

  it("parseKeyboardShortcutParts splits string correctly", () => {
    const text = "• shift + Delete : 删除"
    const parts = parseKeyboardShortcutParts(text)

    expect(parts).toEqual([
      { kind: "text", text: "• " },
      { kind: "shortcut", text: "shift + Delete", keys: ["shift", "Delete"] },
      { kind: "text", text: " : 删除" }
    ])
  })
})
