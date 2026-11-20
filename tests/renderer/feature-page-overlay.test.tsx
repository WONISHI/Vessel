import type { ReactNode } from "react"
import { useState } from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { FeaturePageOverlay } from "@/components/layout/feature-page-overlay"
vi.mock("@/pages/todos", () => ({ default: () => <div>待办页面内容</div> }))
vi.mock("@/pages/debug/components/dev-tools-index", () => ({ DevToolsIndex: ({ children, onSelectTool }: { children: ReactNode; onSelectTool: (id: string) => void }) => <div><button onClick={() => onSelectTool("color")}>颜色工具</button>{children}</div> }))
vi.mock("@/pages/debug/json", () => ({ JsonTool: () => <div>JSON 页面内容</div> }))
vi.mock("@/pages/debug/color", () => ({ ColorTool: () => <div>颜色页面内容</div> }))
afterEach(cleanup)
it.each(["todos", "devtools"] as const)("mounts %s as a full-page dialog and closes on Escape", async feature => {
  function Wrapper() {
    const [open, setOpen] = useState(true)
    const [tool, setTool] = useState("json")
    return <FeaturePageOverlay feature={open ? feature : null} tool={tool} onToolChange={setTool} onClose={() => setOpen(false)} />
  }
  render(<Wrapper />)
  const dialog = screen.getByRole("dialog", { name: feature === "todos" ? "待办" : "开发工具" })
  expect(dialog.className).toContain("feature-page-overlay")
  expect(await screen.findByText(feature === "todos" ? "待办页面内容" : "JSON 页面内容")).toBeTruthy()
  if (feature === "devtools") {
    fireEvent.click(screen.getByRole("button", { name: "颜色工具" }))
    expect(await screen.findByText("颜色页面内容")).toBeTruthy()
    expect(screen.queryByText("JSON 页面内容")).toBeNull()
  }
  fireEvent.keyDown(dialog, { key: "Escape" })
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
})
