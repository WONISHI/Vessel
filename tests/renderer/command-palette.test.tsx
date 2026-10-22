import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ShortcutSettings } from "@/pages/settings/components/shortcuts/components/shortcut-settings"
import { CommandPalette } from "@/components/command-palette"

vi.mock("@vessel/react-router", () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe("CommandPalette theme toggle", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    document.documentElement.classList.remove("dark")
    const mockSettings = {
      theme: "light",
      fontSize: 14,
      font: "sans-serif",
      accent: "#16a34a"
    }

    window.electronAPI = {
      ...window.electronAPI,
      getSettings: vi.fn().mockResolvedValue(mockSettings),
      saveSettings: vi.fn().mockImplementation((settings) => Promise.resolve(settings)),
      setWindowAppearance: vi.fn().mockResolvedValue(undefined),
      onCommandPalette: vi.fn().mockReturnValue(() => {})
    } as any
  })

  afterEach(() => {
    cleanup()
    document.documentElement.classList.remove("dark")
    vi.restoreAllMocks()
  })

  it("renders '切换主题' command and toggles from light to dark", async () => {
    const settingsSavedListener = vi.fn()
    window.addEventListener("vessel:settings-saved", settingsSavedListener)

    render(<CommandPalette />)

    // Open command palette with shortcut (Cmd/Ctrl + P)
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", metaKey: true }))
    })

    // Find "切换主题" command item
    const toggleItem = await screen.findByText("切换主题")
    expect(toggleItem).toBeDefined()

    // Select the command
    await act(async () => {
      fireEvent.click(toggleItem)
    })

    await waitFor(() => {
      expect(window.electronAPI.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ theme: "dark" })
      )
      expect(document.documentElement.classList.contains("dark")).toBe(true)
      expect(settingsSavedListener).toHaveBeenCalled()
    })

    window.removeEventListener("vessel:settings-saved", settingsSavedListener)
  })

  it("toggles from dark to light when current theme is dark", async () => {
    document.documentElement.classList.add("dark")

    render(<CommandPalette />)

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", metaKey: true }))
    })

    const toggleItem = await screen.findByText("切换主题")
    expect(toggleItem).toBeDefined()

    await act(async () => {
      fireEvent.click(toggleItem)
    })

    await waitFor(() => {
      expect(window.electronAPI.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ theme: "light" })
      )
      expect(document.documentElement.classList.contains("dark")).toBe(false)
    })
  })
  it("runs theme, control visibility, file search and link commands directly from shortcuts", async () => {
    localStorage.removeItem("vessel-control-visible")
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: "d", ctrlKey: true, shiftKey: true })
    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true))
    fireEvent.keyDown(window, { key: "u", ctrlKey: true, shiftKey: true })
    expect(localStorage.getItem("vessel-control-visible")).toBe("false")
    fireEvent.keyDown(window, { key: "y", ctrlKey: true, shiftKey: true })
    expect(localStorage.getItem("vessel-control-visible")).toBe("true")
    fireEvent.keyDown(window, { key: "f", ctrlKey: true, shiftKey: true })
    expect(await screen.findByRole("textbox", { name: "搜索工作区文件" })).toBeTruthy()
    fireEvent.keyDown(window, { key: "l", ctrlKey: true, shiftKey: true })
    expect(await screen.findByPlaceholderText("输入命令或链接…")).toHaveProperty("value", "https://")
  })
  it("shows shortcuts in the menu and handles commands forwarded from browser guests", async () => {
    render(<CommandPalette />)
    fireEvent.keyDown(window, { key: "p", ctrlKey: true })
    expect(await screen.findByText(/Shift.*E/)).toBeTruthy()
    const callback = vi.mocked(window.electronAPI.onCommandPalette).mock.calls.at(-1)![0]
    act(() => callback("hideControls"))
    expect(localStorage.getItem("vessel-control-visible")).toBe("false")
  })

  it("lists all seven command shortcuts in settings", () => {
    render(<ShortcutSettings />)
    for (const label of ["选择工作区", "查找工作区文件", "访问链接", "刷新页面", "切换主题", "显示控制按钮", "关闭控制按钮"]) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

})
