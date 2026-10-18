import { Button } from "@/components/ui/button"
import { createMindmapDocument, createMindmapWriter, parseMindmapDocument } from "@/components/core/canvas/variants/mindmap/document"
import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import MindElixir, { type MindElixirInstance } from "mind-elixir"
import "mind-elixir/style.css"
import "@/components/core/canvas/variants/mindmap/style.css"
import { useEffect, useRef, useState } from "react"
import { toast } from "@/components/ui/sonner"

/** Workspace-backed visual mind-map editor with queued autosave and theme switching. */
export default function MindmapCanvas({ activeFilePath }: { activeFilePath: string }) {
  const dark = useDarkAppearance()
  const darkRef = useRef(dark)
  darkRef.current = dark
  const host = useRef<HTMLDivElement>(null)
  const instance = useRef<MindElixirInstance | null>(null)
  const flush = useRef<() => Promise<void>>(async () => {})
  const [status, setStatus] = useState("正在加载…")
  const [error, setError] = useState("")
  const [ready, setReady] = useState(false)

  useEffect(() => {
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
      pending = JSON.stringify(editor.getData(), null, 2)
      setStatus("待保存")
      clearTimeout(timer)
      timer = setTimeout(() => void save(), 500)
    }
    void window.electronAPI.readContent(activeFilePath).then(async (raw) => {
      if (disposed || !host.current) return
      const text = raw.trim() ? raw : createMindmapDocument(activeFilePath.split(/[\\/]/).pop())
      const data = parseMindmapDocument(text)
      editor = new MindElixir({ el: host.current, locale: "zh_CN", theme: darkRef.current ? MindElixir.DARK_THEME : MindElixir.THEME, allowUndo: true, toolBar: true, keypress: true, contextMenu: true, newTopicName: "分支主题", overflowHidden: true })
      const failure = editor.init(data)
      if (failure) throw failure
      editor.changeTheme(darkRef.current ? MindElixir.DARK_THEME : MindElixir.THEME)
      instance.current = editor
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
      editor?.destroy()
      instance.current = null
    }
  }, [activeFilePath])

  useEffect(() => {
    instance.current?.changeTheme(dark ? MindElixir.DARK_THEME : MindElixir.THEME)
  }, [dark])

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
        <strong className="mr-auto truncate" title={activeFilePath}>{activeFilePath.split(/[\\/]/).pop()}</strong>
        <span role="status">{status}</span>
        <Button size="sm" variant="ghost" disabled={!ready} onClick={() => void flush.current()}>保存</Button>
        <Button size="sm" variant="ghost" disabled={!ready} onClick={() => instance.current?.undo()}>撤销</Button>
        <Button size="sm" variant="ghost" disabled={!ready} onClick={() => instance.current?.redo()}>重做</Button>
        <Button size="sm" variant="ghost" disabled={!ready} onClick={() => instance.current?.scaleFit()}>适应画布</Button>
        <Button size="sm" variant="ghost" disabled={!ready} onClick={() => void download("png")}>导出 PNG</Button>
        <Button size="sm" variant="ghost" disabled={!ready} onClick={() => void download("svg")}>导出 SVG</Button>
        <Button size="sm" variant="ghost" disabled={!ready} onClick={() => void download("mind")}>导出导图</Button>
      </header>
      {error && <p role="alert" className="shrink-0 px-3 py-2 text-xs text-red-500">{error}</p>}
      <div ref={host} className="min-h-0 flex-1 overflow-hidden" aria-label="思维导图画布" />
      <footer className="shrink-0 border-t px-3 py-1 text-xs opacity-70">双击编辑 · Tab 新增子主题 · Enter 新增同级主题 · Delete 删除 · 右键拖动画布</footer>
    </div>
  )
}
