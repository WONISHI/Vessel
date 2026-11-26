import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { editorThemes, resolveEditorTheme } from "@/features/editor-appearance/themes"
import { setEditorAppearance, useEditorAppearance } from "@/features/editor-appearance/state"
import { registerMonacoTheme } from "@/components/core/canvas/variants/code/theme"
afterEach(() => { cleanup(); setEditorAppearance({}) })
it("resolves automatic colors and keeps an explicit palette independent of the interface", () => {
 expect(resolveEditorTheme("system", false)).toBe("light")
 expect(resolveEditorTheme(undefined, true)).toBe("vessel-dark")
 for (const theme of editorThemes.filter(theme => theme.value !== "system")) {
  expect(resolveEditorTheme(theme.value, false)).toBe(theme.value)
  expect(resolveEditorTheme(theme.value, true)).toBe(theme.value)
 }
})
it("registers all custom palettes before use", () => {
 const defineTheme = vi.fn()
 registerMonacoTheme({ editor: { defineTheme } } as any)
 expect(defineTheme.mock.calls.map(([name]) => name)).toEqual(["vessel-dark", "vessel-github-light", "vessel-nord-light", "vessel-nord"])
})
it("updates mounted editors when only the selected theme changes", () => {
 function Editor() { return <span>{useEditorAppearance().theme}</span> }
 render(<Editor />)
 expect(screen.getByText("system")).toBeTruthy()
 act(() => setEditorAppearance({ editorTheme: "vessel-nord" }))
 expect(screen.getByText("vessel-nord")).toBeTruthy()
})
