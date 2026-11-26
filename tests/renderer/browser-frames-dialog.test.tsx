import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import BrowserFramesDialog from "@/pages/browser/components/browser-page/browser-frames-dialog"
import { FRAME_SCAN_SCRIPT } from "../../src/main/browser/browser-frames"

afterEach(() => { cleanup(); vi.restoreAllMocks() })
const item = { id: "1:0", documentURL: "https://example.test/", depth: 0, src: "/child", resolvedSrc: "https://example.test/child", name: "child", title: "嵌入页面", elementId: "frame", sandbox: "", srcdoc: false }
it("shows frame count and details, copies original src and opens a Vessel browser tab", async () => {
  const listBrowserFrames = vi.fn().mockResolvedValue({ pageURL: "https://example.test/", total: 1, items: [item], unreadableDocuments: 0, truncated: false })
  window.electronAPI = { listBrowserFrames } as any
  const copy = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } })
  const open = vi.fn()
  window.addEventListener("vessel-browser-tab-action", open)
  try {
    render(<BrowserFramesDialog guestId={7} pageURL="https://example.test/" onClose={vi.fn()}/>)
    await waitFor(() => expect(screen.getByText("1 个 iframe")).toBeTruthy())
    fireEvent.click(screen.getByRole("button", { name: "复制 src" }))
    await waitFor(() => expect(copy).toHaveBeenCalledWith("/child"))
    fireEvent.click(screen.getByRole("button", { name: "复制解析后地址" }))
    await waitFor(() => expect(copy).toHaveBeenCalledWith(item.resolvedSrc))
    fireEvent.click(screen.getByRole("button", { name: "复制所属页面地址" }))
    await waitFor(() => expect(copy).toHaveBeenCalledWith(item.documentURL))
    fireEvent.click(screen.getByRole("button", { name: "新标签页查看" }))
    expect(open.mock.calls[0][0].detail).toMatchObject({ action: "new", url: item.resolvedSrc })
    fireEvent.click(screen.getByRole("button", { name: "复制全部信息" }))
    await waitFor(() => expect(copy).toHaveBeenCalledWith(expect.stringContaining("所属页面: https://example.test/")))
  } finally { window.removeEventListener("vessel-browser-tab-action", open) }
})
it("does not offer standalone opening for srcdoc or script URLs", async () => {
  window.electronAPI = { listBrowserFrames: vi.fn().mockResolvedValue({ total: 1, items: [{ ...item, srcdoc: true, src: "", resolvedSrc: "about:blank" }], unreadableDocuments: 0 }) } as any
  render(<BrowserFramesDialog guestId={7} pageURL="https://example.test/" onClose={vi.fn()}/>)
  await waitFor(() => expect(screen.getByText("1 个 iframe")).toBeTruthy())
  expect(screen.getByRole("button", { name: "复制 src" }).hasAttribute("disabled")).toBe(true)
  expect(screen.getByRole("button", { name: "新标签页查看" }).hasAttribute("disabled")).toBe(true)
})
it("reads iframe attributes from the DOM including open shadow roots without inserting page HTML", () => {
  document.body.innerHTML = '<iframe src="/relative" name="frame"></iframe><div id="shadow"></div>'
  const shadow = document.getElementById("shadow")!.attachShadow({ mode: "open" })
  shadow.innerHTML = '<iframe srcdoc="&lt;p&gt;Hello&lt;/p&gt;"></iframe>'
  const result = window.eval(FRAME_SCAN_SCRIPT)
  expect(result.total).toBe(2)
  expect(result.items[0]).toMatchObject({ src: "/relative", name: "frame", srcdoc: false })
  expect(result.items[1].srcdoc).toBe(true)
  document.body.innerHTML = ""
})
