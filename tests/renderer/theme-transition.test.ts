import { afterEach, expect, it, vi } from "vitest"
import { applyAppearance } from "@/pages/settings/appearance"
import { defaultSettings } from "@vessel/utils"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.documentElement.classList.remove("dark", "vessel-theme-transition")
  delete document.documentElement.dataset.vesselAppearance
})

it("captures the whole page once per theme change and cleans up after the reveal", async () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0 })
  const start = vi.fn((update: () => Promise<void>) => {
    const done = update()
    return { ready: done, finished: done, skipTransition: vi.fn() } as unknown as ViewTransition
  })
  Object.defineProperty(document, "startViewTransition", { configurable: true, value: start })
  try {
    applyAppearance({ ...defaultSettings, theme: "light" })
    expect(start).not.toHaveBeenCalled()
    for (const theme of ["dark", "light"] as const) {
      const count = start.mock.calls.length
      applyAppearance({ ...defaultSettings, theme })
      expect(document.documentElement.classList.contains("dark")).toBe(theme === "dark")
      expect(document.documentElement.classList.contains("vessel-theme-transition")).toBe(true)
      applyAppearance({ ...defaultSettings, theme })
      expect(start.mock.calls.length).toBe(count + 1)
      await start.mock.results.at(-1)!.value.finished
      await Promise.resolve()
      await Promise.resolve()
      expect(document.documentElement.classList.contains("vessel-theme-transition")).toBe(false)
    }
  } finally {
    Object.defineProperty(document, "startViewTransition", { configurable: true, value: undefined })
  }
})

it("applies immediately when reduced motion is requested or snapshots are unavailable", () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })))
  applyAppearance({ ...defaultSettings, theme: "light" })
  applyAppearance({ ...defaultSettings, theme: "dark" })
  expect(document.documentElement.classList.contains("dark")).toBe(true)
  expect(document.documentElement.classList.contains("vessel-theme-transition")).toBe(false)
})

it("does not cancel the reveal when settings notifications contain changed backup metadata", async () => {
  let finish!: () => void
  const finished = new Promise<void>((resolve) => { finish = resolve })
  const skipTransition = vi.fn()
  const start = vi.fn((update: () => Promise<void>) => {
    const ready = update()
    return { ready, finished, skipTransition } as unknown as ViewTransition
  })
  Object.defineProperty(document, "startViewTransition", { configurable: true, value: start })
  try {
    applyAppearance({ ...defaultSettings, theme: "light" })
    applyAppearance({ ...defaultSettings, theme: "dark" })
    applyAppearance({ ...defaultSettings, theme: "dark", backup: { ...defaultSettings.backup, hasSecret: true }, name: "Updated user" })
    expect(start).toHaveBeenCalledTimes(1)
    expect(skipTransition).not.toHaveBeenCalled()
    expect(document.documentElement.classList.contains("vessel-theme-transition")).toBe(true)
    await start.mock.results[0].value.ready
    finish()
    await finished
    await Promise.resolve()
    await Promise.resolve()
    expect(document.documentElement.classList.contains("vessel-theme-transition")).toBe(false)
    expect(start).toHaveBeenCalledTimes(1)
  } finally {
    Object.defineProperty(document, "startViewTransition", { configurable: true, value: undefined })
  }
})

it("queues the opposite theme until the current reveal has finished", async () => {
  const finishes: Array<() => void> = []
  const skipTransition = vi.fn()
  const start = vi.fn((update: () => Promise<void>) => ({
    ready: update(), finished: new Promise<void>((resolve) => finishes.push(resolve)), skipTransition
  } as unknown as ViewTransition))
  Object.defineProperty(document, "startViewTransition", { configurable: true, value: start })
  try {
    applyAppearance({ ...defaultSettings, theme: "light" })
    applyAppearance({ ...defaultSettings, theme: "dark" })
    applyAppearance({ ...defaultSettings, theme: "light" })
    expect(start).toHaveBeenCalledTimes(1)
    await start.mock.results[0].value.ready
    finishes[0]()
    await start.mock.results[0].value.finished
    await Promise.resolve()
    await Promise.resolve()
    expect(start).toHaveBeenCalledTimes(2)
    expect(document.documentElement.classList.contains("dark")).toBe(false)
    expect(skipTransition).not.toHaveBeenCalled()
    await start.mock.results[1].value.ready
    finishes[1]()
    await start.mock.results[1].value.finished
    await Promise.resolve()
    await Promise.resolve()
  } finally {
    Object.defineProperty(document, "startViewTransition", { configurable: true, value: undefined })
  }
})
