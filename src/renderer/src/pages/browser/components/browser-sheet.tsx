import { forwardRef, useContext, type CSSProperties, type ComponentPropsWithoutRef, type ElementRef } from "react"
import { SheetContent } from "@/components/ui/sheet"
import { BrowserSiteColorContext } from "./browser-site-color-context"

export const BrowserSheetContent = forwardRef<ElementRef<typeof SheetContent>, ComponentPropsWithoutRef<typeof SheetContent>>(function BrowserSheetContent({ style, ...props }, ref) {
  const color = useContext(BrowserSiteColorContext)
  return <SheetContent {...props} ref={ref} data-browser-sheet="" style={{ ...style, "--browser-site-color": color } as CSSProperties} />
})
