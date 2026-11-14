import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { DiffViewer } from "@/pages/git/components/diff-viewer"

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
