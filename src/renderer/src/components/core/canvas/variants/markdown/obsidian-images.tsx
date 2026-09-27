import { useEffect, useState, Fragment } from "react"
import { parseObsidianImageEmbed } from "@vessel/obsidian"
import { Image } from "@/components/ui/image"

const language = "vessel-obsidian-image"
/** 将非代码区的图片引用行交给 Vditor 自定义渲染，原始行编码后可无损还原。 */
export function prepareObsidianImages(source: string) {
  let fence = ""
  return source
    .split("\n")
    .map((line) => {
      const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
      if (marker) {
        if (!fence) fence = marker[1]
        else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = ""
        return line
      }
      if (fence || /^ {4}|^\t/.test(line) || line.includes("`")) return line
      if (![...line.matchAll(/!\[\[[^\]\n]+\]\]/g)].some((match) => parseObsidianImageEmbed(match[0]))) return line
      return "\n```" + language + "\n" + encodeURIComponent(line) + "\n```\n"
    })
    .join("\n")
}
export function restoreObsidianImages(source: string) {
  return source.replace(/\n?```vessel-obsidian-image\n([^\n]+)\n```\n?/g, (_match, encoded) => {
    try {
      return decodeURIComponent(encoded)
    } catch {
      return encoded
    }
  })
}
function ObsidianImage({ reference, root, documentPath }: { reference: string; root: string; documentPath: string }) {
  const embed = parseObsidianImageEmbed(reference)!
  const [src, setSrc] = useState<string>()
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let cancelled = false
    window.electronAPI
      .readObsidianImage(root, documentPath, reference)
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
  }, [root, documentPath, reference])
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
    <Image
      src={src}
      alt={embed.alt}
      width={embed.width}
    />
  )
}
export function ObsidianImageLine({ source, root, documentPath }: { source: string; root: string; documentPath: string }) {
  return (
    <span className="block py-2">
      {source.split(/(!\[\[[^\]\n]+\]\])/g).map((part, index) => (
        <Fragment key={index}>
          {parseObsidianImageEmbed(part) ? (
            <ObsidianImage
              reference={part}
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
