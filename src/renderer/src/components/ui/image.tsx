import { toast } from "sonner"
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "./context-menu"
import { ImageEditorSheet } from "@/pages/image-preview/editor-sheet"
import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react"
import { Dialog, DialogContent, DialogTitle } from "./dialog"
import { Resizable } from "./resizable"
import { cn } from "@/lib/utils"
import placeholderSquare from "@/assets/vessel-image-placeholder/placeholder-1x1.svg"
import placeholderWide from "@/assets/vessel-image-placeholder/placeholder-16x9.svg"
import placeholder from "@/assets/vessel-image-placeholder/placeholder-4x3.svg"
import loadingSquare from "@/assets/vessel-image-placeholder/loading-1x1.svg"
import loadingWide from "@/assets/vessel-image-placeholder/loading-16x9.svg"
import loading from "@/assets/vessel-image-placeholder/loading-4x3.svg"
import errorSquare from "@/assets/vessel-image-placeholder/error-1x1.svg"
import errorWide from "@/assets/vessel-image-placeholder/error-16x9.svg"
import error from "@/assets/vessel-image-placeholder/error-4x3.svg"

export interface ImageProps extends Omit<ComponentPropsWithoutRef<"img">, "width"> {
  onFocusBelow?: () => void
  width?: number
  resizable?: boolean
  onResizeEnd?: (width: number) => void
  /** 本地附件等异步来源，仅在进入可视区域后调用。 */
  loadSource?: () => Promise<string>
  sourceKey?: string
  placeholderRatio?: "1x1" | "4x3" | "16x9"
}
const artwork = {
  "1x1": { placeholder: placeholderSquare, loading: loadingSquare, error: errorSquare },
  "4x3": { placeholder, loading, error },
  "16x9": { placeholder: placeholderWide, loading: loadingWide, error: errorWide }
}
/** 切换来源时重新建立加载状态，避免旧图片的事件污染新来源。 */
export function Image(props: ImageProps) {
  return (
    <ImageContent
      key={props.sourceKey ?? props.src ?? "empty"}
      {...props}
    />
  )
}
function ImageContent({ src, srcSet, alt = "", width = 480, resizable = true, className, onError, onLoad, onResizeEnd, loadSource, onFocusBelow, sourceKey: _sourceKey, placeholderRatio = "4x3", loading: _loading, ...props }: ImageProps) {
  const host = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [resolved, setResolved] = useState<string>()
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [zoomed, setZoomed] = useState(false)
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
      aria-busy={phase === "loading" && !loaded}
    >
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
      <ContextMenu><ContextMenuTrigger asChild><span className="block">{resizable ? (
        <Resizable
          defaultWidth={width}
          onResizeEnd={onResizeEnd}
        >
          {content}
        </Resizable>
      ) : (
        content
      )}
      </span></ContextMenuTrigger><ContextMenuContent onCloseAutoFocus={event => event.preventDefault()} className="z-[260]">
        <ContextMenuItem disabled={!loaded || !resolved} onSelect={() => { if (resolved) void imageClipboardSource(resolved).then(source => window.electronAPI.copyImage(source)).catch(error => toast.error(String(error))) }}>复制</ContextMenuItem>
        {onFocusBelow && <ContextMenuItem onSelect={() => requestAnimationFrame(onFocusBelow)}>在下方聚焦</ContextMenuItem>}
        {[["crop", "截图"], ["ocr", "OCR 识别"], ["annotate", "标注"], ["convert", "格式转换"], ["compress", "压缩"], ["watermark", "加水印"], ["color", "取主色调"]].map(([id, title]) => <ContextMenuItem key={id} disabled={!loaded || !resolved || failed} onSelect={() => setTool(id)}>{title}</ContextMenuItem>)}
      </ContextMenuContent></ContextMenu>
      {resolved && tool && <ImageEditorSheet open={tool !== null} onOpenChange={open => { if (!open) setTool(null) }} source={resolved} tool={tool || "ocr"} />}
      <Dialog
        open={zoomed && loaded && !failed}
        onOpenChange={setZoomed}
      >
        <DialogContent
          className="max-w-[95vw] w-fit max-h-[95vh] p-6"
          aria-describedby={undefined}
          onCloseAutoFocus={event => event.preventDefault()}
        >
          <DialogTitle className="sr-only">{alt || "图片预览"}</DialogTitle>
          <img
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

// SVG exports without an XML namespace are valid inline markup but fail as img sources.
function normalizeSvg(source?: string): string | undefined {
  if (!source?.startsWith("data:image/svg+xml")) return source
  try {
    const comma = source.indexOf(",")
    const raw = source.slice(0, comma).includes(";base64") ? new TextDecoder().decode(Uint8Array.from(atob(source.slice(comma + 1)), c => c.charCodeAt(0))) : decodeURIComponent(source.slice(comma + 1))
    const svg = new DOMParser().parseFromString(raw, "image/svg+xml")
    if (svg.documentElement.localName !== "svg") return source
    svg.documentElement.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg))
  } catch { return source }
}

async function imageClipboardSource(source: string): Promise<string> {
  if (source.startsWith("data:image/")) {
    const comma = source.indexOf(",")
    if (source.slice(0, comma).includes(";base64")) return source
    const bytes = new TextEncoder().encode(decodeURIComponent(source.slice(comma + 1)))
    let binary = ""
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return source.slice(0, comma) + ";base64," + btoa(binary)
  }
  const response = await fetch(source)
  if (!response.ok) throw new Error("无法读取图片")
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
