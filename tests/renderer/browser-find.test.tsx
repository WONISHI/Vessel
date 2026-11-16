import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { WebviewTag } from "electron"
import { useRef, useState } from "react"
import { useBrowserFind } from "@/pages/browser/components/browser-page/hooks/use-browser-find"
import { BrowserFindBar } from "@/pages/browser/components/browser-page/browser-find-bar"
import { markGuestReady } from "@/pages/browser/guest-lifecycle"
import type { BrowserPageModel } from "@/pages/browser/components/browser-page/hooks/use-browser-page"

function guest() {
  const view = document.createElement("div") as unknown as WebviewTag
  view.executeJavaScript = vi.fn(async () => ({ activeMatchOrdinal: 1, matches: 3 }))
  view.findInPage = vi.fn(() => { throw new Error("Native find must never be used") })
  document.body.append(view)
  markGuestReady(view, true)
  return view
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.useRealTimers() })

describe("browser find", () => {
  it("handles Enter immediately, cancels the pending debounce and keeps focus in the input", async () => {
    const view = guest()
    function Harness() {
      const [findText, setFindText] = useState("")
      const [findOpen, setFindOpen] = useState(true)
      const [matchCase, setMatchCase] = useState(false)
      const [findResult, setFindResult] = useState({ activeMatchOrdinal: 0, matches: 0, tabId: "", text: "" })
      const views = useRef(new Map([["one", view]]))
      const state = { views, tab: { id: "one" }, findOpen, findText, matchCase, setFindResult }
      const searchPage = useBrowserFind(state as Parameters<typeof useBrowserFind>[0], true)
      const model = { ...state, searchPage, findResult, setFindOpen, setFindText, setMatchCase, findInput: useRef(null), findPosition: null, setFindPosition: vi.fn(), findDrag: useRef(null) }
      return findOpen && <BrowserFindBar b={model as unknown as BrowserPageModel} />
    }
    render(<Harness />)
    const input = screen.getByRole("textbox", { name: "在网页中查找" })
    input.focus()
    fireEvent.change(input, { target: { value: "alert" } })
    vi.mocked(view.executeJavaScript).mockClear()
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }) })
    expect(view.executeJavaScript).toHaveBeenCalledTimes(1)
    expect(view.executeJavaScript).toHaveBeenLastCalledWith(expect.stringContaining('("alert",{"next":true,"forward":true'))
    await act(async () => { vi.advanceTimersByTime(250) })
    expect(view.executeJavaScript).toHaveBeenCalledTimes(1)
    expect(screen.getByText("1/3")).toBeTruthy()
    await act(async () => { fireEvent.keyDown(input, { key: "Enter", shiftKey: true }) })
    expect(view.executeJavaScript).toHaveBeenLastCalledWith(expect.stringContaining('"forward":false'))
    expect(document.activeElement).toBe(input)
    expect(view.findInPage).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: "Enter", isComposing: true })
    expect(view.executeJavaScript).toHaveBeenCalledTimes(2)
    await act(async () => { fireEvent.keyDown(input, { key: "Escape" }) })
    expect(view.executeJavaScript).toHaveBeenLastCalledWith(expect.stringContaining('("",'))
  })

  it("ignores a delayed result after changing the query or tab and clears the old guest", async () => {
    const first = guest(), second = guest()
    let resolveFirst!: (value: { activeMatchOrdinal: number; matches: number }) => void
    vi.mocked(first.executeJavaScript).mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
    const setFindResult = vi.fn()
    const views = { current: new Map([["one", first], ["two", second]]) }
    const useFind = ({ id, text }: { id: string; text: string }) => useBrowserFind({ views, tab: { id }, findOpen: true, findText: text, matchCase: false, setFindResult } as Parameters<typeof useBrowserFind>[0], true)
    const hook = renderHook(useFind, { initialProps: { id: "one", text: "old" } })
    await act(async () => { vi.advanceTimersByTime(180) })
    hook.rerender({ id: "two", text: "new" })
    setFindResult.mockClear()
    await act(async () => { resolveFirst({ activeMatchOrdinal: 99, matches: 99 }) })
    expect(setFindResult).not.toHaveBeenCalled()
    expect(first.executeJavaScript).toHaveBeenLastCalledWith(expect.stringContaining('("",'))
    await act(async () => { vi.advanceTimersByTime(180) })
    expect(setFindResult).toHaveBeenLastCalledWith({ activeMatchOrdinal: 1, matches: 3, tabId: "two", text: "new" })
    hook.unmount()
    expect(second.executeJavaScript).toHaveBeenLastCalledWith(expect.stringContaining('("",'))
  })

  it("waits for dom-ready and searches the new document after reload", async () => {
    const view = guest()
    markGuestReady(view, false)
    const setFindResult = vi.fn()
    renderHook(() => useBrowserFind({ views: { current: new Map([["one", view]]) }, tab: { id: "one" }, findOpen: true, findText: "alert", matchCase: false, setFindResult } as Parameters<typeof useBrowserFind>[0], true))
    await act(async () => { vi.advanceTimersByTime(180) })
    expect(view.executeJavaScript).not.toHaveBeenCalled()
    markGuestReady(view, true)
    await act(async () => { view.dispatchEvent(new Event("dom-ready")); vi.advanceTimersByTime(180) })
    expect(view.executeJavaScript).toHaveBeenCalledTimes(1)
    await act(async () => { view.dispatchEvent(new Event("dom-ready")); vi.advanceTimersByTime(180) })
    expect(view.executeJavaScript).toHaveBeenCalledTimes(2)
  })
})
