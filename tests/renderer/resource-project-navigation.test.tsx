import { useState } from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom"
import { ResourceRoute } from "@/pages/resources"
import { WorkspaceRouteCache } from "@/components/workspace-route-cache"
import { selectLastPinned } from "@/pages/resources/library-state"
import { openResourceProject } from "@/pages/resources/open-project"

vi.mock("@/components/workspace/index", () => ({ default: function CachedProjectPage({ workspace }: { workspace: { name: string } }) {
  const [draft, setDraft] = useState("")
  return <section aria-label={workspace.name}><input aria-label={`${workspace.name} draft`} value={draft} onChange={event => setDraft(event.target.value)} /></section>
} }))
vi.mock("@/components/workspace-welcome/index", () => ({ default: () => <div>选择项目</div> }))
const vessel = { name: "Vessel", path: "/projects/Vessel" }
const devly = { name: "Devly", path: "/projects/Devly" }
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem("resource_current_project", JSON.stringify({ ...vessel, files: [] }))
  localStorage.setItem("resource-library-meta", JSON.stringify({ pins: [vessel], lastPinned: vessel }))
  window.electronAPI = { getAppState: vi.fn(async () => [vessel, devly]), setAppState: vi.fn().mockResolvedValue(undefined) } as any
})
afterEach(() => { cleanup(); localStorage.clear() })

it("keeps Devly and its mounted document state after switching routes and returning through the library entry", async () => {
  function Navigation() {
    const navigate = useNavigate()
    return <>
      <button onClick={() => { void openResourceProject(devly) }}>切换 Devly</button>
      <button onClick={() => navigate("/browser")}>浏览器</button>
      <button onClick={() => { selectLastPinned(); navigate("/resources") }}>返回资源库</button>
    </>
  }
  render(<MemoryRouter initialEntries={["/resources"]}><Navigation /><Routes>
    <Route element={<WorkspaceRouteCache />}>
      <Route path="/resources" element={<ResourceRoute />} />
      <Route path="/browser" element={<div>浏览器页面</div>} />
    </Route>
  </Routes></MemoryRouter>)
  expect(screen.getByRole("region", { name: "Vessel" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "切换 Devly" }))
  const draft = await screen.findByRole("textbox", { name: "Devly draft" })
  fireEvent.change(draft, { target: { value: "preserve this draft" } })
  fireEvent.click(screen.getByRole("button", { name: "浏览器", exact: true }))
  await screen.findByText("浏览器页面")
  fireEvent.click(screen.getByRole("button", { name: "返回资源库" }))
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Devly draft" })).toBe(draft))
  expect((draft as HTMLInputElement).value).toBe("preserve this draft")
  expect(screen.queryByRole("region", { name: "Vessel" })).toBeNull()
  expect(JSON.parse(localStorage.getItem("resource_current_project")!).path).toBe(devly.path)
})

it("keeps an explicit project and pending file, falling back to the last pin only when selection is absent", () => {
  const current = { ...devly, files: [], initialFile: "/projects/Devly/package.json" }
  localStorage.setItem("resource_current_project", JSON.stringify(current))
  expect(selectLastPinned()).toBe(true)
  expect(JSON.parse(localStorage.getItem("resource_current_project")!)).toEqual(current)
  localStorage.removeItem("resource_current_project")
  expect(selectLastPinned()).toBe(true)
  expect(JSON.parse(localStorage.getItem("resource_current_project")!)).toEqual({ ...vessel, files: [] })
})
