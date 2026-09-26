import React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { VirtualTree } from "../../src/renderer/src/components/ui/tree"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it("limits mounted rows and changes the visible window when the ScrollArea viewport scrolls", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  const viewport = document.createElement("div")
  Object.defineProperty(viewport, "clientHeight", { value: 320 })
  const rows = Array.from({ length: 10000 }, (_, index) => ({ id: String(index), depth: 0, item: index }))
  const view = render(
    <VirtualTree
      rows={rows}
      viewport={viewport}
      renderRow={({ item }) => <span>file-{item}</span>}
    />
  )
  expect(screen.getAllByRole("treeitem").length).toBeLessThan(30)
  expect(screen.queryByText("file-500")).toBeNull()
  viewport.scrollTop = 16000
  fireEvent.scroll(viewport)
  expect(screen.getByText("file-500")).toBeTruthy()
  expect(screen.queryByText("file-0")).toBeNull()
  view.rerender(
    <VirtualTree
      rows={rows.slice(0, 2)}
      viewport={viewport}
      renderRow={({ item }) => <span>file-{item}</span>}
    />
  )
  expect(screen.getAllByRole("treeitem")).toHaveLength(2)
})
