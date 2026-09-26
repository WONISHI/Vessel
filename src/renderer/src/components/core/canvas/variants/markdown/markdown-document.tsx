import { Typography } from "@/components/ui/typography"
import { createElement, Fragment, type ReactNode } from "react"
import type { Token, Tokens } from "marked"
import type { parseMarkdownDocument } from "./parse-markdown"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

/** 仅允许常见链接协议；原始 HTML 以文本显示，不注入文档。 */
function safeMarkdownUrl(href: string): string | undefined {
  if (/^(https?:|mailto:|#)/i.test(href)) return href
  return undefined
}

/** 普通文本中的 #标签用 Badge 展示，代码与链接文本保持原样。 */
function renderTaggedText(text: string): ReactNode {
  const parts = text.split(/((?<![\p{L}\p{N}_])#[\p{L}\p{N}_-]+)/u)
  return parts.map((part, index) =>
    /^#[\p{L}\p{N}_-]+$/u.test(part) ? (
      <Badge
        key={index}
        asChild
        variant="secondary"
        className="mx-0.5 border-0 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-green-700"
      >
        <span>{part}</span>
      </Badge>
    ) : (
      part
    )
  )
}

/** 将 Markdown token 映射为 React 元素，让表格、标签遵循应用组件样式。 */
export function MarkdownDocument({ document }: { document: ReturnType<typeof parseMarkdownDocument> }) {
  const render = (tokens: Token[], tags = true): ReactNode =>
    tokens.map((token, index) => {
      const nested = ("tokens" in token && token.tokens ? token.tokens : []) as Token[]
      let element: ReactNode
      switch (token.type) {
        case "space":
          return null
        case "heading": {
          const heading = token as Tokens.Heading
          element = createElement(`h${heading.depth}`, { id: document.headingIds.get(token) }, render(heading.tokens))
          break
        }
        case "paragraph":
          element = <p>{render(nested, tags)}</p>
          break
        case "text":
          element = nested.length ? render(nested, tags) : tags ? renderTaggedText(String(token.text)) : String(token.text)
          break
        case "strong":
          element = <strong>{render(nested, tags)}</strong>
          break
        case "em":
          element = <em>{render(nested, tags)}</em>
          break
        case "del":
          element = <del>{render(nested, tags)}</del>
          break
        case "codespan":
          element = <code>{String(token.text)}</code>
          break
        case "code":
          element = (
            <pre>
              <code>{String(token.text)}</code>
            </pre>
          )
          break
        case "blockquote":
          element = <blockquote>{render(nested)}</blockquote>
          break
        case "br":
          element = <br />
          break
        case "hr":
          element = <hr />
          break
        case "link": {
          const link = token as Tokens.Link
          const href = safeMarkdownUrl(link.href)
          element = href ? (
            <a
              href={href}
              target={href.startsWith("#") ? undefined : "_blank"}
              rel="noreferrer"
            >
              {render(link.tokens, false)}
            </a>
          ) : (
            render(link.tokens, false)
          )
          break
        }
        case "image": {
          const image = token as Tokens.Image
          const href = /^https?:/i.test(image.href) ? image.href : undefined
          element = href ? (
            <img
              src={href}
              alt={image.text}
              loading="lazy"
            />
          ) : (
            <span className="text-stone-400">[图片：{image.text}]</span>
          )
          break
        }
        case "list": {
          const list = token as Tokens.List
          const children = list.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              {item.task && (
                <input
                  type="checkbox"
                  checked={Boolean(item.checked)}
                  readOnly
                  aria-label="任务状态"
                />
              )}
              {render(item.tokens)}
            </li>
          ))
          element = list.ordered ? <ol start={Number(list.start) || 1}>{children}</ol> : <ul>{children}</ul>
          break
        }
        case "table": {
          const table = token as Tokens.Table
          element = (
            <Table>
              <TableHeader>
                <TableRow>
                  {table.header.map((cell, cellIndex) => (
                    <TableHead
                      key={cellIndex}
                      style={{ textAlign: cell.align ?? undefined }}
                    >
                      {render(cell.tokens)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <TableCell
                        key={cellIndex}
                        style={{ textAlign: cell.align ?? undefined }}
                      >
                        {render(cell.tokens)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
          break
        }
        default:
          element = <span>{token.raw}</span>
      }
      return <Fragment key={index}>{element}</Fragment>
    })
  return <Typography className="vessel-markdown-document">{render(document.tokens)}</Typography>
}
