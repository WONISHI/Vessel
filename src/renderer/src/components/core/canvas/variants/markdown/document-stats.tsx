import { StatusSlot } from "@/components/workspace/components/layout-main/status-slot"
import { parseWikiLinks } from "@vessel/obsidian"
import { Check, Link2, CaseSensitive, Loader2, Type } from "lucide-react"
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
        data-title={`统计 Markdown 正文（不含 YAML 属性）；中文逐字、英文按单词；${stats.characters.toLocaleString()} 字符（包含空格、换行与 Markdown 标记）；Markdown · UTF-8`}
        data-title-side="top"
        className="vessel-document-stats"
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
        <span className="vessel-status-separated">
          <Type />
          {stats.words.toLocaleString()} 词
        </span>
        <span>
          <CaseSensitive />
          {stats.characters.toLocaleString()} 字
        </span>
      </footer>
    </StatusSlot>
  )
}
