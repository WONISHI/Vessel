import { readFileSync } from "node:fs"
import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ copy: vi.fn(async () => true), save: vi.fn(async () => ({ ok: true, success: true })) }))
vi.mock("#vessel-clipper/client", () => ({ checkVesselStatus: async () => ({ ok: true }), copyTextToClipboard: mocks.copy, downloadMarkdownFile: vi.fn(), saveClipToVessel: mocks.save }))
beforeEach(() => {
  window.history.replaceState(null, "", "/")
  vi.unstubAllGlobals()
  delete (window as any).vesselPageBridge
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
  await vi.waitFor(() => expect(mocks.copy).toHaveBeenCalledWith("我修改后的 Markdown"))
  document.getElementById("save-btn")!.click()
  await vi.waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ title: "实际网页", markdown: "我修改后的 Markdown" })))
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
  await vi.waitFor(() => expect((document.getElementById("clip-title") as HTMLInputElement).value).toBe("移动端 html 字体"))
  expect((document.getElementById("save-btn") as HTMLButtonElement).disabled).toBe(false)
  expect((document.getElementById("preview-content") as HTMLTextAreaElement).value).toContain("文章正文")
})
