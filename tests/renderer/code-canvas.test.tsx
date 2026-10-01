import React from "react"
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
vi.mock("../../src/renderer/src/components/core/canvas/variants/code/monaco", () => ({ monaco: { Uri: { file: (path: string) => ({ toString: () => path }) } } }))
vi.mock("@monaco-editor/react", () => ({ default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <textarea aria-label="code" value={value} onChange={event => onChange(event.target.value)} /> }))
import CodeCanvas from "../../src/renderer/src/components/core/canvas/variants/code"
import { codeLanguage } from "../../src/renderer/src/components/core/canvas/variants/code/language"
afterEach(cleanup)
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
