import { Popover, PopoverContent } from "@/components/ui/popover"
import { PopoverAnchor } from "@radix-ui/react-popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Check, Search, X } from "lucide-react"
import { useRef, useState, useEffect, useId } from "react"

const languages = [
  ["markdown-table", "markdown-table", "高级表格"],
  ["steps", "steps", "步骤条"], ["timeline", "timeline", "时间线"],
  ["text", "text", "plain text"], ["js", "javascript", ".js"], ["ts", "typescript", ".ts"],
  ["jsx", "jsx", ".jsx"], ["tsx", "tsx", ".tsx"], ["json", "json", ".json"],
  ["html", "html", ".html"], ["css", "css", ".css"], ["scss", "scss", ".scss"],
  ["vue", "vue", ".vue"], ["python", "python", ".py"], ["java", "java", ".java"],
  ["go", "go", ".go"], ["rust", "rust", ".rs"], ["c", "c", ".c"],
  ["cpp", "c++", ".cpp"], ["csharp", "c#", ".cs"], ["sql", "sql", ".sql"],
  ["bash", "bash", ".sh"], ["yaml", "yaml", ".yml"], ["xml", "xml", ".xml"],
  ["markdown", "markdown", ".md"], ["mermaid", "mermaid", "diagram"]
]

/** Selects a draft language without changing the document until confirmation. */
export function CodeLanguageDialog({ value, anchor, onClose, onConfirm }: { value: string; anchor?: HTMLElement; onClose: () => void; onConfirm: (language: string) => void }) {
  const virtualAnchor = useRef({
    /** Anchors the floating picker to the code block header. */
    getBoundingClientRect: () => {
      const rect = anchor?.getBoundingClientRect()
      return new DOMRect(rect ? rect.left + 24 : 24, rect ? rect.top + 28 : 24, 0, 0)
    }
  })
  const listId = useId()
  const list = useRef<HTMLDivElement>(null)
  const normalizedValue = value === "step" ? "steps" : value
  const [selected, setSelected] = useState(normalizedValue)
  const [query, setQuery] = useState("")
  const options = languages.some(([id]) => id === normalizedValue) ? languages : [[normalizedValue, normalizedValue, ""], ...languages]
  const filtered = options.filter((option) => option.join(" ").toLowerCase().includes(query.trim().toLowerCase()))
  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" })
  }, [selected])
  return (
    <Popover open onOpenChange={(open) => { if (!open) onClose() }}>
      <PopoverAnchor virtualRef={virtualAnchor} />
      <PopoverContent className="code-language-dialog" align="start" side="bottom" sideOffset={6} collisionPadding={12} aria-label="代码语言" onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return
        const target = event.target as HTMLElement
        if (target.tagName !== "INPUT" && target.getAttribute("role") !== "option") return
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault()
          if (!filtered.length) return
          const index = filtered.findIndex(([id]) => id === selected)
          const next = index < 0 ? (event.key === "ArrowDown" ? 0 : filtered.length - 1) : (index + (event.key === "ArrowDown" ? 1 : -1) + filtered.length) % filtered.length
          setSelected(filtered[next][0])
        } else if (event.key === "Enter" && filtered.some(([id]) => id === selected)) {
          event.preventDefault()
          onConfirm(selected)
        }
      }} onCloseAutoFocus={(event) => event.preventDefault()}>
        <header className="code-language-header"><h2>代码语言</h2><button type="button" aria-label="关闭代码语言" onClick={onClose}><X size={15} /></button></header>
        <div className="code-language-body">
            <div id="code-language-panel" className="code-language-panel">
              <div className="code-language-search"><Search size={15} /><input autoFocus aria-label="搜索语言" role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={filtered.some(([id]) => id === selected) ? `${listId}-${selected}` : undefined} placeholder="搜索语言..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
              <ScrollArea className="code-language-options">
                <div ref={list} id={listId} role="listbox" aria-label="代码语言">
                  {filtered.map(([id, label, extension]) => (
                    <button id={`${listId}-${id}`} type="button" role="option" aria-selected={selected === id} className="code-language-option" key={id} onClick={() => setSelected(id)}>
                      <Check size={15} className={selected === id ? "" : "invisible"} /><span>{label}</span><span className="code-language-extension">{extension}</span>
                    </button>
                  ))}
                  {!filtered.length && <div className="code-language-empty">没有找到匹配的语言</div>}
                </div>
              </ScrollArea>
            </div>
        </div>
        <footer className="code-language-footer"><button type="button" onClick={onClose}>取消</button><button type="button" className="code-language-confirm" onClick={() => onConfirm(selected)}>确定</button></footer>
      </PopoverContent>
    </Popover>
  )
}
