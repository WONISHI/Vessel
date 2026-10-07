import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { ImageToolbox } from './image-toolbox'
export function ImageEditorSheet({ open, onOpenChange, source, tool = "ocr" }: { open: boolean; onOpenChange: (open: boolean) => void; source: string; tool?: string; onCrop?: () => void }) {
  return <Sheet modal={false} open={open} onOpenChange={onOpenChange}>
    <SheetContent onCloseAutoFocus={event => event.preventDefault()} showOverlay={false} className="z-[250] flex w-[min(1100px,94vw)] flex-col gap-0 p-0 sm:max-w-none">
      <SheetTitle className="sr-only">图片工具箱</SheetTitle>
      <SheetDescription className="sr-only">缩放、裁剪、标注、OCR 等图片处理</SheetDescription>
      <ImageToolbox key={`${source}:${tool}`} initialImage={source} initialTool={tool} embedded />
    </SheetContent>
  </Sheet>
}
