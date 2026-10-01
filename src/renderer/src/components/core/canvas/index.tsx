import { lazy, Suspense, memo } from "react"
import MarkdownCanvas from "@renderer/components/core/canvas/variants/markdown"
import { codeLanguage } from "./variants/code/language"
const CodeCanvas = lazy(() => import("./variants/code"))
import MediaCanvas from "@renderer/components/core/canvas/variants/media"

interface EditorTabsProps {
  fileType: string | undefined
  activeFilePath: string
}

const EditorCanvas = ({ fileType, activeFilePath }: EditorTabsProps) => {
  if (fileType === "md" || fileType === "markdown") {
    return <MarkdownCanvas activeFilePath={activeFilePath} />
  } else if (codeLanguage(activeFilePath)) {
    return <Suspense fallback={<div className="p-4 text-sm">正在加载代码编辑器…</div>}><CodeCanvas key={activeFilePath} activeFilePath={activeFilePath} /></Suspense>
  } else if (["png", "jpg", "jpeg", "bmp", "gif", "webp", "avif", "svg"].includes(fileType!)) {
    return <MediaCanvas key={activeFilePath} activeFilePath={activeFilePath} />
  }
  return <div className="flex items-center justify-center h-full text-zinc-300 text-sm">Select a file to preview</div>
}

export default memo(EditorCanvas)
