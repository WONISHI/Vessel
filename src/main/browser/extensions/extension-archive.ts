import { createHash } from "node:crypto"
import { createWriteStream } from "node:fs"
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import { pipeline } from "node:stream/promises"
import { fromBuffer, type Entry, type ZipFile } from "yauzl"

const MAX_BYTES = 256 * 1024 * 1024

/** Reads a base-128 varint from a protobuf buffer. */
function readVarint(buffer: Buffer, offset: number): [value: number, next: number] | undefined {
  let value = 0
  let shift = 0
  let cursor = offset
  while (cursor < buffer.length && shift < 35) {
    const byte = buffer[cursor++]
    value += (byte & 0x7f) * 2 ** shift
    if ((byte & 0x80) === 0) return [value, cursor]
    shift += 7
  }
  return undefined
}

/** Extracts the first length-delimited field matching `targetField` from a protobuf message. */
function readProtoBytes(buffer: Buffer, targetField: number): Buffer | undefined {
  let offset = 0
  while (offset < buffer.length) {
    const tag = readVarint(buffer, offset)
    if (!tag) return undefined
    const [tagValue, afterTag] = tag
    const field = tagValue >>> 3
    const wire = tagValue & 0x07
    if (wire === 0) {
      const skipped = readVarint(buffer, afterTag)
      if (!skipped) return undefined
      offset = skipped[1]
    } else if (wire === 2) {
      const length = readVarint(buffer, afterTag)
      if (!length) return undefined
      const [size, start] = length
      const end = start + size
      if (end > buffer.length) return undefined
      if (field === targetField) return buffer.subarray(start, end)
      offset = end
    } else {
      return undefined
    }
  }
  return undefined
}

/**
 * Extracts the extension's SubjectPublicKeyInfo (base64) from a CRX2/CRX3 header so unpacked
 * directories preserve their canonical Chrome extension ID (`chrome.runtime.id`).
 */
export function extensionCrxKey(data: Buffer): string | undefined {
  if (data.subarray(0, 4).toString() !== "Cr24" || data.length < 12) return undefined
  const version = data.readUInt32LE(4)
  if (version === 2) {
    if (data.length < 16) return undefined
    const keyLength = data.readUInt32LE(8)
    if (!keyLength || 16 + keyLength > data.length) return undefined
    return data.subarray(16, 16 + keyLength).toString("base64")
  }
  if (version !== 3) return undefined
  const headerLength = data.readUInt32LE(8)
  if (!headerLength || 12 + headerLength > data.length) return undefined
  const header = data.subarray(12, 12 + headerLength)
  const keys: Buffer[] = []
  let crxId: Buffer | undefined
  let offset = 0
  while (offset < header.length) {
    const tag = readVarint(header, offset)
    if (!tag) break
    const [tagValue, afterTag] = tag
    const field = tagValue >>> 3
    const wire = tagValue & 0x07
    if (wire === 0) {
      const skipped = readVarint(header, afterTag)
      if (!skipped) break
      offset = skipped[1]
      continue
    }
    if (wire !== 2) break
    const length = readVarint(header, afterTag)
    if (!length) break
    const [size, start] = length
    const end = start + size
    if (end > header.length) break
    const payload = header.subarray(start, end)
    if (field === 2 || field === 3) {
      const key = readProtoBytes(payload, 1)
      if (key?.length) keys.push(key)
    } else if (field === 10000) {
      const id = readProtoBytes(payload, 1)
      if (id?.length === 16) crxId = id
    }
    offset = end
  }
  if (!keys.length) return undefined
  const matched = crxId ? keys.find((key) => createHash("sha256").update(key).digest().subarray(0, 16).equals(crxId)) : undefined
  return (matched || keys[keys.length - 1]).toString("base64")
}

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

/** Performs the unpack operation. */
async function unpack(data: Buffer, destination: string, budget: { bytes: number; files: number }) {
  const crxKey = extensionCrxKey(data)
  const zip = await new Promise<ZipFile>((resolve, reject) => fromBuffer(extensionZip(data), { lazyEntries: true, autoClose: true, strictFileNames: true }, (error, value) => (error ? reject(error) : resolve(value!))))
  const files: string[] = []
  await new Promise<void>((resolve, reject) => {
    /** Performs the fail operation. */
    const fail = (error: unknown) => {
      zip.close()
      reject(error)
    }
    zip.on("error", fail)
    zip.on("end", resolve)
    zip.on("entry", (entry: Entry) => {
      void (async () => {
        const name = entry.fileName
        if (++budget.files > 10000 || (budget.bytes += entry.uncompressedSize) > MAX_BYTES) throw new Error("扩展包过大（最多 256 MB / 10000 个文件）")
        if (name.startsWith("/") || /^[A-Za-z]:/.test(name) || name.includes("\\") || name.split("/").some((part) => part === "..") || name.includes("\0")) throw new Error("压缩包包含无效路径")
        if (((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000) throw new Error("扩展包不支持符号链接")
        const path = join(destination, name)
        if (name.endsWith("/")) await mkdir(path, { recursive: true })
        else {
          await mkdir(dirname(path), { recursive: true })
          const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => zip.openReadStream(entry, (error, stream) => (error ? reject(error) : resolve(stream!))))
          await pipeline(stream, createWriteStream(path, { flags: "wx" }))
          files.push(path)
        }
        zip.readEntry()
      })().catch(fail)
    })
    zip.readEntry()
  })
  const manifestPath = join(destination, "manifest.json")
  if (crxKey && files.includes(manifestPath)) {
    try {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
      if (manifest && typeof manifest === "object" && typeof manifest.key !== "string") {
        manifest.key = crxKey
        await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8")
      }
    } catch {
      /* Invalid manifests are filtered out by caller validation. */
    }
  }
  return files
}

/** Performs the import extension archive operation. */
export async function importExtensionArchive(source: string, storage: string) {
  if ((await stat(source)).size > MAX_BYTES) throw new Error("扩展压缩包超过 256 MB")
  const data = await readFile(source)
  const digest = createHash("sha256").update(data).digest("hex")
  await mkdir(storage, { recursive: true })
  const directory = await mkdtemp(join(storage, "import-"))
  try {
    const budget = { bytes: 0, files: 0 }
    const files = await unpack(data, join(directory, "package"), budget)
    const candidates = files.filter((path) => basename(path) === "manifest.json" && !path.includes("/__MACOSX/"))
    // Also accept distribution ZIPs containing multiple .crx versions.
    for (const [index, path] of files.filter((path) => /\.crx$/i.test(path)).entries()) {
      const nested = await unpack(await readFile(path), join(directory, `crx-${index}`), budget)
      candidates.push(...nested.filter((file) => basename(file) === "manifest.json"))
    }
    const valid: { path: string; name: string; version: string; label: string }[] = []
    for (const candidate of candidates) {
      try {
        const manifest = JSON.parse(await readFile(candidate, "utf8"))
        if (typeof manifest.name === "string" && typeof manifest.version === "string" && [2, 3].includes(manifest.manifest_version)) valid.push({ path: dirname(candidate), name: manifest.name, version: manifest.version, label: `${manifest.name} · ${manifest.version}` })
      } catch {
        /* Non-extension manifests are not install candidates. */
      }
    }
    if (!valid.length) throw new Error("压缩包中没有找到有效的 Chrome 扩展（manifest.json 或 CRX）")
    if (valid.length > 10) throw new Error("压缩包中有超过 10 个扩展，请单独选择需要的 CRX 文件")
    return { directory, digest, candidates: valid }
  } catch (error) {
    await rm(directory, { recursive: true, force: true })
    throw error
  }
}
