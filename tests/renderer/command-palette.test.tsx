import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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
})
