import { StatusSlot } from "@/components/workspace/components/layout-main/status-slot"
import { parseWikiLinks } from "@vessel/obsidian"
import { Check, Code2, FileText, Link2, List, Loader2, Type } from "lucide-react"
import { useDeferredValue, useMemo } from "react"

import { countDocument } from "@/components/core/canvas/variants/markdown/count-document"

/** Renders the document stats component. */
export function DocumentStats({ source, saveStatus }: { source: string; saveStatus?: { message: string; failed?: boolean } }) {
  const deferred = useDeferredValue(source)
  const stats = useMemo(() => countDocument(deferred), [deferred])
  const links = useMemo(() => parseWikiLinks(deferred).length, [deferred])
  return (
    <StatusSlot>
      <footer
        aria-label="文档统计"
        title="统计 Markdown 源文；字符数包含空格与换行"
        className="flex min-w-0 items-center justify-end gap-1 overflow-hidden whitespace-nowrap bg-transparent text-xs text-stone-600 [&>span]:flex [&>span]:h-6 [&>span]:shrink-0 [&>span]:items-center [&>span]:gap-1 [&>span]:rounded [&>span]:px-1.5 [&>span:hover]:bg-stone-200 [&_svg]:size-3.5"
      >
        {saveStatus && (
          <span
            role={saveStatus.failed ? "alert" : "status"}
            className={`mr-auto ${saveStatus.failed ? "text-red-500" : ""}`}
          >
            {saveStatus.message === "正在保存…" ? <Loader2 className="animate-spin" /> : <Check />}
            {saveStatus.message}
          </span>
        )}
        <span>
          <Link2 />
          {links} 条反向链接
        </span>
        <span className="border-l border-stone-300">
          <Type />
          {stats.words.toLocaleString()} 词
        </span>
        <span>
          <FileText />
          {stats.characters.toLocaleString()} 字符
        </span>
        <span>
          <List />
          {stats.lines.toLocaleString()} 行
        </span>
        <span className="border-l border-stone-300">
          <Code2 />
          Markdown · UTF-8
        </span>
      </footer>
    </StatusSlot>
  )
}
