import { parseWikiLinks } from "@vessel/obsidian"
import { useDeferredValue, useMemo } from "react"

import { countDocument } from "./count-document"

export function DocumentStats({ source, saveStatus }: { source: string; saveStatus?: { message: string; failed?: boolean } }) {
  const deferred = useDeferredValue(source)
  const stats = useMemo(() => countDocument(deferred), [deferred])
  const links = useMemo(() => parseWikiLinks(deferred).length, [deferred])
  return (
    <footer
      aria-label="文档统计"
      title="统计 Markdown 源文；字符数包含空格与换行"
      className="flex shrink-0 flex-wrap items-center justify-end gap-5 border-t border-stone-200 bg-[#faf9f7] px-5 py-2 text-[11px] text-stone-500"
    >
      {saveStatus && <span role={saveStatus.failed ? "alert" : "status"} className={`mr-auto ${saveStatus.failed ? "text-red-500" : ""}`}>{saveStatus.message}</span>}
      <span>{links} 条反向链接</span>
      <span>{stats.words.toLocaleString()} 词</span>
      <span>{stats.characters.toLocaleString()} 字符</span>
      <span>{stats.lines.toLocaleString()} 行</span>
      <span>Markdown · UTF-8</span>
    </footer>
  )
}
