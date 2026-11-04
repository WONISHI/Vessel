import { WorkspaceVisible } from "@/components/workspace/components/layout-main/document-cache"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
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

it("evicts least-recently-used text editors without removing their tabs", () => {
  const files = Array.from({ length: 6 }, (_, i) => ({ name: `${i}.md`, path: `/lru/${i}.md` }))
  const props = { files, workspacePath: '/lru', children: null, home: false }
  const { rerender } = render(<DocumentTabs {...props} activePath={files[0].path} />)
  for (const file of files.slice(1)) rerender(<DocumentTabs {...props} activePath={file.path} />)
  expect(document.querySelectorAll('[data-document-tab]')).toHaveLength(3)
  expect(document.querySelector('[data-document-tab="/lru/0.md"]')).toBeNull()
  rerender(<DocumentTabs {...props} activePath={files[0].path} />)
  expect(screen.getByRole('textbox', { name: files[0].path })).toBeTruthy()
  expect(mounts.mock.calls.filter(([path]) => path === files[0].path)).toHaveLength(2)
})

it("releases background text editors after the grace period, protecting potentially unsaved Office instances", () => {
  vi.useFakeTimers()
  try {
    const files = [{ name: 'a.md', path: '/background/a.md' }, { name: 'b.docx', path: '/background/b.docx' }]
    const props = { files, workspacePath: '/background', children: null, home: false }
    const { rerender } = render(<WorkspaceVisible.Provider value={true}><DocumentTabs {...props} activePath={files[1].path} /></WorkspaceVisible.Provider>)
    rerender(<WorkspaceVisible.Provider value={true}><DocumentTabs {...props} activePath={files[0].path} /></WorkspaceVisible.Provider>)
    rerender(<WorkspaceVisible.Provider value={false}><DocumentTabs {...props} activePath={files[0].path} /></WorkspaceVisible.Provider>)
    expect(document.querySelectorAll('[data-document-tab]')).toHaveLength(2)
    act(() => vi.advanceTimersByTime(30_000))
    expect(document.querySelectorAll('[data-document-tab]')).toHaveLength(1)
    expect(document.querySelector('[data-document-tab="/background/b.docx"]')).toBeTruthy()
    rerender(<WorkspaceVisible.Provider value={true}><DocumentTabs {...props} activePath={files[0].path} /></WorkspaceVisible.Provider>)
    expect(screen.getByRole('textbox', { name: files[0].path })).toBeTruthy()
  } finally { vi.useRealTimers() }
})
