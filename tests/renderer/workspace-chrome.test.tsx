import React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import Clock from "react-live-clock"
import { StatusTarget } from "../../src/renderer/src/pages/workspace/components/layout-main/status-context"
import { StatusSlot } from "../../src/renderer/src/pages/workspace/components/layout-main/status-slot"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "../../src/renderer/src/components/ui/resizable-panels"
import "../../src/renderer/src/components/core/canvas/variants/code/locale"
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
afterEach(cleanup)
it("loads the shipped Monaco Chinese menu strings", () => {
  const scope = globalThis as typeof globalThis & { _VSCODE_NLS_MESSAGES: string[] }
  expect(scope._VSCODE_NLS_MESSAGES[789]).not.toBe("Command Palette")
  expect(scope._VSCODE_NLS_MESSAGES[1014]).toContain("格式")
})
it("renders live-clock with React 19", () => {
  render(<Clock date="2026-10-01T12:34:00" format="YYYY年MM月DD日 HH:mm" ticking={false} />)
  expect(screen.getByText("2026年10月01日 12:34")).toBeTruthy()
})
it("places document stats in the shared status bar", () => {
  const target = document.createElement("div")
  document.body.append(target)
  const result = render(<StatusTarget.Provider value={target}><StatusSlot><span>20 字符</span></StatusSlot></StatusTarget.Provider>)
  expect(target.textContent).toBe("20 字符")
  expect(result.container.textContent).toBe("")
  result.unmount(); target.remove()
})
it("provides an accessible terminal resize separator", () => {
  render(<ResizablePanelGroup orientation="vertical"><ResizablePanel defaultSize="70%">editor</ResizablePanel><ResizableHandle aria-label="调整终端高度" /><ResizablePanel defaultSize="30%">terminal</ResizablePanel></ResizablePanelGroup>)
  expect(screen.getByRole("separator", { name: "调整终端高度" })).toBeTruthy()
})
