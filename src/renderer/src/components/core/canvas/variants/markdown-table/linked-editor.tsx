import { WikiLinkPreview } from "@/components/core/canvas/variants/markdown/wiki-link-preview"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useCallback, useContext, useRef, type ComponentProps } from "react"
import { MarkdownTableEditor } from "@vessel/markdown-table"
import { WikiLinkInput, WikiLinkText, type WikiFileSuggestion } from "@vessel/obsidian"
import { WorkspaceContext, type WorkspaceNode } from "@/components/workspace/types/workspace"
import { toast } from "sonner"

/** Table adapter supplies filesystem access; wikilink behavior belongs to @vessel/obsidian. */
export function LinkedTableEditor({ root, onOpenFile, ...props }: ComponentProps<typeof MarkdownTableEditor> & { root: string; onOpenFile?: (file: WorkspaceNode) => void }) {
  const context = useContext(WorkspaceContext)
  const previewHost = useRef<HTMLDivElement>(null)
  const search = useCallback(
    async (query: string, signal?: AbortSignal): Promise<WikiFileSuggestion[]> => {
      if (!root) return []
      const pending = [root],
        matches: WikiFileSuggestion[] = []
      const keyword = query.toLocaleLowerCase()
      while (pending.length && !signal?.aborted) {
        const directory = pending.shift()!
        const nodes = await window.electronAPI.readWorkspaceDirectory(root, directory, { includeIgnored: true })
        for (const node of nodes) {
          if (node.type === "directory") pending.push(node.path)
          else {
            const path = node.path.replace(/\\/g, "/").slice(root.replace(/\\/g, "/").replace(/\/$/, "").length + 1)
            if (path.toLocaleLowerCase().includes(keyword)) matches.push({ path, label: node.name })
          }
        }
      }
      return matches.sort((a, b) => Number(!a.label.toLocaleLowerCase().startsWith(keyword)) - Number(!b.label.toLocaleLowerCase().startsWith(keyword)))
    },
    [root]
  )
  const open = async (target: string) => {
    try {
      const result = await window.electronAPI.readWikiLink(root, target)
      const openFile = onOpenFile || context?.openWorkspaceFile
      if (!openFile) throw new Error("当前视图无法打开工作区文件")
      openFile({ path: result.path, name: result.path.split(/[\\/]/).pop()!, type: "file" })
    } catch (reason) {
      toast.error(String(reason))
    }
  }
  return (
    <div ref={previewHost} data-wiki-preview-owner style={{ display: "contents" }}>
    <MarkdownTableEditor
      {...props}
      renderCellEditor={(input) => (
        <WikiLinkInput
          input={input}
          search={search}
          renderScrollArea={(children) => <ScrollArea className="max-h-48 [&_[data-radix-scroll-area-viewport]]:max-h-48 [&_[data-radix-scroll-area-viewport]>div]:!block">{children}</ScrollArea>}
        />
      )}
      renderCellContent={(text) => (
        <WikiLinkText
          text={text}
          onOpen={(target) => void open(target)}
        />
      )}
    />
    <WikiLinkPreview host={previewHost} workspacePath={root} />
    </div>
  )
}
