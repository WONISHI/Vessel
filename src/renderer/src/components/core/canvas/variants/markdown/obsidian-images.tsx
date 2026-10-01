import { useCallback, useState, Fragment } from "react"
import { parseImageReference, resizeImageReference } from "@vessel/obsidian"
import { Image } from "@/components/ui/image"

function ObsidianImage({ reference, root, documentPath, onChange, readOnly = false }: { readOnly?: boolean; reference: string; root: string; documentPath: string; onChange: (reference: string) => void }) {
  const embed = parseImageReference(reference)!
  const [selected, setSelected] = useState(false)
  const loadSource = useCallback(() => (/^(https?:|data:image\/)/.test(embed.target) ? Promise.resolve(embed.target) : window.electronAPI.readObsidianImage(root, documentPath, reference)), [embed.target, root, documentPath, reference])
  return (
    <span
      className="block bg-white"
      onClick={() => { if (!readOnly) setSelected(true) }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setSelected(false)
      }}
      tabIndex={0}
    >
      {selected && <span className="block break-all text-sm text-slate-500">{reference}</span>}
      <Image
        sourceKey={`${root}:${documentPath}:${reference}`}
        loadSource={loadSource}
        alt={embed.alt}
        width={embed.width}
        onResizeEnd={readOnly ? undefined : (width) => onChange(resizeImageReference(reference, width))}
      />
    </span>
  )
}
export function ObsidianImageLine({ source, root, documentPath, onChange, readOnly = false }: { readOnly?: boolean; source: string; root: string; documentPath: string; onChange: (source: string) => void }) {
  return (
    <span className="block py-2">
      {source.split(/(!\[\[[^\]\n]+\]\]|!\[[^\]\n]*\]\([^\n]+?\))/g).map((part, index) => (
        <Fragment key={index}>
          {parseImageReference(part) ? (
            <ObsidianImage
              readOnly={readOnly}
              reference={part}
              onChange={(updated) =>
                onChange(
                  source
                    .split(/(!\[\[[^\]\n]+\]\]|!\[[^\]\n]*\]\([^\n]+?\))/g)
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
