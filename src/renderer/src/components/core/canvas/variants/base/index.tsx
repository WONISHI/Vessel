import { BaseBreadcrumb } from "@/components/core/canvas/variants/base/components/base-breadcrumb"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { WorkspaceContext } from "@/components/workspace/types/workspace"
import { useDirectoryWatch, useFileChanges } from "@/components/workspace/hooks/file-changes"
import { formatBaseValue, type BaseQueryResult } from "@vessel/obsidian/bases"
import { RefreshCcw } from "lucide-react"
import { Fragment, useContext, useEffect, useRef, useState } from "react"

/** Renders a Base query as a read-only shadcn table over real workspace properties. */
export default function BaseCanvas({ activeFilePath, workspacePath }: { activeFilePath: string; workspacePath?: string }) {
  const context = useContext(WorkspaceContext)
  const root = workspacePath || context?.workspace.path || ""
  const [view, setView] = useState<number | undefined>(undefined),
    [revision, setRevision] = useState(0)
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<BaseQueryResult | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useDirectoryWatch(root)
  useFileChanges(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setRevision((value) => value + 1), 300)
  })
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")
    if (!root) {
      setError("请在工作区中打开 .base 文件")
      setLoading(false)
      return
    }
    void window.electronAPI
      .queryBase(root, activeFilePath, view)
      .then((value) => {
        if (!cancelled) {
          setResult(value)
          setPage(0)
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(String(reason))
          setResult(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [root, activeFilePath, view, revision])
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-white">
      <BaseBreadcrumb
        root={root}
        path={activeFilePath}
      />
      {result && result.views.length > 1 && (
        <div
          role="tablist"
          aria-label="Base 视图"
          className="flex shrink-0 gap-1 overflow-x-auto border-b p-2"
        >
          {result.views.map((item, index) => (
            <Button
              role="tab"
              className="text-xs hover:!bg-green-600 hover:!text-white"
              aria-selected={(view ?? result.viewIndex) === index}
              variant={(view ?? result.viewIndex) === index ? "secondary" : "ghost"}
              size="sm"
              key={index}
              disabled={item.type !== "table"}
              title={item.type !== "table" ? `暂不支持 ${item.type} 视图` : undefined}
              onClick={() => setView(index)}
            >
              {item.name}
            </Button>
          ))}
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="p-4 text-sm text-red-600"
        >
          {error}
        </p>
      )}
      {loading && (
        <p
          role="status"
          className="px-4 py-2 text-xs text-stone-500"
        >
          正在读取工作区属性…
        </p>
      )}
      {result?.warnings.length ? (
        <details className="shrink-0 border-b px-4 py-2 text-xs text-amber-700">
          <summary>解析提示（{result.warnings.length}）</summary>
          {result.warnings.map((warning, index) => (
            <p
              key={index}
              className="mt-1"
            >
              {warning}
            </p>
          ))}
        </details>
      ) : null}
      {result && !error && (
        <ScrollArea className="min-h-0 min-w-0 flex-1">
          <Table
            containerClassName="overflow-visible"
            className="w-max min-w-full table-auto whitespace-nowrap text-[11px] [&_th]:text-[11px] [&_td]:text-[11px]"
          >
            <TableHeader>
              <TableRow>
                {result.columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className="h-8 whitespace-nowrap px-3 text-[11px]"
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.slice(page * 100, (page + 1) * 100).map((row, rowIndex) => (
                <Fragment key={row.path}>
                  {row.group !== undefined && (rowIndex === 0 || JSON.stringify(result.rows[page * 100 + rowIndex - 1]?.group) !== JSON.stringify(row.group)) && (
                    <TableRow>
                      <TableCell
                        colSpan={result.columns.length}
                        className="bg-stone-50 font-semibold"
                      >
                        {formatBaseValue(row.group) || "未分组"}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    {result.columns.map((column, index) => (
                      <TableCell
                        key={column.key}
                        className="px-3 py-2 text-[11px] leading-4 whitespace-nowrap"
                      >
                        {column.key === "file.name" || (index === 0 && column.key === "file.path") ? (
                          <button
                            className="text-green-700 hover:underline"
                            onClick={() => context?.openWorkspaceFile({ name: row.path.split("/").pop() || row.path, path: root.replace(/[\\/]$/, "") + "/" + row.path, type: "file" })}
                          >
                            {formatBaseValue(row.values[column.key])}
                          </button>
                        ) : (
                          formatBaseValue(row.values[column.key])
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                </Fragment>
              ))}
            </TableBody>
          </Table>
          {!result.rows.length && <p className="p-8 text-center text-sm text-stone-400">没有符合筛选条件的文件</p>}
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
      <div className="flex shrink-0 items-center gap-2 border-t px-4 py-1 text-xs text-stone-400">
        <span>{result?.rows.length ?? 0} 条记录 · 只读</span>
        <Button
          size="icon"
          variant="ghost"
          aria-label="刷新 Base"
          className="ml-auto size-7"
          onClick={() => setRevision((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCcw className={loading ? "size-3.5 animate-spin" : "size-3.5"} />
        </Button>
      </div>
      {result && result.rows.length > 100 && (
        <footer className="flex shrink-0 items-center justify-end gap-2 border-t px-4 py-2 text-xs text-stone-500">
          <span>
            第 {page + 1} / {Math.ceil(result.rows.length / 100)} 页
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={!page}
            onClick={() => setPage((value) => value - 1)}
          >
            上一页
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={(page + 1) * 100 >= result.rows.length}
            onClick={() => setPage((value) => value + 1)}
          >
            下一页
          </Button>
        </footer>
      )}
    </section>
  )
}
