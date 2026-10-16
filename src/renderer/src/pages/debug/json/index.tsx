import "@/components/core/canvas/variants/code/monaco"
import "@/components/styles/tool-page-header.css"
import { Button } from "@/components/ui/button"
import Editor from "@monaco-editor/react"
import { Archive, Code, Copy, Download, RotateCw, Trash2 } from "lucide-react"
import type { editor as MonacoEditor } from "monaco-editor"
import { useRef, useState } from "react"
import { toast } from "sonner"

/** Renders the json tool component. */
export function JsonTool() {
  const [value, setValue] = useState("")
  const [error, setError] = useState("")
  const editor = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)

  /** Replaces replace. */
  const replace = (text: string) => {
    const instance = editor.current
    const model = instance?.getModel()
    if (instance && model) {
      instance.pushUndoStop()
      instance.executeEdits("json-tool", [{ range: model.getFullModelRange(), text }])
      instance.pushUndoStop()
    }
    setValue(text)
    setError("")
  }

  /** Transforms transform. */
  const transform = (compact: boolean) => {
    try {
      replace(JSON.stringify(JSON.parse(value), null, compact ? undefined : 2))
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    }
  }

  /** Downloads download. */
  const download = () => {
    const url = URL.createObjectURL(new Blob([value], { type: "application/json;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "formatted.json"
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <header className="tool-page-header">
        <span className="tool-page-brand">
          <Code size={16} />
        </span>
        <div className="tool-page-heading">
          <h2>JSON 格式化</h2>
          <p>本地处理，即时转换</p>
        </div>
        <div className="tool-page-actions">
          <Button
            size="sm"
            className="bg-green-600 text-white hover:bg-green-700"
            onClick={() => transform(false)}
          >
            <RotateCw size={13} />
            格式化
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => transform(true)}
          >
            <Archive size={13} />
            压缩
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="复制内容"
            title="复制内容"
            disabled={!value}
            onClick={() =>
              void navigator.clipboard
                .writeText(value)
                .then(() => toast.success("已复制"))
                .catch((error) => toast.error(String(error)))
            }
          >
            <Copy size={14} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="下载 JSON"
            title="下载 JSON"
            disabled={!value}
            onClick={download}
          >
            <Download size={14} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="清空内容"
            title="清空内容"
            disabled={!value}
            onClick={() => replace("")}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="shrink-0 bg-red-50 px-4 py-2 text-xs text-red-600"
        >
          {error}
        </p>
      )}
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <Editor
          height="100%"
          language="json"
          value={value}
          onMount={(instance) => {
            editor.current = instance
          }}
          onChange={(text) => {
            setValue(text ?? "")
            setError("")
          }}
          options={{
            ariaLabel: "JSON 编辑器",
            automaticLayout: true,
            fontSize: 14,
            tabSize: 2,
            lineNumbers: "on",
            folding: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 8 },
            bracketPairColorization: { enabled: true },
            formatOnPaste: true,
            scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
            overviewRulerLanes: 0
          }}
        />
      </div>
    </div>
  )
}
