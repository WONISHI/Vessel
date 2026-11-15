import { QRCodeSVG } from "qrcode.react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogPortal, DialogTitle } from "@/components/ui/dialog"

export default function BrowserMobileDialog({ url, onClose }: { url: string; onClose: () => void }) {
  // Byte-mode QR capacity at level L. Avoid letting an oversized URL throw during render.
  const tooLong = new TextEncoder().encode(url).length > 2953
  return <Dialog open modal={false} onOpenChange={open => { if (!open) onClose() }}>
    <DialogPortal><div aria-hidden="true" data-browser-mobile-overlay className="fixed top-0 right-0 bottom-8 left-[52px] z-[230] bg-black/[.04] backdrop-blur-[3px]" /></DialogPortal>
    <DialogContent onFocusOutside={event => event.preventDefault()} className="z-[231] left-[calc(50%+26px)] w-[calc(100vw-84px)] max-w-sm max-h-[calc(100vh-64px)] overflow-y-auto">
      <DialogHeader><DialogTitle>手机访问</DialogTitle><DialogDescription>使用手机相机或扫一扫，打开当前网页。</DialogDescription></DialogHeader>
      {tooLong ? <p role="alert" className="rounded-lg border p-4 text-sm text-muted-foreground">当前网页地址过长，无法生成二维码。</p> : <div className="mx-auto w-fit max-w-full rounded-xl border bg-white p-3"><QRCodeSVG value={url} size={224} level="L" marginSize={4} bgColor="#ffffff" fgColor="#111111" title="当前网页访问二维码" className="max-w-full h-auto" /></div>}
      <p className="truncate text-center text-sm font-medium">{new URL(url).hostname}</p>
      <p title={url} className="select-text truncate rounded-md bg-muted/50 px-3 py-2 font-mono text-[10px] text-muted-foreground">{url}</p>
    </DialogContent>
  </Dialog>
}
