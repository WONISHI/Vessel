import React, { createRef } from "react"
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
  await waitFor(() => expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "center" }))
  expect(scroll.mock.instances[0]).toBe(contentHost.current?.querySelectorAll("p")[1])
})
