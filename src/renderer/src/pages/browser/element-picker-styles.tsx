/* eslint-disable react-refresh/only-export-components -- This self-contained guest bundle mounts outside the app React tree. */
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import * as React from "react"
import { createRoot } from "react-dom/client"
import { flushSync } from "react-dom"
import type { ElementStyleSnapshot, StyleRow } from "./element-style-snapshot"
export { readElementStyles } from "./element-style-snapshot"

/** Colour tokens without inserting page-provided HTML. */
function StyleValue({ value }: { value: string }) {
  const tokens = value.split(/(#[\da-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)|-?\d*\.?\d+(?:px|em|rem|%|vh|vw|s|ms|deg)?|"[^"\n]*"|'[^'\n]*')/g)
  return <>{tokens.map((token, index) => {
    const kind = /^(?:#|rgba?\(|hsla?\()/.test(token) ? "color" : /^-?\d*\.?\d/.test(token) ? "number" : /^["']/.test(token) ? "string" : "keyword"
    return <span key={index} className={`style-token-${kind}`}>{token}</span>
  })}</>
}

const groups = [
  { title: "字体与文本", match: /^(?:font|text|line-|letter-|word-|white-space|hyphens|tab-size|writing-mode|direction|unicode-bidi|vertical-align)/ },
  { title: "布局与容器", match: /^(?:display|position|inset|top$|right$|bottom$|left$|z-index|float|clear|flex|grid|align-|justify-|place-|order$|gap$|row-gap|column-|columns$|container|contain|content-visibility|overflow|overscroll|anchor|position-anchor)/ },
  { title: "尺寸与间距", match: /^(?:width|height|min-|max-|inline-size|block-size|aspect-ratio|box-sizing|margin|padding|border-spacing)/ },
  { title: "背景与颜色", match: /^(?:background|color$|accent-color|caret-color|color-scheme|print-color|fill|stroke|stop-|flood-|lighting-color)/ },
  { title: "边框与轮廓", match: /^(?:border|outline|box-decoration)/ },
  { title: "视觉效果", match: /^(?:opacity|visibility|box-shadow|filter|backdrop|transform|translate|rotate|scale|perspective|backface|clip|mask|mix-blend|isolation|object-|image-|shape-|zoom)/ },
  { title: "动画与交互", match: /^(?:animation|transition|cursor|pointer-events|touch-action|user-select|resize|scroll|will-change|view-transition|interpolate)/ },
  { title: "其他属性", match: /./ }
]

function Chevron() {
  return <svg className="styles-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
}

function StyleGroups({ rows, inspect }: { rows: StyleRow[]; inspect: (name: string) => void }) {
  const grouped = groups.map(group => ({ ...group, rows: [] as StyleRow[] }))
  for (const row of rows) grouped.find(group => group.match.test(row[0].replace(/^-(?:webkit|moz|ms)-/, "")))!.rows.push(row)
  return <>{grouped.filter(group => group.rows.length).map(group => <Collapsible key={group.title} className="style-group">
    <CollapsibleTrigger className="style-group-trigger">
      <Chevron /><span>{group.title}</span><span className="styles-count">{group.rows.length}</span>
    </CollapsibleTrigger>
    <CollapsibleContent>
      {group.rows.map(([name, value]) => <div className="style-row" key={name}>
        <span className="style-property" title={name}>{name}</span>
        <button type="button" className="style-value" data-title="在控制台中定位样式" aria-label={`在控制台中定位 ${name}`} onClick={() => inspect(name)}><StyleValue value={value} /><span className="style-punctuation">;</span></button>
      </div>)}
    </CollapsibleContent>
  </Collapsible>)}</>
}

/** Render JSON as text tokens so page attributes and markup cannot execute. */
function HighlightedJSON({ text }: { text: string }) {
  const tokens = text.split(/("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g)
  return <>{tokens.map((token, index) => {
    const kind = /^"/.test(token) ? (/:$/.test(token) ? "property" : "string") : /^(true|false|null)$/.test(token) ? "keyword" : /^-?\d/.test(token) ? "number" : "punctuation"
    return <span key={index} className={`json-token-${kind}`}>{token}</span>
  })}</>
}

function ElementJSON({ snapshot }: { snapshot: ElementStyleSnapshot }) {
  const data = { element: snapshot.element || null, unreadableSheets: snapshot.unreadableSheets, userStyles: Object.fromEntries(snapshot.user) }
  const user = JSON.stringify(data, null, 2).slice(0, -2)
  const system = JSON.stringify(Object.fromEntries(snapshot.system), null, 2).replace(/\n/g, "\n  ")
  return <pre className="element-json" aria-label="当前元素 JSON"><code><HighlightedJSON text={user + ",\n"} /><span className="system-json">{'  "systemStyles": ' + system}</span>{"\n}"}</code></pre>
}

function ElementStyles({ read, inspect }: { read: () => ElementStyleSnapshot; inspect: (name: string) => void }) {
  const [open, setOpen] = React.useState(true)
  const [json, setJSON] = React.useState(false)
  const [snapshot, setSnapshot] = React.useState(read)
  const changeOpen = (next: boolean) => {
    if (next) setSnapshot(read())
    setOpen(next)
  }
  return <Collapsible className="styles-collapsible" open={open} onOpenChange={changeOpen}>
    <div className="styles-heading">
    <CollapsibleTrigger className="styles-trigger">
      <Chevron /><span>元素信息</span><span className="styles-subtitle">样式来源</span>
      <span className="styles-count">{snapshot.user.length + snapshot.system.length}</span>
    </CollapsibleTrigger>
    <button type="button" className="styles-json-toggle" data-title={json ? "查看分组样式" : "查看 JSON"} aria-label="JSON 视图" aria-pressed={json} onClick={() => { setSnapshot(read()); setJSON(!json); setOpen(true) }}>JSON</button>
    </div>
    <CollapsibleContent className="styles-content">
      <ScrollArea className="all-styles" type="auto" aria-label="元素计算样式">
        {json ? <ElementJSON snapshot={snapshot} /> : <>
        <Collapsible className="style-source" data-source="user" defaultOpen>
          <CollapsibleTrigger className="style-source-trigger"><Chevron /><span>用户样式</span><span className="styles-count">{snapshot.user.length}</span></CollapsibleTrigger>
          <CollapsibleContent>
            {snapshot.user.length ? <StyleGroups rows={snapshot.user} inspect={inspect} /> : <p className="styles-empty">未找到可读取的页面规则或内联样式</p>}
          </CollapsibleContent>
        </Collapsible>
        <Collapsible className="style-source" data-source="system">
          <CollapsibleTrigger className="style-source-trigger"><Chevron /><span>系统样式</span><span className="styles-count">{snapshot.system.length}</span></CollapsibleTrigger>
          <CollapsibleContent><StyleGroups rows={snapshot.system} inspect={inspect} /></CollapsibleContent>
        </Collapsible>
        </>}
        {snapshot.unreadableSheets && <p className="styles-note">跨域样式表受浏览器限制，无法确认来源的计算值归入系统样式。</p>}
      </ScrollArea>
    </CollapsibleContent>
  </Collapsible>
}

export function mount(container: HTMLElement, read: () => ElementStyleSnapshot, inspect: (name: string) => void) {
  const root = createRoot(container)
  flushSync(() => root.render(<ElementStyles read={read} inspect={inspect} />))
  return () => root.unmount()
}
