import { cleanup, render, screen } from "@testing-library/react"
import { useEffect } from "react"
import { afterEach, expect, it, vi } from "vitest"
import { ResizableSplit } from "@/components/ui/resizable-split"

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
