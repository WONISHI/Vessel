import { ImageEditorSheet } from "@/components/image-preview/editor-sheet"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { artwork, ImageProps, normalizeSvg } from "@/components/ui/image/components/image-shared"
import { Resizable } from "@/components/ui/resizable"
import { cn } from "@/lib/utils"
import { ImageDown, RotateCw, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

/** Renders the image content component. */
export function ImageContent({
  remote = false,
  src,
  sourceAddress,
  srcSet,
  alt = "",
  width = 480,
  defaultWidthPercent,
  resizable = true,
  className,
  onError,
  onLoad,
  onResizeEnd,
  loadSource,
  onFocusAbove,
  onFocusBelow,
  onViewLink,
  onCopyReference,
  onDelete,
  onDownloadLocal,
  sourceKey: _sourceKey,
  placeholderRatio = "4x3",
  loading: _loading,
  ...props
}: ImageProps) {
  const host = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [resolved, setResolved] = useState<string>()
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [tool, setTool] = useState<string | null>(null)
  useEffect(() => {
    if (!host.current) return
    let active = true
    if (typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => {
        if (active) setVisible(true)
      })
      return () => {
        active = false
      }
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "0px", threshold: 0 }
    )
    observer.observe(host.current)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [])
  useEffect(() => {
    if (!visible) return
    let active = true
    Promise.resolve()
      .then(() => (loadSource ? loadSource() : src))
      .then((value) => {
        if (active) {
          setResolved(normalizeSvg(value))
          if (loadSource && !value) setFailed(true)
        }
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [visible, src, loadSource])
  const phase = failed ? "error" : !visible || (!src && !srcSet && !loadSource) ? "placeholder" : "loading"
  const content = (
    <span
      ref={host}
      className="relative block w-full"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.stopPropagation()
        if (loaded) setZoomed(true)
      }}
      aria-busy={phase === "loading" && !loaded}
    >
      {remote && (
        <span
          data-title="远程图片"
          className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-white/90 p-1 text-stone-500 shadow-sm"
        >
          <ImageDown className="size-4" />
        </span>
      )}
      {!loaded && (
        <img
          src={artwork[placeholderRatio][phase]}
          alt={phase === "error" ? "图片不存在或无法读取" : phase === "loading" ? "正在加载图片" : "图片占位图"}
          className="block h-auto w-full rounded-md"
        />
      )}
      {visible && !failed && (resolved || srcSet) && (
        <img
          {...props}
          src={resolved}
          srcSet={srcSet}
          alt={alt}
          decoding="async"
          className={cn("block h-auto w-full rounded-md object-contain", !loaded && "absolute inset-0 opacity-0", className)}
          onLoad={(event) => {
            setLoaded(true)
            onLoad?.(event)
          }}
          onError={(event) => {
            setFailed(true)
            setLoaded(false)
            onError?.(event)
          }}
          onDoubleClick={(event) => {
            event.stopPropagation()
            if (loaded) setZoomed(true)
            props.onDoubleClick?.(event)
          }}
        />
      )}
    </span>
  )
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <span className="block">
            {resizable ? (
              <Resizable
                defaultWidth={width}
                defaultWidthPercent={defaultWidthPercent}
                onResizeEnd={onResizeEnd}
              >
                {content}
              </Resizable>
            ) : (
              content
            )}
          </span>
        </ContextMenuTrigger>
        <ContextMenuContent
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="z-[260]"
        >
          <ContextMenuItem
            disabled={!onCopyReference && !(sourceAddress || src)}
            onSelect={() => {
              if (onCopyReference) { onCopyReference(); return }
              const address = sourceAddress || src
              if (address) void navigator.clipboard.writeText(address)
                .then(() => toast.success("已复制图片地址"))
                .catch((error) => toast.error(String(error)))
            }}
          >
            复制
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!onDownloadLocal || downloading}
            onSelect={() => {
              if (!onDownloadLocal) return
              setDownloading(true)
              void onDownloadLocal()
                .catch((error) => toast.error(String(error)))
                .finally(() => setDownloading(false))
            }}
          >
            {downloading ? "正在下载…" : "下载并且替换本地图片"}
          </ContextMenuItem>
          {(onFocusAbove || onFocusBelow) && (
            <ContextMenuSub>
              <ContextMenuSubTrigger>聚焦</ContextMenuSubTrigger>
              <ContextMenuSubContent className="z-[260]">
                <ContextMenuItem
                  disabled={!onFocusAbove}
                  onSelect={() => requestAnimationFrame(onFocusAbove!)}
                >
                  在上方聚焦
                </ContextMenuItem>
                <ContextMenuItem
                  disabled={!onFocusBelow}
                  onSelect={() => requestAnimationFrame(onFocusBelow!)}
                >
                  在下方聚焦
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}
          <ContextMenuSub>
            <ContextMenuSubTrigger disabled={!loaded || !resolved || failed}>图片编辑</ContextMenuSubTrigger>
            <ContextMenuSubContent className="z-[260]">
              {[
                ["crop", "截图"],
                ["ocr", "OCR 识别"],
                ["annotate", "标注"],
                ["convert", "格式转换"],
                ["compress", "压缩"],
                ["watermark", "加水印"],
                ["color", "取主色调"]
              ].map(([id, title]) => (
                <ContextMenuItem
                  key={id}
                  disabled={!loaded || !resolved || failed}
                  onSelect={() => setTool(id)}
                >
                  {title}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          {(onViewLink || src || resolved) && (
            <ContextMenuItem
              onSelect={() => {
                if (onViewLink) onViewLink()
                else if (src || resolved) {
                  void navigator.clipboard.writeText(src || resolved || "")
                  toast.success("已复制图片链接")
                }
              }}
            >
              查看图片链接
            </ContextMenuItem>
          )}
          {onDelete && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="text-red-600 focus:bg-red-600 focus:text-white data-[highlighted]:bg-red-600 data-[highlighted]:!text-white"
                onSelect={onDelete}
              >
                删除
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {resolved && tool && (
        <ImageEditorSheet
          open={tool !== null}
          onOpenChange={(open) => {
            if (!open) setTool(null)
          }}
          source={resolved}
          tool={tool || "ocr"}
        />
      )}
      <Dialog
        open={zoomed && loaded && !failed}
        onOpenChange={setZoomed}
      >
        <DialogContent
          showCloseButton={false}
          overlayClassName="z-[269]"
          className="z-[270] max-w-[95vw] w-fit max-h-[95vh] p-6"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DialogTitle className="sr-only">{alt || "图片预览"}</DialogTitle>
          <div className="flex justify-end gap-2">
            <button
              aria-label="旋转图片"
              onClick={() => setRotation((value) => value + 90)}
            >
              <RotateCw className="size-4" />
            </button>
            <button
              aria-label="关闭图片预览"
              onClick={() => setZoomed(false)}
            >
              <X className="size-4" />
            </button>
          </div>
          <img
            style={{ transform: `rotate(${rotation}deg)` }}
            src={resolved}
            srcSet={srcSet}
            alt={alt}
            className="max-h-[85vh] max-w-[90vw] object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
