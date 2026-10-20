import { constants } from "node:fs"
import { nativeImage, session } from "electron"
import { copyFile, realpath, stat, writeFile } from "node:fs/promises"
import { basename, extname, isAbsolute, join, relative, sep } from "node:path"
export type ImageImport = { bytes?: Uint8Array; url?: string; path?: string }
const limit = 30 * 1024 * 1024
/** Import attachments atomically into the vault root; never overwrite a same-second paste. */
export async function saveObsidianImage(root: string, documentPath: string, source: ImageImport) {
  const base = await realpath(root),
    document = await realpath(documentPath)
  const offset = relative(base, document)
  if (!offset || offset === ".." || offset.startsWith(".." + sep) || isAbsolute(offset) || !(await stat(document)).isFile()) throw new Error("文档不在工作区")
  if (source.path) {
    const selected = await realpath(source.path)
    const info = await stat(selected)
    if (!info.isFile() || info.size > limit || !/\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(selected)) throw new Error("请选择不超过 30 MB 的图片文件")
    const name = basename(selected), offset = relative(base, selected)
    if (offset && offset !== ".." && !offset.startsWith(".." + sep) && !isAbsolute(offset)) return { name, path: selected, reference: `![[${name}]]` }
    const extension = extname(name), stem = name.slice(0, -extension.length)
    for (let attempt = 0; attempt < 10000; attempt++) {
      const candidate = attempt ? `${stem} (${attempt})${extension}` : name
      const destination = join(base, candidate)
      try {
        await copyFile(selected, destination, constants.COPYFILE_EXCL)
        return { name: candidate, path: destination, reference: `![[${candidate}]]` }
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error }
    }
    throw new Error("图片文件名冲突过多")
  }
  let bytes: Buffer,
    extension = "png"
  if (source.url) {
    const remote = await fetchRemoteImage(source.url)
    bytes = remote.bytes
    extension = remote.extension
  } else {
    if (!source.bytes?.length || source.bytes.length > limit) throw new Error("图片内容为空或超过 30 MB")
    const image = nativeImage.createFromBuffer(Buffer.from(source.bytes))
    if (image.isEmpty()) throw new Error("无法读取剪贴板图片")
    bytes = image.toPNG()
  }
  if (!bytes.length || bytes.length > limit) throw new Error("图片内容为空或超过 30 MB")
  const date = new Date()

  /** Performs the pad operation. */
  const pad = (value: number) => String(value).padStart(2, "0")
  for (let attempt = 0; attempt < 3600; attempt++) {
    const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    const name = `Pasted image ${stamp}.${extension}`,
      path = join(base, name)
    try {
      await writeFile(path, bytes, { flag: "wx" })
      return { name, path, reference: `![[${name}]]` }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      date.setSeconds(date.getSeconds() + 1)
    }
  }
  throw new Error("图片文件名冲突，请稍后再试")
}

/** Fetches remote image. */
export async function fetchRemoteImage(address: string) {
  const url = new URL(address)
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("只支持 HTTP 或 HTTPS 图片")
  const response = await session.fromPartition("persist:vessel-browser").fetch(url.href, {
    signal: AbortSignal.timeout(30000),
    referrerPolicy: "no-referrer",
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
    }
  })
  if (!response.ok) throw new Error(`图片下载失败：HTTP ${response.status}`)
  if (Number(response.headers.get("content-length")) > limit) throw new Error("图片超过 30 MB")
  const reader = response.body?.getReader()
  if (!reader) throw new Error("图片内容为空")
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > limit) throw new Error("图片超过 30 MB")
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
  const bytes = Buffer.concat(chunks)
  let extension: string | undefined
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    extension = "png"
  } else if (bytes.length >= 2 && bytes[0] === 255 && bytes[1] === 216) {
    extension = "jpg"
  } else if (bytes.length >= 6 && /^GIF8[79]a/.test(bytes.subarray(0, 6).toString("ascii"))) {
    extension = "gif"
  } else if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    extension = "webp"
  } else if (bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp" && /avif|avis/.test(bytes.subarray(8, 32).toString("ascii"))) {
    extension = "avif"
  } else if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    extension = "bmp"
  } else {
    const textHeader = bytes.subarray(0, 1000).toString("utf-8")
    if (/^(?:\s*<\?xml[^>]*>\s*)?(?:<!--[^]*?-->\s*)?<svg[\s>]/i.test(textHeader) || /<svg\b/i.test(textHeader)) {
      extension = "svg"
    } else {
      const contentType = response.headers.get("content-type")?.toLowerCase() || ""
      if (contentType.includes("image/webp")) extension = "webp"
      else if (contentType.includes("image/png")) extension = "png"
      else if (contentType.includes("image/jpeg")) extension = "jpg"
      else if (contentType.includes("image/gif")) extension = "gif"
      else if (contentType.includes("image/svg")) extension = "svg"
      else if (contentType.includes("image/avif")) extension = "avif"
      else if (contentType.includes("image/bmp")) extension = "bmp"
    }
  }
  if (!extension) throw new Error("下载内容不是支持的图片")
  return { bytes, extension }
}
