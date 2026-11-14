import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { CaseConvertTool } from "@/pages/debug/case-convert"
vi.mock("@/components/ui/scroll-area", () => ({ ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
afterEach(cleanup)
it("restores input and results after navigation and preserves explicit clearing", () => {
  const first = render(<CaseConvertTool />)
  fireEvent.change(screen.getByLabelText("转写输入"), { target: { value: "hello world" } })
  first.unmount()
  const second = render(<CaseConvertTool />)
  expect((screen.getByLabelText("转写输入") as HTMLTextAreaElement).value).toBe("hello world")
  expect(screen.getByText("helloWorld")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "清空输入" }))
  second.unmount()
  render(<CaseConvertTool />)
  expect((screen.getByLabelText("转写输入") as HTMLTextAreaElement).value).toBe("")
})
