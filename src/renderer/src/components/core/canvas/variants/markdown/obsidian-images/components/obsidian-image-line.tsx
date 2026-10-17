import { ObsidianImage } from "@/components/core/canvas/variants/markdown/obsidian-images/components/obsidian-image"
import { parseImageReference } from "@vessel/obsidian"
import { Fragment } from "react"

/** Renders the obsidian image line component. */
export function ObsidianImageLine({ source, root, documentPath, onChange, onFocusAbove, onFocusBelow, readOnly = false }: { onFocusAbove?: () => void; onFocusBelow?: () => void; readOnly?: boolean; source: string; root: string; documentPath: string; onChange: (source: string) => void }) {
  return (
    <span className="block py-2">
      {source.split(/(!\[\[[^\]\n]+\]\]|!\[[^\]\n]*\]\([^\n]+?\)|<img\b[^>\n]*>)/g).map((part, index) => (
        <Fragment key={index}>
          {parseImageReference(part) ? (
            <ObsidianImage
              readOnly={readOnly}
              onFocusAbove={onFocusAbove}
              onFocusBelow={onFocusBelow}
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
      ))}
    </span>
  )
}
