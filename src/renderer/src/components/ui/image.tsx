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
function ImageContent({ src, srcSet, alt = "", width = 480, resizable = true, className, onError, onLoad, onResizeEnd, loadSource, sourceKey: _sourceKey, placeholderRatio = "4x3", loading: _loading, ...props }: ImageProps) {
  const host = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [resolved, setResolved] = useState<string>()
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [zoomed, setZoomed] = useState(false)
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
          setResolved(value)
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
      {resizable ? (
        <Resizable
          defaultWidth={width}
          onResizeEnd={onResizeEnd}
        >
          {content}
        </Resizable>
      ) : (
        content
      )}
      <Dialog
        open={zoomed && loaded && !failed}
        onOpenChange={setZoomed}
      >
        <DialogContent
          className="max-w-[95vw] w-fit max-h-[95vh] p-6"
          aria-describedby={undefined}
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
