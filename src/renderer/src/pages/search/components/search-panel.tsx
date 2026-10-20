import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Highlight } from "@/pages/search/components/highlight"
import { initialRoot } from "@/pages/search/components/index-shared"
import type { ContentMatch, ContentSearchResult } from "@vessel/type"
import { ChevronDown, File, FolderOpen, LoaderCircle, Search, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

/** Renders the search panel component. */
export function SearchPanel({
  selected,
  onSelect,
  onClose,
  root: propRoot,
  onRootChange,
  allowChangeFolder = true,
  title = "全局搜索"
}: {
  selected?: ContentMatch | null
  onSelect: (match: ContentMatch) => void
  onClose?: () => void
  root?: string
  onRootChange?: (root: string) => void
  allowChangeFolder?: boolean
  title?: string
}) {
  const [internalRoot, setInternalRoot] = useState(initialRoot)
  const root = propRoot !== undefined ? propRoot : internalRoot

  /** Sets root. */
  const setRoot = (next: string) => {
    setInternalRoot(next)
    onRootChange?.(next)
  }

  const [query, setQuery] = useState("")
  const [include, setInclude] = useState("")
  const [exclude, setExclude] = useState("")
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [regex, setRegex] = useState(false)
  const [includeIgnored, setIncludeIgnored] = useState(false)
  const [result, setResult] = useState<ContentSearchResult>({ matches: [], truncated: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const sequence = useRef(0)

  useEffect(() => {
    const request = ++sequence.current
    window.electronAPI.cancelContentSearch()
    setResult({ matches: [], truncated: false })
    setError("")
    if (!root || !query) {
      setBusy(false)
      return
    }
    setBusy(true)
    const timer = setTimeout(() => {
      void window.electronAPI
        .searchContent({ root, query, include, exclude, caseSensitive, wholeWord, regex, includeIgnored })
        .then(
          (value) => {
            if (sequence.current === request) setResult(value)
          },
          (reason) => {
            if (sequence.current === request) setError(String(reason))
          }
        )
        .finally(() => {
          if (sequence.current === request) setBusy(false)
        })
    }, 250)
    return () => {
      ++sequence.current
      clearTimeout(timer)
      window.electronAPI.cancelContentSearch()
    }
  }, [root, query, include, exclude, caseSensitive, wholeWord, regex, includeIgnored])

  const groups = useMemo(() => {
    const map = new Map<string, ContentMatch[]>()
    result.matches.forEach((match) => {
      const list = map.get(match.path) ?? []
      list.push(match)
      map.set(match.path, list)
    })
    return [...map.entries()]
  }, [result])

  return (
    <aside className="vessel-search-sidebar flex h-full min-h-0 flex-col">
      <header className="flex h-11 shrink-0 items-center justify-between px-3.5">
        <h1 className="text-xs font-bold text-stone-500">{title}</h1>
        <span className="flex items-center gap-1">
          {busy && <LoaderCircle className="size-3.5 animate-spin text-green-600" />}
          {onClose && (
            <button
              aria-label="关闭搜索"
              data-title="关闭搜索并返回文件列表"
              onClick={onClose}
              className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-900"
            >
              <X size={14} />
            </button>
          )}
        </span>
      </header>
      {allowChangeFolder ? (
        <button
          className="search-folder"
          data-title={root || "选择搜索文件夹"}
          onClick={() => {
            void window.electronAPI
              .pickSearchFolder()
              .then((path) => {
                if (path) setRoot(path)
              })
              .catch((reason) => setError(String(reason)))
          }}
        >
          <FolderOpen
            size={15}
            className="shrink-0 text-green-600"
          />
          <span className="min-w-0 flex-1 text-left">
            <strong className="block truncate text-xs">{root ? root.split(/[\\/]/).pop() : "选择文件夹"}</strong>
            <small className="block truncate text-[10px] text-stone-400">{root || "递归搜索文件内容"}</small>
          </span>
          <ChevronDown size={14} />
        </button>
      ) : (
        <div
          className="search-folder !cursor-default !bg-stone-50 select-none"
          data-title={root || "当前目录"}
        >
          <FolderOpen
            size={15}
            className="shrink-0 text-green-600"
          />
          <span className="min-w-0 flex-1 text-left">
            <strong className="block truncate text-xs">{root ? root.split(/[\\/]/).pop() : "当前目录"}</strong>
            <small
              className="block truncate text-[10px] text-stone-400"
              data-title={root}
            >
              {root || "仅限当前文件夹"}
            </small>
          </span>
        </div>
      )}
      <div className="search-input-row">
        <Search size={15} />
        <input
          autoFocus
          aria-label="搜索文件内容"
          placeholder="搜索文件内容…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <button
            aria-label="清空搜索"
            onClick={() => setQuery("")}
          >
            <X size={13} />
          </button>
        )}
        {(
          [
            ["Aa", "区分大小写", caseSensitive, setCaseSensitive],
            ["ab", "全词匹配", wholeWord, setWholeWord],
            [".*", "正则表达式", regex, setRegex]
          ] as const
        ).map(([label, title, active, change]) => (
          <button
            key={title}
            data-title={title}
            aria-label={title}
            aria-pressed={active}
            className={active ? "selected" : ""}
            onClick={() => change(!active)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mx-3 mb-2 space-y-2">
        <input
          className="search-filter"
          aria-label="包含文件"
          placeholder="包含文件，如 *.ts, *.md"
          value={include}
          onChange={(event) => setInclude(event.target.value)}
        />
        <input
          className="search-filter"
          aria-label="排除文件"
          placeholder="排除文件，如 **/node_modules/**"
          value={exclude}
          onChange={(event) => setExclude(event.target.value)}
        />
        <label className="flex items-center gap-2 text-[11px] text-stone-500">
          <input
            type="checkbox"
            checked={includeIgnored}
            onChange={(event) => setIncludeIgnored(event.target.checked)}
          />
          包含被忽略文件
        </label>
      </div>
      <div
        role="status"
        className="px-3 pb-2 text-[11px] text-stone-400"
      >
        {busy ? "搜索中…" : `${result.matches.length} 处匹配 · ${groups.length} 个文件`}
        {result.truncated && "（结果已截断，请缩小范围）"}
      </div>
      {error && (
        <p
          role="alert"
          className="px-3 pb-2 text-xs text-red-600"
        >
          {error}
        </p>
      )}
      <ScrollArea className="min-h-0 flex-1">
        <div className="search-results min-w-0 px-2 pb-3">
          {groups.map(([path, matches]) => (
            <Collapsible
              key={path}
              defaultOpen
            >
              <CollapsibleTrigger className="search-file-heading group flex min-w-0 max-w-full w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-xs hover:bg-[#f0efed]">
                <ChevronDown className="size-3 shrink-0 text-stone-400 group-data-[state=closed]:-rotate-90" />
                <File className="size-3.5 shrink-0 text-stone-500" />
                <span
                  className="min-w-0 flex-1 truncate"
                  data-title={matches[0].relativePath}
                >
                  {matches[0].relativePath}
                </span>
                <span className="search-match-count shrink-0 text-[10px] text-stone-400" aria-label={`${matches.length} 处匹配`}>{matches.length}</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {matches.map((match, index) => (
                  <button
                    key={`${match.line}:${index}`}
                    data-title={match.text}
                    className={`search-match ${selected === match ? "active" : ""}`}
                    onClick={() => onSelect(match)}
                  >
                    <span className="w-7 shrink-0 text-right font-mono text-[10px] text-stone-400">{match.line}</span>
                    <span className="min-w-0 flex-1 overflow-hidden">
                      <Highlight match={match} />
                    </span>
                  </button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))}
          {!busy && query && root && !groups.length && !error && <p className="p-3 text-xs text-stone-400">没有匹配的文本内容</p>}
        </div>
      </ScrollArea>
    </aside>
  )
}
