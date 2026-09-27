import { useState, type ComponentPropsWithoutRef } from "react"
import { ImageOff } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "./dialog"
import { Resizable } from "./resizable"
import { cn } from "@/lib/utils"

export interface ImageProps extends Omit<ComponentPropsWithoutRef<"img">, "width"> {
  width?: number
  resizable?: boolean
  onResizeEnd?: (width: number) => void
}
/** 通用图片：加载失败占位、可访问替代文本，以及可拖动的尺寸容器。 */
export function Image({ src, alt = "", width = 480, resizable = true, className, onError, onResizeEnd, ...props }: ImageProps) {
  const [zoomed, setZoomed] = useState(false)
  const [failedSource, setFailedSource] = useState<string | undefined>()
  const failed = !src || failedSource === src
  const content = failed ? (
    <span
      role="img"
      aria-label={alt || "图片无法加载"}
      className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/40 p-4 text-xs text-muted-foreground"
    >
      <ImageOff className="size-6" />
      <span>{alt || "图片无法加载"}</span>
      <span>图片不存在或无法读取</span>
    </span>
  ) : (
    <img
      {...props}
      src={src}
      alt={alt}
      className={cn("block h-auto w-full rounded-md object-contain", className)}
      loading="lazy"
      onDoubleClick={(event) => {
        event.stopPropagation()
        setZoomed(true)
        props.onDoubleClick?.(event)
      }}
      onError={(event) => {
        setFailedSource(src)
        onError?.(event)
      }}
    />
  )
  const preview = resizable ? (
    <Resizable
      defaultWidth={width}
      onResizeEnd={onResizeEnd}
    >
      {content}
    </Resizable>
  ) : (
    content
  )
  return (
    <>
      {preview}
      <Dialog
        open={zoomed && !failed}
        onOpenChange={setZoomed}
      >
        <DialogContent
          className="max-w-[95vw] w-fit max-h-[95vh] p-6"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">{alt || "图片预览"}</DialogTitle>
          <img
            src={src}
            alt={alt}
            className="max-h-[85vh] max-w-[90vw] object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
