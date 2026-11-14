import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { toast } from "@/components/ui/sonner"
import { AlignJustify, Check, Columns, Copy } from "lucide-react"
import { Fragment, useMemo, useState } from "react"
import { Decoration, Diff, Hunk, parseDiff } from "react-diff-view"
import "react-diff-view/style/index.css"
import "./diff-viewer.css"

export interface DiffViewerProps {
  diffText: string
  filePath?: string
  isStaged?: boolean
  onToggleStage?: () => void
}

/** Renders the diff viewer component. */
export function DiffViewer({ diffText, filePath, isStaged, onToggleStage }: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified")
  const [copied, setCopied] = useState(false)
  const files = useMemo(() => {
    // Untracked files arrive as a unified patch without git's file header.
    const header = diffText.search(/^diff --git /m)
    const patch = header >= 0 ? diffText.slice(header) : `diff --git a/file b/file\n${diffText}`
    try {
      return parseDiff(patch, { nearbySequences: "zip" })
    } catch {
      return []
    }
  }, [diffText])

  /** Handles copy events. */
  const handleCopy = () => {
    void navigator.clipboard.writeText(diffText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    toast.success("已复制差异内容")
  }

  if (!diffText.trim()) {
    return <div className="flex h-full w-full items-center justify-center text-xs text-stone-400">该文件暂无差异变更</div>
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white text-xs">
      {/* 顶部操作条 */}
      <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-stone-50/80 px-3">
        {/* 3号: 宽度是 flex: 1，超出显示省略号 */}
        <span
          className="flex-1 min-w-0 truncate font-mono font-medium text-stone-700"
          data-title={filePath}
        >
          {filePath || "Diff 视图"}
        </span>
        {/* 4号及工具组: 与 3 号存在间隙，文字不要换行 */}
        <div className="flex shrink-0 items-center gap-2">
          {onToggleStage && (
            <button
              type="button"
              onClick={onToggleStage}
              className={`shrink-0 whitespace-nowrap rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${isStaged ? "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border border-green-300 bg-green-50 text-green-700 hover:bg-green-100"}`}
            >
              {isStaged ? "取消暂存该文件" : "暂存该文件"}
            </button>
          )}

          {/* 模式切换 */}
          <div className="flex rounded border border-stone-200 bg-white p-0.5">
            <button
              type="button"
              data-title="统一视图 (Unified)"
              className={`flex size-6 items-center justify-center rounded ${viewMode === "unified" ? "bg-stone-200 text-stone-800" : "text-stone-400 hover:text-stone-600"}`}
              onClick={() => setViewMode("unified")} aria-label="统一视图 (Unified)"
            >
              <AlignJustify className="size-3.5" />
            </button>
            <button
              type="button"
              data-title="分栏视图 (Split)"
              className={`flex size-6 items-center justify-center rounded ${viewMode === "split" ? "bg-stone-200 text-stone-800" : "text-stone-400 hover:text-stone-600"}`}
              onClick={() => setViewMode("split")} aria-label="分栏视图 (Split)"
            >
              <Columns className="size-3.5" />
            </button>
          </div>

          <button
            type="button"
            data-title="复制 Diff"
            className="flex size-7 items-center justify-center rounded text-stone-400 hover:bg-stone-200 hover:text-stone-700"
            onClick={handleCopy}
          >
            {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* Diff 内容滚动区 (4号) */}
      <ScrollArea className="flex-1 min-h-0 font-mono text-[11px] leading-5">
        <div className="git-code-diff">
          {files.map((file, index) => (
            <Fragment key={`${file.oldPath}-${file.newPath}-${index}`}>
              {files.length > 1 && <div className="git-diff-file-name">{file.newPath === "/dev/null" ? file.oldPath : file.newPath}</div>}
              {file.hunks.length ? (
                <Diff viewType={viewMode} diffType={file.type} hunks={file.hunks} optimizeSelection>
                  {(hunks) => hunks.map((hunk) => (
                    <Fragment key={`${hunk.oldStart}-${hunk.newStart}`}>
                      <Decoration><div className="git-diff-hunk-header">{hunk.content}</div></Decoration>
                      <Hunk hunk={hunk} />
                    </Fragment>
                  ))}
                </Diff>
              ) : <div className="p-3 text-stone-500">该文件无可显示的文本差异（二进制或文件信息变更）</div>}
            </Fragment>
          ))}
          {!files.length && <pre className="m-0 whitespace-pre-wrap p-3">{diffText}</pre>}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
