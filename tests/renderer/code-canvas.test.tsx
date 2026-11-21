import { act, fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
vi.mock("@/components/core/canvas/variants/code/monaco", () => ({ monaco: { Uri: { file: (path: string) => ({ toString: () => path }) } } }))
vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: { fontSize: number; fontFamily: string } }) => (
    <textarea
      aria-label="code"
      style={{ fontSize: options.fontSize, fontFamily: options.fontFamily }}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}))
import { setEditorAppearance } from "@/features/editor-appearance/state"
import CodeCanvas from "@/components/core/canvas/variants/code/index"
import { codeLanguage } from "@/components/core/canvas/variants/code/language"
afterEach(() => { cleanup(); setEditorAppearance({}) })
it("loads exact source and saves edits to the selected file", async () => {
  const save = vi.fn().mockResolvedValue(undefined)
  window.electronAPI = { readContent: vi.fn().mockResolvedValue("const x = 1\n"), saveContent: save } as unknown as Window["electronAPI"]
  render(<CodeCanvas activeFilePath="/repo/a.ts" />)
  const input = await screen.findByRole("textbox")
  expect(save).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { value: "const x = 2\n" } })
  await waitFor(() => expect(save).toHaveBeenCalledWith("/repo/a.ts", "const x = 2\n"))
  expect(await screen.findByText("已保存")).toBeTruthy()
})
it("detects code types without routing binaries into the editor", () => {
  expect(codeLanguage("C:\\repo\\app.TSX")).toBe("typescript")
  expect(codeLanguage("/repo/.env.local")).toBe("plaintext")
  expect(codeLanguage("/repo/Dockerfile")).toBe("dockerfile")
  expect(codeLanguage("/repo/image.png")).toBeUndefined()
})

it("updates mounted code typography without reloading or saving the document", async () => {
  const read = vi.fn().mockResolvedValue("const typography = true\n")
  const save = vi.fn().mockResolvedValue(undefined)
  window.electronAPI = { readContent: read, saveContent: save } as any
  render(<CodeCanvas activeFilePath="/repo/editor-font-test.ts" />)
  const editor = await screen.findByRole("textbox", { name: "code" }) as HTMLTextAreaElement
  await waitFor(() => expect(editor.value).toContain("const typography"))
  act(() => setEditorAppearance({ editorFont: "Fira Code", editorFontSize: 21 }))
  expect(editor.style.fontSize).toBe("21px")
  expect(editor.style.fontFamily).toContain("Fira Code")
  expect(editor.value).toBe("const typography = true\n")
  expect(read).toHaveBeenCalledTimes(1)
  expect(save).not.toHaveBeenCalled()
})
