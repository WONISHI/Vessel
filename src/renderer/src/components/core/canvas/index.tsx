import { codeLanguage } from "@/components/core/canvas/variants/code/language"
import MarkdownCanvas from "@/components/core/canvas/variants/markdown/index"
import MediaCanvas from "@/components/core/canvas/variants/media/index"
import { EditorLoading } from "@/components/ui/editor-loading"
import { lazyWithRetry } from "@/lib/lazy-retry"
import { Suspense, memo } from "react"
const BaseCanvas = lazyWithRetry(() => import("@/components/core/canvas/variants/base"))
const OfficeCanvas = lazyWithRetry(() => import("@/components/core/canvas/variants/office/index"))
const CodeCanvas = lazyWithRetry(() => import("@/components/core/canvas/variants/code/index"))
const ExcalidrawCanvas = lazyWithRetry(() => import("@/components/core/canvas/variants/excalidraw/index"))
const PdfCanvas = lazyWithRetry(() => import("@/components/core/canvas/variants/pdf"))

interface EditorTabsProps {
  fileType: string | undefined
  activeFilePath: string
  workspacePath?: string
  revealPosition?: { lineNumber: number; column: number }
  highlightKeyword?: string
  revealLine?: number
}

/** Renders the editor canvas component. */
const EditorCanvas = ({ fileType, activeFilePath, workspacePath, revealPosition, highlightKeyword, revealLine }: EditorTabsProps) => {
  fileType = fileType?.toLowerCase()
  const lowerPath = activeFilePath.toLowerCase()
  if (fileType === "base" || lowerPath.endsWith(".base"))
    return (
      <Suspense fallback={<EditorLoading />}>
        <BaseCanvas
          key={activeFilePath}
          activeFilePath={activeFilePath}
          workspacePath={workspacePath}
        />
      </Suspense>
    )
  if (lowerPath.endsWith(".excalidraw.md") || lowerPath.endsWith(".excalidraw") || lowerPath.endsWith(".canvas") || fileType === "canvas" || fileType === "excalidraw") {
    return (
      <Suspense fallback={<EditorLoading />}>
        <ExcalidrawCanvas
          key={activeFilePath}
          activeFilePath={activeFilePath}
          workspacePath={workspacePath}
        />
      </Suspense>
    )
  }
  if (["doc", "docx", "docs", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp"].includes(fileType || ""))
    return (
      <Suspense fallback={<EditorLoading kind="office" />}>
        <OfficeCanvas
          key={activeFilePath}
          activeFilePath={activeFilePath}
        />
      </Suspense>
    )
  if (fileType?.toLowerCase() === "pdf")
    return (
      <Suspense fallback={<div>正在加载 PDF…</div>}>
        <PdfCanvas
          key={activeFilePath}
          activeFilePath={activeFilePath}
          workspacePath={workspacePath}
        />
      </Suspense>
    )
  if (fileType === "md" || fileType === "markdown") {
    return (
      <MarkdownCanvas
        key={activeFilePath}
        activeFilePath={activeFilePath}
        workspacePath={workspacePath}
        highlightKeyword={highlightKeyword}
        revealLine={revealLine}
      />
    )
  } else if (codeLanguage(activeFilePath) || codeLanguage(`file.${fileType}`)) {
    return (
      <Suspense fallback={<EditorLoading />}>
        <CodeCanvas
          key={activeFilePath}
          activeFilePath={activeFilePath}
          workspacePath={workspacePath}
          revealPosition={revealPosition}
          highlightKeyword={highlightKeyword}
        />
      </Suspense>
    )
  } else if (["png", "jpg", "jpeg", "bmp", "gif", "webp", "avif", "svg"].includes(fileType!)) {
    return (
      <MediaCanvas
        key={activeFilePath}
        activeFilePath={activeFilePath}
      />
    )
  }
  return (
    <Suspense fallback={<EditorLoading />}>
      <CodeCanvas
        key={activeFilePath}
        activeFilePath={activeFilePath}
        workspacePath={workspacePath}
        revealPosition={revealPosition}
        highlightKeyword={highlightKeyword}
      />
    </Suspense>
  )
}

export default memo(EditorCanvas)
