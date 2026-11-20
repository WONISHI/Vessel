import { clipboard, dialog, nativeImage, type WebContents } from "electron"
import { readFile, writeFile } from "node:fs/promises"
import { basename } from "node:path"
import { fileURLToPath } from "node:url"
import { notifyBrowserFileSaved } from "./browser-downloads"

/** Read the displayed image through its own browser session, preserving authenticated requests. */
export async function browserImageAction(host: WebContents, target: WebContents, action: "copy-image" | "download-image") {
  const url = target.getURL()
  const type: unknown = await target.executeJavaScript("document.contentType")
  if (typeof type !== "string" || !type.startsWith("image/") || target.isDestroyed() || target.getURL() !== url) throw new Error("当前页面不是图片资源")
  const resource = new URL(url)
  let bytes: Buffer
  if (resource.protocol === "file:") bytes = await readFile(fileURLToPath(resource))
  else if (resource.protocol === "http:" || resource.protocol === "https:") {
    const response = await target.session.fetch(url)
    if (!response.ok) throw new Error(`读取图片失败：${response.status}`)
    bytes = Buffer.from(await response.arrayBuffer())
  } else throw new Error("不支持的图片地址")

  if (action === "copy-image") {
    const image = nativeImage.createFromBuffer(bytes)
    if (image.isEmpty()) throw new Error("无法复制此格式的图片")
    clipboard.writeImage(image)
    return
  }
  const defaultPath = resource.protocol === "file:" ? basename(fileURLToPath(resource)) : decodeURIComponent(basename(resource.pathname)) || `image.${type.split("/")[1].replace("svg+xml", "svg")}`
  const result = await dialog.showSaveDialog({ title: "下载图片", defaultPath })
  if (result.canceled || !result.filePath) return
  await writeFile(result.filePath, bytes)
  await notifyBrowserFileSaved(host, result.filePath, "save")
}
