import React, { useState } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import Clock from "react-live-clock"
import { StatusTarget } from "@/components/workspace/components/layout-main/status-context"
import { StatusSlot } from "@/components/workspace/components/layout-main/status-slot"
import { StatusBar } from "@/components/ui/status-bar"
import { LayoutVisibilityControls } from "@/components/layout/layout-visibility-controls"
import { setStatusBarVisible } from "@/features/status-bar/visibility"
import { DocumentStats } from "@/components/core/canvas/variants/markdown/document-stats"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable-panels"
import "@/components/core/canvas/variants/code/locale"
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
)
afterEach(() => { cleanup(); setStatusBarVisible(true) })
it("loads the shipped Monaco Chinese menu strings", () => {
  const scope = globalThis as typeof globalThis & { _VSCODE_NLS_MESSAGES: string[] }
  expect(scope._VSCODE_NLS_MESSAGES[789]).not.toBe("Command Palette")
  expect(scope._VSCODE_NLS_MESSAGES[1014]).toContain("格式")
})
it("renders live-clock with React 19", () => {
  render(
    <Clock
      date="2026-10-01T12:34:00"
      format="YYYY年MM月DD日 HH:mm"
      ticking={false}
    />
  )
  expect(screen.getByText("2026年10月01日 12:34")).toBeTruthy()
})
it("places document stats in the shared status bar", () => {
  const target = document.createElement("div")
  document.body.append(target)
  const result = render(
    <StatusTarget.Provider value={target}>
      <StatusSlot>
        <span>20 字符</span>
      </StatusSlot>
    </StatusTarget.Provider>
  )
  expect(target.textContent).toBe("20 字符")
  expect(result.container.textContent).toBe("")
  result.unmount()
  target.remove()
})
it("provides an accessible terminal resize separator", () => {
  render(
    <ResizablePanelGroup orientation="vertical">
      <ResizablePanel defaultSize="70%">editor</ResizablePanel>
      <ResizableHandle aria-label="调整终端高度" />
      <ResizablePanel defaultSize="30%">terminal</ResizablePanel>
    </ResizablePanelGroup>
  )
  expect(screen.getByRole("separator", { name: "调整终端高度" })).toBeTruthy()
})

it("hides document statistics with the status bar instead of rendering them in the editor", () => {
  function Page() {
    const [target, setTarget] = useState<HTMLDivElement | null>(null)
    return <><LayoutVisibilityControls activity={false} /><main aria-label="编辑器"><StatusTarget.Provider value={target}><DocumentStats source="hello world" /></StatusTarget.Provider></main><StatusBar><div ref={setTarget} /></StatusBar></>
  }
  render(<Page />)
  expect(screen.getByLabelText("底部状态栏").contains(screen.getByLabelText("文档统计"))).toBe(true)
  fireEvent.click(screen.getByLabelText("隐藏底部状态栏"))
  expect(screen.queryByLabelText("底部状态栏")).toBeNull()
  expect(screen.queryByLabelText("文档统计")).toBeNull()
  expect(screen.getByLabelText("编辑器").textContent).toBe("")
  fireEvent.click(screen.getByLabelText("显示底部状态栏"))
  expect(screen.getByLabelText("底部状态栏").contains(screen.getByLabelText("文档统计"))).toBe(true)
})
