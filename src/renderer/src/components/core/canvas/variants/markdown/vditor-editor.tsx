import "@vessel/obsidian/callouts/style.css"
import "@vessel/obsidian/links/style.css"
import "@vessel/markdown-steps/style.css"
import "@vessel/markdown-table/style.css"
import "@/components/core/canvas/variants/markdown/index.css"
import { DocumentProperties } from "@/components/core/canvas/variants/markdown/document-properties"
import { LinkInteractionArea } from "@/components/ui/link"
import { PageLoading } from "@/components/ui/page-loading"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Typography } from "@/components/ui/typography"
import { LinkTooltip } from "@vessel/obsidian"
import "@vessel/obsidian/links/style.css"
import "vditor/dist/index.css"
import type { VditorEditorProps } from "@/components/core/canvas/variants/markdown/vditor-editor/types"
import { useVditorEditorState } from "@/components/core/canvas/variants/markdown/vditor-editor/hooks/use-vditor-editor-state"
import { useLinkTooltip } from "@/components/core/canvas/variants/markdown/vditor-editor/hooks/use-link-tooltip"
import { useVditorSetup } from "@/components/core/canvas/variants/markdown/vditor-editor/hooks/use-vditor-setup"
import { EditorBlockMenus } from "@/components/core/canvas/variants/markdown/vditor-editor/components/editor-block-menus"
import { EditorCodeMenus } from "@/components/core/canvas/variants/markdown/vditor-editor/components/editor-code-menus"
import { EditorBreadcrumb } from "@/components/core/canvas/variants/markdown/vditor-editor/components/editor-breadcrumb"

/** 保留 Vditor 编辑能力，文档显示和大纲由外层 React 组件负责。 */
export function VditorEditor({ value, onChange, workspacePath, documentPath, readOnly = false, onReady }: VditorEditorProps) {
  const state = useVditorEditorState({ value, onChange, workspacePath, documentPath, readOnly, onReady })
  const link = useLinkTooltip(state)
  useVditorSetup(state, link)
  const m = { ...state, ...link }
  const { loading, loadError, host, toolbarHost, properties, linkTooltip, setLinkTooltip, handleConfirmLink } = m

  return (
    <LinkInteractionArea className="relative flex h-full min-h-0 min-w-0 flex-col">
      <EditorBlockMenus m={m} />
      <EditorCodeMenus m={m} />
      {(loading || loadError) && (
        <div className="absolute inset-0 z-30 bg-white">
          {loadError ? (
            <p
              role="alert"
              className="p-6 text-sm text-red-600"
            >
              {loadError}
            </p>
          ) : (
            <PageLoading label="正在解析 Markdown 文档…" />
          )}
        </div>
      )}
      {linkTooltip && !readOnly && (
        <LinkTooltip
          anchor={linkTooltip.anchor}
          initialUrl={linkTooltip.initialUrl}
          initialText={linkTooltip.initialText}
          onConfirm={handleConfirmLink}
          onClose={() => {
            setLinkTooltip(null)
            const editable = host.current?.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')
            editable?.focus({ preventScroll: true })
          }}
          onOpenUrl={(url) => window.open(url, "_blank")}
        />
      )}
      <EditorBreadcrumb m={m} />
      <div
        ref={toolbarHost}
        className={readOnly ? "hidden" : "vessel-vditor shrink-0 min-w-0 w-full"}
      />
      <ScrollArea className="vessel-editor-scroll flex-1 min-h-0 min-w-0 mt-2">
        {properties && (
          <DocumentProperties
            properties={properties.properties}
            workspacePath={workspacePath}
          />
        )}
        <Typography asChild>
          <div
            ref={host}
            className="vessel-vditor min-h-full"
          />
        </Typography>
      </ScrollArea>
    </LinkInteractionArea>
  )
}
