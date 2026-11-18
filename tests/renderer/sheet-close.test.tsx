import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"

afterEach(cleanup)
it.each(["right", "left", "top", "bottom"] as const)("keeps the %s Sheet close button outside native drag regions", side => {
  const changed = vi.fn()
  render(<Sheet open onOpenChange={changed}><SheetContent side={side}><SheetTitle>面板</SheetTitle><SheetDescription>设置</SheetDescription></SheetContent></Sheet>)
  const button = screen.getByRole("button", { name: "关闭面板" })
  expect(button.style.getPropertyValue("-webkit-app-region") || (button.style as any).WebkitAppRegion).toBe("no-drag")
  expect(screen.getByRole("dialog").className).toContain("z-50")
  fireEvent.click(button)
  expect(changed).toHaveBeenCalledWith(false)
})
