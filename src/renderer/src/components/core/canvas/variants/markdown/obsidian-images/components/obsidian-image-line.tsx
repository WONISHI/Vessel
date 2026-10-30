import { ObsidianImage } from "@/components/core/canvas/variants/markdown/obsidian-images/components/obsidian-image"
import { parseImageReference } from "@vessel/obsidian"
import { Fragment } from "react"

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
            part
          )}
        </Fragment>
      )})}
    </span>
  )
}
