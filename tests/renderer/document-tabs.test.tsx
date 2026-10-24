import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { useEffect, useState } from "react"
import { DocumentTabs } from "@/components/workspace/components/layout-main/document-tabs"
const mounts = vi.hoisted(() => vi.fn())
vi.mock("@/components/core/canvas/index", () => ({ default: ({ activeFilePath }: { activeFilePath: string }) => {
  const [value, setValue] = useState("")
  useEffect(() => { mounts(activeFilePath) }, [])
  return <input aria-label={activeFilePath} value={value} onChange={(event) => setValue(event.target.value)} />
} }))
afterEach(() => { cleanup(); mounts.mockClear() })
it("preserves visited editor instances and drafts across tab and home switches, destroying closed tabs", () => {
  const files = [{ name: "a.md", path: "/vault/a.md" }, { name: "b.md", path: "/vault/b.md" }]
  const props = { files, workspacePath: "/vault", children: <div>工作台</div> }
  const { rerender } = render(<DocumentTabs {...props} activePath={files[0].path} home={false} />)
  fireEvent.change(screen.getByRole("textbox", { name: files[0].path }), { target: { value: "未保存内容" } })
  rerender(<DocumentTabs {...props} activePath={files[1].path} home={false} />)
  expect(mounts).toHaveBeenCalledTimes(2)
  rerender(<DocumentTabs {...props} activePath={files[0].path} home={false} />)
  expect(screen.getByRole("textbox", { name: files[0].path })).toHaveProperty("value", "未保存内容")
  expect(mounts).toHaveBeenCalledTimes(2)
  rerender(<DocumentTabs {...props} activePath={files[0].path} home />)
  expect(screen.getByText("工作台")).toBeTruthy()
  rerender(<DocumentTabs {...props} activePath={files[0].path} home={false} />)
  expect(mounts).toHaveBeenCalledTimes(2)
  rerender(<DocumentTabs {...props} files={[files[0]]} activePath={files[0].path} home={false} />)
  expect(document.querySelector('[data-document-tab="/vault/b.md"]')).toBeNull()
})
