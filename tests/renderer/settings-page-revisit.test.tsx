import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { defaultSettings } from "@vessel/utils"
import { SettingsPage } from "@/pages/settings/components/settings-page"

const navigation = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }))
vi.mock("@vessel/react-router", () => ({ useRouter: () => navigation }))
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

it('groups file backup and database sync below the new sync navigation', async () => {
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: {
    getSettings: async () => defaultSettings,
    getSettingsInfo: async () => ({ version: '1.0', electron: '39', node: '22', deviceName: 'Fixture' }),
    getBackupStatus: async () => ({ running: false }),
    databaseSync: { status: async () => ({ configured: false, connected: false }) }
  } })
  render(<SettingsPage />)
  expect(screen.queryByRole('button', { name: '自定域同步', exact: true })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '同步', exact: true }))
  expect(screen.getByRole('button', { name: '备份与迁移', exact: true })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '自定域同步', exact: true }))
  expect(await screen.findByLabelText('数据库连接字符串')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '备份与迁移', exact: true }))
  expect(screen.getByRole('heading', { name: '备份与迁移' })).toBeTruthy()
})

it.each([0, 1])('returns from settings with history index %s', async (index) => {
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: {
    getSettings: async () => defaultSettings,
    getSettingsInfo: async () => ({ version: '1.0', electron: '39', node: '22', deviceName: 'Fixture' }),
    getBackupStatus: async () => ({ running: false })
  } })
  const previousState = window.history.state
  window.history.replaceState({ idx: index }, '')
  navigation.back.mockClear()
  navigation.replace.mockClear()
  try {
    render(<SettingsPage />)
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: '返回', exact: true }))
    if (index > 0) {
      expect(navigation.back).toHaveBeenCalledTimes(1)
      expect(navigation.replace).not.toHaveBeenCalled()
    } else {
      expect(navigation.replace).toHaveBeenCalledWith('/')
      expect(navigation.back).not.toHaveBeenCalled()
    }
  } finally {
    window.history.replaceState(previousState, '')
  }
})

it.each(['system', 'user'])('shows the %s domain account and logs out before opening login', async (domain) => {
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  const logout = vi.fn().mockResolvedValue({ source: 'local' })
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: {
    getSettings: async () => defaultSettings,
    getSettingsInfo: async () => ({ version: '1.0', electron: '39', node: '22', deviceName: 'Device identity' }),
    getBackupStatus: async () => ({ running: false }),
    databaseSync: { status: async () => ({ domain, user: { id: 'account', name: 'alice' }, source: 'remote' }), logout }
  } })
  navigation.push.mockClear()
  render(<SettingsPage />)
  expect(await screen.findByRole('heading', { name: 'alice' })).toBeTruthy()
  expect(screen.getByLabelText('用户名').textContent).toBe('alice')
  expect(screen.getByText(domain === 'system' ? '系统域账号' : '用户域账号')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '退出登录', exact: true }))
  expect(screen.getByRole('alertdialog')).toBeTruthy()
  expect(logout).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '取消', exact: true }))
  expect(logout).not.toHaveBeenCalled()
  expect(navigation.push).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '退出登录', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: '继续', exact: true }))
  expect(screen.getByRole('heading', { name: '再次确认退出登录' })).toBeTruthy()
  expect(logout).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '取消', exact: true }))
  expect(logout).not.toHaveBeenCalled()
  expect(navigation.push).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '退出登录', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: '继续', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: '确认退出', exact: true }))
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/login'))
  expect(logout).toHaveBeenCalledOnce()
})

it('opens login for a local user without logging out or switching data', async () => {
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  const logout = vi.fn()
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: {
    getSettings: async () => defaultSettings,
    getSettingsInfo: async () => ({ version: '1.0', electron: '39', node: '22', deviceName: 'Device identity' }),
    getBackupStatus: async () => ({ running: false }),
    databaseSync: { status: async () => ({ source: 'local' }), logout }
  } })
  navigation.push.mockClear()
  render(<SettingsPage />)
  const login = screen.getByRole('button', { name: '登录', exact: true })
  await waitFor(() => expect(login.hasAttribute('disabled')).toBe(false))
  fireEvent.click(login)
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/login'))
  expect(logout).not.toHaveBeenCalled()
})

it('keeps the second confirmation open on logout failure and allows retry', async () => {
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  const logout = vi.fn().mockRejectedValueOnce(new Error('退出失败')).mockResolvedValue({ source: 'local' })
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: {
    getSettings: async () => defaultSettings,
    getSettingsInfo: async () => ({ version: '1.0', electron: '39', node: '22', deviceName: 'Fixture' }),
    getBackupStatus: async () => ({ running: false }),
    databaseSync: { status: async () => ({ user: { id: 'account', name: 'alice' }, source: 'remote' }), logout }
  } })
  navigation.push.mockClear()
  render(<SettingsPage />)
  await screen.findByRole('heading', { name: 'alice' })
  fireEvent.click(screen.getByRole('button', { name: '退出登录', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: '继续', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: '确认退出', exact: true }))
  await waitFor(() => expect(screen.getByRole('alertdialog').textContent).toContain('退出失败'))
  expect(navigation.push).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '确认退出', exact: true }))
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/login'))
  expect(logout).toHaveBeenCalledTimes(2)
})


