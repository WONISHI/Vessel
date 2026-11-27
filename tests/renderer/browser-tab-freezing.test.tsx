import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react"
import { useCallback, useRef, useState } from "react"
import type { WebviewTag } from "electron"
import { afterEach, expect, it, vi } from "vitest"
import { freezeIdleTabs, TAB_FREEZE_AFTER, TAB_FREEZE_CHECK_INTERVAL, useTabFreezing, wakeBrowserTab } from "@/pages/browser/use-tab-freezing"
import { useActivatedTabs } from "@/pages/browser/use-activated-tabs"
import { Guest } from "@/pages/browser/components/guest"
import { BrowserFavicon } from "@/components/browser-favicon"
import { newTab, type Tab } from "@/pages/browser/components/index-shared"
import { useBrowserState } from "@/pages/browser/components/browser-page/hooks/use-browser-state"
import { BrowserTabs } from "@/pages/browser/components/browser-page/browser-tabs"
import type { BrowserPageModel } from "@/pages/browser/components/browser-page/hooks/use-browser-page"
import { BrowserFrozenPage } from "@/pages/browser/components/browser-page/browser-frozen-page"

vi.mock("@/hooks/use-dark-appearance", () => ({ useDarkAppearance: () => false }))
vi.mock("@vessel/react-router", () => ({ useRouter: () => ({}) }))
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear() })

function tab(id: string, patch: Partial<Tab> = {}): Tab {
  return { ...newTab(), id, title: id, url: `https://${id}.test`, lastActiveAt: 0, favicon: `https://${id}.test/icon.png`, ...patch }
}

it("freezes only eligible background guests at three hours and keeps tab metadata", () => {
  const tabs = [tab("active"), tab("idle", { pinned: true, zoom: 1.25, back: true, ready: true }), tab("audio", { mediaPlaying: true }), tab("video", { videoPlaying: true }), tab("loading", { loading: true }), tab("devtools"), tab("unmounted"), tab("recent", { lastActiveAt: 1 })]
  const canFreeze = (id: string) => id !== "devtools" && id !== "unmounted"
  expect(freezeIdleTabs(tabs, "active", canFreeze, TAB_FREEZE_AFTER - 1)).toBe(tabs)
  const next = freezeIdleTabs(tabs, "active", canFreeze, TAB_FREEZE_AFTER)
  expect(next.filter((item) => item.frozen).map((item) => item.id)).toEqual(["idle"])
  expect(next[1]).toMatchObject({ title: "idle", url: tabs[1].url, favicon: tabs[1].favicon, pinned: true, zoom: 1.25, ready: false, loading: false, back: false, forward: false })
  expect(wakeBrowserTab(next[1], TAB_FREEZE_AFTER + 1)).toMatchObject({ frozen: false, loading: true, ready: false, lastActiveAt: TAB_FREEZE_AFTER + 1 })
})

function Harness() {
  const [tabs, setTabs] = useState([tab("a"), tab("b")])
  const [active, setActive] = useState("a")
  const views = useRef(new Map<string, WebviewTag>())
  const activated = useActivatedTabs(active, tabs)
  useTabFreezing(active, setTabs, views)
  const register = useCallback((id: string, view: WebviewTag | null) => {
    if (view) { Object.assign(view, { isDevToolsOpened: () => false }); views.current.set(id, view) }
    else views.current.delete(id)
  }, [])
  const update = useCallback((id: string, patch: Partial<Tab>) => setTabs((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item)), [])
  return <>
    {tabs.map((item) => <button key={item.id} onClick={() => {
      setTabs((current) => current.map((value) => value.id === item.id ? wakeBrowserTab(value) : value.id === active ? { ...value, lastActiveAt: Date.now() } : value))
      setActive(item.id)
    }}>{item.title}<BrowserFavicon url={item.url} frozen={item.frozen} /></button>)}
    {tabs.filter((item) => !item.frozen && activated.has(item.id)).map((item) => <Guest key={item.id} tab={item} visible={active === item.id} register={register} update={update} />)}
  </>
}

it("unmounts the idle webview, retains its tab and dashed indicator, then mounts a fresh guest on click", () => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  const result = render(<Harness />)
  const first = result.container.querySelector("webview")!
  fireEvent.click(screen.getByRole("button", { name: "b" }))
  expect(result.container.querySelectorAll("webview")).toHaveLength(2)
  act(() => { vi.advanceTimersByTime(TAB_FREEZE_AFTER - 1) })
  expect(first.isConnected).toBe(true)
  act(() => { vi.advanceTimersByTime(TAB_FREEZE_CHECK_INTERVAL) })
  expect(first.isConnected).toBe(false)
  expect(result.container.querySelectorAll("webview")).toHaveLength(1)
  expect(screen.getByLabelText("标签页已冷冻，点击后重新加载").querySelector("[data-frozen-ring]")).toBeTruthy()
  expect(screen.getAllByRole("button")).toHaveLength(2)
  fireEvent.click(screen.getByRole("button", { name: /a/ }))
  const restored = result.container.querySelector('webview[src="https://a.test"]')!
  expect(restored).toBeTruthy()
  expect(restored).not.toBe(first)
  expect(screen.queryByLabelText("标签页已冷冻，点击后重新加载")).toBeNull()
})

it("clears its periodic sweep when the browser is unmounted", () => {
  vi.useFakeTimers()
  const result = render(<Harness />)
  expect(vi.getTimerCount()).toBeGreaterThan(0)
  result.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it("wakes frozen tabs through the shared selection event used by search and tab menus", () => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  localStorage.setItem("browser-tabs", JSON.stringify([tab("a"), tab("b")]))
  localStorage.setItem("browser-active-tab", "a")
  vi.stubGlobal("electronAPI", { onBrowserDevtoolsClosed: () => () => {}, syncBrowserBookmarks: vi.fn().mockResolvedValue(undefined) })
  const result = renderHook(() => useBrowserState(true))
  act(() => result.result.current.freezeTab("b"))
  expect(result.result.current.tabs.find((value) => value.id === "b")?.frozen).toBe(true)
  act(() => {
    vi.setSystemTime(1000)
    window.dispatchEvent(new CustomEvent("vessel-browser-tab", { detail: "b" }))
  })
  expect(result.result.current.tab).toMatchObject({ id: "b", frozen: false, loading: true, ready: false, lastActiveAt: 1000 })
  expect(result.result.current.tabs.find((value) => value.id === "a")?.lastActiveAt).toBe(1000)
  act(() => {
    result.result.current.setDevtoolsOpen(true)
    result.result.current.freezeTab("b")
  })
  expect(result.result.current.tab).toMatchObject({ id: "b", title: "b", url: "https://b.test", frozen: true, loading: false })
  expect(result.result.current.devtoolsOpen).toBe(false)
  expect(result.result.current.tabs).toHaveLength(2)
})

it.each([false, true].flatMap(grouped => [false, true].map(frozen => ({ grouped, frozen }))))("offers the matching freeze action for the represented tab (grouped=$grouped, frozen=$frozen)", ({ grouped, frozen }) => {
  const item = tab("menu", { frozen })
  const sibling = tab("sibling", { url: "https://menu.test/other" })
  vi.stubGlobal("electronAPI", { getSettings: vi.fn(async () => ({ browserGroupSameDomain: true })) })
  const freezeTab = vi.fn(), setActive = vi.fn()
  const model = { tabs: grouped ? [item, sibling] : [item], tab: item, freezeTab, setActive, setInput: vi.fn(), close: vi.fn() } as unknown as BrowserPageModel
  const view = render(<BrowserTabs b={model} />)
  fireEvent.contextMenu(view.container.querySelector(".browser-tab")!)
  fireEvent.click(screen.getByRole("menuitem", { name: frozen ? "解冻标签页" : "冻结标签页" }))
  expect(frozen ? setActive : freezeTab).toHaveBeenCalledExactlyOnceWith("menu")
  expect(frozen ? freezeTab : setActive).not.toHaveBeenCalled()
})

it("identifies the frozen site and resumes only when requested", () => {
  const onResume = vi.fn()
  render(<BrowserFrozenPage tab={tab("react", { title: "React 文档", url: "https://react.dev/learn", frozen: true })} onResume={onResume} />)
  expect(screen.getByText("React 文档")).toBeTruthy()
  expect(screen.getByText("react.dev")).toBeTruthy()
  expect(document.querySelector("webview")).toBeNull()
  expect(onResume).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "恢复浏览" }))
  expect(onResume).toHaveBeenCalledOnce()
})
