import { expect, it } from "vitest"
import { commandShortcutIds, matchesShortcut, shortcutLabel, shortcuts } from "@vessel/utils"

it("registers every palette command with unique keys for renderer and Electron input", () => {
  const labels = commandShortcutIds.map((id) => shortcutLabel(id, false))
  expect(new Set(labels).size).toBe(commandShortcutIds.length)
  for (const id of commandShortcutIds) {
    const item = shortcuts[id]
    expect(matchesShortcut({ key: item.key, control: true, shift: id !== "command" }, id)).toBe(true)
    expect(matchesShortcut({ key: item.key, metaKey: true, shiftKey: id !== "command" }, id)).toBe(true)
    expect(item.scope).toBe("全局")
  }
})
