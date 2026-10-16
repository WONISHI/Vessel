import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { copy } from "@/pages/debug/components/utility-tools-shared"
import { Code, Copy, Download, Trash2 } from "lucide-react"
import { useState } from "react"

/** Renders the text tool component. */
export function TextTool({ mode }: { mode: "base64" | "url" }) {
  const [input, setInput] = useState(""),
    [output, setOutput] = useState(""),
    [error, setError] = useState("")

  /** Runs run. */
  const run = (reverse = false) => {
    try {
      const result =
        mode === "url" ? (reverse ? decodeURIComponent(input) : encodeURIComponent(input)) : reverse ? new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(input), (c) => c.charCodeAt(0))) : btoa(Array.from(new TextEncoder().encode(input), (b) => String.fromCharCode(b)).join(""))
      setOutput(result)
      setError("")
    } catch (e) {
      setError(String(e))
      setOutput("")
    }
  }
  const name = mode === "base64" ? "Base64" : "URL 编解码"
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="tool-page-header">
        <span className="tool-page-brand">
          <Code size={16} />
        </span>
        <div className="tool-page-heading">
          <h2>{name}</h2>
          <p>本地处理，即时转换</p>
        </div>
        <div className="tool-page-actions">
          <Button
            size="sm"
            className="bg-green-600 text-white hover:bg-green-700"
            onClick={() => run()}
          >
            <Code size={13} />
            编码
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => run(true)}
          >
            <Code size={13} />
            解码
          </Button>
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="bg-red-50 px-4 py-2 text-xs text-red-600"
        >
          {error}
        </p>
      )}
      <div className="dual-tools grid min-h-0 flex-1 grid-cols-2">
        <section className="flex min-h-0 flex-col border-r">
          <div className="flex h-10 items-center border-b bg-stone-50 px-3 text-xs text-stone-500">
            输入
            <Button
              size="icon"
              variant="ghost"
              className="ml-auto size-7"
              aria-label="清空输入"
              onClick={() => {
                setInput("")
                setOutput("")
                setError("")
              }}
            >
              <Trash2 size={14} />
            </Button>
          </div>
          <Textarea
            aria-label={`${name}输入`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="在此输入内容…"
            className="min-h-0 flex-1 resize-none rounded-none border-0 p-4 font-mono text-xs shadow-none focus-visible:ring-0"
          />
        </section>
        <section className="flex min-h-0 flex-col">
          <div className="flex h-10 items-center gap-1 border-b bg-stone-50 px-3 text-xs text-stone-500">
            处理结果
            <Button
              size="icon"
              variant="ghost"
              className="ml-auto size-7"
              aria-label="复制结果"
              disabled={!output}
              onClick={() => copy(output)}
            >
              <Copy size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label="下载结果"
              disabled={!output}
              onClick={() => {
                const url = URL.createObjectURL(new Blob([output], { type: "text/plain" }))
                const a = document.createElement("a")
                a.href = url
                a.download = "result.txt"
                a.click()
                setTimeout(() => URL.revokeObjectURL(url), 1000)
              }}
            >
              <Download size={14} />
            </Button>
          </div>
          <Textarea
            aria-label="处理结果"
            readOnly
            value={output}
            className="min-h-0 flex-1 resize-none rounded-none border-0 p-4 font-mono text-xs shadow-none focus-visible:ring-0"
          />
        </section>
      </div>
    </div>
  )
}
