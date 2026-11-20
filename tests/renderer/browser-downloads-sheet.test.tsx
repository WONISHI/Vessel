import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { DownloadsSheet } from "@/pages/browser/components/downloads-sheet"
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it("lists recorded downloads and previews supported files in a browser tab", async () => {
  const entries = [{ id: 1, name: "photo.png", path: "/tmp/photo.png", size: 2048, savedAt: 100, source: "download" }, { id: 2, name: "archive.zip", path: "/tmp/archive.zip", size: 10, savedAt: 100, source: "download" }]
  let refresh!: () => void
  const preview = vi.fn().mockResolvedValue("file:///tmp/photo.png"), reveal = vi.fn().mockResolvedValue(undefined), off = vi.fn()
  vi.stubGlobal("electronAPI", { listBrowserDownloads: vi.fn().mockResolvedValue(entries), onBrowserDownloadsUpdated: (callback: () => void) => { refresh = callback; return off }, previewBrowserDownload: preview, revealBrowserDownload: reveal })
  const action = vi.fn(), close = vi.fn()
  window.addEventListener("vessel-browser-tab-action", action)
  try {
    const view = render(<DownloadsSheet open onOpenChange={close} />)
    const image = await screen.findByRole("button", { name: /photo.png.*2.0 KB/ })
    expect((screen.getByRole("button", { name: /archive.zip.*不支持预览/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(image)
    await waitFor(() => expect(preview).toHaveBeenCalledWith(1))
    await waitFor(() => expect(action).toHaveBeenCalledOnce())
    expect(action.mock.calls[0][0].detail).toMatchObject({ action: "new", url: "file:///tmp/photo.png" })
    expect(close).toHaveBeenCalledWith(false)
    fireEvent.click(screen.getByRole("button", { name: "在文件管理器中显示 archive.zip" }))
    expect(reveal).toHaveBeenCalledWith(2)
    act(refresh)
    await waitFor(() => expect(window.electronAPI.listBrowserDownloads).toHaveBeenCalledTimes(2))
    fireEvent.change(screen.getByLabelText("搜索下载历史"), { target: { value: "missing" } })
    expect(screen.getByText("没有匹配的文件")).toBeTruthy()
    view.unmount()
    expect(off).toHaveBeenCalledOnce()
  } finally { window.removeEventListener("vessel-browser-tab-action", action) }
})

it("opens download history from the browser More menu", async () => {
  vi.stubGlobal("electronAPI", { listBrowserDownloads: vi.fn().mockResolvedValue([]), onBrowserDownloadsUpdated: () => () => {} })
  const { BrowserMore } = await import("@/pages/browser/components/tools/components/browser-more")
  render(<BrowserMore zoom={vi.fn()} zoomFactor={1} onFind={vi.fn()} onNavigate={vi.fn()} guest={() => undefined} deviceMode={false} onDevice={vi.fn()} bookmarksVisible onToggleBookmarks={vi.fn()} />)
  fireEvent.keyDown(screen.getByRole("button", { name: "浏览器更多" }), { key: "Enter" })
  fireEvent.click(await screen.findByRole("menuitem", { name: "下载历史" }))
  expect(await screen.findByRole("dialog", { name: "下载历史" })).toBeTruthy()
  expect(await screen.findByText("暂无下载历史")).toBeTruthy()
})
