import { SyncError, type RemoteFile } from "./types.js"
type XmlNode = { name: string; text: string; children: XmlNode[] }
const invalid = () => new SyncError("S3_REQUEST", "S3 XML 格式无效，未执行同步")
function decode(value: string) {
  if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/.test(value)) throw invalid()
  return value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);/g, (_all, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
      if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) throw invalid()
      return String.fromCodePoint(code)
    }
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[entity]
  })
}
/** Small validating XML reader; refuses DTD/entities and malformed/truncated listings. */
function parseXml(xml: string): XmlNode {
  const document: XmlNode = { name: "", text: "", children: [] },
    stack = [document]
  let cursor = 0
  const token = /<!--[\s\S]*?-->|<\?xml\s[^?]*\?>|<[^>]+>|[^<]+/g
  for (const match of xml.matchAll(token)) {
    if (match.index !== cursor) throw invalid()
    cursor += match[0].length
    const value = match[0],
      current = stack.at(-1)!
    if (value.startsWith("<!--") || value.startsWith("<?xml")) continue
    if (!value.startsWith("<")) {
      current.text += decode(value)
      continue
    }
    const close = /^<\/([\w:.-]+)\s*>$/.exec(value)
    if (close) {
      if (stack.length === 1 || current.name !== close[1]) throw invalid()
      stack.pop()
      continue
    }
    const start = /^<([\w:.-]+)(?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*\s*(\/?)>$/.exec(value)
    if (!start) throw invalid()
    const node: XmlNode = { name: start[1], text: "", children: [] }
    current.children.push(node)
    if (!start[2]) stack.push(node)
  }
  if (cursor !== xml.length || stack.length !== 1 || document.text.trim() || document.children.length !== 1) throw invalid()
  return document.children[0]
}
const local = (node: XmlNode) => node.name.split(":").at(-1)
const field = (node: XmlNode, name: string) => {
  const matches = node.children.filter((child) => local(child) === name)
  if (matches.length > 1 || matches[0]?.children.length) throw invalid()
  return matches[0]?.text
}
export function readS3XmlField(xml: string, rootName: string, fieldName: string) {
  const root = parseXml(xml)
  if (local(root) === "Error") {
    const code = field(root, "Code")
    throw new SyncError("S3_REQUEST", `S3 返回错误：${code ?? "unknown"}`, { status: code === "InternalError" ? 500 : undefined })
  }
  if (local(root) !== rootName) throw invalid()
  const value = field(root, fieldName)
  if (!value) throw invalid()
  return value
}
export function parseS3List(xml: string): { entries: Map<string, RemoteFile>; next?: string } {
  const root = parseXml(xml)
  if (local(root) !== "ListBucketResult") throw invalid()
  const truncated = field(root, "IsTruncated")?.trim(),
    encoded = field(root, "EncodingType")?.trim() === "url"
  if (truncated !== "true" && truncated !== "false") throw invalid()
  const entries = new Map<string, RemoteFile>()
  for (const node of root.children.filter((child) => local(child) === "Contents")) {
    const rawKey = field(node, "Key"),
      sizeText = field(node, "Size"),
      etag = field(node, "ETag")?.trim(),
      modified = field(node, "LastModified")
    if (!rawKey || sizeText === undefined || !/^\d+$/.test(sizeText.trim()) || !etag || !modified) throw invalid()
    let key: string
    try {
      key = encoded ? decodeURIComponent(rawKey) : rawKey
    } catch {
      throw invalid()
    }
    const size = Number(sizeText),
      modifiedMs = Date.parse(modified)
    if (!Number.isSafeInteger(size) || !Number.isFinite(modifiedMs) || entries.has(key)) throw invalid()
    entries.set(key, { digest: null, etag, size, modifiedMs })
  }
  const count = field(root, "KeyCount")
  if (count !== undefined && Number(count) !== entries.size) throw invalid()
  const next = field(root, "NextContinuationToken")
  if (truncated === "true" && !next) throw invalid()
  return { entries, next: truncated === "true" ? next : undefined }
}
