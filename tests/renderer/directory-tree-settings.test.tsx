import { useState } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { defaultDirectoryTreeSettings, normalizeDirectoryTreeSettings } from "@vessel/utils"
import { DirectoryTreeSettingsPanel } from "@/pages/settings/components/directory-tree-settings"
import { setDirectoryTreeSettings, useDirectoryTreeLayout, useDirectoryTreeSidebarWidth } from "@/features/directory-tree/state"
import { FileIconScope } from "@/features/file-icons/state"
import { VirtualTree } from "@/components/ui/tree"
import FileTreeItem from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/file-tree-item"
import { treeRevealScrollTop } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/reveal-scroll"

beforeEach(() => { setDirectoryTreeSettings({ directoryTree: structuredClone(defaultDirectoryTreeSettings), font: "Plus Jakarta Sans" }) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it("edits layout, guides and gaps in separate collapsible groups without changing the other scope", () => {
  let saved = structuredClone(defaultDirectoryTreeSettings)
  function Fixture() {
    const [value, setValue] = useState({ directoryTree: saved })
    return <DirectoryTreeSettingsPanel value={value} onChange={(next) => { saved = next.directoryTree!; setValue({ directoryTree: saved }) }} />
  }
  render(<Fixture />)
  expect(screen.queryByLabelText("工作区层级缩进")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: /目录树布局/ }))
  fireEvent.change(screen.getByLabelText("工作区层级缩进"), { target: { value: "5" } })
  fireEvent.blur(screen.getByLabelText("工作区层级缩进"))
  expect(saved.workspace.indent).toBe(5)
  expect(saved.resources.indent).toBe(8)
  fireEvent.click(screen.getByRole("switch", { name: "紧凑目录布局作用于工作区" }))
  expect(saved.layoutWorkspace).toBe(false)
  expect(saved.layoutResources).toBe(true)
  expect((screen.getByLabelText("工作区目录行高") as HTMLInputElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole("button", { name: /目录树连线/ }))
  fireEvent.click(screen.getByRole("switch", { name: "目录树连线作用于项目资源库" }))
  expect(saved.guidesResources).toBe(false)
  expect(saved.guidesWorkspace).toBe(true)
  fireEvent.click(screen.getByRole("button", { name: /目录行间隙/ }))
  fireEvent.change(screen.getByLabelText("工作区行间隙"), { target: { value: "4" } })
  fireEvent.blur(screen.getByLabelText("工作区行间隙"))
  fireEvent.change(screen.getByLabelText("项目资源库行间隙"), { target: { value: "7" } })
  fireEvent.blur(screen.getByLabelText("项目资源库行间隙"))
  expect(saved.workspace.gap).toBe(4)
  expect(saved.resources.gap).toBe(7)
  fireEvent.change(screen.getByLabelText("工作区行间隙"), { target: { value: "999" } })
  fireEvent.blur(screen.getByLabelText("工作区行间隙"))
  expect(saved.workspace.gap).toBe(24)
  expect(saved.resources.gap).toBe(7)
})

it("applies different geometry to each tree and truncates filenames when deeply nested", () => {
  vi.stubGlobal("ResizeObserver", class { observe() { /* jsdom has no layout observer. */ } disconnect() { /* No observer to release. */ } })
  const rows = Array.from({ length: 1000 }, (_, i) => ({ id: String(i), depth: i === 0 ? 0 : 12, item: { name: `deep-file-${i}.ts`, path: `/vault/${i}`, type: "file" as const } }))
  const viewport = document.createElement("div")
  Object.defineProperty(viewport, "clientHeight", { value: 240 })
  function Tree() {
    const layout = useDirectoryTreeLayout()
    return <VirtualTree rows={rows} viewport={viewport} rowHeight={layout.rowHeight} rowGap={layout.gap} indent={layout.indent} showGuides={layout.guides} fullRow renderRow={({ item }) => <FileTreeItem node={item} selected={false} expanded={false} onActivate={() => {}} />} />
  }
  const directoryTree = normalizeDirectoryTreeSettings({ guidesWorkspace: false, workspace: { rowHeight: 26, fontSize: 15, indent: 5, gap: 4 }, resources: { rowHeight: 24, fontSize: 12, indent: 10, gap: 8 } })
  act(() => setDirectoryTreeSettings({ directoryTree }))
  const view = render(<FileIconScope.Provider value="workspace"><Tree /></FileIconScope.Provider>)
  expect(screen.getAllByRole("treeitem")[1].style.transform).toBe("translateY(30px)")
  expect(screen.getAllByRole("treeitem")[1].style.getPropertyValue("--tree-indent")).toBe("60px")
  expect(screen.getByRole("tree").style.height).toBe("29996px")
  const button = view.container.querySelector<HTMLElement>("[data-workspace-tree-row]")!
  expect(button.style.height).toBe("26px")
  expect(button.style.fontSize).toBe("15px")
  expect(view.container.querySelector("[data-tree-guides]")).toBeNull()
  expect(view.container.querySelector("[data-tree-label]")?.classList.contains("truncate")).toBe(true)
  view.rerender(<FileIconScope.Provider value="resources"><Tree /></FileIconScope.Provider>)
  expect(screen.getAllByRole("treeitem")[1].style.transform).toBe("translateY(32px)")
  expect(screen.getAllByRole("treeitem")[1].style.getPropertyValue("--tree-indent")).toBe("120px")
  expect(view.container.querySelector("[data-tree-guides]")).toBeTruthy()
  expect(view.container.querySelector<HTMLElement>("[data-workspace-tree-row]")!.style.fontSize).toBe("12px")
  act(() => { viewport.scrollTop = 16000; viewport.dispatchEvent(new Event("scroll")) })
  expect(screen.getByText("deep-file-500.ts")).toBeTruthy()
  expect(screen.getAllByRole("treeitem").length).toBeLessThan(40)
  expect(treeRevealScrollTop(500, 0, 240, 24, 8)).toBe(15784)
  act(() => setDirectoryTreeSettings({ directoryTree: { ...directoryTree, layoutResources: false, gapResources: false, guidesResources: false } }))
  expect(view.container.querySelector<HTMLElement>("[data-workspace-tree-row]")!.style.height).toBe("32px")
  expect(view.container.querySelector("[data-tree-guides]")).toBeNull()
})

it("keeps manually resized widths per scope and applies a new configured width", () => {
  function Width({ scope }: { scope: string }) {
    const [width, resize] = useDirectoryTreeSidebarWidth()
    return <button onClick={() => resize(scope === "workspace" ? 340 : 420)}>{scope}:{width}</button>
  }
  const directoryTree = normalizeDirectoryTreeSettings({ workspace: { sidebarWidth: 290 }, resources: { sidebarWidth: 380 } })
  act(() => setDirectoryTreeSettings({ directoryTree }))
  render(<><FileIconScope.Provider value="workspace"><Width scope="workspace" /></FileIconScope.Provider><FileIconScope.Provider value="resources"><Width scope="resources" /></FileIconScope.Provider></>)
  fireEvent.click(screen.getByText("workspace:290"))
  expect(screen.getByText("workspace:340")).toBeTruthy()
  expect(screen.getByText("resources:380")).toBeTruthy()
  fireEvent.click(screen.getByText("resources:380"))
  expect(JSON.parse(localStorage.getItem("vessel-sidebar-width-resources")!).width).toBe(420)
  act(() => setDirectoryTreeSettings({ directoryTree: { ...directoryTree, guidesWorkspace: false } }))
  expect(screen.getByText("workspace:340")).toBeTruthy()
  expect(screen.getByText("resources:420")).toBeTruthy()
  act(() => setDirectoryTreeSettings({ directoryTree: { ...directoryTree, workspace: { ...directoryTree.workspace, sidebarWidth: 320 } } }))
  expect(screen.getByText("workspace:320")).toBeTruthy()
  expect(screen.getByText("resources:420")).toBeTruthy()
})
