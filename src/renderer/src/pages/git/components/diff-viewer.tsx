import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { toast } from "@/components/ui/sonner"
import { AlignJustify, Check, Columns, Copy } from "lucide-react"
import { Fragment, useState } from "react"

export interface DiffViewerProps {
  diffText: string
  filePath?: string
  isStaged?: boolean
  onToggleStage?: () => void
}

interface ParsedHunk {
  header: string
  lines: Array<{
    type: "add" | "delete" | "normal" | "header"
    oldLine?: number
    newLine?: number
    content: string
  }>
}

/** Parses unified diff. */
function parseUnifiedDiff(diff: string): ParsedHunk[] {
  if (!diff) return []
  const rawLines = diff.split("\n")
  const hunks: ParsedHunk[] = []
  let currentHunk: ParsedHunk | null = null
  let oldLine = 0
  let newLine = 0

  for (const line of rawLines) {
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (match) {
        oldLine = parseInt(match[1], 10)
        newLine = parseInt(match[2], 10)
      }
      currentHunk = { header: line, lines: [] }
      hunks.push(currentHunk)
      continue
    }

    if (!currentHunk) continue

    if (line.startsWith("+") && !line.startsWith("+++")) {
      currentHunk.lines.push({
        type: "add",
        newLine: newLine++,
        content: line.slice(1)
      })
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      currentHunk.lines.push({
        type: "delete",
        oldLine: oldLine++,
        content: line.slice(1)
      })
    } else if (!line.startsWith("\\")) {
      currentHunk.lines.push({
        type: "normal",
        oldLine: oldLine++,
        newLine: newLine++,
        content: line.startsWith(" ") ? line.slice(1) : line
      })
    }
  }

  return hunks
}

/** Renders the diff viewer component. */
export function DiffViewer({ diffText, filePath, isStaged, onToggleStage }: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified")
  const [copied, setCopied] = useState(false)
  const hunks = parseUnifiedDiff(diffText)

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
          title={filePath}
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
              title="统一视图 (Unified)"
              className={`flex size-6 items-center justify-center rounded ${viewMode === "unified" ? "bg-stone-200 text-stone-800" : "text-stone-400 hover:text-stone-600"}`}
              onClick={() => setViewMode("unified")}
            >
              <AlignJustify className="size-3.5" />
            </button>
            <button
              type="button"
              title="分栏视图 (Split)"
              className={`flex size-6 items-center justify-center rounded ${viewMode === "split" ? "bg-stone-200 text-stone-800" : "text-stone-400 hover:text-stone-600"}`}
              onClick={() => setViewMode("split")}
            >
              <Columns className="size-3.5" />
            </button>
          </div>

          <button
            type="button"
            title="复制 Diff"
            className="flex size-7 items-center justify-center rounded text-stone-400 hover:bg-stone-200 hover:text-stone-700"
            onClick={handleCopy}
          >
            {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* Diff 内容滚动区 (4号) */}
      <ScrollArea className="flex-1 min-h-0 font-mono text-[11px] leading-5">
        {viewMode === "unified" ? (
          <table className="w-full border-collapse">
            <tbody>
              {hunks.map((hunk, hIdx) => (
                <Fragment key={hIdx}>
                  <tr className="bg-blue-50 text-blue-600">
                    <td
                      colSpan={3}
                      className="px-3 py-1 font-semibold select-none"
                    >
                      {hunk.header}
                    </td>
                  </tr>
                  {hunk.lines.map((line, lIdx) => {
                    const isAdd = line.type === "add"
                    const isDel = line.type === "delete"
                    return (
                      <tr
                        key={lIdx}
                        className={isAdd ? "bg-green-50/70 hover:bg-green-100/70 text-green-900" : isDel ? "bg-red-50/70 hover:bg-red-100/70 text-red-900" : "hover:bg-stone-50 text-stone-700"}
                      >
                        <td className="w-10 select-none border-r border-stone-200/50 pr-2 text-right text-stone-400">{line.oldLine || ""}</td>
                        <td className="w-10 select-none border-r border-stone-200/50 pr-2 text-right text-stone-400">{line.newLine || ""}</td>
                        <td className="px-3 whitespace-pre-wrap break-all">
                          <span className="inline-block w-4 font-bold select-none text-stone-400">{isAdd ? "+" : isDel ? "-" : " "}</span>
                          {line.content}
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        ) : (
          /* Split 分栏对比模式 */
          <div className="flex divide-x divide-stone-200">
            <div className="w-1/2 overflow-x-auto">
              <table className="w-full border-collapse">
                <tbody>
                  {hunks.map((hunk, hIdx) => (
                    <Fragment key={hIdx}>
                      <tr className="bg-blue-50 text-blue-600">
                        <td
                          colSpan={2}
                          className="px-2 py-0.5 font-semibold select-none truncate"
                        >
                          {hunk.header}
                        </td>
                      </tr>
                      {hunk.lines
                        .filter((l) => l.type !== "add")
                        .map((line, lIdx) => (
                          <tr
                            key={lIdx}
                            className={line.type === "delete" ? "bg-red-50/70 text-red-900" : "text-stone-700 hover:bg-stone-50"}
                          >
                            <td className="w-10 select-none border-r border-stone-200/50 pr-2 text-right text-stone-400">{line.oldLine || ""}</td>
                            <td className="px-2 whitespace-pre-wrap break-all">
                              <span className="inline-block w-3 font-bold select-none text-stone-400">{line.type === "delete" ? "-" : " "}</span>
                              {line.content}
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="w-1/2 overflow-x-auto">
              <table className="w-full border-collapse">
                <tbody>
                  {hunks.map((hunk, hIdx) => (
                    <Fragment key={hIdx}>
                      <tr className="bg-blue-50 text-blue-600">
                        <td
                          colSpan={2}
                          className="px-2 py-0.5 font-semibold select-none truncate"
                        >
                          {hunk.header}
                        </td>
                      </tr>
                      {hunk.lines
                        .filter((l) => l.type !== "delete")
                        .map((line, lIdx) => (
                          <tr
                            key={lIdx}
                            className={line.type === "add" ? "bg-green-50/70 text-green-900" : "text-stone-700 hover:bg-stone-50"}
                          >
                            <td className="w-10 select-none border-r border-stone-200/50 pr-2 text-right text-stone-400">{line.newLine || ""}</td>
                            <td className="px-2 whitespace-pre-wrap break-all">
                              <span className="inline-block w-3 font-bold select-none text-stone-400">{line.type === "add" ? "+" : " "}</span>
                              {line.content}
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
