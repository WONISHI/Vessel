import React from "react"
import { render, waitFor, cleanup } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({ mount: undefined as any }))
vi.mock("@/components/core/canvas/variants/code/monaco", () => ({}))
vi.mock("@/components/core/canvas/variants/code/theme", () => ({ registerMonacoTheme: vi.fn() }))
vi.mock("@/hooks/use-dark-appearance", () => ({ useDarkAppearance: () => false }))
vi.mock("@monaco-editor/react", () => ({ default: ({ onMount }: any) => { mock.mount = onMount; return <div data-testid="source-editor" /> } }))
import BrowserSourceDialog from "@/pages/browser/components/browser-page/browser-source-dialog"
afterEach(cleanup)
it("leaves the activity bar uncovered and waits for HTML formatting before locking the editor", async () => {
  const result = render(<BrowserSourceDialog source={{ url: "https://example.com", text: "<html><body>hello</body></html>" }} onClose={() => {}} />)
  expect(document.querySelector('[data-browser-source-overlay]')?.className).toContain("left-[52px]")
  expect(result.getByText("https://example.com").className).toContain("text-[10px]")
  const action = { isSupported: vi.fn().mockReturnValueOnce(false).mockReturnValue(true), run: vi.fn().mockResolvedValue(undefined) }
  const model = { isDisposed: () => false }
  const editor = { getModel: () => model, getAction: () => action, setScrollTop: vi.fn(), updateOptions: vi.fn() }
  mock.mount(editor)
  expect(editor.updateOptions).not.toHaveBeenCalled()
  await waitFor(() => expect(editor.updateOptions).toHaveBeenCalledWith({ readOnly: true }))
  expect(action.run).toHaveBeenCalledOnce()
  expect(action.run.mock.invocationCallOrder[0]).toBeLessThan(editor.updateOptions.mock.invocationCallOrder[0])
  expect(result.queryByRole("status")).toBeNull()
})
