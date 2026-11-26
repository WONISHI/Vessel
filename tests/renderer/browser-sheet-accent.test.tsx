import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { Sheet, SheetTitle } from "@/components/ui/sheet"
import { BrowserSheetContent } from "@/pages/browser/components/browser-sheet"
import { BrowserSiteColorContext } from "@/pages/browser/components/browser-site-color-context"
afterEach(cleanup)
it("passes the active site color through the Sheet portal and updates it when tabs change", () => {
  const panel = (color: string) => <BrowserSiteColorContext.Provider value={color}><Sheet open><BrowserSheetContent style={{ top: 20 }}><SheetTitle>浏览器面板</SheetTitle></BrowserSheetContent></Sheet></BrowserSiteColorContext.Provider>
  const view = render(panel("#4792f1"))
  const sheet = screen.getByRole("dialog")
  expect(sheet.hasAttribute("data-browser-sheet")).toBe(true)
  expect(sheet.style.getPropertyValue("--browser-site-color")).toBe("#4792f1")
  expect(sheet.style.top).toBe("20px")
  view.rerender(panel("#fc6d26"))
  expect(sheet.style.getPropertyValue("--browser-site-color")).toBe("#fc6d26")
})
