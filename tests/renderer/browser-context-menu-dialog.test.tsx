import React from "react"
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
vi.mock("@/pages/browser/components/browser-page/browser-source-dialog", () => ({ default: ({ onClose }: any) => <div role="dialog">网页源码<button onClick={onClose}>关闭源码</button></div> }))
import { BrowserContextMenu } from "@/pages/browser/components/browser-page/browser-context-menu"

afterEach(cleanup)
it("opens source on the first selection and keeps the closing menu anchored away from the top-left", async () => {
  const browserPageAction = vi.fn().mockResolvedValue("<html><body>hello</body></html>")
  window.electronAPI = { browserPageAction } as any
  const b = { tab: { id: "tab", url: "https://example.com", back: false, forward: false }, views: { current: new Map() } } as any
  const result = render(<BrowserContextMenu b={b} visible />)
  const openMenu = () => act(() => { window.dispatchEvent(new CustomEvent("vessel-browser-context-menu", { detail: { tabId: "tab", guestId: 7, x: 100, y: 150, left: 400, top: 300 } })) })
  openMenu()
  fireEvent.click(result.getByRole("menuitem", { name: "显示网页源代码" }))
  await waitFor(() => expect(result.getByRole("dialog")).toBeTruthy())
  expect(browserPageAction).toHaveBeenCalledOnce()
  const anchor = document.querySelector<HTMLElement>("[data-browser-context-anchor]")!
  expect(anchor.style.left).toBe("400px")
  expect(anchor.style.top).toBe("300px")
  expect(result.queryByRole("menu")).toBeNull()
  fireEvent.click(result.getByText("关闭源码"))
  openMenu()
  fireEvent.click(result.getByRole("menuitem", { name: "显示网页源代码" }))
  await waitFor(() => expect(result.getByRole("dialog")).toBeTruthy())
  expect(browserPageAction).toHaveBeenCalledTimes(2)
  expect(anchor.style.left).toBe("400px")
})
