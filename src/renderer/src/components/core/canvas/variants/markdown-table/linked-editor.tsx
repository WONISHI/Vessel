import { WikiLinkPreview } from "@/components/core/canvas/variants/markdown/wiki-link-preview"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cloneElement, lazy, Suspense, useCallback, useContext, useRef, type ClipboardEvent, type ComponentProps } from "react"
import { ObsidianImage } from "@/components/core/canvas/variants/markdown/obsidian-images/components/obsidian-image"
import { MarkdownTableEditor } from "@vessel/markdown-table"
import { WikiLinkInput, WikiLinkText, type WikiFileSuggestion } from "@vessel/obsidian"
import { WorkspaceContext, type WorkspaceNode } from "@/components/workspace/types/workspace"
import { toast } from "sonner"
const TableJsonEditor = lazy(() => import("./json-editor"))

/** Table adapter supplies filesystem access; wikilink behavior belongs to @vessel/obsidian. */
const imageLine = /^!\[\[[^\]]+\]\]$/
export function LinkedTableEditor({ root, documentPath, onOpenFile, ...props }: ComponentProps<typeof MarkdownTableEditor> & { root: string; documentPath?: string; onOpenFile?: (file: WorkspaceNode) => void }) {
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
  /** Pasted images are stored through the document image pipeline and embedded as ![[name]]; text keeps the native paste. */
  const pasteImage = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"))
    if (!file || !documentPath) return
    event.preventDefault()
    const field = event.currentTarget
    void file.arrayBuffer()
      .then((bytes) => window.electronAPI.saveObsidianImage(root, documentPath, { bytes: new Uint8Array(bytes) }))
      .then((saved) => {
        const { selectionStart, selectionEnd, value } = field
        const before = value.slice(0, selectionStart), after = value.slice(selectionEnd)
        const insert = `${before && !before.endsWith("\n") ? "\n" : ""}${saved.reference}${after && !after.startsWith("\n") ? "\n" : ""}`
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, before + insert + after)
        field.dispatchEvent(new Event("input", { bubbles: true }))
      })
      .catch((reason) => toast.error(String(reason)))
  }
  return (
    <div ref={previewHost} data-wiki-preview-owner style={{ display: "contents" }}>
    <MarkdownTableEditor
      {...props}
      renderRawEditor={(editorProps) => <Suspense fallback={<div style={{ height: 360, padding: 16 }}>正在加载 JSON 编辑器…</div>}><TableJsonEditor {...editorProps} /></Suspense>}
      renderCellEditor={(input) => (
        <WikiLinkInput
          input={cloneElement(input, { onPaste: pasteImage } as never) as typeof input}
          search={search}
          renderScrollArea={(children) => <ScrollArea className="max-h-48 [&_[data-radix-scroll-area-viewport]]:max-h-48 [&_[data-radix-scroll-area-viewport]>div]:!block">{children}</ScrollArea>}
        />
      )}
      renderCellContent={(text) => text.split("\n").some((line) => imageLine.test(line.trim())) && documentPath ? (
        <>
          {text.split("\n").map((line, index) => imageLine.test(line.trim())
            ? <ObsidianImage key={index} reference={line.trim()} root={root} documentPath={documentPath} onChange={() => {}} readOnly />
            : line ? <WikiLinkText key={index} text={line} onOpen={(target) => void open(target)} /> : null)}
        </>
      ) : (
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
