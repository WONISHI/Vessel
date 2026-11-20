import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { DiffViewer } from "@/pages/git/components/diff-viewer"
import { GitDiffSheet } from "@/pages/git/components/git-diff-sheet"
import { useState } from "react"

vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn() } }))
afterEach(cleanup)

const patch = `commit abcdef0123456789
Author: Test <test@example.com>

    commit message

diff --git a/test.ts b/test.ts
index 1234567..abcdef0 100644
--- a/test.ts
+++ b/test.ts
@@ -8,2 +8,3 @@
-old value
+new value
+extra line
 unchanged
`

it("switches the diff into a resizable bottom sheet and back even when the selected diff becomes empty", () => {
  function DockableDiff({ text }: { text: string }) {
    const [bottom, setBottom] = useState(false)
    const diff = <DiffViewer diffText={text} bottomDocked={bottom} onToggleDock={() => setBottom(value => !value)} />
    return bottom ? <GitDiffSheet onDockRight={() => setBottom(false)}>{diff}</GitDiffSheet> : diff
  }
  const { rerender } = render(<DockableDiff text={patch} />)
  fireEvent.click(screen.getByRole("button", { name: "在底部面板显示差异" }))
  expect(screen.getByRole("dialog", { name: "文件差异" })).toBeTruthy()
  const handle = screen.getByRole("separator", { name: "调整差异面板高度" })
  const height = Number(handle.getAttribute("aria-valuenow"))
  fireEvent.keyDown(handle, { key: "ArrowUp" })
  expect(Number(handle.getAttribute("aria-valuenow"))).toBe(height + 20)
  rerender(<DockableDiff text="" />)
  expect(screen.getByText("该文件暂无差异变更")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "停靠到右侧" }))
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(screen.getByRole("button", { name: "在底部面板显示差异" })).toBeTruthy()
})

it("renders real hunks and keeps unequal replacement rows aligned in split mode", () => {
  const { container } = render(<DiffViewer diffText={patch} filePath="test.ts" />)
  expect(screen.getByText("@@ -8,2 +8,3 @@")).toBeTruthy()
  expect(screen.getByText("old value")).toBeTruthy()
  expect(screen.getByText("new value")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "分栏视图 (Split)" }))
  expect(container.querySelector(".diff-split")).toBeTruthy()
  const contextRow = screen.getAllByText("unchanged")[0].closest("tr")!
  expect(contextRow.textContent).toContain("9")
  expect(contextRow.textContent).toContain("10")
})

it("supports untracked-file patches without a diff --git header and preserves staging", () => {
  const onToggleStage = vi.fn()
  render(<DiffViewer diffText={"--- /dev/null\n+++ b/new.ts\n@@ -0,0 +1,2 @@\n+first\n+second\n"} onToggleStage={onToggleStage} />)
  expect(screen.getByText("first")).toBeTruthy()
  expect(screen.getByText("second")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "暂存该文件" }))
  expect(onToggleStage).toHaveBeenCalledOnce()
})

it("reports binary changes and empty diffs without rendering an empty table", () => {
  const { rerender } = render(<DiffViewer diffText={"diff --git a/a.png b/a.png\nindex 1234567..abcdef0 100644\nBinary files a/a.png and b/a.png differ\n"} />)
  expect(screen.getByText("该文件无可显示的文本差异（二进制或文件信息变更）")).toBeTruthy()
  rerender(<DiffViewer diffText="" />)
  expect(screen.getByText("该文件暂无差异变更")).toBeTruthy()
})

it("keeps combined conflict diffs visible and offers the resolve-and-stage action", () => {
  const patch = "diff --cc test.md\nindex abc123,def456..000000\n--- a/test.md\n+++ b/test.md\n@@@ -1,1 -1,1 +1,5 @@@\n++<<<<<<< Updated upstream\n +current\n++=======\n+ stashed\n++>>>>>>> Stashed changes\n"
  const onToggleStage = vi.fn()
  render(<DiffViewer diffText={patch} isConflict onToggleStage={onToggleStage} />)
  expect(screen.getByText(/<<<<<<< Updated upstream/)).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "标记解决并暂存" }))
  expect(onToggleStage).toHaveBeenCalledOnce()
})
