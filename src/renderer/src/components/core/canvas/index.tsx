import { EditorLoading } from "@/components/ui/editor-loading"
import { Suspense, memo } from "react"
import { lazyWithRetry } from "@/lib/lazy-retry"
import MarkdownCanvas from "./variants/markdown"
import { codeLanguage } from "./variants/code/language"
const OfficeCanvas = lazyWithRetry(() => import("./variants/office"))
const CodeCanvas = lazyWithRetry(() => import("./variants/code"))
const ExcalidrawCanvas = lazyWithRetry(() => import("./variants/excalidraw"))
import MediaCanvas from "./variants/media"
const PdfCanvas = lazyWithRetry(() => import("./variants/pdf"))

interface EditorTabsProps {
  fileType: string | undefined
  activeFilePath: string
  workspacePath?: string
  revealPosition?: { lineNumber: number; column: number }
  highlightKeyword?: string
  revealLine?: number
}

const EditorCanvas = ({ fileType, activeFilePath, workspacePath, revealPosition, highlightKeyword, revealLine }: EditorTabsProps) => {
  fileType = fileType?.toLowerCase()
  const lowerPath = activeFilePath.toLowerCase()
  if (
    lowerPath.endsWith(".excalidraw.md") ||
    lowerPath.endsWith(".excalidraw") ||
    lowerPath.endsWith(".canvas") ||
    fileType === "canvas" ||
    fileType === "excalidraw"
  ) {
    return (
      <Suspense fallback={<EditorLoading />}>
        <ExcalidrawCanvas key={activeFilePath} activeFilePath={activeFilePath} workspacePath={workspacePath} />
      </Suspense>
    )
  }
  if (["doc", "docx", "docs", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp"].includes(fileType || "")) return <Suspense fallback={<EditorLoading kind="office" />}><OfficeCanvas key={activeFilePath} activeFilePath={activeFilePath} /></Suspense>
  if (fileType?.toLowerCase() === "pdf") return <Suspense fallback={<div>正在加载 PDF…</div>}><PdfCanvas key={activeFilePath} activeFilePath={activeFilePath} workspacePath={workspacePath} /></Suspense>
  if (fileType === "md" || fileType === "markdown") {
    return <MarkdownCanvas key={activeFilePath} activeFilePath={activeFilePath} workspacePath={workspacePath} highlightKeyword={highlightKeyword} revealLine={revealLine} />
  } else if ((codeLanguage(activeFilePath) || codeLanguage(`file.${fileType}`))) {
    return <Suspense fallback={<EditorLoading />}><CodeCanvas key={activeFilePath} activeFilePath={activeFilePath} revealPosition={revealPosition} highlightKeyword={highlightKeyword} /></Suspense>
  } else if (["png", "jpg", "jpeg", "bmp", "gif", "webp", "avif", "svg"].includes(fileType!)) {
    return <MediaCanvas key={activeFilePath} activeFilePath={activeFilePath} />
  }
  return <Suspense fallback={<EditorLoading />}><CodeCanvas key={activeFilePath} activeFilePath={activeFilePath} revealPosition={revealPosition} highlightKeyword={highlightKeyword} /></Suspense>
}

export default memo(EditorCanvas)
