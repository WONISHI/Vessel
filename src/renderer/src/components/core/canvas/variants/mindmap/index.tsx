import { mindmapActionState } from "./action-state"
import { bindRootSelection } from "./root-selection"
import { bindBranchDrop } from "./branch-drop"
import { useToolbarDrag } from "@/components/core/canvas/variants/mindmap/use-toolbar-drag"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { GripVertical, Save, Undo2, Redo2, Scan, ImageDown, FileCode2, FileDown, GitFork, BetweenHorizontalEnd, BetweenHorizontalStart, Network, Pencil, Copy, ArrowUp, ArrowDown, UnfoldHorizontal, FoldHorizontal, UnfoldVertical, FoldVertical, Bold, Focus, Maximize, ListX, Trash2, AlignStartVertical, AlignEndVertical, ArrowLeftRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createMindmapDocument, createMindmapWriter, parseMindmapDocument } from "@/components/core/canvas/variants/mindmap/document"
import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import MindElixir, { type MindElixirInstance } from "mind-elixir"
import "mind-elixir/style.css"
import "@/components/core/canvas/variants/mindmap/style.css"
import { useEffect, useRef, useState } from "react"
import { toast } from "@/components/ui/sonner"

const nodeActions = [
  ["child", "添加子主题", GitFork], ["sibling", "添加同级主题", BetweenHorizontalEnd], ["before", "前置同级主题", BetweenHorizontalStart],
  ["parent", "插入父主题", Network], ["edit", "编辑主题", Pencil], ["copy", "复制分支", Copy],
  ["up", "上移主题", ArrowUp], ["down", "下移主题", ArrowDown], ["expand", "展开分支", UnfoldHorizontal],
  ["collapse", "折叠分支", FoldHorizontal], ["expand-all", "展开全部", UnfoldVertical], ["collapse-all", "折叠全部", FoldVertical],
  ["bold", "加粗/取消加粗", Bold], ["focus", "聚焦分支", Focus], ["unfocus", "退出聚焦", Maximize],
  ["delete-children", "删除子主题", ListX], ["delete", "删除主题", Trash2],
  ["left", "向左布局", AlignStartVertical], ["right", "向右布局", AlignEndVertical], ["both", "双向布局", ArrowLeftRight]
] as const

/** Applies the workspace gray canvas without mutating the library's shared themes. */
function mindmapTheme(dark: boolean) {
  const theme = dark ? MindElixir.DARK_THEME : MindElixir.THEME
  return { ...theme, cssVar: { ...theme.cssVar, "--bgcolor": dark ? "#30353c" : "#ffffff" } }
}

/** Workspace-backed visual mind-map editor with queued autosave and theme switching. */
export default function MindmapCanvas({ activeFilePath }: { activeFilePath: string }) {
  const toolbarDrag = useToolbarDrag()
  const dark = useDarkAppearance()
  const darkRef = useRef(dark)
  darkRef.current = dark
  const host = useRef<HTMLDivElement>(null)
  const instance = useRef<MindElixirInstance | null>(null)
  const selectedId = useRef<string | null>(null)
  const captureChange = useRef<() => void>(() => {})
  const flush = useRef<() => Promise<void>>(async () => {})
  const [status, setStatus] = useState("正在加载…")
  const [error, setError] = useState("")
  const [ready, setReady] = useState(false)
  const [allowed, setAllowed] = useState<Record<string, boolean>>({})
  const refreshActions = useRef<() => void>(() => {})

  useEffect(() => {
    let disposeRootSelection: (() => void) | undefined
    let disposeBranchDrop: (() => void) | undefined
    setReady(false)
    setAllowed({})
    selectedId.current = null
    let disposed = false
    let editor: MindElixirInstance | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending: string | null = null
    const write = createMindmapWriter((text) => window.electronAPI.saveContent(activeFilePath, text))
    /** Flushes the latest snapshot, retaining unsaved data if writing fails. */
    const save = async () => {
      clearTimeout(timer)
      if (pending === null) return
      const text = pending
      if (!disposed) setStatus("保存中…")
      try {
        await write(text)
        if (pending === text) pending = null
        if (!disposed) { setError(""); setStatus(pending === null ? "已保存" : "待保存") }
      } catch (reason) {
        if (!disposed) { setError(String(reason)); setStatus("保存失败，可点击保存重试") }
        else toast.error("思维导图保存失败", { description: `${activeFilePath}\n${String(reason)}` })
      }
    }
    flush.current = save
    /** Captures edits before debounce so switching files can flush the final operation. */
    const changed = () => {
      if (!editor || disposed) return
      syncActions()
      pending = JSON.stringify(editor.getData(), null, 2)
      setStatus("待保存")
      clearTimeout(timer)
      timer = setTimeout(() => void save(), 500)
    }
    const syncActions = () => {
      if (!editor || disposed) return
      const nodes = editor.currentNodes ?? (editor.currentNode ? [editor.currentNode] : [])
      const node = nodes.length === 1 ? nodes[0].nodeObj : undefined
      selectedId.current = node?.id || null
      setAllowed(mindmapActionState(editor.nodeData || editor.getData().nodeData, node, nodes.length, !!editor.isFocusMode))
    }
    refreshActions.current = syncActions
    captureChange.current = changed
    void window.electronAPI.readContent(activeFilePath).then(async (raw) => {
      if (disposed || !host.current) return
      const text = raw.trim() ? raw : createMindmapDocument(activeFilePath.split(/[\\/]/).pop())
      const data = parseMindmapDocument(text)
      editor = new MindElixir({ el: host.current, locale: "zh_CN", theme: mindmapTheme(darkRef.current), editable: true, draggable: true, allowUndo: true, toolBar: true, keypress: true, contextMenu: true, newTopicName: "分支主题", overflowHidden: false, mouseSelectionButton: 2 })
      const failure = editor.init(data)
      if (failure) throw failure
      // Include the floating React toolbar in the browser fullscreen subtree.
      const fullscreen = host.current.querySelector<HTMLElement>(".mind-elixir-toolbar #fullscreen")
      if (fullscreen) fullscreen.onclick = () => {
        const canvas = host.current?.parentElement
        if (!canvas) return
        void (document.fullscreenElement === canvas ? document.exitFullscreen() : canvas.requestFullscreen())
          .catch((reason) => toast.error("切换全屏失败", { description: String(reason) }))
      }
      disposeBranchDrop = bindBranchDrop(editor, (error) => toast.error("移动分支失败", { description: String(error) }))
      editor.changeTheme(mindmapTheme(darkRef.current))
      disposeRootSelection = bindRootSelection(editor)
      instance.current = editor
      editor.bus.addListener("selectNodes", syncActions)
      editor.bus.addListener("unselectNodes", syncActions)
      editor.bus.addListener("selectNewNode", syncActions)
      syncActions()
      editor.bus.addListener("operation", (operation) => { if (operation.name !== "beginEdit") changed() })
      const undo = editor.undo.bind(editor)
      const redo = editor.redo.bind(editor)
      editor.undo = () => { undo(); changed() }
      editor.redo = () => { redo(); changed() }
      editor.bus.addListener("updateArrowDelta", changed)
      editor.bus.addListener("expandNode", changed)
      editor.bus.addListener("changeDirection", changed)
      setReady(true)
      setStatus("已保存")
      if (!raw.trim()) { pending = text; await save() }
    }).catch((reason) => {
      if (!disposed) { setError(String(reason)); setStatus("打开失败") }
    })
    return () => {
      disposed = true
      clearTimeout(timer)
      void save()
      disposeRootSelection?.()
      disposeBranchDrop?.()
      editor?.destroy()
      instance.current = null
    }
  }, [activeFilePath])

  useEffect(() => {
    instance.current?.changeTheme(mindmapTheme(dark))
  }, [dark])

  /** Runs node editing against the selection retained while toolbar buttons are clicked. */
  const editNode = async (action: typeof nodeActions[number][0]) => {
    const editor = instance.current
    if (!editor || !allowed[action]) return
    try {
      const rootId = editor.getData().nodeData.id
      let node = editor.currentNode
      const globalAction = ["expand-all", "collapse-all", "left", "right", "both", "unfocus"].includes(action)
      if (!node && selectedId.current) node = editor.findEle(selectedId.current)
      if (!node && !globalAction) return
      if (!node) node = editor.findEle(rootId)
      if (!globalAction) editor.selectNode(node)
      if (action === "child") await editor.addChild(node)
      else if (action === "sibling") {
        if (node.nodeObj.id === rootId) await editor.addChild(node)
        else await editor.insertSibling("after", node)
      } else if (action === "edit") await editor.beginEdit(node)
      else if (action === "before") {
        if (node.nodeObj.id === rootId) await editor.addChild(node)
        else await editor.insertSibling("before", node)
      } else if (action === "parent" || action === "copy") {
        if (!node.nodeObj.parent) { toast.info("请选择中心主题以外的分支"); return }
        if (action === "parent") await editor.insertParent(node)
        else await editor.copyNode(node, editor.findEle(node.nodeObj.parent.id))
      } else if (action === "up") await editor.moveUpNode(node)
      else if (action === "down") await editor.moveDownNode(node)
      else if (action === "expand" || action === "collapse") {
        if (!node.nodeObj.children?.length) return
        if (node.nodeObj.id === rootId) editor.expandNodeAll(node, action === "expand")
        else if (node.nodeObj.expanded !== (action === "expand")) editor.expandNode(node, action === "expand")
        captureChange.current()
      } else if (action === "expand-all" || action === "collapse-all") {
        editor.expandNodeAll(editor.findEle(editor.nodeData?.id || rootId), action === "expand-all")
        captureChange.current()
      }
      else if (action === "bold") await editor.reshapeNode(node, { style: { ...node.nodeObj.style, fontWeight: node.nodeObj.style?.fontWeight === "bold" ? "normal" : "bold" } })
      else if (action === "focus") editor.focusNode(node)
      else if (action === "unfocus") editor.cancelFocus()
      else if (action === "left") editor.initLeft()
      else if (action === "right") editor.initRight()
      else if (action === "both") editor.initSide()
      else if (action === "delete-children") {
        const children = node.nodeObj.children || []
        if (!children.length) return
        if (node.nodeObj.expanded === false) editor.expandNodeAll(node, true)
        await editor.removeNodes(children.map((child) => editor.findEle(child.id)))
        selectedId.current = node.nodeObj.id
      } else if (action === "delete") {
        if (node.nodeObj.id === rootId) { toast.info("中心主题不能删除"); return }
        await editor.removeNodes([node])
        selectedId.current = rootId
      }
    } catch (reason) { toast.error("节点操作失败", { description: String(reason) }) }
    finally { refreshActions.current() }
  }

  /** Downloads a portable map or rendered diagram without changing the source file. */
  const download = async (format: "mind" | "svg" | "png") => {
    const editor = instance.current
    if (!editor) return
    try {
      const blob = format === "mind" ? new Blob([JSON.stringify(editor.getData(), null, 2)], { type: "application/json" }) : format === "svg" ? editor.exportSvg() : await editor.exportPng()
      if (!blob) throw new Error("导出图像失败")
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = (activeFilePath.split(/[\\/]/).pop() || "思维导图").replace(/\.mind$/i, "") + `.${format}`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (reason) { toast.error("导出失败", { description: String(reason) }) }
  }

  return (
    <div className="vessel-mindmap flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 text-xs">
        <strong className="mr-auto truncate" data-title={activeFilePath}>{activeFilePath.split(/[\\/]/).pop()}</strong>
        <span role="status">{status}</span>
        <TooltipProvider delayDuration={250}>
          {([
            ["保存", Save, () => void flush.current()],
            ["撤销", Undo2, () => instance.current?.undo()],
            ["重做", Redo2, () => instance.current?.redo()],
            ["适应画布", Scan, () => instance.current?.scaleFit()],
            ["导出 PNG", ImageDown, () => void download("png")],
            ["导出 SVG", FileCode2, () => void download("svg")],
            ["导出导图", FileDown, () => void download("mind")]
          ] as const).map(([label, Icon, onClick]) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <Button className="mindmap-toolbar-action" size="icon" variant="ghost" aria-label={label} disabled={!ready} onClick={onClick}><Icon aria-hidden /></Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{label}</TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </header>
      {error && <p role="alert" className="shrink-0 px-3 py-2 text-xs text-red-500">{error}</p>}
      <div className="relative min-h-0 flex-1">
        <div ref={host} className="h-full min-h-0 overflow-hidden" aria-label="思维导图画布" />
      <div ref={toolbarDrag.toolbar} style={toolbarDrag.style} role="toolbar" aria-label="思维导图编辑工具" className="mindmap-node-actions flex flex-wrap items-center justify-center gap-1 border px-2 py-1.5">
        <TooltipProvider delayDuration={250}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="mindmap-drag-handle" aria-label="拖拽移动工具栏" {...toolbarDrag.handleProps}><GripVertical aria-hidden /></Button>
            </TooltipTrigger>
            <TooltipContent side="top">拖拽移动工具栏</TooltipContent>
          </Tooltip>
          {nodeActions.map(([action, label, Icon]) => (
            <Tooltip key={action}>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" aria-label={label} disabled={!ready || !allowed[action]} onMouseDown={(event) => event.preventDefault()} onClick={() => void editNode(action)}><Icon aria-hidden /></Button>
              </TooltipTrigger>
              <TooltipContent side="top">{label}</TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
      </div>
      <footer className="shrink-0 border-t px-3 py-1 text-xs opacity-70">双击编辑 · Tab 新增子主题 · Enter 新增同级主题 · Delete 删除 · 空白处左键拖动画布 · 右键框选</footer>
    </div>
  )
}
