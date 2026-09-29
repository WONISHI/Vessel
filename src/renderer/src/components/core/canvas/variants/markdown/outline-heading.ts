import { marked } from "marked"
/** 解析标题的 Markdown 行内标记；只读取惰性 DOM，不挂载源 HTML。 */
export function outlineHeading(source: string): { text: string; color?: string } {
  const template = document.createElement("template")
  template.innerHTML = marked.parseInline(source.replace(/^#+\s*/, ""), { async: false })
  template.content.querySelectorAll("script,style").forEach((element) => element.remove())
  const styled = template.content.querySelector<HTMLElement>("font[color],span[style]")
  const color = styled?.style.color || styled?.getAttribute("color") || undefined
  return { text: template.content.textContent ?? "", color }
}
