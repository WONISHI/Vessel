import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useEffect } from "react"
import { afterEach, expect, it, vi } from "vitest"
import { ResizableSplit } from "@/components/ui/resizable-split"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable-panels"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it("preserves the page node and its state across every console dock change", () => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  const mounted = vi.fn(), unmounted = vi.fn()
  function Page() {
    useEffect(() => { mounted(); return unmounted }, [])
    return <input aria-label="网页表单" defaultValue="initial" />
  }
  const layout = (side: "bottom" | "left" | "right" | "detached", open = true) => (
    <ResizableSplit side={side} size={300} min={100} max={600} label="控制台大小" onResize={() => {}} pane={open ? <div>网页控制台</div> : undefined}>
      <Page />
    </ResizableSplit>
  )
  const view = render(layout("bottom"))
  const input = screen.getByRole("textbox") as HTMLInputElement
  input.value = "unsaved page state"
  for (const side of ["detached", "right", "left", "bottom", "detached"] as const) {
    view.rerender(layout(side))
    expect(screen.getByRole("textbox")).toBe(input)
    expect(input.value).toBe("unsaved page state")
    expect(screen.getByText("网页控制台")).toBeTruthy()
  }
  view.rerender(layout("detached", false))
  view.rerender(layout("bottom"))
  expect(screen.getByRole("textbox")).toBe(input)
  expect(mounted).toHaveBeenCalledOnce()
  expect(unmounted).not.toHaveBeenCalled()
})

it("exposes a vertical editor divider that changes both panel widths with keyboard resizing", async () => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute("data-panel") ? 497 : this.getAttribute("role") === "separator" ? 6 : 1000
  })
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600)
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) {
    return this.id === "right-doc" ? 503 : this.getAttribute("role") === "separator" ? 497 : 0
  })
  const observers: { notify: () => void }[] = []
  vi.stubGlobal("ResizeObserver", class {
    elements = new Set<Element>()
    constructor(private callback: ResizeObserverCallback) { observers.push(this) }
    observe = (element: Element) => { this.elements.add(element) }
    unobserve = (element: Element) => { this.elements.delete(element) }
    disconnect = () => this.elements.clear()
    notify = () => this.callback([...this.elements].map((element) => {
      const rect = element.getBoundingClientRect()
      return { target: element, borderBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }], contentRect: rect } as ResizeObserverEntry
    }), this as unknown as ResizeObserver)
  })
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const left = this.id === "right-doc" ? 503 : this.getAttribute("role") === "separator" ? 497 : 0
    const width = this.hasAttribute("data-panel") ? 497 : this.getAttribute("role") === "separator" ? 6 : 1000
    return { x: left, y: 0, left, right: left + width, top: 0, bottom: 600, width, height: 600, toJSON: () => ({}) }
  })
  const layout = vi.fn()
  render(<ResizablePanelGroup orientation="horizontal" onLayoutChanged={layout} defaultLayout={{ "left-doc": 50, "right-doc": 50 }}>
    <ResizablePanel id="left-doc" minSize="20%">左编辑区</ResizablePanel>
    <ResizableHandle className="workspace-document-divider" aria-label="调整拆分编辑区宽度" />
    <ResizablePanel id="right-doc" minSize="20%">右编辑区</ResizablePanel>
  </ResizablePanelGroup>)
  const handle = screen.getByRole("separator", { name: "调整拆分编辑区宽度" })
  expect(handle.getAttribute("aria-orientation")).toBe("vertical")
  expect(handle.tabIndex).toBe(0)
  await act(async () => { observers.forEach((observer) => observer.notify()) })
  await waitFor(() => expect(Number(handle.getAttribute("aria-valuenow"))).toBe(50))
  const before = Number(handle.getAttribute("aria-valuenow"))
  fireEvent.keyDown(handle, { key: "ArrowRight" })
  await waitFor(() => expect(Number(handle.getAttribute("aria-valuenow"))).toBeGreaterThan(before))
  expect(layout).toHaveBeenCalledWith(expect.objectContaining({ "left-doc": expect.any(Number), "right-doc": expect.any(Number) }), expect.objectContaining({ isUserInteraction: true }))
})

it("keeps sidebar and editor state mounted while an animated pane closes and reopens", () => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  const resize = vi.fn()
  const layout = (open: boolean) => <ResizableSplit side="left" size={300} min={232} max={600} label="侧栏宽度" paneOpen={open} onResize={resize} pane={<input aria-label="侧栏搜索" defaultValue="query" />}><input aria-label="正文草稿" defaultValue="draft" /></ResizableSplit>
  const view = render(layout(true))
  const search = screen.getByRole("textbox", { name: "侧栏搜索" }) as HTMLInputElement
  const draft = screen.getByRole("textbox", { name: "正文草稿" }) as HTMLInputElement
  search.value = "retained query"; draft.value = "unsaved text"
  view.rerender(layout(false))
  expect(view.container.querySelector('[data-pane-open="false"]')).toBeTruthy()
  expect(search.closest('[aria-hidden="true"]')?.hasAttribute("inert")).toBe(true)
  expect(view.container.contains(search)).toBe(true)
  view.rerender(layout(true))
  expect(screen.getByRole("textbox", { name: "侧栏搜索" })).toBe(search)
  expect(screen.getByRole("textbox", { name: "正文草稿" })).toBe(draft)
  expect(search.value).toBe("retained query")
  expect(draft.value).toBe("unsaved text")
  expect(resize).not.toHaveBeenCalled()
})
