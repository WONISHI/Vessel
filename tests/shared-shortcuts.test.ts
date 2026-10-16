import { expect, it } from "vitest"
import { matchesShortcut, shortcutLabel, markdownHotkey } from "@vessel/utils"
it("matches renderer and Electron events from the same definition", () => {
  expect(matchesShortcut({ key: "p", metaKey: true }, "command")).toBe(true)
  expect(matchesShortcut({ key: "P", control: true }, "command")).toBe(true)
  expect(matchesShortcut({ key: "p", control: true, shift: true }, "command")).toBe(false)
  expect(matchesShortcut({ key: "F12" }, "devtools")).toBe(true)
  expect(matchesShortcut({ key: "l", metaKey: true }, "previousTab")).toBe(false)
  expect(matchesShortcut({ key: "l", ctrlKey: true }, "previousTab")).toBe(true)
  expect(matchesShortcut({ key: "f", ctrlKey: true, isComposing: true }, "find")).toBe(false)
})
it("uses the same keys for settings and Markdown toolbar bindings", () => {
  expect(shortcutLabel("command", true)).toBe("⌘ + P")
  expect(shortcutLabel("command", false)).toBe("Ctrl + P")
  expect(markdownHotkey("bold")).toBe("⌘B")
  expect(markdownHotkey("line")).toBe("⇧⌘H")
})
