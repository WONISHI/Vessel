import { useDialogLayout } from "@/features/layout/use-dialog-layout"
import { Dialog, DialogContent, DialogPortal } from "@/components/ui/dialog"
import { forwardRef, type ComponentProps, type ElementRef } from "react"

/** Git dialogs leave the activity bar available for navigation. */
export function GitPageDialog(props: ComponentProps<typeof Dialog>) {
  return <Dialog {...props} modal={false} />
}

export const GitPageDialogContent = forwardRef<ElementRef<typeof DialogContent>, ComponentProps<typeof DialogContent>>(({ className, style, ...props }, ref) => {
  const layout = useDialogLayout()
  return (
    <>
      <DialogPortal>
        <div aria-hidden="true" data-git-dialog-overlay style={layout.overlayStyle} className="fixed inset-y-0 right-0 z-50 bg-black/[.04] backdrop-blur-[3px]" />
      </DialogPortal>
      <DialogContent {...props} ref={ref} style={{ ...layout.contentStyle, ...style }} className={className} />
    </>
  )
})
GitPageDialogContent.displayName = "GitPageDialogContent"
