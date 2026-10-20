import { importToolboxImage } from "@/components/image-toolbox/import-state"
import { selectTransit } from "@/components/transit/state"
import { useRouter } from "@vessel/react-router"
import { countDocument } from "@/components/core/canvas/variants/markdown/count-document"
import { formatBytes } from "@/components/image-toolbox/components/image-toolbox-shared"
import { useEffect, useMemo, useState } from "react"
import { codeLanguage } from "@/components/core/canvas/variants/code/language"
import { StatusBar } from "@/components/ui/status-bar"
import type { TransitItem } from "@/components/transit/state"
import type { TransitFile } from "@vessel/type"
import { Clipboard, Copy, Download, FileText, Globe, RotateCw, Search, Pencil, Type, CaseSensitive, ImageIcon } from "lucide-react"
import { toast } from "sonner"

/** Shows metadata and working actions for the current transit item. */
export function TransitStatus({ item, file, onRefresh, onSearch }: { item: TransitItem; file?: TransitFile; onRefresh: () => void; onSearch?: () => void }) {
  const router = useRouter()
  const [imageMeta, setImageMeta] = useState<{ source: string; width: number; height: number; bytes: number } | null>(null)
  const stats = useMemo(() => file?.kind === "markdown" ? countDocument(file.content) : null, [file])
  useEffect(() => {
    if (file?.kind !== "image") return
    let active = true
    const image = new window.Image()
    image.onload = () => {
      const base64 = file.content.split(",")[1] || ""
      const bytes = Math.max(0, Math.floor(base64.length * 3 / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0))
      if (active) setImageMeta({ source: file.content, width: image.naturalWidth, height: image.naturalHeight, bytes })
    }
    image.src = file.content
    return () => { active = false; image.onload = null }
  }, [file])
  const label = item.kind === "text" ? "剪贴板文本" : item.kind === "url" ? (URL.canParse(item.content) ? new URL(item.content).hostname : item.content) : item.title
  const detail = item.kind === "text" ? `${Array.from(item.content).length} 字` : item.kind === "url" ? "网页" : file?.kind === "text" ? codeLanguage(item.content) || "纯文本" : file?.kind === "markdown" ? "Markdown" : file?.kind === "office" ? "WPS" : file?.kind === "pdf" ? "PDF" : file?.kind === "image" ? "图片" : "文件"
  /** Copies text or downloads the original image content. */
  const action = async () => {
    try {
      if (file?.kind === "image") {
        const link = document.createElement("a")
        link.href = file.content
        link.download = item.title
        link.click()
      } else {
        await navigator.clipboard.writeText(item.content)
        toast.success("已复制到剪贴板")
      }
    } catch (error) { toast.error("操作失败", { description: error instanceof Error ? error.message : String(error) }) }
  }
  return (
    <>
    <StatusBar className="transit-status-bar" left={
      <div className="transit-status-info">
        <span data-title={item.kind === "file" ? item.content : label} className="transit-bar-static transit-status-name">{item.kind === "text" ? <Clipboard /> : item.kind === "url" ? <Globe /> : <FileText />}<span>{label}</span></span>
        <span className="transit-bar-static">{detail}</span>
        {file?.kind === "text" && <span className="transit-bar-static">{file.content.split(/\r?\n/).length} 行</span>}
        {stats && <><span className="transit-bar-static"><Type />{stats.words.toLocaleString()} 词</span><span className="transit-bar-static"><CaseSensitive />{stats.characters.toLocaleString()} 字</span></>}
        {file?.kind === "image" && imageMeta?.source === file.content && <><span className="transit-bar-static"><ImageIcon />{imageMeta.width} × {imageMeta.height}</span><span className="transit-bar-static">{formatBytes(imageMeta.bytes)}</span></>}
      </div>
      } right={<div className="transit-status-actions">
        {(item.kind === "text" || file?.kind === "image") && <button className="transit-bar-item" data-title={file?.kind === "image" ? "下载图片" : "复制"} aria-label={file?.kind === "image" ? "下载图片" : "复制中转文本"} onClick={() => void action()}>{file?.kind === "image" ? <Download /> : <Copy />}<span>{file?.kind === "image" ? "下载" : "复制"}</span></button>}
        {item.kind === "url" && <button className="transit-bar-item" data-title="搜索网页" aria-label="搜索中转网页" onClick={onSearch}><Search /><span>搜索</span></button>}
        {file?.kind === "image" && <button className="transit-bar-item" data-title="编辑图片" aria-label="编辑中转图片" onClick={() => { importToolboxImage(file.content); void router.push("/image"); selectTransit(null) }}><Pencil /><span>编辑</span></button>}
        {item.kind === "url" && <button className="transit-bar-item" data-title="刷新网页" aria-label="刷新中转网页" onClick={onRefresh}><RotateCw /><span>刷新</span></button>}
      </div>} />
    </>
  )
}
