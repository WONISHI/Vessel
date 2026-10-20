import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CodeBlockContextMenu } from "@/components/core/canvas/variants/markdown/code-block-context-menu"

describe("CodeBlockContextMenu", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("renders menu options and handles operations", async () => {
    const onFocusAbove = vi.fn()
    const onFocusBelow = vi.fn()
    const onCopy = vi.fn()
    const onDelete = vi.fn()
    const onClose = vi.fn()

    render(
      <CodeBlockContextMenu
        x={100}
        y={100}
        onClose={onClose}
        onFocusAbove={onFocusAbove}
        onFocusBelow={onFocusBelow}
        onCopy={onCopy}
        onDelete={onDelete}
      />
    )

    // Check menu items exist
    expect(screen.getByText("聚焦")).toBeDefined()
    expect(screen.getByText("复制")).toBeDefined()
    expect(screen.getByText("删除")).toBeDefined()

    // Test Copy
    act(() => {
      fireEvent.click(screen.getByText("复制"))
    })
    expect(onCopy).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()

    // Test Delete
    act(() => {
      fireEvent.click(screen.getByText("删除"))
    })
    expect(onDelete).toHaveBeenCalled()
  })
})
