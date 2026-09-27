import { useEffect, useState, Fragment } from "react"
import { parseImageReference, resizeImageReference } from "@vessel/obsidian"
import { Image } from "@/components/ui/image"

function ObsidianImage({ reference, root, documentPath, onChange }: { reference: string; root: string; documentPath: string; onChange: (reference: string) => void }) {
  const embed = parseImageReference(reference)!
  const [selected, setSelected] = useState(false)
  const [src, setSrc] = useState<string>()
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let cancelled = false
    const request = /^(https?:|data:image\/)/.test(embed.target) ? Promise.resolve(embed.target) : window.electronAPI.readObsidianImage(root, documentPath, reference)
    request
      .then((value) => {
        if (!cancelled) {
          setSrc(value)
          setLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [root, documentPath, reference, embed.target])
  if (!loaded)
    return (
      <span
        role="status"
        className="block py-4 text-xs text-stone-400"
      >
        正在加载图片…
      </span>
    )
  return (
    <span
      className="block bg-white"
      onClick={() => setSelected(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setSelected(false)
      }}
      tabIndex={0}
    >
      {selected && <span className="block break-all text-sm text-slate-500">{reference}</span>}
      <Image
        src={src}
        alt={embed.alt}
        width={embed.width}
        onResizeEnd={(width) => onChange(resizeImageReference(reference, width))}
      />
    </span>
  )
}
export function ObsidianImageLine({ source, root, documentPath, onChange }: { source: string; root: string; documentPath: string; onChange: (source: string) => void }) {
  return (
    <span className="block py-2">
      {source.split(/(!\[\[[^\]\n]+\]\]|!\[[^\]\n]*\]\([^\n]+?\))/g).map((part, index) => (
        <Fragment key={index}>
          {parseImageReference(part) ? (
            <ObsidianImage
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
