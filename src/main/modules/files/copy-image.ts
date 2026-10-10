import { app, clipboard, nativeImage } from "electron"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { createHash } from "node:crypto"

/** Preserve original image bytes, including SVG, when pasting into a file manager. */
export async function copyImage(source: string) {
  if (typeof source !== "string" || source.length > 70 * 1024 * 1024) throw new Error("图片过大或来源无效")
  const match = /^data:image\/(png|jpeg|jpg|webp|gif|bmp|avif|svg\+xml)(?:;charset=[a-z\d-]+)?;base64,([a-z\d+/=\s]+)$/i.exec(source)
  if (!match) throw new Error("不支持的图片来源")
  const bytes = Buffer.from(match[2], "base64")
  const extension = match[1].toLowerCase() === "svg+xml" ? "svg" : match[1].toLowerCase()
  const folder = join(app.getPath("temp"), "vessel-clipboard-images")
  await mkdir(folder, { recursive: true })
  const path = join(folder, `image-${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.${extension}`)
  await writeFile(path, bytes)
  clipboard.clear()
  const bitmap = nativeImage.createFromBuffer(bytes)
  if (!bitmap.isEmpty()) clipboard.writeImage(bitmap)
  const url = pathToFileURL(path).href
  if (process.platform === "darwin") clipboard.writeBuffer("public.file-url", Buffer.from(url))
  else if (process.platform === "win32") {
    const header = Buffer.alloc(20)
    header.writeUInt32LE(20, 0)
    header.writeUInt32LE(1, 16)
    clipboard.writeBuffer("CF_HDROP", Buffer.concat([header, Buffer.from(path + "\0\0", "utf16le")]))
  } else {
    clipboard.writeBuffer("text/uri-list", Buffer.from(url + "\r\n"))
    clipboard.writeBuffer("x-special/gnome-copied-files", Buffer.from("copy\n" + url))
  }
}
