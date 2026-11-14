import { Dialog, DialogContent, DialogPortal } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { forwardRef, type ComponentProps, type ElementRef } from "react"

/** Git dialogs leave the activity bar available for navigation. */
export function GitPageDialog(props: ComponentProps<typeof Dialog>) {
  return <Dialog {...props} modal={false} />
}

export const GitPageDialogContent = forwardRef<ElementRef<typeof DialogContent>, ComponentProps<typeof DialogContent>>(({ className, ...props }, ref) => (
  <>
    <DialogPortal>
      <div aria-hidden="true" data-git-dialog-overlay className="fixed inset-y-0 right-0 left-[52px] z-50 bg-black/[.04] backdrop-blur-[3px]" />
    </DialogPortal>
    <DialogContent {...props} ref={ref} className={cn("left-[calc(50%+26px)] w-[calc(100%-52px)]", className)} />
  </>
))
GitPageDialogContent.displayName = "GitPageDialogContent"
