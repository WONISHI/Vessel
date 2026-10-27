import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useEffect } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import PdfExportDialog from "@/components/pdf-export/pdf-export-dialog"
import { markdownDocuments } from "@/components/native-file-menu/document-bridge"

vi.mock("@/components/core/canvas/variants/markdown/vditor-editor", () => ({
  VditorEditor: ({ value, onReady }: { value: string; onReady?: () => void }) => {
    useEffect(() => {
      onReady?.()
    }, [])
    return (
      <div className="vditor-ir">
        <div className="vditor-reset">
          <h1>{value}</h1>
        </div>
      </div>
    )
  }
}))
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  markdownDocuments.clear()
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView")
})

it("uses the current draft, confirms landscape settings and submits a PDF export", async () => {
  const fileMenuDialog = vi.fn().mockResolvedValue("/vault/note.pdf")
  const readContent = vi.fn()
  vi.stubGlobal("electronAPI", { fileMenuDialog, readContent })
  markdownDocuments.set("/vault/note.md", { content: () => "未保存的草稿", html: () => "" })
  const close = vi.fn()
  render(
    <PdfExportDialog
      path="/vault/note.md"
      root="/vault"
      onClose={close}
    />
  )
  const button = await screen.findByRole("button", { name: "导出 PDF" })
  expect(readContent).not.toHaveBeenCalled()
  expect(fileMenuDialog).not.toHaveBeenCalled()
  fireEvent.keyDown(screen.getByRole("combobox", { name: "页面方向" }), { key: " " })
  fireEvent.click(await screen.findByRole("option", { name: "横向" }))
  fireEvent.change(screen.getByLabelText("页边距"), { target: { value: "20" } })
  fireEvent.click(screen.getByLabelText("显示页码"))
  fireEvent.click(button)
  await waitFor(() => expect(fileMenuDialog).toHaveBeenCalledWith(expect.objectContaining({ action: "pdf", defaultPath: "/vault/note.pdf", pdfOptions: expect.objectContaining({ landscape: true, marginMm: 20, pageNumbers: true }), html: expect.stringContaining("未保存的草稿") })))
  expect(close).toHaveBeenCalled()
})
it("reads unopened Markdown and cancellation does not write a PDF", async () => {
  const fileMenuDialog = vi.fn()
  vi.stubGlobal("electronAPI", { readContent: vi.fn().mockResolvedValue("磁盘文档"), fileMenuDialog })
  const close = vi.fn()
  render(
    <PdfExportDialog
      path="/vault/closed.md"
      root="/vault"
      onClose={close}
    />
  )
  await screen.findByRole("button", { name: "导出 PDF" })
  expect(screen.getByText("磁盘文档")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "取消" }))
  expect(close).toHaveBeenCalled()
  expect(fileMenuDialog).not.toHaveBeenCalled()
})
