import { EditorLoading } from "@/components/ui/editor-loading"
import { lazy, Suspense, memo } from "react"
import MarkdownCanvas from "./variants/markdown"
import { codeLanguage } from "./variants/code/language"
const CodeCanvas = lazy(() => import("./variants/code"))
import MediaCanvas from "./variants/media"
const PdfCanvas = lazy(() => import("./variants/pdf"))

interface EditorTabsProps {
  fileType: string | undefined
  activeFilePath: string
}

const EditorCanvas = ({ fileType, activeFilePath }: EditorTabsProps) => {
  if (fileType?.toLowerCase() === "pdf") return <Suspense fallback={<div>正在加载 PDF…</div>}><PdfCanvas key={activeFilePath} activeFilePath={activeFilePath} /></Suspense>
  if (fileType === "md" || fileType === "markdown") {
    return <MarkdownCanvas activeFilePath={activeFilePath} />
  } else if ((codeLanguage(activeFilePath) || codeLanguage(`file.${fileType}`))) {
    return <Suspense fallback={<EditorLoading />}><CodeCanvas key={activeFilePath} activeFilePath={activeFilePath} /></Suspense>
  } else if (["png", "jpg", "jpeg", "bmp", "gif", "webp", "avif", "svg"].includes(fileType!)) {
    return <MediaCanvas key={activeFilePath} activeFilePath={activeFilePath} />
  }
  return <Suspense fallback={<EditorLoading />}><CodeCanvas key={activeFilePath} activeFilePath={activeFilePath} /></Suspense>
}

export default memo(EditorCanvas)
