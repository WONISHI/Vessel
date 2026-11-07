import "@/components/ui/resize-handle.css"
import "@/components/styles/tool-page-header.css"
import ActivityBar from "@/components/layout/activity-bar/index"
import { ImageFilePreview } from "@/components/image-preview/index"
import Layout from "@/components/layout"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Image } from "@/components/ui/image"
import { RouteLoading } from "@/components/ui/route-loading"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { readCurrentWorkspace } from "@/router/components/index-shared"
import { ArrowDown, ArrowUp, BookOpenText, ChevronLeft, ChevronRight, File, Paperclip, RefreshCw, SquareCheck, Trash } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

type Attachment = Awaited<ReturnType<Window["electronAPI"]["listAttachments"]>>[number]
const pageSize = 60
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })
const folderOf = (path: string) => path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")))
const sortLabels = { time: "修改时间", folder: "所在文件夹", name: "文件名称" }
type SortBy = keyof typeof sortLabels
const sortOptions: SortBy[] = ["time", "folder", "name"]
const dateFormat = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" })
const nameGroup = (name: string) => name.match(/^[a-z]/i)?.[0].toUpperCase() ?? "#"

function groupLabel(file: Attachment, sortBy: SortBy) {
  if (sortBy === "time") return Number.isFinite(file.mtime) ? dateFormat.format(file.mtime) : "未知日期"
  if (sortBy === "folder") return folderOf(file.relativePath) || "工作区根目录"
  return nameGroup(file.name)
}

const imageExtension = /\.(png|jpe?g|gif|webp|avif|bmp|svg|tmp)$/i

function AttachmentReader({ root, files, onNextPage, open, onOpenChange, initialPath, loop }: {
  root: string
  files: Attachment[]
  onNextPage?: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPath?: string
  loop?: boolean
}) {
  const [index, setIndex] = useState(0)
  const rail = useRef<HTMLDivElement>(null)
  const lastWheel = useRef(0)
  const [width, setWidth] = useState<number>()
  const sheet = useRef<HTMLDivElement>(null)
  const resize = useRef<{ x: number; width: number } | null>(null)
  const changeWidth = (next: number) => {
    const max = window.innerWidth * 0.9
    setWidth(Math.min(max, Math.max(Math.min(480, window.innerWidth * 0.6), next)))
  }
  const step = 160
  const move = (direction: number) => {
    rail.current?.scrollTo({ top: (index + direction) * step })
  }
  const file = files[Math.min(index, files.length - 1)]

  return (
    <Sheet modal={false} open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button className="hover:text-white" size="icon" variant="outline" aria-label="图片阅读" data-title="图片阅读" disabled={!file}>
          <BookOpenText />
        </Button>
      </SheetTrigger>
      <SheetContent
        showOverlay={false}
        ref={sheet}
        className="flex w-[60vw] min-w-[min(480px,60vw)] max-w-[90vw] flex-col gap-0 p-0 sm:max-w-[90vw]"
        style={{ width }}
        onOpenAutoFocus={() => {
          const initialIndex = Math.max(0, files.findIndex((entry) => entry.path === initialPath))
          setIndex(initialIndex)
          if (rail.current) rail.current.scrollTop = initialIndex * step
        }}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="调整图片阅读侧栏宽度"
          tabIndex={0}
          className="vessel-resize-handle absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize"
          onPointerDown={(event) => {
            if (event.button !== 0 || !sheet.current) return
            event.preventDefault()
            resize.current = { x: event.clientX, width: sheet.current.offsetWidth }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (resize.current) changeWidth(resize.current.width + resize.current.x - event.clientX)
          }}
          onLostPointerCapture={() => { resize.current = null }}
          onKeyDown={(event) => {
            if (!sheet.current || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return
            event.preventDefault()
            changeWidth(sheet.current.offsetWidth + (event.key === "ArrowLeft" ? 24 : -24))
          }}
        />
        <div className="shrink-0 border-b px-5 py-3 pr-12">
          <SheetTitle>图片阅读</SheetTitle>
          <SheetDescription>上下滚动切换图片 · {files.length ? index + 1 : 0} / {files.length}</SheetDescription>
        </div>
        <div
          className="flex min-h-0 flex-1"
          onWheel={(event) => {
            if ((event.target as Element).closest(".image-viewer-details") || event.ctrlKey) return
            const now = performance.now()
            const newGesture = now - lastWheel.current > 160
            lastWheel.current = now
            const viewport = rail.current
            if (!viewport) return
            if (event.deltaY > 0 && newGesture && (loop || onNextPage) &&
                viewport.scrollTop >= (files.length - 1) * step - 1) {
              viewport.scrollTop = 0
              setIndex(0)
              if (!loop) onNextPage?.()
              return
            }
            if (viewport.parentElement?.contains(event.target as Node)) return
            const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? step : 1
            viewport.scrollBy({ top: event.deltaY * multiplier })
          }}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
            event.preventDefault()
            move(event.key === "ArrowUp" ? -1 : 1)
          }}
          tabIndex={0}
          aria-label="图片浏览，使用上下方向键切换"
        >
          <div
            className="min-w-0 flex-1"

          >
            {file ? <ImageFilePreview key={file.path} root={root} activeFilePath={file.path} /> : <p className="p-5 text-sm text-muted-foreground">该分组暂无可阅读的图片</p>}
          </div>
          <ScrollArea
            type="auto"
            className="w-4 shrink-0 border-l [container-type:size]"
            viewportRef={rail}
            onScrollCapture={(event) => {
              if (event.target === rail.current && rail.current) {
                setIndex(Math.max(0, Math.min(files.length - 1, Math.round(rail.current.scrollTop / step))))
              }
            }}
          >
            <div aria-hidden="true" style={{ height: `calc(100cqh + ${Math.max(0, files.length - 1) * step}px)` }} />
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function AttachmentCard({ file, root, selected, onSelect, onPreview }: { file: Attachment; root: string; selected?: boolean; onSelect?: (event: MouseEvent<HTMLElement>) => void; onPreview: () => void }) {
  const extension = file.name.split(".").pop()?.toUpperCase() || "文件"
  const [failedTemp, setFailedTemp] = useState(false)
  const temporary = /\.tmp$/i.test(file.name)
  const image = imageExtension.test(file.name)
  const preview = image && !failedTemp ? onPreview : undefined
  const size = file.size >= 1024 ** 2 ? `${(file.size / 1024 ** 2).toFixed(1)} MB` : `${Math.ceil(file.size / 1024)} KB`

  return (
    <article className={`relative min-w-0 rounded-xl border bg-card p-2 text-card-foreground ${selected ? "ring-2 ring-green-600" : ""}`} onDoubleClick={(event) => {
      if (!(event.target as Element).closest("[data-attachment-thumbnail]")) preview?.()
    }}>
      <div data-attachment-thumbnail
        className={`aspect-square overflow-hidden rounded-lg bg-muted ${onSelect ? "relative z-10" : ""}`}
        onClickCapture={onSelect}
      >
        {image && !failedTemp ? (
          <Image
            sourceKey={file.path}
            loadSource={async () => {
              try {
                return (await window.electronAPI.readImageFile(root, file.path)).src
              } catch (error) {
                if (temporary) setFailedTemp(true)
                throw error
              }
            }}
            onError={() => { if (temporary) setFailedTemp(true) }}
            placeholderRatio="1x1"
            alt={file.name}
            className="aspect-square w-full object-cover"
          />
        ) : <div className="grid h-full place-items-center"><File className="size-8 text-muted-foreground" /></div>}
      </div>
      <button
        type="button"
        className="mt-2 block w-full cursor-default truncate rounded px-1 text-left text-sm font-medium hover:underline"
        data-title={file.relativePath}
        onClick={() => void window.electronAPI.openTransitWindow({ kind: "file", root, content: file.path, title: file.name }).catch((error) => toast.error(String(error)))}
      >
        {file.name}
      </button>
      <p className="cursor-default px-1 text-xs text-muted-foreground">{extension} · {size}</p>
      {onSelect && (
        <button type="button" aria-label={`选择 ${file.name}`} aria-pressed={selected}
          className="absolute inset-0 cursor-default rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-600"
          onClick={onSelect}
        />
      )}
    </article>
  )
}

export default function AttachmentRoute() {
  const navigate = useNavigate()
  const root = readCurrentWorkspace()?.path
  const [files, setFiles] = useState<Attachment[]>([])
  const [selection, setSelection] = useState<{ group: string; paths: string[]; anchor?: string }>()
  const [readerOpen, setReaderOpen] = useState(false)
  const [readerGroup, setReaderGroup] = useState<string>()
  const [initialPath, setInitialPath] = useState<string>()
  const [confirmFiles, setConfirmFiles] = useState<Attachment[]>([])
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [requestedPage, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortBy>("time")
  const [filterGroup, setFilterGroup] = useState<string>()
  const [reverse, setReverse] = useState(false)
  const [loading, setLoading] = useState(Boolean(root))
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (!root) return
    let cancelled = false
    setLoading(true)
    setError("")
    void window.electronAPI.listAttachments(root).then((files) => {
      if (!cancelled) {
        setFiles(files)
        setPage((current) => Math.min(current, Math.max(1, Math.ceil(files.length / pageSize))))
      }
    }).catch((error) => {
      if (!cancelled) setError(String(error))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [root, revision])

  const sortedFiles = useMemo(() => files.filter((file) => {
    if (filterGroup === undefined) return true
    return groupLabel(file, sortBy) === filterGroup && (sortBy !== "folder" || imageExtension.test(file.name))
  }).sort((a, b) => {
    const byName = () => collator.compare(a.name, b.name)
    const aGroup = sortBy === "time" ? "" : groupLabel(a, sortBy)
    const bGroup = sortBy === "time" ? "" : groupLabel(b, sortBy)
    if (sortBy === "name" && (aGroup === "#") !== (bGroup === "#")) return aGroup === "#" ? 1 : -1
    const order = sortBy === "time" ? (b.mtime || 0) - (a.mtime || 0)
      : collator.compare(aGroup, bGroup) || (aGroup < bGroup ? -1 : aGroup > bGroup ? 1 : 0)
    const withinGroup = sortBy === "name" && reverse ? -byName() : byName()
    return (reverse ? -order : order) || withinGroup || collator.compare(a.relativePath, b.relativePath)
  }), [files, sortBy, reverse, filterGroup])
  const pageCount = Math.max(1, Math.ceil(sortedFiles.length / pageSize))
  const page = Math.min(requestedPage, pageCount)
  const start = (page - 1) * pageSize
  const pageGroups = new Map<string, Attachment[]>()
  const pageFiles = sortedFiles.slice(start, start + pageSize)
  const groupImages = useMemo(() => readerGroup === undefined ? undefined : sortedFiles.filter(
    (file) => imageExtension.test(file.name) && groupLabel(file, sortBy) === readerGroup
  ), [readerGroup, sortedFiles, sortBy])
  const readerFiles = groupImages ?? pageFiles.filter((file) => imageExtension.test(file.name))
  for (const file of pageFiles) {
    const label = groupLabel(file, sortBy)
    const group = pageGroups.get(label)
    if (group) group.push(file)
    else pageGroups.set(label, [file])
  }
  const removeAttachment = async () => {
    if (!root || !confirmFiles.length || deleting) return
    setDeleting(true)
    setDeleteError("")
    const removed = new Set<string>()
    try {
      for (const file of confirmFiles) {
        await window.electronAPI.mutateWorkspaceFile(root, file.path)
        removed.add(file.path)
      }
      setSelection(undefined)
      toast.success("所选附件已移到废纸篓")
    } catch (error) {
      setDeleteError(String(error))
    } finally {
      setConfirmFiles(confirmFiles.filter((file) => !removed.has(file.path)))
      setFiles((current) => current.filter((file) => !removed.has(file.path)))
      setPage((current) => Math.min(current, Math.max(1, Math.ceil((files.length - removed.size) / pageSize))))
      setDeleting(false)
    }
  }
  const openGroupReader = (group: string, path?: string) => {
    setReaderGroup(group)
    setInitialPath(path)
    setReaderOpen(true)
  }
  const sortLabel = `排序与筛选 · ${sortLabels[sortBy]}${filterGroup === undefined ? "" : ` · ${filterGroup}`}`
  const filterOptions = useMemo(() => ({
    time: [...new Set([...files].sort((a, b) => b.mtime - a.mtime).map((file) => groupLabel(file, "time")))],
    folder: [...new Set(files.filter((file) => imageExtension.test(file.name)).map((file) => groupLabel(file, "folder")))].sort(collator.compare),
    name: [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"]
  }), [files])
  const direction = sortBy === "time" ? (reverse ? "最早优先" : "最新优先") : (reverse ? "降序" : "升序")

  return (
    <Layout aside={<ActivityBar activity="attachments" onActivityChange={(id) => navigate(id === "files" ? "/editor" : `/${id}`)} />}>
      {loading ? (
        <RouteLoading icon={<Paperclip />} title="正在加载附件库" label="正在读取附件目录，请稍候…" />
      ) : (
        <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
          <header className="tool-page-header dark:!border-b-border">
            <span className="tool-page-brand"><Paperclip size={16} /></span>
            <div className="tool-page-heading">
              <h1>附件库</h1>
              <p>浏览和管理工作区附件</p>
            </div>
            <div className="tool-page-actions">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="hover:text-white" size="icon" variant="outline" aria-label={sortLabel} data-title={sortLabel}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m3 9 3-3 3 3M6 6v12M12 6h3m-3 6h6m-6 6h9" />
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="dark:bg-[#2c333d]">
                  {sortOptions.map((option) => (
                    <DropdownMenuSub key={option}>
                      <DropdownMenuSubTrigger>{sortLabels[option]}</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="dark:bg-[#2c333d]">
                        <ScrollArea type="hover" scrollHideDelay={0} className="[&>[data-radix-scroll-area-viewport]]:max-h-[min(24rem,calc(var(--radix-dropdown-menu-content-available-height)_-_0.625rem))]">
                          <DropdownMenuRadioGroup
                            value={sortBy === option ? filterGroup === undefined ? "all" : `group:${filterGroup}` : ""}
                            onValueChange={(value) => {
                              setSortBy(option)
                              setFilterGroup(value === "all" ? undefined : value.slice("group:".length))
                              if (sortBy !== option) setReverse(false)
                              setPage(1)
                              setSelection(undefined)
                            }}
                          >
                            <DropdownMenuRadioItem checkOnRight value="all">全部</DropdownMenuRadioItem>
                            {filterOptions[option].map((group) => (
                              <DropdownMenuRadioItem key={group} checkOnRight value={`group:${group}`}>
                                {option === "name" && group === "#" ? "其他首字符" : group}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </ScrollArea>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button className="hover:text-white" size="icon" variant="outline" aria-label={direction} data-title={direction} onClick={() => { setReverse(!reverse); setPage(1) }}>
                {reverse === (sortBy === "time") ? <ArrowUp /> : <ArrowDown />}
              </Button>
              <Button className="hover:text-white" size="icon" variant="outline" aria-label="刷新" data-title="刷新" disabled={!root} onClick={() => setRevision((value) => value + 1)}>
                <RefreshCw />
              </Button>
              {root && <AttachmentReader key={`${root}:${sortBy}:${reverse}`} root={root} files={readerFiles} open={readerOpen} initialPath={initialPath} loop={readerGroup !== undefined} onOpenChange={(next) => {
                setReaderOpen(next)
                setInitialPath(undefined)
                setReaderGroup(undefined)
              }} onNextPage={page < pageCount ? () => setPage(page + 1) : undefined} />}
            </div>
          </header>
          <ScrollArea key={`${root}:${page}:${sortBy}:${reverse}`} type="hover" className="min-h-0 flex-1 [&>[data-radix-scroll-area-viewport]]:[scrollbar-width:none] [&>[data-radix-scroll-area-viewport]::-webkit-scrollbar]:hidden">
            <div className="p-5">
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              {!error && files.length > 0 && sortedFiles.length === 0 && <p className="text-sm text-muted-foreground">没有符合筛选条件的附件</p>}
              {!error && !files.length && <p className="text-sm text-muted-foreground">{root ? "配置的目录中暂无附件" : "请先打开工作区"}</p>}
              {root && Array.from(pageGroups, ([label, group]) => {
                const selecting = selection?.group === label
                const selected = selecting ? group.filter((file) => selection.paths.includes(file.path)) : []
                const firstImage = selected.find((file) => imageExtension.test(file.name))
                const selectFile = (file: Attachment, event: MouseEvent<HTMLElement>) => {
                  if (!selection) return
                  const additive = event.metaKey || event.ctrlKey
                  const anchorIndex = group.findIndex((entry) => entry.path === selection.anchor)
                  const index = group.indexOf(file)
                  if (event.shiftKey && anchorIndex >= 0) {
                    const range = group.slice(Math.min(index, anchorIndex), Math.max(index, anchorIndex) + 1).map((entry) => entry.path)
                    setSelection({ ...selection, paths: additive ? [...new Set([...selection.paths, ...range])] : range })
                    return
                  }
                  const paths = additive
                    ? selection.paths.includes(file.path) ? selection.paths.filter((path) => path !== file.path) : [...selection.paths, file.path]
                    : [file.path]
                  setSelection({ group: label, paths, anchor: file.path })
                }
                return (
                <section key={label} className="mb-6 last:mb-0" onKeyDown={(event) => {
                  if (!selecting || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "a") return
                  event.preventDefault()
                  setSelection({ ...selection, paths: group.map((file) => file.path) })
                }}>
                  <div className="mb-3 flex items-center justify-between gap-2 border-b pb-2">
                    <h2 className="min-w-0 break-words text-sm font-semibold">{label}</h2>
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" variant="outline" className="hover:text-white" aria-label="选择附件" data-title="选择附件" aria-pressed={selecting}
                        onClick={() => setSelection(selecting ? undefined : { group: label, paths: [] })}><SquareCheck /></Button>
                      <Button size="icon" variant="outline" className="hover:text-white" aria-label="阅读分组图片" data-title="阅读分组图片"
                        onClick={() => openGroupReader(label, firstImage?.path)}><BookOpenText /></Button>
                      <Button size="icon" variant="outline" className="hover:text-white" aria-label="删除所选附件" data-title="删除所选附件"
                        disabled={!selected.length} onClick={() => { setDeleteError(""); setConfirmFiles(selected) }}><Trash /></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
                    {group.map((file) => <AttachmentCard key={`${file.path}:${file.mtime}`} file={file} root={root} selected={selected.includes(file) || (readerOpen && initialPath === file.path)}
                      onPreview={() => openGroupReader(label, file.path)}
                      onSelect={selecting ? (event) => selectFile(file, event) : undefined} />)}
                  </div>
                </section>
                )
              })}
            </div>
          </ScrollArea>
          {root && sortedFiles.length > 0 && (
            <nav aria-label="附件分页" className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3">
              <p className="text-sm text-muted-foreground">共 {sortedFiles.length} 项，每页 {pageSize} 项</p>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" className="hover:text-white" aria-label="上一页" data-title="上一页" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft /></Button>
                <form className="flex items-center gap-2" onSubmit={(event) => {
                  event.preventDefault()
                  const target = Number(new FormData(event.currentTarget).get("page"))
                  if (Number.isInteger(target) && target >= 1 && target <= pageCount) setPage(target)
                }}>
                  <label className="flex items-center gap-1 text-sm tabular-nums">
                    <span>第</span>
                    <Input key={page} name="page" type="number" min={1} max={pageCount} step={1} required
                      defaultValue={page} aria-label="跳转到页码"
                      className="h-9 w-16 px-2 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                    <span>/ {pageCount} 页</span>
                  </label>
                  <Button type="submit" size="sm" variant="outline" className="hover:text-white">跳转</Button>
                </form>
                <Button size="icon" variant="outline" className="hover:text-white" aria-label="下一页" data-title="下一页" disabled={page === pageCount} onClick={() => setPage(page + 1)}><ChevronRight /></Button>
              </div>
            </nav>
          )}
        </section>
      )}
      <ConfirmDialog open={confirmFiles.length > 0} onOpenChange={(open) => { if (!open) setConfirmFiles([]) }}
        title="删除附件" description={confirmFiles.length === 1 ? `将「${confirmFiles[0].name}」移到系统废纸篓？` : `将选中的 ${confirmFiles.length} 个附件移到系统废纸篓？`}
        confirmText="移到废纸篓" busy={deleting} error={deleteError} onConfirm={() => void removeAttachment()} />
    </Layout>
  )
}
