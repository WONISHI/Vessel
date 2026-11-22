import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { defaultSettings } from "@vessel/utils"
import { SettingsPage } from "@/pages/settings/components/settings-page"

vi.mock("@vessel/react-router", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }))
vi.mock("@/pages/settings/components/shortcuts", () => ({ ShortcutSettings: () => null }))
vi.mock("@/pages/settings/components/sync-diagnostics", () => ({ SyncDiagnosticsPanel: () => null }))
vi.mock("@/pages/settings/components/app-update-settings", () => ({ AppUpdateSettings: () => null }))
vi.mock("@/pages/settings/components/attachment-library-settings", () => ({ AttachmentLibrarySettings: () => null }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it("reuses committed settings on revisit while refreshing in the background", async () => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  const info = { version: "1.0.16", electron: "40", node: "22", deviceName: "My Mac" }
  const getSettings = vi.fn(async () => ({ ...defaultSettings, font: "Inter" }))
  Object.defineProperty(window, "electronAPI", { configurable: true, value: {
    getSettings, getSettingsInfo: vi.fn(async () => info), getBackupStatus: vi.fn(async () => ({ running: false }))
  } })
  const first = render(<SettingsPage />)
  expect(first.container.querySelector("[data-page-transition-loading]")).toBeTruthy()
  await waitFor(() => expect(screen.queryByText("正在读取设备信息…")).toBeNull())
  expect(screen.getAllByText("My Mac").length).toBeGreaterThan(0)
  first.unmount()

  let finish!: (value: typeof defaultSettings) => void
  getSettings.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const second = render(<SettingsPage />)
  expect(screen.getAllByText("My Mac").length).toBeGreaterThan(0)
  expect(screen.queryByText("正在读取设备信息…")).toBeNull()
  expect(second.container.querySelector("[data-page-transition-loading]")).toBeNull()
  expect(getSettings).toHaveBeenCalledTimes(2)
  await act(async () => { finish({ ...defaultSettings, font: "Georgia" }) })
  expect(screen.getAllByText("My Mac").length).toBeGreaterThan(0)
})
