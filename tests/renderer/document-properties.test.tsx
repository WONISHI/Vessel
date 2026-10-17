import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { DocumentProperties } from "@/components/core/canvas/variants/markdown/document-properties"
import { WorkspaceContext } from "@/components/workspace/types/workspace"
import { parseFrontmatter } from "@vessel/obsidian/frontmatter"
afterEach(cleanup)
it("renders YAML list properties and opens wiki links from the Markdown properties table", async () => {
  const parsed = parseFrontmatter('---\n项目名称: "[[工作/项目|项目别名]]"\njekins地址:\n  - 1. https://example.com/job/\n---\n正文')!
  const openWorkspaceFile = vi.fn()
  const readWikiLink = vi.fn(async () => ({ path: "/vault/工作/项目.md", content: "" }))
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { readWikiLink } })
  render(
    <WorkspaceContext.Provider value={{ openWorkspaceFile } as any}>
      <DocumentProperties
        properties={parsed.properties}
        workspacePath="/vault"
      />
    </WorkspaceContext.Provider>
  )
  expect(screen.getByRole("link", { name: "https://example.com/job/" })).toBeTruthy()
  fireEvent.click(screen.getByRole("link", { name: "项目别名" }))
  await waitFor(() => expect(openWorkspaceFile).toHaveBeenCalledWith({ name: "项目.md", path: "/vault/工作/项目.md", type: "file" }))
})
