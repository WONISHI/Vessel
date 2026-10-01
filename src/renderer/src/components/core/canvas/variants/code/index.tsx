import Editor from "@monaco-editor/react"
import { useEffect, useRef, useState } from "react"
import { monaco } from "./monaco"
import { codeLanguage } from "./language"
import { PageLoading } from "@/components/ui/page-loading"

export default function CodeCanvas({ activeFilePath }: { activeFilePath: string }) {
  const [content, setContent] = useState<string>()
  const [error, setError] = useState("")
  const [status, setStatus] = useState("预览 / 编辑")
  const [saveError, setSaveError] = useState(false)
  const revision = useRef(0)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    let cancelled = false
    void window.electronAPI.readContent(activeFilePath).then(value => {
      if (!cancelled) {
        if (value.includes("\0")) setError("该文件包含二进制内容，无法作为代码编辑。")
        else setContent(value)
      }
    }).catch(error => { if (!cancelled) setError(String(error)) })
    return () => { cancelled = true; mounted.current = false }
  }, [activeFilePath])
  const save = (value: string) => {
    const request = ++revision.current
    setStatus("正在保存…")
    setSaveError(false)
    void window.electronAPI.saveContent(activeFilePath, value).then(() => {
      if (mounted.current && revision.current === request) setStatus("已保存")
    }).catch(error => {
      if (mounted.current && revision.current === request) { setStatus(`保存失败：${String(error)}`); setSaveError(true) }
    })
  }
  if (error) return <p role="alert" className="p-4 text-red-500">读取失败：{error}</p>
  if (content === undefined) return <PageLoading label="正在读取代码…" />
  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div className="min-h-0 flex-1">
      <Editor height="100%" path={monaco.Uri.file(activeFilePath).toString()} language={codeLanguage(activeFilePath)} value={content}
        loading={<PageLoading label="正在加载代码编辑器…" />}
        onChange={value => { if (value !== undefined && value !== content) { setContent(value); save(value) } }}
        onMount={editor => { editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => save(editor.getValue())) }}
        options={{ automaticLayout: true, minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, tabSize: 2, renderWhitespace: "selection" }} />
    </div>
    <footer className="flex shrink-0 justify-between border-t bg-stone-50 px-5 py-2 text-xs text-stone-500">
      <span role={saveError ? "alert" : "status"} className={saveError ? "text-red-500" : ""}>{status}</span>
      <span>{codeLanguage(activeFilePath)} · UTF-8</span>
    </footer>
  </div>
}
