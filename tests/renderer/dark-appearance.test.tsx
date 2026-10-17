import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { useDarkAppearance } from "@/hooks/use-dark-appearance"

afterEach(() => {
  cleanup()
  document.documentElement.classList.remove("dark")
})
it("updates embedded editor appearance when the application's theme changes", async () => {
  document.documentElement.classList.remove("dark")
  const { result } = renderHook(() => useDarkAppearance())
  expect(result.current).toBe(false)
  act(() => document.documentElement.classList.add("dark"))
  await waitFor(() => expect(result.current).toBe(true))
  act(() => document.documentElement.classList.remove("dark"))
  await waitFor(() => expect(result.current).toBe(false))
})
