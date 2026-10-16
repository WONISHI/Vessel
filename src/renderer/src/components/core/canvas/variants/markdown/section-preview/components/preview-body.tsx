import { VditorEditor } from "@/components/core/canvas/variants/markdown/vditor-editor"
import { WikiLinkPreview } from "@/components/core/canvas/variants/markdown/wiki-link-preview"
import { useRef } from "react"

/** Renders the preview body component. */
export function PreviewBody({ source, workspacePath, documentPath }: { source: string; workspacePath: string; documentPath: string }) {
  const host = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={host}
      className="vessel-hover-preview h-80 min-h-0 text-xs"
    >
      <VditorEditor
        value={source}
        workspacePath={workspacePath}
        documentPath={documentPath}
        readOnly
        onChange={() => {}}
      />
      <WikiLinkPreview
        host={host}
        workspacePath={workspacePath}
      />
    </div>
  )
}
