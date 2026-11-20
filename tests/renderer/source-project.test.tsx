import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { afterEach, expect, it, vi } from "vitest"
import { SourceProjectDialog } from "@/pages/browser/components/source-project-dialog"
let dispose: (() => void) | undefined

afterEach(() => { dispose?.(); dispose = undefined; cleanup(); vi.unstubAllGlobals() })
it("starts the selected project and opens its managed URL without hiding the activity bar", async () => {
  const start = vi.fn().mockResolvedValue({ root: "/project", url: "http://127.0.0.1:5173/", running: true, logs: "" })
  vi.stubGlobal("electronAPI", { sourceProjectStatus: vi.fn().mockResolvedValue(null), sourceProjectPick: vi.fn().mockResolvedValue("/project"), sourceProjectStart: start })
  const navigate = vi.fn(), close = vi.fn()
  render(<SourceProjectDialog open onOpenChange={close} onNavigate={navigate} />)
  const overlay = document.querySelector('[aria-hidden="true"].fixed')
  expect(overlay?.classList.contains("left-[52px]")).toBe(true)
  expect(overlay?.classList.contains("bottom-8")).toBe(true)
  fireEvent.click(screen.getByRole("button", { name: "选择项目目录" }))
  await waitFor(() => expect((screen.getByLabelText("项目目录") as HTMLInputElement).value).toBe("/project"))
  fireEvent.click(screen.getByRole("button", { name: "启动并打开" }))
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("http://127.0.0.1:5173/"))
  expect(start).toHaveBeenCalledWith({ root: "/project", config: "", mode: "development", port: undefined })
  expect(close).toHaveBeenCalledWith(false)
})
it("picks marked elements, suppresses the page action, and closes on Escape", async () => {
  const client = readFileSync("src/main/source-inspector/client.js", "utf8").replaceAll("import.meta.hot", "hot")
  const request = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal("fetch", request)
  new Function("hot", client)({ dispose: (callback: () => void) => { dispose = callback } })
  const api = (window as unknown as { __VESSEL_SOURCE_INSPECTOR__: { toggle: (value?: boolean) => boolean } }).__VESSEL_SOURCE_INSPECTOR__
  const pageClick = vi.fn()
  render(<button data-vessel-source="12" onClick={pageClick}>测试元素</button>)
  expect(api.toggle()).toBe(true)
  const button = screen.getByText("测试元素")
  fireEvent(button, new MouseEvent("pointermove", { bubbles: true }))
  await act(async () => { fireEvent.click(button) })
  expect(pageClick).not.toHaveBeenCalled()
  expect(request).toHaveBeenCalledWith("/__vessel_source_open", expect.objectContaining({ body: '{"key":"12"}' }))
  api.toggle(true)
  fireEvent.keyDown(window, { key: "Escape" })
  fireEvent.click(button)
  expect(pageClick).toHaveBeenCalledOnce()
})

it("defaults to the current workspace when launched outside the browser", async () => {
  const start = vi.fn().mockResolvedValue({ root: "/workspace/app", url: "http://localhost:9525/", running: true, logs: "" })
  vi.stubGlobal("electronAPI", { sourceProjectStatus: vi.fn().mockResolvedValue(null), sourceProjectStart: start })
  const navigate = vi.fn()
  render(<SourceProjectDialog open initialRoot="/workspace/app" onOpenChange={vi.fn()} onNavigate={navigate} />)
  expect((screen.getByLabelText("项目目录") as HTMLInputElement).value).toBe("/workspace/app")
  fireEvent.click(screen.getByRole("button", { name: "启动并打开" }))
  await waitFor(() => expect(start).toHaveBeenCalledWith({ root: "/workspace/app", config: "", mode: "development", port: undefined }))
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("http://localhost:9525/"))
})
