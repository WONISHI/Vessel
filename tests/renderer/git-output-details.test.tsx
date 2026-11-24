import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { toast, Toaster } from "@/components/ui/sonner"
import { GitOutputDetails } from "@/pages/git/components/git-output-details"

afterEach(() => { toast.dismiss(); cleanup(); vi.unstubAllGlobals() })
it("remeasures the same success toast when shadcn details expand and collapse", async () => {
  let notify!: () => void
  vi.stubGlobal("ResizeObserver", class { constructor(private callback: () => void) {} observe = vi.fn((element: HTMLElement) => { if (element.hasAttribute("data-toast-description")) notify = this.callback }); disconnect = vi.fn() })
  render(<Toaster />)
  const output = "To https://example.test/team/repo.git\nrefs/heads/dev:refs/heads/dev\nDone"
  let id!: string | number
  act(() => { id = toast.success("推送成功", { duration: Infinity, description: <GitOutputDetails output={output} /> }) })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)) })
  const trigger = screen.getByRole("button", { name: "查看操作详情" })
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
  expect(screen.queryByLabelText("Git 操作输出")).toBeNull()
  const measured = trigger.parentElement!.parentElement!
  let height = 24
  vi.spyOn(measured, "getBoundingClientRect").mockImplementation(() => ({ height } as DOMRect))
  const previousDescription = toast.getToasts().find(item => item.id === id)?.description
  fireEvent.click(trigger)
  height = 190
  act(() => notify())
  expect(screen.getByRole("button", { name: "查看操作详情" }).getAttribute("aria-expanded")).toBe("true")
  expect(screen.getByLabelText("Git 操作输出").textContent).toContain("Done")
  expect(toast.getToasts().filter(item => item.id === id)).toHaveLength(1)
  expect(toast.getToasts().find(item => item.id === id)?.description).not.toBe(previousDescription)
  fireEvent.click(trigger)
  height = 24
  act(() => notify())
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
  expect(screen.queryByLabelText("Git 操作输出")).toBeNull()
})
