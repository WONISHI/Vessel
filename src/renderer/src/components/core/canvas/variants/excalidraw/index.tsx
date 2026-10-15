import { useEffect, useRef, useState, useCallback, useMemo, useContext, Fragment } from "react"
import { Excalidraw, exportToBlob, exportToSvg } from "@excalidraw/excalidraw"
import "@excalidraw/excalidraw/index.css"
import { toast } from "sonner"
import {
  parseExcalidrawDocument,
  serializeExcalidrawDocument,
  createNewExcalidrawContent,
  type ParsedExcalidrawScene
} from "./parser"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Code, LayoutTemplate, Download, Trash2, CheckCircle2, LoaderCircle } from "lucide-react"
import CodeCanvas from "@/components/core/canvas/variants/code"
import { WorkspaceContext } from "@/pages/workspace/types/workspace"

export interface ExcalidrawCanvasProps {
  activeFilePath: string
  workspacePath?: string
}

function computeSceneContentHash(elements: readonly any[], appState: any): string {
  let str = `bg:${appState?.viewBackgroundColor || ""};grid:${appState?.gridSize ?? ""};`
  for (const el of elements) {
    if (!el.isDeleted) {
      str += `${el.id}:${el.version}:${el.versionNonce};`
    }
  }
  return str
}

export default function ExcalidrawCanvas({ activeFilePath, workspacePath = "" }: ExcalidrawCanvasProps) {
  const [scene, setScene] = useState<ParsedExcalidrawScene | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [viewMode, setViewMode] = useState<"canvas" | "code">("canvas")
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved")

  const excalidrawAPIRef = useRef<any>(null)
  const originalRawContent = useRef<string>("")
  const isInitialMount = useRef(true)
  const lastSavedHash = useRef<string>("")
  const latestScene = useRef<{ elements: any[]; appState: any; files: any }>({
    elements: [],
    appState: {},
    files: {}
  })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // 1. 读取并解析文档
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")
    isInitialMount.current = true

    window.electronAPI
      .readContent(activeFilePath)
      .then((raw) => {
        if (cancelled) return
        let text = raw
        if (!text || !text.trim()) {
          text = createNewExcalidrawContent(activeFilePath.split(/[\\/]/).pop())
          void window.electronAPI.saveContent(activeFilePath, text).catch(() => {})
        }
        originalRawContent.current = text
        const parsed = parseExcalidrawDocument(text)
        setScene(parsed)
        latestScene.current = {
          elements: parsed.elements,
          appState: parsed.appState,
          files: parsed.files
        }
        lastSavedHash.current = computeSceneContentHash(parsed.elements, parsed.appState)
        setLoading(false)
        setSaveStatus("saved")
      })
      .catch((err) => {
        if (cancelled) return
        setError(String(err))
        setLoading(false)
      })

    return () => {
      cancelled = true
      clearTimeout(saveTimer.current)
    }
  }, [activeFilePath])

  // 2. 画布变化处理与防抖自动保存（仅在图元、版本或背景真正发生改变时保存，忽略鼠标移动与平移）
  const handleChange = useCallback(
    (elements: readonly any[], appState: any, files: any) => {
      latestScene.current = { elements: elements as any[], appState, files }
      const currentHash = computeSceneContentHash(elements, appState)

      // 忽略初次挂载触发的 onChange，避免无意义的初始写入或覆盖
      if (isInitialMount.current) {
        isInitialMount.current = false
        lastSavedHash.current = currentHash
        return
      }

      // 如果图元数据与版本未发生改变（例如鼠标单纯移动、悬停、画布缩放平移），绝不触发保存
      if (currentHash === lastSavedHash.current) {
        return
      }

      setSaveStatus("saving")
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        try {
          const serialized = serializeExcalidrawDocument(
            { elements: latestScene.current.elements, appState: latestScene.current.appState, files: latestScene.current.files },
            originalRawContent.current
          )
          originalRawContent.current = serialized
          void window.electronAPI
            .saveContent(activeFilePath, serialized)
            .then(() => {
              lastSavedHash.current = currentHash
              setSaveStatus("saved")
            })
            .catch((err) => {
              toast.error(`保存失败：${String(err)}`)
              setSaveStatus("saved")
            })
        } catch (e) {
          console.error("Failed to serialize excalidraw:", e)
          setSaveStatus("saved")
        }
      }, 500)
    },
    [activeFilePath]
  )

  // 4. 导出为图片 / 矢量 / JSON
  const handleExportPNG = async () => {
    const api = excalidrawAPIRef.current
    if (!api) return
    try {
      const elements = api.getSceneElements()
      if (!elements.length) {
        toast.info("画布暂无内容可导出")
        return
      }
      const blob = await exportToBlob({
        elements,
        appState: { ...api.getAppState(), exportWithDarkMode: false },
        files: api.getFiles(),
        mimeType: "image/png"
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const baseName = activeFilePath.split(/[\\/]/).pop()?.replace(/\.(excalidraw(\.md)?|canvas)$/i, "") || "drawing"
      a.href = url
      a.download = `${baseName}.png`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("已导出 PNG 图片")
    } catch (e) {
      toast.error(`导出 PNG 失败：${String(e)}`)
    }
  }

  const handleExportSVG = async () => {
    const api = excalidrawAPIRef.current
    if (!api) return
    try {
      const elements = api.getSceneElements()
      if (!elements.length) {
        toast.info("画布暂无内容可导出")
        return
      }
      const svg = await exportToSvg({
        elements,
        appState: { ...api.getAppState(), exportWithDarkMode: false },
        files: api.getFiles()
      })
      const svgString = new XMLSerializer().serializeToString(svg)
      const blob = new Blob([svgString], { type: "image/svg+xml" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const baseName = activeFilePath.split(/[\\/]/).pop()?.replace(/\.(excalidraw(\.md)?|canvas)$/i, "") || "drawing"
      a.href = url
      a.download = `${baseName}.svg`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("已导出 SVG 矢量图")
    } catch (e) {
      toast.error(`导出 SVG 失败：${String(e)}`)
    }
  }

  const handleExportJSON = () => {
    const api = excalidrawAPIRef.current
    if (!api) return
    const payload = {
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: api.getSceneElements(),
      appState: api.getAppState(),
      files: api.getFiles()
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const baseName = activeFilePath.split(/[\\/]/).pop()?.replace(/\.(excalidraw(\.md)?|canvas)$/i, "") || "drawing"
    a.href = url
    a.download = `${baseName}.excalidraw`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("已导出 Excalidraw JSON")
  }

  const handleClear = () => {
    const api = excalidrawAPIRef.current
    if (!api) return
    if (confirm("确定清空白板内容吗？此操作无法撤销。")) {
      api.resetScene()
      handleChange([], api.getAppState(), {})
      toast.success("白板已清空")
    }
  }

  const context = useContext(WorkspaceContext)
  const effectiveWorkspacePath = (workspacePath || context?.workspace?.path || "").replace(/[\\/]+$/, "")

  // 路径面包屑：工作区目录名 > 子目录... > 文件名（参考截图2样式）
  const breadcrumbSegments = useMemo(() => {
    const rootName = context?.workspace?.name || effectiveWorkspacePath.split(/[\\/]/).filter(Boolean).pop() || "工作区"
    if (!effectiveWorkspacePath || !activeFilePath.startsWith(effectiveWorkspacePath)) {
      const parts = activeFilePath.split(/[\\/]/).filter(Boolean)
      return parts.length ? parts : [rootName]
    }
    const relative = activeFilePath.slice(effectiveWorkspacePath.length)
    const subParts = relative.split(/[\\/]/).filter(Boolean)
    return [rootName, ...subParts]
  }, [effectiveWorkspacePath, activeFilePath, context?.workspace?.name])

  const handleJumpRoute = useCallback(
    (index: number) => {
      if (!effectiveWorkspacePath) return
      if (index === 0) {
        window.dispatchEvent(new CustomEvent("vessel:reveal-file", { detail: effectiveWorkspacePath }))
        return
      }
      const relativeParts = breadcrumbSegments.slice(1, index + 1)
      const targetPath = `${effectiveWorkspacePath}/${relativeParts.join("/")}`
      window.dispatchEvent(new CustomEvent("vessel:reveal-file", { detail: targetPath }))
    },
    [effectiveWorkspacePath, breadcrumbSegments]
  )

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs text-stone-400">
        <LoaderCircle className="mr-2 size-4 animate-spin text-green-600" />
        正在加载白板…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-sm text-red-500">
        加载白板失败：{error}
      </div>
    )
  }

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col bg-white">
      {/* 1. 顶部面包屑导航（参考截图2样式） */}
      <Breadcrumb className="shrink-0 px-4 pt-2" aria-label="当前白板路径">
        <BreadcrumbList className="text-xs">
          {breadcrumbSegments.map((part, index, parts) => {
            const isLast = index === parts.length - 1
            return (
              <Fragment key={index}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem className="min-w-0">
                  {isLast ? (
                    <BreadcrumbPage
                      className="cursor-pointer truncate max-w-64 hover:text-stone-900 transition-colors"
                      title={part}
                      onClick={() => handleJumpRoute(index)}
                    >
                      {part}
                    </BreadcrumbPage>
                  ) : (
                    <span
                      className="cursor-pointer hover:text-stone-700 transition-colors"
                      onClick={() => handleJumpRoute(index)}
                    >
                      {part}
                    </span>
                  )}
                </BreadcrumbItem>
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>

      {/* 2. 操作按钮工具栏（截图3操作按钮单独占一行） */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[#f0efed] bg-white px-4 text-xs">
        {/* 保存状态 */}
        <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
          {saveStatus === "saving" ? (
            <>
              <LoaderCircle className="size-3 animate-spin text-stone-400" />
              <span>正在保存…</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="size-3 text-green-600" />
              <span>已保存</span>
            </>
          )}
        </div>

        {/* 右侧操作按钮 */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* 模式切换：白板视图 / 源码视图 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2.5 text-xs ${viewMode === "canvas" ? "bg-green-50 text-green-700 hover:bg-green-100" : "text-stone-600 hover:bg-stone-100"}`}
                onClick={() => setViewMode("canvas")}
              >
                <LayoutTemplate className="mr-1.5 size-3.5" />
                白板视图
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">可视化的 Excalidraw 白板绘图</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2.5 text-xs ${viewMode === "code" ? "bg-green-50 text-green-700 hover:bg-green-100" : "text-stone-600 hover:bg-stone-100"}`}
                onClick={() => setViewMode("code")}
              >
                <Code className="mr-1.5 size-3.5" />
                源码视图
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">查看和编辑底层 Markdown / JSON 代码</TooltipContent>
          </Tooltip>

          {/* 导出菜单 */}
          {viewMode === "canvas" && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7 text-stone-600 hover:bg-stone-100" aria-label="导出白板">
                      <Download className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">导出白板</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-36 text-xs bg-white">
                <DropdownMenuItem onSelect={handleExportPNG}>导出为 PNG 图片</DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExportSVG}>导出为 SVG 矢量图</DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExportJSON}>导出为 JSON 文件</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* 清空白板 */}
          {viewMode === "canvas" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-stone-600 hover:bg-stone-100 hover:text-red-600"
                  aria-label="清空白板"
                  onClick={handleClear}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">清空白板所有内容</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* 主视图区域 */}
      <main className="relative flex-1 min-h-0 min-w-0 overflow-hidden">
        {viewMode === "canvas" ? (
          <div className="absolute inset-0 size-full">
            <Excalidraw
              excalidrawAPI={(api) => {
                excalidrawAPIRef.current = api
              }}
              initialData={{
                elements: scene?.elements || [],
                appState: {
                  viewBackgroundColor: scene?.appState?.viewBackgroundColor || "#ffffff",
                  gridSize: scene?.appState?.gridSize ?? null,
                  theme: "light",
                  zenModeEnabled: false,
                  viewModeEnabled: false
                },
                files: scene?.files || {}
              }}
              onChange={handleChange}
              langCode="zh-CN"
            />
          </div>
        ) : (
          <CodeCanvas activeFilePath={activeFilePath} />
        )}
      </main>
    </div>
  )
}
