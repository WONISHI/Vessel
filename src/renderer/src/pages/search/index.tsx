import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from '@vessel/react-router'
import { Search, FolderOpen, ChevronDown, File, X, LoaderCircle, ChevronRight, ExternalLink } from 'lucide-react'
import Layout from '@/layout'
import ActivityBar from '@/layout/activity-bar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ResizableSplit } from '@/components/ui/resizable-split'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import EditorCanvas from '@/components/core/canvas'
import { Button } from '@/components/ui/button'
import type { ContentMatch, ContentSearchResult } from '../../../../shared/content-search'
import './search.css'

function initialRoot() {
  try {
    return JSON.parse(localStorage.getItem('app_current_workspace') || 'null')?.path || ''
  } catch {
    return ''
  }
}

function Highlight({ match }: { match: ContentMatch }) {
  let end = 0
  const parts: React.ReactNode[] = []
  match.ranges.forEach((range, index) => {
    parts.push(match.text.slice(end, range.start), <mark key={index}>{match.text.slice(range.start, range.end)}</mark>)
    end = range.end
  })
  parts.push(match.text.slice(end))
  return <>{parts}</>
}

export default function SearchPage() {
  const router = useRouter()
  const [width, setWidth] = useState(320)
  const [root, setRoot] = useState(initialRoot)
  const [selected, setSelected] = useState<ContentMatch | null>(null)

  const ext = selected ? (selected.path.split('.').pop() || '').toLowerCase() : ''
  const keyword = selected
    ? selected.ranges[0]
      ? selected.text.slice(selected.ranges[0].start, selected.ranges[0].end)
      : selected.text.trim()
    : ''

  const breadcrumbs = useMemo(() => {
    if (!selected) return []
    const rootName = root.split(/[\\/]/).filter(Boolean).pop() || '工作区'
    const relSegments = selected.relativePath.split(/[\\/]/).filter(Boolean)
    return [rootName, ...relSegments]
  }, [selected, root])

  return (
    <Layout aside={null}>
      <ActivityBar
        activity="search"
        onActivityChange={(activity) => {
          void router.push(activity === 'files' ? '/editor' : activity === 'tools' ? '/devtools' : `/${activity}`)
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
                  <File size={15} className="shrink-0 text-stone-400" />
                  <div className="flex min-w-0 flex-1 items-center gap-1 truncate font-medium">
                    {breadcrumbs.map((segment, idx) => (
                      <span key={idx} className="flex items-center gap-1">
                        {idx > 0 && <ChevronRight size={12} className="shrink-0 text-stone-300" />}
                        <span className={idx === breadcrumbs.length - 1 ? 'font-semibold text-stone-800' : 'text-stone-500'}>
                          {segment}
                        </span>
                      </span>
                    ))}
                  </div>
                  <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">
                    第 {selected.line} 行
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2 pl-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs text-stone-600 hover:text-stone-900"
                    onClick={() => void router.push(`/editor?external=${encodeURIComponent(selected.path)}`)}
                    title="在工作区打开编辑"
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

/** 全局搜索面板；可独立使用或嵌入其他视图，点击结果通知调用方。 */
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
  const setRoot = (next: string) => {
    setInternalRoot(next)
    onRootChange?.(next)
  }

  const [query, setQuery] = useState('')
  const [include, setInclude] = useState('')
  const [exclude, setExclude] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [regex, setRegex] = useState(false)
  const [includeIgnored, setIncludeIgnored] = useState(false)
  const [result, setResult] = useState<ContentSearchResult>({ matches: [], truncated: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const sequence = useRef(0)

  useEffect(() => {
    const request = ++sequence.current
    window.electronAPI.cancelContentSearch()
    setResult({ matches: [], truncated: false })
    setError('')
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
              title="关闭搜索并返回文件列表"
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
          title={root || '选择搜索文件夹'}
          onClick={() => {
            void window.electronAPI
              .pickSearchFolder()
              .then((path) => {
                if (path) setRoot(path)
              })
              .catch((reason) => setError(String(reason)))
          }}
        >
          <FolderOpen size={15} className="shrink-0 text-green-600" />
          <span className="min-w-0 flex-1 text-left">
            <strong className="block truncate text-xs">{root ? root.split(/[\\/]/).pop() : '选择文件夹'}</strong>
            <small className="block truncate text-[10px] text-stone-400">{root || '递归搜索文件内容'}</small>
          </span>
          <ChevronDown size={14} />
        </button>
      ) : (
        <div
          className="search-folder !cursor-default !bg-stone-50 select-none"
          title={root || '当前目录'}
        >
          <FolderOpen size={15} className="shrink-0 text-green-600" />
          <span className="min-w-0 flex-1 text-left">
            <strong className="block truncate text-xs">{root ? root.split(/[\\/]/).pop() : '当前目录'}</strong>
            <small className="block truncate text-[10px] text-stone-400" title={root}>{root || '仅限当前文件夹'}</small>
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
          <button aria-label="清空搜索" onClick={() => setQuery('')}>
            <X size={13} />
          </button>
        )}
        {(
          [
            ['Aa', '区分大小写', caseSensitive, setCaseSensitive],
            ['ab', '全词匹配', wholeWord, setWholeWord],
            ['.*', '正则表达式', regex, setRegex]
          ] as const
        ).map(([label, title, active, change]) => (
          <button
            key={title}
            title={title}
            aria-label={title}
            aria-pressed={active}
            className={active ? 'selected' : ''}
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
      <div role="status" className="px-3 pb-2 text-[11px] text-stone-400">
        {busy ? '搜索中…' : `${result.matches.length} 处匹配 · ${groups.length} 个文件`}
        {result.truncated && '（结果已截断，请缩小范围）'}
      </div>
      {error && (
        <p role="alert" className="px-3 pb-2 text-xs text-red-600">
          {error}
        </p>
      )}
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-2 pb-3">
          {groups.map(([path, matches]) => (
            <Collapsible key={path} defaultOpen>
              <CollapsibleTrigger className="group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-xs hover:bg-[#f0efed]">
                <ChevronDown className="size-3 shrink-0 text-stone-400 group-data-[state=closed]:-rotate-90" />
                <File className="size-3.5 shrink-0 text-stone-500" />
                <span className="min-w-0 flex-1 truncate" title={matches[0].relativePath}>
                  {matches[0].relativePath}
                </span>
                <span className="text-[10px] text-stone-400">{matches.length}</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {matches.map((match, index) => (
                  <button
                    key={`${match.line}:${index}`}
                    title={match.text}
                    className={`search-match ${selected === match ? 'active' : ''}`}
                    onClick={() => onSelect(match)}
                  >
                    <span className="w-7 shrink-0 text-right font-mono text-[10px] text-stone-400">{match.line}</span>
                    <span className="min-w-0 flex-1 truncate">
                      <Highlight match={match} />
                    </span>
                  </button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))}
          {!busy && query && root && !groups.length && !error && (
            <p className="p-3 text-xs text-stone-400">没有匹配的文本内容</p>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
