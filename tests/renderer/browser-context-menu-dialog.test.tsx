import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
vi.mock("@/pages/browser/components/browser-page/browser-source-dialog", () => ({ default: ({ onClose }: any) => <div role="dialog">网页源码<button onClick={onClose}>关闭源码</button></div> }))
import { BrowserContextMenu } from "@/pages/browser/components/browser-page/browser-context-menu"

afterEach(cleanup)
it("opens source on the first selection and keeps the closing menu anchored away from the top-left", async () => {
  const browserPageAction = vi.fn().mockResolvedValue("<html><body>hello</body></html>")
  window.electronAPI = { browserPageAction } as any
  const b = { tab: { id: "tab", url: "https://example.com", back: false, forward: false }, views: { current: new Map() } } as any
  const result = render(<BrowserContextMenu b={b} visible />)
  const openMenu = () => act(() => { window.dispatchEvent(new CustomEvent("vessel-browser-context-menu", { detail: { tabId: "tab", guestId: 7, x: 100, y: 150, left: 400, top: 300 } })) })
  openMenu()
  fireEvent.click(result.getByRole("menuitem", { name: "显示网页源代码" }))
  await waitFor(() => expect(result.getByRole("dialog")).toBeTruthy())
  expect(browserPageAction).toHaveBeenCalledOnce()
  const anchor = document.querySelector<HTMLElement>("[data-browser-context-anchor]")!
  expect(anchor.style.left).toBe("400px")
  expect(anchor.style.top).toBe("300px")
  expect(result.queryByRole("menu")).toBeNull()
  fireEvent.click(result.getByText("关闭源码"))
  openMenu()
  fireEvent.click(result.getByRole("menuitem", { name: "显示网页源代码" }))
  await waitFor(() => expect(result.getByRole("dialog")).toBeTruthy())
  expect(browserPageAction).toHaveBeenCalledTimes(2)
  expect(anchor.style.left).toBe("400px")
})

it.each(["https://example.com/page?q=1#section", "file:///tmp/%E6%96%87%E6%A1%A3.html"])("confirms opening the current page externally from the context menu: %s", async (url) => {
  const openExternal = vi.fn().mockResolvedValue(undefined)
  window.electronAPI = { openExternal } as any
  const b = { tab: { id: "tab", url }, views: { current: new Map() } } as any
  const result = render(<BrowserContextMenu b={b} visible />)
  act(() => { window.dispatchEvent(new CustomEvent("vessel-browser-context-menu", { detail: { tabId: "tab", guestId: 7, x: 100, y: 150, left: 400, top: 300 } })) })
  fireEvent.click(result.getByRole("menuitem", { name: "在默认浏览器中打开" }))
  await waitFor(() => expect(result.getByRole("dialog")).toBeTruthy())
  expect(result.queryByRole("menu")).toBeNull()
  expect(openExternal).not.toHaveBeenCalled()
  fireEvent.click(result.getByRole("button", { name: "打开", exact: true }))
  await waitFor(() => expect(openExternal).toHaveBeenCalledExactlyOnceWith(url))
  await waitFor(() => expect(result.queryByRole("dialog")).toBeNull())
})

it("shows an external-opening failure and allows retrying", async () => {
  const openExternal = vi.fn().mockRejectedValueOnce(new Error("无法打开浏览器")).mockResolvedValue(undefined)
  window.electronAPI = { openExternal } as any
  const b = { tab: { id: "tab", url: "https://example.com/page" }, views: { current: new Map() } } as any
  const result = render(<BrowserContextMenu b={b} visible />)
  act(() => { window.dispatchEvent(new CustomEvent("vessel-browser-context-menu", { detail: { tabId: "tab", guestId: 7, x: 100, y: 150, left: 400, top: 300 } })) })
  fireEvent.click(result.getByRole("menuitem", { name: "在默认浏览器中打开" }))
  fireEvent.click(await result.findByRole("button", { name: "打开", exact: true }))
  await waitFor(() => expect(result.getByRole("alert").textContent).toContain("无法打开浏览器"))
  fireEvent.click(result.getByRole("button", { name: "打开", exact: true }))
  await waitFor(() => expect(result.queryByRole("dialog")).toBeNull())
  expect(openExternal).toHaveBeenCalledTimes(2)
})

it("reveals a local page in the file manager and hides the action for web pages", async () => {
  const browserPageAction = vi.fn().mockResolvedValue(undefined)
  window.electronAPI = { browserPageAction } as any
  const model = (url: string) => ({ tab: { id: "tab", url }, views: { current: new Map() } }) as any
  const result = render(<BrowserContextMenu b={model("file:///tmp/%E6%96%87%E6%A1%A3%20preview.html#part")} visible />)
  const openMenu = () => act(() => { window.dispatchEvent(new CustomEvent("vessel-browser-context-menu", { detail: { tabId: "tab", guestId: 7, x: 100, y: 150, left: 400, top: 300 } })) })
  openMenu()
  fireEvent.click(result.getByRole("menuitem", { name: "在资源管理器中显示" }))
  await waitFor(() => expect(browserPageAction).toHaveBeenCalledExactlyOnceWith(7, "reveal", { x: 100, y: 150 }))
  expect(result.queryByRole("menu")).toBeNull()
  for (const url of ["https://example.com/a.html", "http://localhost:9525/a.html", "about:blank"]) {
    result.rerender(<BrowserContextMenu b={model(url)} visible />)
    openMenu()
    expect(result.queryByRole("menuitem", { name: "在资源管理器中显示" })).toBeNull()
    fireEvent.keyDown(document, { key: "Escape" })
  }
})

it.each([null, { running: false, url: 'http://localhost:9525/' }, { running: true, url: 'http://localhost:9523/' }])('hides local debugging when the current page is not managed: %j', async (project) => {
 const status = vi.fn().mockResolvedValue(project)
 window.electronAPI = { sourceProjectStatus: status } as any
 const b = { tab: { id: 'tab', url: 'http://localhost:9525/login' }, views: { current: new Map() } } as any
 const result = render(<BrowserContextMenu b={b} visible />)
 await act(async () => window.dispatchEvent(new CustomEvent('vessel-browser-context-menu', { detail: { tabId: 'tab', guestId: 7, x: 100, y: 150, left: 400, top: 300 } })))
 expect(status).toHaveBeenCalledOnce()
 expect(result.queryByRole('menuitem', { name: '本地项目调试' })).toBeNull()
})

it('starts source inspection only for a live matching project and rechecks when selected', async () => {
 const { markGuestReady } = await import('@/pages/browser/guest-lifecycle')
 const status = vi.fn().mockResolvedValue({ running: true, url: 'http://localhost:9525/' })
 window.electronAPI = { sourceProjectStatus: status } as any
 const view = document.createElement('webview')
 document.body.append(view)
 const execute = vi.fn().mockResolvedValue(true)
 Object.assign(view, { getURL: () => 'http://localhost:9525/login', executeJavaScript: execute })
 markGuestReady(view as any, true)
 const b = { tab: { id: 'tab', url: 'http://localhost:9525/login' }, views: { current: new Map([['tab', view]]) } } as any
 const result = render(<BrowserContextMenu b={b} visible />)
 const show = () => act(() => window.dispatchEvent(new CustomEvent('vessel-browser-context-menu', { detail: { tabId: 'tab', guestId: 7, x: 100, y: 150, left: 400, top: 300 } })))
 try {
  show()
  fireEvent.click(await result.findByRole('menuitem', { name: '本地项目调试' }))
  await waitFor(() => expect(execute).toHaveBeenCalledOnce())
  expect(execute.mock.calls[0][0]).toContain('__VESSEL_SOURCE_INSPECTOR__')
  expect(result.queryByRole('menu')).toBeNull()
  show()
  const item = await result.findByRole('menuitem', { name: '本地项目调试' })
  status.mockResolvedValueOnce({ running: false, url: 'http://localhost:9525/' })
  fireEvent.click(item)
  await waitFor(() => expect(status).toHaveBeenCalledTimes(4))
  expect(execute).toHaveBeenCalledOnce()
 } finally { view.remove() }
})

it.each([["复制图片", "copy-image"], ["下载图片", "download-image"]])("offers %s only for image documents", async (label, action) => {
  const browserPageAction = vi.fn().mockResolvedValue(undefined)
  window.electronAPI = { browserPageAction, sourceProjectStatus: vi.fn().mockResolvedValue(null) } as any
  const b = { tab: { id: "image", url: "file:///tmp/photo.png" }, views: { current: new Map() } } as any
  const view = render(<BrowserContextMenu b={b} visible />)
  const show = (imageDocument: boolean) => act(() => { window.dispatchEvent(new CustomEvent("vessel-browser-context-menu", { detail: { tabId: "image", guestId: 7, x: 1, y: 2, left: 10, top: 20, imageDocument } })) })
  show(false)
  expect(view.queryByRole("menuitem", { name: label })).toBeNull()
  show(true)
  fireEvent.click(view.getByRole("menuitem", { name: label }))
  await waitFor(() => expect(browserPageAction).toHaveBeenCalledWith(7, action, { x: 1, y: 2 }))
})

it('opens page search after dismissing the context menu and focuses the search input', async () => {
 window.electronAPI = { browserPageAction: vi.fn() } as any
 const input = document.createElement('input')
 document.body.append(input)
 const b = { tab: { id:'tab', url:'https://example.com' }, views:{current:new Map()}, setFindPosition:vi.fn(), setFindOpen:vi.fn(), findInput:{current:input} } as any
 try {
  const result = render(<BrowserContextMenu b={b} visible />)
  act(() => window.dispatchEvent(new CustomEvent('vessel-browser-context-menu', {detail:{tabId:'tab',guestId:7,x:10,y:20,left:100,top:100}})))
  fireEvent.click(result.getByRole('menuitem',{name:'搜索'}))
  await waitFor(() => expect(b.setFindOpen).toHaveBeenCalledWith(true))
  expect(b.setFindPosition).toHaveBeenCalledWith(null)
  expect(result.queryByRole('menu')).toBeNull()
  await waitFor(() => expect(document.activeElement).toBe(input))
  expect(window.electronAPI.browserPageAction).not.toHaveBeenCalled()
 } finally { input.remove() }
})

it('opens the frame inspector after the page context menu closes', async () => {
  window.electronAPI = { listBrowserFrames: vi.fn().mockResolvedValue({ pageURL: 'https://example.com', total: 0, items: [], unreadableDocuments: 0, truncated: false }) } as any
  const b = { tab: { id: 'tab', url: 'https://example.com' }, views: { current: new Map() } } as any
  const result = render(<BrowserContextMenu b={b} visible />)
  act(() => window.dispatchEvent(new CustomEvent('vessel-browser-context-menu', { detail: { tabId: 'tab', guestId: 7, x: 10, y: 20, left: 100, top: 100 } })))
  fireEvent.click(result.getByRole('menuitem', { name: '查看域' }))
  await waitFor(() => expect(result.getByRole('dialog', { name: /查看域/ })).toBeTruthy())
  await waitFor(() => expect(result.getByText('当前页面未发现 iframe')).toBeTruthy())
  expect(window.electronAPI.listBrowserFrames).toHaveBeenCalledWith(7)
  expect(result.queryByRole('menu')).toBeNull()
})
