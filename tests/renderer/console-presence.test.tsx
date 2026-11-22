import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import type { TransitionEvent } from "react"
import { useConsolePresence } from "@/components/workspace/components/layout-main/use-console-presence"

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it("keeps terminal content mounted through exit and cancels stale exits on rapid reopen", () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useConsolePresence())
  act(() => result.current.setOpen(true))
  expect(result.current).toMatchObject({ open: true, mounted: true, phase: "enter" })
  const panel = document.createElement("div")
  panel.id = "terminal"
  const end = { target: panel, propertyName: "flex-grow" } as unknown as TransitionEvent<HTMLDivElement>
  act(() => result.current.onTransitionEnd(end))
  expect(result.current.phase).toBe("idle")
  act(() => result.current.setOpen(false))
  expect(result.current).toMatchObject({ open: false, mounted: true, phase: "exit" })
  act(() => vi.advanceTimersByTime(200))
  act(() => result.current.setOpen(previous => !previous))
  act(() => vi.advanceTimersByTime(400))
  expect(result.current).toMatchObject({ open: true, mounted: true, phase: "idle" })
  act(() => result.current.setOpen(false))
  act(() => vi.advanceTimersByTime(250))
  expect(result.current.mounted).toBe(true)
  act(() => result.current.onTransitionEnd(end))
  expect(result.current.mounted).toBe(false)
})

it("opens and closes immediately with reduced motion", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }))
  const { result } = renderHook(() => useConsolePresence())
  act(() => result.current.setOpen(true))
  expect(result.current).toMatchObject({ open: true, mounted: true, phase: "idle" })
  act(() => result.current.setOpen(false))
  expect(result.current).toMatchObject({ open: false, mounted: false, phase: "idle" })
})


it("freezes the current terminal height and falls back when no transition event arrives", () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useConsolePresence())
  const group = document.createElement("div")
  const panel = document.createElement("div")
  panel.id = "terminal"
  group.append(panel)
  vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({ height: 215 } as DOMRect)
  act(() => { result.current.layoutRef.current = group; result.current.setOpen(true) })
  act(() => vi.advanceTimersByTime(400))
  act(() => result.current.setOpen(false))
  expect(group.style.getPropertyValue("--console-content-height")).toBe("215px")
  act(() => vi.advanceTimersByTime(339))
  expect(result.current.mounted).toBe(true)
  act(() => vi.advanceTimersByTime(1))
  expect(result.current.mounted).toBe(false)
})
