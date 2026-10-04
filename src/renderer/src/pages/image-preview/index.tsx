import { ImageEditorSheet } from "./editor-sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useCallback, useState } from "react"
import { RotateCcw, RotateCw, Pencil, FlipHorizontal, Undo2, Download } from "lucide-react"
import { Image } from "@/components/ui/image"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"
import type { ImageFile } from "../../../../shared/image-file"
import { transformImage, type ImageOperation } from "./transform"
export default function ImagePreviewPage({ activeFilePath }: { activeFilePath: string }) {
  const { workspace } = useWorkspace()
  const [file, setFile] = useState<ImageFile>()
  const [edited, setEdited] = useState<string>()
  const [original, setOriginal] = useState({ width: 0, height: 0 })
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [display, setDisplay] = useState(480)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  const [editorOpen, setEditorOpen] = useState(false)
  const [cropping, setCropping] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 1, height: 1 })
  const [ready, setReady] = useState(false)
  const loadSource = useCallback(async () => {
    try {
      const result = await window.electronAPI.readImageFile(workspace.path, activeFilePath)
      setFile(result)
      return result.src
    } catch (error) {
      setError(String(error))
      throw error
    }
  }, [workspace.path, activeFilePath])
  const apply = async (operation: ImageOperation) => {
    if (!file || busy) return
    setBusy(true)
    setError("")
    try {
      const result = await transformImage(edited || file.src, operation)
      setReady(false)
      setEdited(result)
      setCropping(false)
    } catch (error) {
      setError(String(error))
    } finally {
      setBusy(false)
    }
  }
  const tools = [
    { label: "向左旋转 90°", Icon: RotateCcw, run: () => void apply("left") },
    { label: "向右旋转 90°", Icon: RotateCw, run: () => void apply("right") },
    { label: "水平翻转", Icon: FlipHorizontal, run: () => void apply("flip") },
    {
      label: "编辑",
      Icon: Pencil,
      run: () => {
        setEditorOpen(true)
      }
    },
    {
      label: "恢复原图",
      Icon: Undo2,
      run: () => {
        if (!edited) return
        setReady(false)
        setEdited(undefined)
        setCropping(false)
        setError("")
      }
    },
    {
      label: "导出 PNG 副本",
      Icon: Download,
      run: async () => {
        if (!file) return
        setBusy(true)
        try {
          const src = edited || (await transformImage(file.src, { x: 0, y: 0, ...dimensions }))
          const link = document.createElement("a")
          link.href = src
          link.download = file.name.replace(/\.[^.]+$/, "") + "-edited.png"
          link.click()
        } catch (error) {
          setError(String(error))
        } finally {
          setBusy(false)
        }
      }
    }
  ]
  const details: [string, string][] = file
    ? [
        ["文件名", file.name],
        ["格式", file.mime],
        ["原始宽高", `${original.width} × ${original.height} px`],
        ["当前宽高", `${dimensions.width} × ${dimensions.height} px`],
        ["像素总数", `${(original.width * original.height).toLocaleString()} 像素`],
        ["原始宽高比", original.height ? (original.width / original.height).toFixed(3) : "—"],
        ["预览宽度", `${Math.round(display)} px`],
        ["原始文件大小", `${file.size.toLocaleString()} 字节（${(file.size / 1024).toFixed(1)} KB）`],
        ["修改时间", new Date(file.modifiedAt).toLocaleString()],
        ["创建时间", new Date(file.createdAt).toLocaleString()],
        ["路径", file.path]
      ]
    : []
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(200px,280px)] gap-4 overflow-hidden p-5">
        <ScrollArea className="min-h-0 min-w-0 rounded-xl bg-stone-50 [&_[data-radix-scroll-area-viewport]>div]:!flex [&_[data-radix-scroll-area-viewport]>div]:min-h-full">
          <div className="flex min-w-0 flex-1 items-center justify-center p-4">
            <Image
              sourceKey={edited || activeFilePath}
              src={edited}
              loadSource={edited ? undefined : loadSource}
              width={display}
              alt={file?.name || "图片预览"}
              onResizeEnd={setDisplay}
              onError={() => {
                setReady(false)
                setError("无法解码图片，文件可能已损坏或格式不受支持。")
              }}
              onLoad={(event) => {
                setReady(true)
                const image = event.currentTarget
                const next = { width: image.naturalWidth, height: image.naturalHeight }
                setDimensions(next)
                if (!edited) setOriginal(next)
                setDisplay(image.getBoundingClientRect().width || 480)
              }}
            />
          </div>
        </ScrollArea>
        <ScrollArea className="min-h-0 min-w-0 pr-2 [&_[data-radix-scroll-area-viewport]>div]:!block">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-sm">图片详细信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              {!file && <p className="text-xs text-stone-400">等待加载图片…</p>}
              {details.map(([label, value]) => (
                <div
                  key={label}
                  className="text-xs"
                >
                  <dt className="mb-1 text-stone-400">{label}</dt>
                  <dd className="break-all">{value}</dd>
                </div>
              ))}
              <p className="text-[11px] text-stone-400">旋转和裁剪生成静态 PNG 副本，动图导出为单帧。</p>
            </CardContent>
          </Card>
        </ScrollArea>
      </div>
      {error && (
        <p
          role="alert"
          className="px-5 py-2 text-xs text-red-600"
        >
          {error}
        </p>
      )}
      {cropping && (
        <form
          className="flex flex-wrap items-end gap-2 border-t p-3"
          onSubmit={(event) => {
            event.preventDefault()
            void apply(crop)
          }}
        >
          {(["x", "y", "width", "height"] as const).map((key) => (
            <label
              key={key}
              className="text-xs"
            >
              {{ x: "左侧 X", y: "顶部 Y", width: "裁剪宽度", height: "裁剪高度" }[key]}
              <Input
                type="number"
                min={key === "x" || key === "y" ? 0 : 1}
                step={1}
                required
                className="mt-1 h-8 w-24 text-xs"
                value={crop[key]}
                onChange={(event) => setCrop({ ...crop, [key]: Number(event.target.value) })}
              />
            </label>
          ))}
          <Button
            disabled={busy}
            type="submit"
            className="h-8 text-xs"
          >
            应用裁剪
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setCropping(false)}
          >
            取消
          </Button>
        </form>
      )}
      {editorOpen && file && <ImageEditorSheet open={editorOpen} onOpenChange={setEditorOpen} source={edited || file.src} onCrop={() => { setCrop({ x: 0, y: 0, ...dimensions }); setCropping(true) }} />}
      <TooltipProvider>
        <div
          role="toolbar"
          aria-label="图片工具栏"
          className="flex shrink-0 justify-center gap-2 border-t p-3"
        >
          {tools.map(({ label, Icon, run }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={label}
                  aria-pressed={label === "编辑" ? editorOpen : undefined}
                  className="hover:bg-emerald-700 hover:!text-white active:bg-emerald-800 active:!text-white aria-pressed:bg-emerald-700 aria-pressed:!text-white [&:hover_svg]:!text-white [&:active_svg]:!text-white [&[aria-pressed=true]_svg]:!text-white"
                  disabled={busy || !ready}
                  onClick={run}
                >
                  <Icon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  )
}
