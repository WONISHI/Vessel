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
