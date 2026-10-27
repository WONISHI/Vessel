import { printableMarkdown } from "@/components/native-file-menu/document-bridge"
import { parseImageReference } from "@vessel/obsidian"

/** Resolve every attachment, including images outside the lazy preview viewport. */
export async function pdfDocumentHtml(root: HTMLElement, workspace: string, path: string) {
  const output = new DOMParser().parseFromString(printableMarkdown(root), "text/html")
  const originals = Array.from(root.querySelectorAll(".vessel-image-block"))
  const exported = Array.from(output.querySelectorAll(".vessel-image-block"))
  await Promise.all(
    originals.map(async (block, index) => {
      const marker = block.querySelector("pre.vditor-ir__marker code")?.textContent?.trim()
      if (!marker || !exported[index]) return
      const source = decodeURIComponent(marker)
      const fragment = document.createDocumentFragment()
      const pattern = /!\[\[[^\]\n]+\]\]|!\[[^\]\n]*\]\([^\n]+?\)|<img\b[^>\n]*>/g
      let end = 0
      for (const match of source.matchAll(pattern)) {
        fragment.append(source.slice(end, match.index))
        const embed = parseImageReference(match[0])
        if (embed) {
          const image = document.createElement("img")
          image.src = /^data:image\//i.test(embed.target) ? embed.target : await window.electronAPI.readObsidianImage(workspace, path, match[0])
          if (!image.src) throw new Error(`无法读取图片：${embed.target}`)
          image.alt = embed.alt || ""
          if (embed.width) image.style.width = `${embed.width}px`
          fragment.append(image)
        } else fragment.append(match[0])
        end = match.index! + match[0].length
      }
      fragment.append(source.slice(end))
      exported[index].replaceChildren(fragment)
    })
  )
  return "<!doctype html>" + output.documentElement.outerHTML
}
