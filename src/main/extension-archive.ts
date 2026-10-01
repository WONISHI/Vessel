import { fromBuffer, type Entry, type ZipFile } from "yauzl"
import { createWriteStream } from "node:fs"
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import { pipeline } from "node:stream/promises"
import { createHash } from "node:crypto"

const MAX_BYTES = 256 * 1024 * 1024
/** CRX2/CRX3 wrap a ZIP payload. This imports a local package as an unpacked extension. */
export function extensionZip(data: Buffer): Buffer {
  if (data.subarray(0, 4).toString() !== "Cr24") return data
  if (data.length < 12) throw new Error("CRX 文件头不完整")
  const version = data.readUInt32LE(4)
  let offset: number
  if (version === 2 && data.length >= 16) offset = 16 + data.readUInt32LE(8) + data.readUInt32LE(12)
  else if (version === 3) offset = 12 + data.readUInt32LE(8)
  else throw new Error(`不支持的 CRX 格式：${version}`)
  if (offset >= data.length || data.subarray(offset, offset + 2).toString() !== "PK") throw new Error("CRX 文件损坏，找不到扩展内容")
  return data.subarray(offset)
}
async function unpack(data: Buffer, destination: string, budget: { bytes: number; files: number }) {
  const zip = await new Promise<ZipFile>((resolve, reject) => fromBuffer(extensionZip(data), { lazyEntries: true, autoClose: true, strictFileNames: true }, (error, value) => error ? reject(error) : resolve(value!)))
  const files: string[] = []
  await new Promise<void>((resolve, reject) => {
    const fail = (error: unknown) => { zip.close(); reject(error) }
    zip.on("error", fail); zip.on("end", resolve)
    zip.on("entry", (entry: Entry) => {
      void (async () => {
        const name = entry.fileName
        if (++budget.files > 10000 || (budget.bytes += entry.uncompressedSize) > MAX_BYTES) throw new Error("扩展包过大（最多 256 MB / 10000 个文件）")
        if (name.startsWith("/") || /^[A-Za-z]:/.test(name) || name.includes("\\") || name.split("/").some(part => part === "..") || name.includes("\0")) throw new Error("压缩包包含无效路径")
        if (((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000) throw new Error("扩展包不支持符号链接")
        const path = join(destination, name)
        if (name.endsWith("/")) await mkdir(path, { recursive: true })
        else {
          await mkdir(dirname(path), { recursive: true })
          const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => zip.openReadStream(entry, (error, stream) => error ? reject(error) : resolve(stream!)))
          await pipeline(stream, createWriteStream(path, { flags: "wx" }))
          files.push(path)
        }
        zip.readEntry()
      })().catch(fail)
    })
    zip.readEntry()
  })
  return files
}
export async function importExtensionArchive(source: string, storage: string) {
  if ((await stat(source)).size > MAX_BYTES) throw new Error("扩展压缩包超过 256 MB")
  const data = await readFile(source)
  const digest = createHash("sha256").update(data).digest("hex")
  await mkdir(storage, { recursive: true })
  const directory = await mkdtemp(join(storage, "import-"))
  try {
    const budget = { bytes: 0, files: 0 }
    const files = await unpack(data, join(directory, "package"), budget)
    const candidates = files.filter(path => basename(path) === "manifest.json" && !path.includes("/__MACOSX/"))
    // Also accept distribution ZIPs containing multiple .crx versions.
    for (const [index, path] of files.filter(path => /\.crx$/i.test(path)).entries()) {
      const nested = await unpack(await readFile(path), join(directory, `crx-${index}`), budget)
      candidates.push(...nested.filter(file => basename(file) === "manifest.json"))
    }
    const valid: { path: string; name: string; version: string; label: string }[] = []
    for (const candidate of candidates) {
      try {
        const manifest = JSON.parse(await readFile(candidate, "utf8"))
        if (typeof manifest.name === "string" && typeof manifest.version === "string" && [2, 3].includes(manifest.manifest_version)) valid.push({ path: dirname(candidate), name: manifest.name, version: manifest.version, label: `${manifest.name} · ${manifest.version}` })
      } catch { /* Non-extension manifests are not install candidates. */ }
    }
    if (!valid.length) throw new Error("压缩包中没有找到有效的 Chrome 扩展（manifest.json 或 CRX）")
    if (valid.length > 10) throw new Error("压缩包中有超过 10 个扩展，请单独选择需要的 CRX 文件")
    return { directory, digest, candidates: valid }
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error }
}
