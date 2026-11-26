import { createRef } from "react"
import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { FileSearch } from "@/components/workspace/components/layout-main/file-search"
import { TooltipProvider } from "@/components/ui/tooltip"
afterEach(cleanup)
it("scrolls to the chosen match rather than the first repeated keyword", async () => {
  const contentHost = createRef<HTMLDivElement>()
  const scroll = vi.fn()
  HTMLElement.prototype.scrollIntoView = scroll
  render(
    <TooltipProvider>
      <FileSearch
        path="/note.md"
        contentHost={contentHost}
      />
      <div ref={contentHost}>
        <div className="vditor-ir">
          <div className="vditor-reset">
            <p>两网第一处</p>
            <p>两网第二处</p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
  fireEvent.click(screen.getByRole("button", { name: "搜索当前文件" }))
  fireEvent.change(await screen.findByRole("textbox", { name: "文件内容关键词" }), { target: { value: "两网" } })
  const result = await screen.findByRole("button", { name: /两网第二处/ })
  fireEvent.click(result)
  await waitFor(() => expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: "center" })))
  expect(scroll.mock.instances[0]).toBe(contentHost.current?.querySelectorAll("p")[1])
})

it("keeps search open through outside clicks, editor focus, Escape and result selection until explicitly closed", async () => {
  const contentHost = createRef<HTMLDivElement>()
  render(<TooltipProvider>
    <FileSearch path="/note.md" contentHost={contentHost} />
    <div ref={contentHost}><div className="vditor-ir"><div className="vditor-reset"><p>查找目标</p></div></div><textarea aria-label="编辑区" /></div>
    <button>其他操作</button>
  </TooltipProvider>)
  fireEvent.click(screen.getByRole("button", { name: "搜索当前文件" }))
  const input = await screen.findByRole("textbox", { name: "文件内容关键词" })
  fireEvent.change(input, { target: { value: "目标" } })
  expect(await screen.findByRole("button", { name: /查找目标/ })).toBeTruthy()
  // Radix installs its outside pointer listener on the next task.
  await new Promise(resolve => setTimeout(resolve, 0))
  const outside = screen.getByRole("button", { name: "其他操作" })
  fireEvent.pointerDown(outside)
  fireEvent.click(outside)
  fireEvent.focusIn(screen.getByRole("textbox", { name: "编辑区" }))
  fireEvent.keyDown(input, { key: "Escape" })
  fireEvent.click(screen.getByRole("button", { name: "搜索当前文件" }))
  fireEvent.click(screen.getByRole("button", { name: /查找目标/ }))
  expect(screen.getByRole("textbox", { name: "文件内容关键词" })).toHaveProperty("value", "目标")
  fireEvent.click(screen.getByRole("button", { name: "关闭搜索" }))
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "文件内容关键词" })).toBeNull())
})

it("closes on route navigation, including when the active file path stays the same", async () => {
  const contentHost = createRef<HTMLDivElement>()
  const view = (routeKey: string, path = "/note.md") => <TooltipProvider><FileSearch path={path} routeKey={routeKey} contentHost={contentHost} /><div ref={contentHost}><div className="vditor-ir"><div className="vditor-reset"><p>查找目标</p></div></div></div></TooltipProvider>
  const rendered = render(view("initial"))
  fireEvent.click(screen.getByRole("button", { name: "搜索当前文件" }))
  expect(await screen.findByRole("textbox", { name: "文件内容关键词" })).toBeTruthy()
  rendered.rerender(view("next-route"))
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "文件内容关键词" })).toBeNull())
  fireEvent.click(screen.getByRole("button", { name: "搜索当前文件" }))
  expect(await screen.findByRole("textbox", { name: "文件内容关键词" })).toBeTruthy()
  rendered.rerender(view("next-route", "/other.md"))
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "文件内容关键词" })).toBeNull())
})
