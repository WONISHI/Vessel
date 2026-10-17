import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { OfficePage } from "@/pages/office/components/office-page"
vi.mock("@vessel/react-router", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/components/layout/activity-bar/index", () => ({ default: () => null }))
vi.mock("@/components/layout/index", () => ({ default: ({ children }: any) => <div>{children}</div> }))
vi.mock("@/components/ui/editor-loading", () => ({ EditorLoading: () => <span>正在加载</span> }))
afterEach(() => {
  cleanup()
  document.documentElement.classList.remove("dark")
})
it("mounts ONLYOFFICE and synchronizes its theme after load without calling hooks inside effects", async () => {
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { openOffice: vi.fn(async () => "http://localhost:1234/office.html") } })
  render(<OfficePage />)
  const frame = (await screen.findByTitle("ONLYOFFICE 本地编辑器")) as HTMLIFrameElement
  const send = vi.spyOn(frame.contentWindow!, "postMessage")
  act(() => window.dispatchEvent(new MessageEvent("message", { source: frame.contentWindow, origin: "http://localhost:1234", data: { type: "office:loaded" } })))
  await waitFor(() => expect(send).toHaveBeenCalledWith({ type: "office:theme", dark: false }, "http://localhost:1234"))
  act(() => document.documentElement.classList.add("dark"))
  await waitFor(() => expect(send).toHaveBeenCalledWith({ type: "office:theme", dark: true }, "http://localhost:1234"))
  expect(screen.queryByText("正在加载")).toBeNull()
})
