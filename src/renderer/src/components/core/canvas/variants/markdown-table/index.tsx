import { LinkedTableEditor } from "./linked-editor"
import { useContext, useEffect, useRef, useState } from "react"
import { BaseBreadcrumb } from "@/components/core/canvas/variants/base/components/base-breadcrumb"
import { WorkspaceContext } from "@/components/workspace/types/workspace"
import { serializeMarkdownTable, type MarkdownTableData } from "@vessel/markdown-table"
import { parseMarkdownTableDocument } from "./document"
import "@vessel/markdown-table/style.css"

/** Standalone JSON-backed table editor; writes stay ordered across rapid edits and tab closure. */
export default function MarkdownTableCanvas({ activeFilePath, workspacePath }: { activeFilePath: string; workspacePath?: string }) {
  const context = useContext(WorkspaceContext)
  const root = workspacePath || context?.workspace.path || activeFilePath.replace(/[\\/][^\\/]*$/, "")
  const [data, setData] = useState<MarkdownTableData | null>(null)
  const [error, setError] = useState("")
  const [status, setStatus] = useState("已保存")
  const writer = useRef<(text: string) => void>(() => {})
  useEffect(() => {
    let disposed = false
    let queue = Promise.resolve()
    setData(null)
    setError("")
    writer.current = (text) => {
      setStatus("保存中…")
      queue = queue
        .catch(() => {})
        .then(async () => {
          await window.electronAPI.saveContent(activeFilePath, text)
        })
      const latest = queue
      void latest.then(
        () => {
          if (!disposed && queue === latest) {
            setStatus("已保存")
            setError("")
          }
        },
        (reason) => {
          if (!disposed) {
            setStatus("保存失败")
            setError(String(reason))
          }
        }
      )
    }
    void window.electronAPI
      .readContent(activeFilePath)
      .then((text) => {
        const parsed = parseMarkdownTableDocument(text)
        if (!disposed) setData(parsed)
      })
      .catch((reason) => {
        if (!disposed) setError(String(reason))
      })
    return () => {
      disposed = true
    }
  }, [activeFilePath])
  return (
    <section className="flex h-full min-h-0 flex-col bg-white dark:bg-[#22272e]">
      <header className="flex shrink-0 items-center justify-between text-xs">
        <BaseBreadcrumb root={root} path={activeFilePath} label="当前高级表格文件路径" className="min-w-0 flex-1 border-0 bg-transparent" />
        <span
          role="status"
          className="shrink-0 pr-4 text-stone-400"
        >
          {data ? status : ""}
        </span>
      </header>
      {error && (
        <p
          role="alert"
          className="px-4 py-2 text-xs text-red-500"
        >
          {error}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {data ? (
          <LinkedTableEditor
            root={root}
            data={data}
            onChange={(_source, next) => writer.current(serializeMarkdownTable(next))}
          />
        ) : (
          !error && <p className="text-xs text-stone-400">正在读取表格…</p>
        )}
      </div>
    </section>
  )
}
