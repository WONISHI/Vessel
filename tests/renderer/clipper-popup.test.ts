import { readFileSync } from "node:fs"
import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ copy: vi.fn(async () => true), save: vi.fn(async () => ({ ok: true, success: true })) }))
vi.mock("#vessel-clipper/client", () => ({ checkVesselStatus: async () => ({ ok: true, workspace: { name: "obsidian" } }), copyTextToClipboard: mocks.copy, downloadMarkdownFile: vi.fn(), saveClipToVessel: mocks.save }))
beforeEach(() => {
  window.history.replaceState(null, "", "/")
  vi.unstubAllGlobals()
  delete (window as any).vesselPageBridge
  delete (window as any).__vesselClipperPage
  vi.resetModules()
  document.body.innerHTML = readFileSync("packages/@vessel/clipper/src/popup/index.html", "utf8")
  vi.stubGlobal("chrome", { tabs: { query: async () => [{ id: 1, url: "https://example.com" }], sendMessage: async () => ({ title: "实际网页", url: "https://example.com", articleText: "实际正文", author: "作者" }) }, storage: { local: { get: async () => ({}), set: vi.fn(async () => {}) } } })
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("外部浏览器不得读取内置网页") }))
})
it("使用当前浏览器页面，手动编辑后复制与保存保持一致", async () => {
  await import("../../packages/@vessel/clipper/src/popup/index")
  const title = document.getElementById("clip-title") as HTMLInputElement
  await vi.waitFor(() => expect(title.value).toBe("实际网页"))
  expect(fetch).not.toHaveBeenCalled()
  const editor = document.getElementById("preview-content") as HTMLTextAreaElement
  editor.value = "我修改后的 Markdown"
  editor.dispatchEvent(new Event("input"))
  document.querySelector<HTMLButtonElement>('[data-mode="article"]')!.click()
  expect(editor.value).toBe("我修改后的 Markdown")
  vi.spyOn(window, "confirm").mockReturnValue(false)
  const template = document.getElementById("clip-template") as HTMLSelectElement
  template.value = "quote"
  template.dispatchEvent(new Event("change"))
  expect(template.value).toBe("default")
  expect(editor.value).toBe("我修改后的 Markdown")
  document.getElementById("copy-btn")!.click()
  await vi.waitFor(() => expect(mocks.copy).toHaveBeenCalledWith(expect.stringContaining("我修改后的 Markdown")))
  document.getElementById("save-btn")!.click()
  await vi.waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ title: "实际网页", markdown: expect.stringContaining("我修改后的 Markdown") })))
  document.querySelector<HTMLButtonElement>('[data-mode="selection"]')!.click()
  expect(document.getElementById("message-bar")!.textContent).toContain("请先在网页中选择")
})

it("内置浏览器使用宿主桥，不依赖被改写的 User Agent", async () => {
  ;(window as any).vesselPageBridge = {}
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: { title: "内置网页", url: "https://inside.example.com", articleText: "内置正文" } }) })))
  await import("../../packages/@vessel/clipper/src/popup/index")
  await vi.waitFor(() => expect((document.getElementById("clip-title") as HTMLInputElement).value).toBe("内置网页"))
  expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:35678/api/active-page", expect.objectContaining({ signal: expect.anything() }))
})

it("剪藏扩展没有 guest preload 时仍通过宿主标记读取 CSDN 页面", async () => {
  window.history.replaceState(null, "", "/?vesselHost=1")
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: { title: "移动端 html 字体", url: "https://blog.csdn.net/chi1130/article/details/82844489", articleHtml: "<p>文章正文</p>" } }) })))
  await import("../../packages/@vessel/clipper/src/popup/index")
  await vi.waitFor(() => expect((document.getElementById("clip-title") as HTMLInputElement).value).toBe("移动端 html 字体"), { timeout: 3000 })
  expect((document.getElementById("save-btn") as HTMLButtonElement).disabled).toBe(false)
  expect((document.getElementById("preview-content") as HTMLTextAreaElement).value).toContain("文章正文")
})

it("直接接收 Vessel 当前页面数据，正文与属性分开并明确显示连接 Vessel", async () => {
  window.history.replaceState(null, "", "/?vesselHost=1")
  ;(window as any).__vesselClipperPage = { title: "真实标题", url: "https://example.com/article", articleHtml: "<h4>移动端适配</h4><p>正文内容</p><img src='/image.png'>" }
  await import("../../packages/@vessel/clipper/src/popup/index")
  await vi.waitFor(() => expect((document.getElementById("clip-title") as HTMLInputElement).value).toBe("真实标题"))
  const text = (document.getElementById("preview-content") as HTMLTextAreaElement).value
  expect(text).toContain("#### 移动端适配")
  expect(text).toContain("正文内容")
  expect(text).toContain("https://example.com/image.png")
  expect(text).not.toContain("clipped_at:")
  const template = document.getElementById("clip-template") as HTMLSelectElement
  template.value = "quote"
  template.dispatchEvent(new Event("change"))
  const editor = document.getElementById("preview-content") as HTMLTextAreaElement
  expect(editor.value).not.toContain("我的笔记")
  const notes = document.getElementById("clip-notes") as HTMLTextAreaElement
  notes.value = "个人批注"
  notes.dispatchEvent(new Event("input"))
  expect(editor.value).toContain("## 我的笔记\n\n个人批注")
  notes.value = ""
  notes.dispatchEvent(new Event("input"))
  expect(editor.value).not.toContain("我的笔记")

  expect(document.getElementById("connection-status")!.textContent).toContain("已连接 Vessel")
  expect(fetch).not.toHaveBeenCalled()
})
