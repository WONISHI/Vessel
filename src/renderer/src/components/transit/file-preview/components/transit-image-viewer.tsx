import { Image } from "@/components/ui/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEffect, useState } from "react"

/** Both docked and standalone previews start with the complete image fitted inside the canvas. */
export function TransitImageViewer({ src, name }: { src: string; name: string }) {
  return <TransitImageContent key={src} src={src} name={name} />
}

function TransitImageContent({ src, name }: { src: string; name: string }) {
  const [zoom, setZoom] = useState(1)
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const [bounds, setBounds] = useState({ width: 0, height: 0 })
  const [detailsHidden, setDetailsHidden] = useState(false)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!viewport) return
    const observer = new ResizeObserver(() => setBounds({ width: viewport.clientWidth, height: viewport.clientHeight }))
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [viewport])
  const measured = size.width > 0 && size.height > 0 && bounds.width > 32 && bounds.height > 32
  const fit = measured ? Math.min(1, (bounds.width - 32) / size.width, (bounds.height - 32) / size.height) : 1
  const scale = fit * zoom
  const mime = /^data:([^;,]+)/.exec(src)?.[1] ?? "image"
  const bytes = src.startsWith("data:") && src.includes(";base64,") ? Math.floor((src.length - src.indexOf(",") - 1) * 3 / 4) : 0
  const details: [string, string][] = [
    ["文件名", name],
    ["格式", mime],
    ["原始宽高", size.width ? `${size.width} × ${size.height} px` : "—"],
    ["像素总数", size.width ? `${(size.width * size.height).toLocaleString()} 像素` : "—"],
    ["原始宽高比", size.height ? (size.width / size.height).toFixed(3) : "—"],
    ["显示比例", `${Math.round(scale * 100)}%${scale === 1 ? "（原始尺寸）" : ""}`],
    ...(bytes ? [["文件大小", `${bytes.toLocaleString()} 字节（${(bytes / 1024).toFixed(1)} KB）`] as [string, string]] : [])
  ]
  return (
    <div className={`grid min-h-0 min-w-0 flex-1 ${detailsHidden ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_minmax(180px,260px)]"} gap-4 overflow-hidden bg-white p-4`}>
      <ScrollArea viewportRef={setViewport} horizontal className="min-h-0 min-w-0 rounded-xl bg-stone-50 [&_[data-radix-scroll-area-viewport]>div]:!flex [&_[data-radix-scroll-area-viewport]>div]:min-h-full">
        <div className="flex min-w-full w-max shrink-0 items-center justify-center p-4">
          <div className="shrink-0" style={{ width: size.width ? size.width * scale : 480 }}>
            <Image
              resizable={false}
              onZoomIn={() => setZoom((value) => Math.min(8 / fit, value * 1.25))}
              onZoomOut={() => setZoom((value) => Math.max(0.1, value / 1.25))}
              detailsHidden={detailsHidden}
              onToggleDetails={() => setDetailsHidden((value) => !value)}
              src={src}
              alt={name}
              draggable={false}
              className="block"
              onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            />
          </div>
        </div>
      </ScrollArea>
      {!detailsHidden && <ScrollArea className="min-h-0 min-w-0 pr-2 [&_[data-radix-scroll-area-viewport]>div]:!block">
        <Card>
          <CardHeader className="p-4"><CardTitle className="text-sm">图片详细信息</CardTitle></CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            {details.map(([label, value]) => (
              <div key={label} className="text-xs">
                <dt className="mb-1 text-stone-400">{label}</dt>
                <dd className="break-all">{value}</dd>
              </div>
            ))}
          </CardContent>
        </Card>
      </ScrollArea>}
    </div>
  )
}

