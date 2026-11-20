import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { mobilePageURL } from "@/pages/browser/mobile-page-url"
import BrowserMobileDialog from "@/pages/browser/components/browser-page/browser-mobile-dialog"
import { BrowserContextMenu } from "@/pages/browser/components/browser-page/browser-context-menu"
import type { BrowserPageModel } from "@/pages/browser/components/browser-page/hooks/use-browser-page"

beforeEach(() => { vi.stubGlobal("electronAPI", { sourceProjectStatus: vi.fn(async () => null) }) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it.each(["http://localhost:9525/a", "http://LOCALHOST.:9525", "http://foo.localhost/", "http://127.0.0.1/a", "http://127.5.6.7/", "http://127.1/", "http://2130706433/", "http://0.0.0.0/", "http://[::1]:5173/", "http://[::ffff:127.0.0.1]/", "file:///tmp/a.html", "about:blank", "invalid"])("does not offer mobile access for %s", value => {
  expect(mobilePageURL(value)).toBeUndefined()
})
it("preserves full web URLs and permits LAN addresses usable by another device", () => {
  expect(mobilePageURL("https://example.com/a?q=hello%20world#part")).toBe("https://example.com/a?q=hello%20world#part")
  expect(mobilePageURL("http://192.168.1.10:9525/a")).toBe("http://192.168.1.10:9525/a")
  expect(mobilePageURL("https://localhost.example.com/")).toBe("https://localhost.example.com/")
})
it("renders a scannable SVG in the common dialog with an activity-bar-safe overlay", () => {
  const close = vi.fn()
  render(<BrowserMobileDialog url="https://example.com/page?q=1#section" onClose={close} />)
  expect(screen.getByText("手机访问")).toBeTruthy()
  const title = screen.getByText("当前网页访问二维码")
  expect(title.closest("svg")?.querySelectorAll("path").length).toBeGreaterThan(0)
  const overlay = document.querySelector("[data-browser-mobile-overlay]")!
  expect((overlay as HTMLElement).style.left).toBe("52px")
  expect((overlay as HTMLElement).style.bottom).toBe("32px")
  fireEvent.click(screen.getByRole("button", { name: "Close" }))
  expect(close).toHaveBeenCalledOnce()
})
it("handles oversized URLs without crashing the browser", () => {
  render(<BrowserMobileDialog url={`https://example.com/?q=${"x".repeat(4000)}`} onClose={() => {}} />)
  expect(screen.getByRole("alert").textContent).toContain("地址过长")
})
it("opens the QR dialog from the web context menu and hides the item on localhost", async () => {
  const model = (url: string) => ({ tab: { id: "tab1", url }, views: { current: new Map() }, reloadTab: vi.fn(), inspectPage: vi.fn() }) as unknown as BrowserPageModel
  const view = render(<BrowserContextMenu b={model("https://example.com/page")} visible />)
  const show = () => window.dispatchEvent(new CustomEvent("vessel-browser-context-menu", { detail: { tabId: "tab1", guestId: 1, x: 1, y: 1, left: 100, top: 100 } }))
  act(show)
  fireEvent.click(await screen.findByRole("menuitem", { name: "手机访问…" }))
  await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy())
  expect(screen.getByText("https://example.com/page")).toBeTruthy()
  view.rerender(<BrowserContextMenu b={model("http://localhost:9525/")} visible />)
  act(show)
  expect(screen.queryByRole("menuitem", { name: "手机访问…" })).toBeNull()
  expect(screen.queryByRole("dialog")).toBeNull()
})

it("opens on the first selection repeatedly and survives focus returning to the page", async () => {
  const b = { tab: { id: "tab1", url: "https://example.com/first" }, views: { current: new Map() }, reloadTab: vi.fn(), inspectPage: vi.fn() } as unknown as BrowserPageModel
  render(<><button>活动栏</button><BrowserContextMenu b={b} visible /></>)
  for (let attempt = 0; attempt < 3; attempt++) {
    act(() => { window.dispatchEvent(new CustomEvent("vessel-browser-context-menu", { detail: { tabId: "tab1", guestId: 1, x: 1, y: 1, left: 100, top: 100 } })) })
    const item = await screen.findByRole("menuitem", { name: "手机访问…" })
    if (attempt === 1) fireEvent.keyDown(item, { key: "Enter" })
    else { fireEvent.pointerDown(item, { button: 0, pointerType: "mouse" }); fireEvent.pointerUp(item, { button: 0, pointerType: "mouse" }); fireEvent.click(item) }
    await screen.findByRole("dialog")
    expect(screen.queryByRole("menu")).toBeNull()
    act(() => { screen.getByRole("button", { name: "活动栏" }).focus() })
    expect(screen.getByRole("dialog")).toBeTruthy()
    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  }
})
