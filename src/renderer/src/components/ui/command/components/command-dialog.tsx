import { Command } from "@/components/ui/command/components/command"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { type DialogProps } from "@radix-ui/react-dialog"

/** Renders the command dialog component. */
export const CommandDialog = ({ children, ...props }: DialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[279] bg-black/[.04] backdrop-blur-[3px]"
        className="vessel-command-dialog z-[280] top-[14vh] max-h-[70vh] w-[400px] max-w-[92vw] sm:max-w-[400px] translate-y-0 gap-0 overflow-hidden rounded-2xl border-[#e3e3e2] bg-white p-0 shadow-[0_24px_70px_-12px_#00000038,0_8px_24px_-8px_#0000001f] sm:rounded-2xl"
      >
        <DialogTitle className="sr-only">命令菜单</DialogTitle>
        <DialogDescription className="sr-only">搜索并执行命令</DialogDescription>
        <Command className="vessel-command rounded-none bg-white text-[#1a1a18]">{children}</Command>
      </DialogContent>
    </Dialog>
  )
}
