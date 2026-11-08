import { ScrollArea } from "@/components/ui/scroll-area"
import "./translate.css"
import "@/components/styles/tool-page-header.css"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { copy } from "@/pages/debug/components/utility-tools-shared"
import { ArrowLeftRight, Copy, Languages, X } from "lucide-react"
import { useState } from "react"

const languages = [
  ["zh-CN", "中文（简体）"], ["zh-TW", "中文（繁体）"], ["en", "英语"], ["ja", "日语"],
  ["ko", "韩语"], ["fr", "法语"], ["de", "德语"], ["es", "西班牙语"],
  ["it", "意大利语"], ["pt", "葡萄牙语"], ["ru", "俄语"], ["ar", "阿拉伯语"],
  ["hi", "印地语"], ["th", "泰语"], ["vi", "越南语"], ["id", "印度尼西亚语"]
]
const maxLength = 5000

export default function TranslateTool() {
  const [input, setInput] = useState("")
  const [from, setFrom] = useState("zh-CN")
  const [to, setTo] = useState("en")
  const [result, setResult] = useState<{ text: string; detectedLanguage: string; alternatives?: { word: string; partOfSpeech: string; meanings: string[] }[] }>()
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const source = from === "auto" ? result?.detectedLanguage : from
  const detectedLabel = languages.find(([code]) => code === result?.detectedLanguage)?.[1] ?? result?.detectedLanguage

  function clearResult() {
    setResult(undefined)
    setError("")
  }

  async function run() {
    if (busy || !input.trim()) return
    clearResult()
    setBusy(true)
    try {
      setResult(await window.electronAPI.translateText(input, from, to))
    } catch (error) {
      setError(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, "") : "翻译失败，请重试")
    } finally {
      setBusy(false)
    }
  }

  function swap() {
    if (!source) return
    setFrom(to)
    setTo(source)
    if (result) setInput(result.text)
    clearResult()
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="tool-page-header shrink-0">
        <span className="tool-page-brand"><Languages size={16} /></span>
        <div className="tool-page-heading">
          <h2>翻译</h2>
          <p>点击翻译后，文本将发送至 Google 翻译</p>
        </div>
        <div className="tool-page-actions">
          <Button size="sm" disabled={busy || !input.trim()} onClick={() => void run()}>
            {busy ? "翻译中…" : "翻译"}
          </Button>
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
      <div className="grid gap-3 p-4 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Select value={from} disabled={busy} onValueChange={(value) => { setFrom(value); clearResult() }}>
              <SelectTrigger aria-label="源语言"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">检测语言</SelectItem>
                {languages.map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" aria-label="交换语言" disabled={busy || !source || source === to || (result?.text.length ?? 0) > maxLength || !languages.some(([code]) => code === source)} onClick={swap}>
              <ArrowLeftRight size={16} />
            </Button>
          </div>
          <div className="translate-source-field rounded-xl border bg-background">
            <Textarea
              autoFocus
              aria-label="原文"
              placeholder="输入要翻译的文字，Enter 翻译，Shift+Enter 换行"
              value={input}
              maxLength={maxLength}
              readOnly={busy}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                  event.preventDefault()
                  if (!event.repeat) void run()
                }
              }}
              onChange={(event) => { setInput(event.target.value); clearResult() }}
              className="translate-source-input h-44 resize-none border-0 bg-transparent p-4 text-base shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center justify-between px-3 pb-2 text-xs text-muted-foreground">
              <span>{from === "auto" && detectedLabel ? `检测到 ${detectedLabel} · ` : ""}{input.length}/{maxLength}</span>
              <Button size="icon" variant="ghost" className="translate-clear-button" aria-label="清空原文" disabled={busy || !input} onClick={() => { setInput(""); clearResult() }}><X size={16} /></Button>
            </div>
          </div>
        </section>
        <section className="flex min-w-0 flex-col gap-2">
          <Select value={to} disabled={busy} onValueChange={(value) => { setTo(value); clearResult() }}>
            <SelectTrigger aria-label="目标语言"><SelectValue /></SelectTrigger>
            <SelectContent>
              {languages.map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="rounded-xl border border-transparent bg-muted">
            <div role="status" className="h-44 overflow-y-auto whitespace-pre-wrap break-words p-4 text-base">
              {busy ? "正在翻译…" : result?.text || "译文"}
            </div>
            <div className="flex justify-end px-3 pb-2">
              <Button size="icon" variant="ghost" className="translate-copy-button" aria-label="复制译文" disabled={!result?.text} onClick={() => copy(result?.text ?? "")}><Copy size={16} /></Button>
            </div>
          </div>
          {!!result?.alternatives?.length && (
            <div className="translate-alternatives overflow-hidden rounded-xl border bg-muted/50">
              <h3 className="border-b px-4 py-3 text-sm font-semibold">其他翻译</h3>
              {result.alternatives.map((entry) => (
                <div key={`${entry.partOfSpeech}:${entry.word}`} className="flex flex-wrap items-start gap-3 border-b px-4 py-3 last:border-b-0">
                  <span className="min-w-24 flex-1 text-sm font-medium break-words">{entry.word}</span>
                  <span className="text-xs text-muted-foreground">{({ noun: "名词", verb: "动词", adjective: "形容词", adverb: "副词", pronoun: "代词", preposition: "介词", conjunction: "连词", interjection: "感叹词" } as Record<string, string>)[entry.partOfSpeech] ?? entry.partOfSpeech}</span>
                  <div className="flex min-w-0 flex-[2] flex-wrap gap-1.5">
                    {entry.meanings.map((meaning) => <span key={meaning} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{meaning}</span>)}
                  </div>
                  <Button size="icon" variant="ghost" className="translate-copy-button size-7 shrink-0" aria-label={`复制 ${entry.word}`} onClick={() => copy(entry.word)}><Copy size={14} /></Button>
                </div>
              ))}
            </div>
          )}
        </section>
        {error && <p role="alert" className="text-sm text-red-600 lg:col-span-2">{error}</p>}
      </div>
      </ScrollArea>
    </div>
  )
}
