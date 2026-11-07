import { useEffect, useRef } from "react"

/** Renders compact footnote Markdown using Vditor's read-only preview engine. */
export function FootnoteSidebarPreview({ content }: { content: string }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = host.current
    if (!element) return
    let active = true
    const body = document.createElement("div")
    element.replaceChildren(body)
    void import("vditor").then(({ default: Vditor }) => {
      if (!active) return
      return Vditor.preview(body, content, {
        cdn: new URL("./vendor/vditor", document.baseURI).href,
        mode: document.documentElement.classList.contains("dark") ? "dark" : "light",
        markdown: { sanitize: true },
        hljs: { enable: false }
      })
    }).catch((error) => {
      console.error("脚注预览失败", error)
      if (active) body.textContent = content
    })
    return () => { active = false; body.remove() }
  }, [content])
  return <div ref={host} className="footnote-sidebar-preview mt-1 min-w-0 break-words pl-[22px]" />
}
