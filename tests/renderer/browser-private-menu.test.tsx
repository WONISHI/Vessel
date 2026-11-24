import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { BrowserMore } from "@/pages/browser/components/tools/components/browser-more"
import { useBrowserWindows } from "@/pages/browser/use-browser-windows"
import { newTab } from "@/pages/browser/components/index-shared"
import type { ReactNode } from "react"
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: { children: ReactNode; onSelect: () => void }) => <button onClick={onSelect}>{children}</button>,
  DropdownMenuSeparator: () => null, DropdownMenuShortcut: () => null
}))
vi.mock("@/pages/browser/components/downloads-sheet", () => ({ DownloadsSheet: () => null }))
vi.mock("@/pages/browser/components/history-sheet", () => ({ HistorySheet: () => null }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it("offers exactly the requested actions through the entire window lifecycle", async () => {
  vi.stubGlobal("electronAPI", { createBrowserPrivateSession: async () => "vessel-private-test", closeBrowserPrivateSession: async () => {} })
  const initial = newTab()
  function Menu() {
    const b = useBrowserWindows({ tabs: [initial], activeId: initial.id })
    return <BrowserMore bookmarksVisible onToggleBookmarks={() => {}} zoomFactor={1} zoom={() => {}} onFind={() => {}} onNavigate={() => {}} guest={() => undefined} deviceMode={false} onDevice={() => {}}
      incognito={b.incognito} hasIncognito={!!b.privateWindow} onEnterIncognito={b.enterIncognito} onCloseIncognito={b.closeIncognito} onSwitchUserWindow={b.switchUserWindow} />
  }
  render(<Menu />)
  expect(screen.queryByText("进入无痕窗口")).toBeNull()
  await act(async () => fireEvent.click(screen.getByText("打开无痕窗口")))
  expect(screen.getByText("关闭无痕窗口")).toBeTruthy()
  expect(screen.getByText("切换用户窗口")).toBeTruthy()
  fireEvent.click(screen.getByText("切换用户窗口"))
  expect(screen.getByText("进入无痕窗口")).toBeTruthy()
  expect(screen.getByText("关闭无痕窗口")).toBeTruthy()
  await act(async () => fireEvent.click(screen.getByText("进入无痕窗口")))
  expect(screen.getByText("切换用户窗口")).toBeTruthy()
  await act(async () => fireEvent.click(screen.getByText("关闭无痕窗口")))
  expect(await screen.findByRole("heading", { name: "确认关闭无痕窗口？" })).toBeTruthy()
  await screen.findByRole("button", { name: "确认关闭" })
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "确认关闭" })))
  expect(screen.getByText("打开无痕窗口")).toBeTruthy()
  expect(screen.queryByText("进入无痕窗口")).toBeNull()
  expect(screen.queryByText("关闭无痕窗口")).toBeNull()
})


it.each([true, false])("requires confirmation before closing private tabs from incognito=%s", async (incognito) => {
  let finish!: () => void
  const close = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
  render(<BrowserMore bookmarksVisible onToggleBookmarks={() => {}} zoomFactor={1} zoom={() => {}} onFind={() => {}} onNavigate={() => {}} guest={() => undefined} deviceMode={false} onDevice={() => {}} incognito={incognito} hasIncognito onCloseIncognito={close} />)
  fireEvent.click(screen.getByText("关闭无痕窗口"))
  expect(close).not.toHaveBeenCalled()
  expect(await screen.findByText(/将关闭所有无痕标签页/)).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "取消" }))
  expect(screen.queryByRole("heading", { name: "确认关闭无痕窗口？" })).toBeNull()
  expect(close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText("关闭无痕窗口"))
  await screen.findByRole("button", { name: "确认关闭" })
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "确认关闭" })))
  expect(close).toHaveBeenCalledOnce()
  expect(screen.getByRole("button", { name: "确认关闭" }).hasAttribute("disabled")).toBe(true)
  await act(async () => finish())
  expect(screen.queryByRole("heading", { name: "确认关闭无痕窗口？" })).toBeNull()
})

it("keeps the confirmation open with an error if closing the session fails", async () => {
  const close = vi.fn(async () => { throw new Error("close failed") })
  render(<BrowserMore bookmarksVisible onToggleBookmarks={() => {}} zoomFactor={1} zoom={() => {}} onFind={() => {}} onNavigate={() => {}} guest={() => undefined} deviceMode={false} onDevice={() => {}} incognito hasIncognito onCloseIncognito={close} />)
  fireEvent.click(screen.getByText("关闭无痕窗口"))
  await screen.findByRole("button", { name: "确认关闭" })
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "确认关闭" })))
  expect(screen.getByRole("alert").textContent).toContain("close failed")
  expect(screen.getByRole("button", { name: "确认关闭" }).hasAttribute("disabled")).toBe(false)
})
