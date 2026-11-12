import "@/components/styles/tool-page-header.css"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { copy } from "@/pages/debug/components/utility-tools-shared"
import { CaseSensitive, Copy, Trash2 } from "lucide-react"
import { useState } from "react"
import { convertCase } from "./convert"

/** Converts the current input into common identifier styles. */
export function CaseConvertTool() {
  const [input, setInput] = useState("")
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="tool-page-header">
        <span className="tool-page-brand"><CaseSensitive size={16} /></span>
        <div className="tool-page-heading">
          <h2>转写工具</h2>
          <p>输入单词，实时转换常用命名格式</p>
        </div>
      </header>
      <div className="dual-tools grid min-h-0 flex-1 grid-cols-2">
        <section className="flex min-h-0 min-w-0 flex-col border-r">
          <div className="flex h-10 shrink-0 items-center border-b bg-stone-50 px-3 text-xs text-stone-500 dark:bg-stone-900">
            输入
            <Button size="icon" variant="ghost" className="ml-auto size-7" aria-label="清空输入" disabled={!input} onClick={() => setInput("")}><Trash2 size={14} /></Button>
          </div>
          <Textarea aria-label="转写输入" value={input} onChange={(event) => setInput(event.target.value)} placeholder="例如 hello world、helloWorld、HTTPServer 或 hello_world" spellCheck={false} className="min-h-0 flex-1 resize-none rounded-none border-0 p-4 font-mono text-xs shadow-none focus-visible:ring-0" />
        </section>
        <section className="flex min-h-0 min-w-0 flex-col">
          <div className="flex h-10 shrink-0 items-center border-b bg-stone-50 px-3 text-xs text-stone-500 dark:bg-stone-900">转写结果</div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-3 p-4">
              {convertCase(input).map(({ label, value }) => (
                <section key={label} className="rounded-lg border bg-background">
                  <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs text-muted-foreground">
                    <h3>{label}</h3>
                    <Button size="icon" variant="ghost" className="size-7" aria-label={`复制${label}`} disabled={!value} onClick={() => copy(value)}><Copy size={14} /></Button>
                  </div>
                  <p className="min-h-12 whitespace-pre-wrap break-all p-3 font-mono text-xs">{value || <span className="text-muted-foreground">等待输入…</span>}</p>
                </section>
              ))}
            </div>
          </ScrollArea>
        </section>
      </div>
    </div>
  )
}
