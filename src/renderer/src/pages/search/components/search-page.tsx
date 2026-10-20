import EditorCanvas from "@/components/core/canvas/index"
import ActivityBar from "@/components/layout/activity-bar/index"
import Layout from "@/components/layout/index"
import { Button } from "@/components/ui/button"
import { ResizableSplit } from "@/components/ui/resizable-split"
import { initialRoot } from "@/pages/search/components/index-shared"
import { SearchPanel } from "@/pages/search/components/search-panel"
import { useRouter } from "@vessel/react-router"
import type { ContentMatch } from "@vessel/type"
import { ChevronRight, ExternalLink, File, Search } from "lucide-react"
import { useMemo, useState } from "react"

/** Renders the search page component. */
export function SearchPage() {
  const router = useRouter()
  const [width, setWidth] = useState(320)
  const [root, setRoot] = useState(initialRoot)
  const [selected, setSelected] = useState<ContentMatch | null>(null)

  const ext = selected ? (selected.path.split(".").pop() || "").toLowerCase() : ""
  const keyword = selected ? (selected.ranges[0] ? selected.text.slice(selected.ranges[0].start, selected.ranges[0].end) : selected.text.trim()) : ""

  const breadcrumbs = useMemo(() => {
    if (!selected) return []
    const rootName = root.split(/[\\/]/).filter(Boolean).pop() || "工作区"
    const relSegments = selected.relativePath.split(/[\\/]/).filter(Boolean)
    return [rootName, ...relSegments]
  }, [selected, root])

  return (
    <Layout aside={null}>
      <ActivityBar
        activity="search"
        onActivityChange={(activity) => {
          void router.push(activity === "files" ? "/editor" : activity === "tools" ? "/devtools" : `/${activity}`)
        }}
      />
      <ResizableSplit
        side="left"
        size={width}
        min={260}
        max={560}
        label="调整搜索侧栏宽度"
        onResize={setWidth}
        pane={
          <SearchPanel
            root={root}
            onRootChange={setRoot}
            selected={selected}
            onSelect={setSelected}
          />
        }
      >
        <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
          {selected ? (
            <>
              <header className="flex h-10 shrink-0 items-center justify-between border-b border-[#f0efed] bg-white px-4">
                <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-stone-600">
                  <File
                    size={15}
                    className="shrink-0 text-stone-400"
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-1 truncate font-medium">
                    {breadcrumbs.map((segment, idx) => (
                      <span
                        key={idx}
                        className="flex items-center gap-1"
                      >
                        {idx > 0 && (
                          <ChevronRight
                            size={12}
                            className="shrink-0 text-stone-300"
                          />
                        )}
                        <span className={idx === breadcrumbs.length - 1 ? "font-semibold text-stone-800" : "text-stone-500"}>{segment}</span>
                      </span>
                    ))}
                  </div>
                  <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">第 {selected.line} 行</span>
                </div>
                <div className="flex shrink-0 items-center gap-2 pl-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs text-stone-600 hover:text-stone-900"
                    onClick={() => void router.push(`/editor?external=${encodeURIComponent(selected.path)}`)}
                    data-title="在工作区打开编辑"
                  >
                    <ExternalLink size={13} />
                    在工作区打开
                  </Button>
                </div>
              </header>
              <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
                <EditorCanvas
                  key={selected.path}
                  fileType={ext}
                  activeFilePath={selected.path}
                  workspacePath={root}
                  revealPosition={{ lineNumber: selected.line, column: selected.column }}
                  highlightKeyword={keyword}
                  revealLine={selected.line}
                />
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-stone-400">
              <div className="flex size-12 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
                <Search size={22} />
              </div>
              <p className="text-xs">选择搜索结果以在右侧查看文件内容</p>
            </div>
          )}
        </main>
      </ResizableSplit>
    </Layout>
  )
}
