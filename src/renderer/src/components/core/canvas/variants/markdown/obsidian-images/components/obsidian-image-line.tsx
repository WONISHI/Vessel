import { ObsidianImage } from "@/components/core/canvas/variants/markdown/obsidian-images/components/obsidian-image"
import { VESSEL_BLANK_LINE } from "@/components/core/canvas/variants/markdown/image-paragraph"
import { parseImageReference } from "@vessel/obsidian"
import { Fragment, type ReactNode } from "react"

/** Renders non-image source text; blank markers from 聚焦 stay visible inside the component. */
function SourceGap({ text }: { text: string }) {
  if (!text) return null
  if (!text.includes(VESSEL_BLANK_LINE) && !text.includes("\n")) return <>{text}</>
  const nodes: ReactNode[] = []
  let remaining = text
  while (remaining.length) {
    if (remaining.startsWith(VESSEL_BLANK_LINE)) {
      nodes.push(<div key={nodes.length} className="min-h-[1.5em] w-full" aria-hidden />)
      remaining = remaining.slice(VESSEL_BLANK_LINE.length)
      continue
    }
    if (remaining.startsWith("\n")) {
      nodes.push(<div key={nodes.length} className="min-h-[1.5em] w-full" aria-hidden />)
      remaining = remaining.slice(1)
      continue
    }
    const nextBlank = remaining.indexOf(VESSEL_BLANK_LINE)
    const nextNl = remaining.indexOf("\n")
    let cut = remaining.length
    if (nextBlank >= 0) cut = Math.min(cut, nextBlank)
    if (nextNl >= 0) cut = Math.min(cut, nextNl)
    nodes.push(<span key={nodes.length}>{remaining.slice(0, cut)}</span>)
    remaining = remaining.slice(cut)
  }
  return <>{nodes}</>
}

/** Renders the obsidian image line component. */
export function ObsidianImageLine({ source, root, documentPath, onChange, onFocusAbove, onFocusBelow, readOnly = false }: { onFocusAbove?: (offset: number) => void; onFocusBelow?: (offset: number) => void; readOnly?: boolean; source: string; root: string; documentPath: string; onChange: (source: string) => void }) {
  let offset = 0
  return (
    <span className="block py-1">
      {source.split(/(!\[\[[^\]\n]+\]\]|!\[[^\]\n]*\]\([^\n]+?\)|<img\b[^>\n]*>)/g).map((part, index) => {
        const start = offset
        offset += part.length
        const end = offset
        return (
        <Fragment key={index}>
          {parseImageReference(part) ? (
            <ObsidianImage
              readOnly={readOnly}
              onFocusAbove={() => onFocusAbove?.(start)}
              onFocusBelow={() => onFocusBelow?.(end)}
              reference={part}
              onChange={(updated) =>
                onChange(
                  source
                    .split(/(!\[\[[^\]\n]+\]\]|!\[[^\]\n]*\]\([^\n]+?\)|<img\b[^>\n]*>)/g)
                    .map((value, i) => (i === index ? updated : value))
                    .join("")
                )
              }
              root={root}
              documentPath={documentPath}
            />
          ) : (
            <SourceGap text={part} />
          )}
        </Fragment>
      )})}
    </span>
  )
}
