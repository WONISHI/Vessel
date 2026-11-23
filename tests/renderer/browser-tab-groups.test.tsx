import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { BrowserTabs } from "@/pages/browser/components/browser-page/browser-tabs"
import { groupBrowserTabs } from "@/pages/browser/tab-groups"
import type { Tab } from "@/pages/browser/components/index-shared"
import type { BrowserPageModel } from "@/pages/browser/components/browser-page/hooks/use-browser-page"
const tabs = [
  { id: "one", title: "文档一", url: "https://docs.test/a" },
  { id: "other", title: "其他站点", url: "https://other.test" },
  { id: "two", title: "文档二", url: "https://docs.test/b" },
  { id: "local", title: "本地", url: "file:///tmp/a.html" }
] as Tab[]
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it("groups by exact hostname while retaining active tabs, order, local files and pin boundaries", () => {
  expect(groupBrowserTabs(tabs, "two", false).map(group => group.tab.id)).toEqual(tabs.map(tab => tab.id))
  const groups = groupBrowserTabs([...tabs, { id: "pinned", url: "https://docs.test/c", pinned: true }, { id: "blank", url: "" }, { id: "sub", url: "https://sub.docs.test" }] as Tab[], "two", true)
  expect(groups.map(group => group.members.map(tab => tab.id))).toEqual([["one", "two"], ["other"], ["local"], ["pinned"], ["blank"], ["sub"]])
  expect(groups[0].tab.id).toBe("two")
  expect(groupBrowserTabs(tabs.filter(tab => tab.id !== "two"), "one", true)[0].tab.id).toBe("one")
})
it("defaults to individual tabs, then groups after settings are enabled and allows hover switching", async () => {
  let enabled = false
  vi.stubGlobal("electronAPI", { getSettings: vi.fn(async () => ({ browserGroupSameDomain: enabled })) })
  const setActive = vi.fn(), setInput = vi.fn(), close = vi.fn()
  const b = { tabs, tab: tabs[2], setActive, setInput, close, add: vi.fn(), addTabRightOf: vi.fn(), reloadTab: vi.fn(), togglePinTab: vi.fn(), closeOtherTabs: vi.fn(), closeRightTabs: vi.fn(), setDragTabId: vi.fn(), reorderTabs: vi.fn() } as unknown as BrowserPageModel
  const view = render(<BrowserTabs b={b} />)
  expect(view.container.querySelectorAll('.browser-tab')).toHaveLength(4)
  await waitFor(() => expect(window.electronAPI.getSettings).toHaveBeenCalledOnce())
  enabled = true
  act(() => window.dispatchEvent(new Event("vessel:settings-saved")))
  await waitFor(() => expect(view.container.querySelectorAll('.browser-tab')).toHaveLength(3))
  expect(screen.getByLabelText("另有 1 个同域名标签页").textContent).toBe("1")
  const wrapper = view.container.querySelector<HTMLElement>('.browser-tab-group')!
  expect(wrapper.querySelector('.selected')?.textContent).toContain("文档二")
  fireEvent.mouseEnter(wrapper)
  expect(await screen.findByText("已打开 2 个标签页")).toBeTruthy()
  fireEvent.click(screen.getByRole("menuitem", { name: "文档一" }))
  expect(setActive).toHaveBeenCalledWith("one")
  expect(setInput).toHaveBeenCalledWith(null)
  expect(close).not.toHaveBeenCalled()
  enabled = false
  act(() => window.dispatchEvent(new Event("vessel:settings-saved")))
  await waitFor(() => expect(view.container.querySelectorAll('.browser-tab')).toHaveLength(4))
})

it("closes a folded tab from the hover list without selecting it", async () => {
  vi.stubGlobal("electronAPI", { getSettings: vi.fn(async () => ({ browserGroupSameDomain: true })) })
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  const close = vi.fn(), setActive = vi.fn(), setInput = vi.fn()
  const b = { tabs, tab: tabs[0], close, setActive, setInput, add: vi.fn(), setDragTabId: vi.fn() } as unknown as BrowserPageModel
  const view = render(<BrowserTabs b={b} />)
  await waitFor(() => expect(view.container.querySelector('.browser-tab-group')).toBeTruthy())
  fireEvent.mouseEnter(view.container.querySelector('.browser-tab-group')!)
  fireEvent.click(await screen.findByRole("button", { name: "关闭 文档二" }))
  expect(close).toHaveBeenCalledExactlyOnceWith("two")
  expect(setActive).not.toHaveBeenCalled()
  expect(setInput).not.toHaveBeenCalled()
  expect(screen.getByRole("menuitem", { name: "文档一" })).toBeTruthy()
})

it.each([false, true])("keeps the group popup closed while its context menu is open (previously hovered=%s)", async (hovered) => {
  vi.stubGlobal("electronAPI", { getSettings: vi.fn(async () => ({ browserGroupSameDomain: true })) })
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  const b = { tabs, tab: tabs[0], close: vi.fn(), setActive: vi.fn(), setInput: vi.fn(), add: vi.fn(), setDragTabId: vi.fn() } as unknown as BrowserPageModel
  const view = render(<BrowserTabs b={b} />)
  await waitFor(() => expect(view.container.querySelector('.browser-tab-group')).toBeTruthy())
  const wrapper = view.container.querySelector('.browser-tab-group')!
  if (hovered) {
    fireEvent.mouseEnter(wrapper)
    expect(await screen.findByText("已打开 2 个标签页")).toBeTruthy()
  }
  fireEvent.contextMenu(wrapper.querySelector('.browser-tab')!)
  const action = await screen.findByRole("menuitem", { name: "关闭整个分组" })
  fireEvent.mouseEnter(action)
  fireEvent.focus(action)
  expect(screen.queryByText("已打开 2 个标签页")).toBeNull()
  expect(screen.queryByText("已打开 4 个标签页")).toBeNull()
  fireEvent.keyDown(action, { key: "Escape" })
  await waitFor(() => expect(screen.queryByRole("menuitem", { name: "关闭整个分组" })).toBeNull())
  expect(screen.queryByText("已打开 2 个标签页")).toBeNull()
  fireEvent.mouseLeave(wrapper)
  fireEvent.mouseEnter(wrapper)
  expect(await screen.findByText("已打开 2 个标签页")).toBeTruthy()
})

it.each([
  ["复制标签页", "addTabRightOf"], ["重新加载", "reloadTab"], ["冻结标签页", "freezeTab"],
  ["关闭", "close"], ["关闭其他标签页", "closeOtherTabs"]
])("runs %s against the right-clicked folded tab without selecting it", async (label, method) => {
  vi.stubGlobal("electronAPI", { getSettings: vi.fn(async () => ({ browserGroupSameDomain: true })) })
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  const actions = { addTabRightOf: vi.fn(), reloadTab: vi.fn(), freezeTab: vi.fn(), close: vi.fn(), closeOtherTabs: vi.fn() }
  const setActive = vi.fn()
  const b = { tabs, tab: tabs[0], ...actions, setActive, setInput: vi.fn(), add: vi.fn(), setDragTabId: vi.fn() } as unknown as BrowserPageModel
  const view = render(<BrowserTabs b={b} />)
  await waitFor(() => expect(view.container.querySelector('.browser-tab-group')).toBeTruthy())
  const wrapper = view.container.querySelector('.browser-tab-group')!
  fireEvent.mouseEnter(wrapper)
  fireEvent.contextMenu(await screen.findByRole("menuitem", { name: "文档二" }))
  const action = await screen.findByRole("menuitem", { name: label })
  fireEvent.mouseLeave(wrapper)
  fireEvent.mouseEnter(action)
  if (label === "冻结标签页") await act(async () => { await new Promise((resolve) => setTimeout(resolve, 220)) })
  expect(screen.getByRole("menuitem", { name: label })).toBeTruthy()
  fireEvent.click(action)
  expect(actions[method as keyof typeof actions]).toHaveBeenCalledWith(...(label === "复制标签页" ? ["two", true] : ["two"]))
  expect(setActive).not.toHaveBeenCalled()
})

it("groups all local paths, file hosts and pin states together without grouping blank or data pages", () => {
  const files = [{ id: "a", url: "file:///tmp/a.html", pinned: true }, { id: "b", url: "file:///Users/test/b.pdf" }, { id: "c", url: "file://server/share/c.png" }, { id: "empty", url: "" }, { id: "data", url: "data:text/html,test" }] as Tab[]
  const groups = groupBrowserTabs(files, "b", true)
  expect(groups.map((group) => group.members.map((tab) => tab.id))).toEqual([["a", "b", "c"], ["empty"], ["data"]])
  expect(groups[0]).toMatchObject({ kind: "local", tab: files[1] })
  expect(groupBrowserTabs(files, "b", false)).toHaveLength(5)
})

it.each(["button", "menu"])("closes every member of the local group through its %s", async (method) => {
  vi.stubGlobal("electronAPI", { getSettings: vi.fn(async () => ({ browserGroupSameDomain: true })) })
  const local = [...tabs, { ...tabs[3], id: "second-local", title: "本地二", url: "file:///other/b.pdf" }]
  const closeTabs = vi.fn(), close = vi.fn()
  const b = { tabs: local, tab: tabs[3], closeTabs, close, setActive: vi.fn(), setInput: vi.fn(), add: vi.fn(), setDragTabId: vi.fn() } as unknown as BrowserPageModel
  const view = render(<BrowserTabs b={b} />)
  const group = await waitFor(() => { const element = view.container.querySelector('[data-browser-group="local-resources"]'); expect(element).toBeTruthy(); return element! })
  expect(group.textContent).toContain("本地")
  expect(group.querySelector('[aria-label="本地资源分组"]')?.getAttribute("stroke")).toBe("#016BFF")
  if (method === "button") fireEvent.click(screen.getByRole("button", { name: "关闭整个分组：本地（2 个标签页）" }))
  else {
    fireEvent.contextMenu(group)
    for (const label of ["复制标签页", "重新加载", "冻结标签页", "解冻标签页"]) expect(screen.queryByRole("menuitem", { name: label })).toBeNull()
    fireEvent.click(screen.getByRole("menuitem", { name: "关闭整个分组" }))
  }
  expect(closeTabs).toHaveBeenCalledExactlyOnceWith(["local", "second-local"])
  expect(close).not.toHaveBeenCalled()
})

it("keeps single-tab commands while group other/right-close operations preserve its own members", async () => {
  vi.stubGlobal("electronAPI", { getSettings: vi.fn(async () => ({ browserGroupSameDomain: true })) })
  const closeTabs = vi.fn(), closeOtherTabs = vi.fn(), togglePinTab = vi.fn()
  const ordered = [tabs[0], tabs[1], tabs[2], { ...tabs[3], pinned: true }]
  const b = { tabs: ordered, tab: tabs[0], closeTabs, closeOtherTabs, togglePinTab, setActive: vi.fn(), setInput: vi.fn(), add: vi.fn(), setDragTabId: vi.fn() } as unknown as BrowserPageModel
  const view = render(<BrowserTabs b={b} />)
  const group = await waitFor(() => { const element = view.container.querySelector('[data-browser-group="normal:docs.test"]'); expect(element).toBeTruthy(); return element! })
  fireEvent.contextMenu(group)
  expect(screen.queryByRole("menuitem", { name: "复制标签页" })).toBeNull()
  fireEvent.click(screen.getByRole("menuitem", { name: "关闭其他标签页" }))
  expect(closeOtherTabs).toHaveBeenCalledWith(["one", "two"])
  fireEvent.contextMenu(group)
  fireEvent.click(screen.getByRole("menuitem", { name: "关闭右侧标签页" }))
  expect(closeTabs).toHaveBeenCalledWith(["other"])
  fireEvent.contextMenu(group)
  fireEvent.click(screen.getByRole("menuitem", { name: "固定", exact: true }))
  expect(togglePinTab).toHaveBeenCalledWith(["one", "two"])
  fireEvent.contextMenu(view.container.querySelectorAll('.browser-tab')[1])
  expect(screen.getByRole("menuitem", { name: "复制标签页" })).toBeTruthy()
  expect(screen.getByRole("menuitem", { name: "重新加载" })).toBeTruthy()
  expect(screen.getByRole("menuitem", { name: "冻结标签页" })).toBeTruthy()
})


it("keeps the last selected local document as its group representative after leaving the group", () => {
  const local = [
    { id: "local-one", title: "原型预览", url: "file:///a.html", lastActiveAt: 100 },
    { id: "local-two", title: "年休假", url: "file:///b.html", lastActiveAt: 200 },
    tabs[0]
  ] as Tab[]
  expect(groupBrowserTabs(local, "local-one", true)[0].tab.title).toBe("原型预览")
  expect(groupBrowserTabs(local, "local-two", true)[0].tab.title).toBe("年休假")
  expect(groupBrowserTabs(local, "one", true)[0].tab.title).toBe("年休假")
})

it("positions grouped item tooltips right except for the last group, which uses left", async () => {
  vi.stubGlobal("electronAPI", { getSettings: vi.fn(async () => ({ browserGroupSameDomain: true })) })
  const local = [
    tabs[0], tabs[2],
    { id: "a", title: "原型", url: "file:///a.html" },
    { id: "b", title: "年休假", url: "file:///b.html" },
    tabs[1]
  ] as Tab[]
  const b = { tabs: local, tab: local[3], setActive: vi.fn(), setInput: vi.fn(), close: vi.fn(), add: vi.fn() } as unknown as BrowserPageModel
  const view = render(<BrowserTabs b={b} />)
  await waitFor(() => expect(view.container.querySelectorAll(".browser-tab-group")).toHaveLength(2))
  const groups = view.container.querySelectorAll<HTMLElement>(".browser-tab-group")
  fireEvent.mouseEnter(groups[0])
  expect((await screen.findByRole("menuitem", { name: "文档一" })).getAttribute("data-title-side")).toBe("right")
  fireEvent.mouseEnter(groups[1])
  expect((await screen.findByRole("menuitem", { name: "年休假" })).getAttribute("data-title-side")).toBe("left")
  expect(groups[1].querySelector(".browser-tab-select")?.textContent).toBe("年休假")
})
