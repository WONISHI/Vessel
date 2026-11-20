import { act, cleanup, render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import type { BrowserSavedFile } from "@vessel/type"
const mocks = vi.hoisted(() => ({ success: vi.fn(), router: { push: vi.fn() } }))
vi.mock("@/components/ui/sonner", () => ({ toast: { success: mocks.success } }))
vi.mock("@vessel/react-router", () => ({ useRouter: () => mocks.router }))
import { BrowserSaveNotifications } from "@/pages/browser/components/browser-save-notifications"

afterEach(() => { cleanup(); sessionStorage.clear() })
function fixture() {
  let notify: (file: BrowserSavedFile) => void
  const off = vi.fn()
  window.electronAPI = { onBrowserFileSaved: (callback: typeof notify) => { notify = callback; return off } } as any
  const result = render(<BrowserSaveNotifications />)
  return { notify: (file: BrowserSavedFile) => act(() => notify(file)), off, result }
}

it("offers preview at bottom-right after success and opens a new browser tab only when chosen", () => {
  const { notify, off, result } = fixture()
  const file = { name: "预览.png", url: "file:///tmp/%E9%A2%84%E8%A7%88.png", source: "download" as const }
  notify(file)
  expect(mocks.success).toHaveBeenCalledWith("文件下载成功", expect.objectContaining({ description: file.name, position: "bottom-right" }))
  expect(mocks.router.push).not.toHaveBeenCalled()
  const options = mocks.success.mock.calls[0][1]
  options.action.onClick()
  expect(sessionStorage.getItem("vessel-browser-pending-url")).toBe(file.url)
  expect(mocks.router.push).toHaveBeenCalledExactlyOnceWith("/browser")
  result.unmount()
  expect(off).toHaveBeenCalledOnce()
})

it.each(["archive.zip", "program.exe", "sheet.xlsx", "report.docx", "unknown.bin", "notes.md", "png", "file.constructor", "file.__proto__"])("does not show Sonner for unsupported browser preview: %s", name => {
  fixture().notify({ name, url: "file:///tmp/" + name, source: "download" })
  expect(mocks.success).not.toHaveBeenCalled()
})

it("checks native media support and uses the save-success message for saved files", () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("")
  const { notify } = fixture()
  notify({ name: "video.mov", url: "file:///tmp/video.mov", source: "download" })
  expect(mocks.success).not.toHaveBeenCalled()
  expect(play).toHaveBeenCalledWith("video/quicktime")
  play.mockReturnValue("probably")
  notify({ name: "video.webm", url: "file:///tmp/video.webm", source: "save" })
  expect(mocks.success).toHaveBeenCalledWith("文件保存成功", expect.objectContaining({ action: expect.objectContaining({ label: "预览" }), cancel: expect.objectContaining({ label: "暂不" }) }))
})
