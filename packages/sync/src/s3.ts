import { open } from "node:fs/promises"
import { createHash, createHmac } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { setTimeout as delay } from "node:timers/promises"
import { SyncError, type StorageAdapter, type RemoteFile } from "./types.js"
import { parseS3List, readS3XmlField } from "./s3-list.js"
export interface S3Config {
  endpoint: string
  bucket: string
  region: string
  accessKey: string
  prefix?: string
}
export interface S3RequestOptions {
  signal?: AbortSignal
  retries?: number
  timeoutMs?: number
  fetch?: typeof globalThis.fetch
  multipartThreshold?: number
  partSize?: number
  partConcurrency?: number
  /** Disable for providers whose plain ETags cannot be used as content identifiers. */
  compareSinglePartEtags?: boolean
}

const hash = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex")
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest()
const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
// AWS S3 Signature V4, single payload: docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
export function signedS3Request(config: S3Config, secret: string, method: "HEAD" | "PUT" | "GET" | "DELETE" | "POST", key = "", body: Uint8Array = new Uint8Array(), now = new Date(), options: { digest?: string; headers?: Record<string, string>; query?: Record<string, string> } = {}) {
  const endpoint = config.endpoint.trim()
  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`)
  } catch {
    throw new Error("请输入有效的 S3 Endpoint，例如 https://s3.amazonaws.com")
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("请输入不含凭据和查询参数的 HTTP(S) Endpoint")
  if (!config.bucket || !config.accessKey || !secret || !config.region) throw new Error("请填写完整的 S3 存储配置")
  // COS requires virtual-hosted bucket URLs for newer buckets.
  const cosService = /^cos\.[a-z0-9-]+\.myqcloud\.com$/i.test(url.hostname)
  const cosBucket = /^[a-z0-9.-]+\.cos\.[a-z0-9-]+\.myqcloud\.com$/i.test(url.hostname)
  if (cosService) url.hostname = `${config.bucket}.${url.hostname}`
  if (cosBucket && !url.hostname.startsWith(`${config.bucket}.`)) throw new Error("Endpoint 中的存储桶与 Bucket 名称不一致")
  const segments = [...url.pathname.split("/").filter(Boolean).map(decodeURIComponent), ...(!cosService && !cosBucket ? [config.bucket] : []), ...key.split("/").filter(Boolean)]
  if (segments.some((part) => part === "." || part === "..")) throw new Error("路径不能包含 . 或 ..")
  url.pathname = "/" + segments.map(encode).join("/")
  const date = now.toISOString().replace(/[:-]|\.\d{3}/g, "")
  const day = date.slice(0, 8)
  const digest = options.digest ?? hash(body)
  const headers: Record<string, string> = { ...options.headers, "x-amz-content-sha256": digest, "x-amz-date": date }
  const canonicalHeaders: Record<string, string> = { ...headers, host: url.host }
  const names = Object.keys(canonicalHeaders).sort()
  const signed = names.join(";")
  const query = Object.entries(options.query ?? {})
    .map(([key, value]) => [encode(key), encode(value)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")
  url.search = query
  const canonical = [method, url.pathname, query, names.map((name) => `${name}:${canonicalHeaders[name].trim()}\n`).join(""), signed, digest].join("\n")
  const scope = `${day}/${config.region}/s3/aws4_request`
  const signingKey = hmac(hmac(hmac(hmac("AWS4" + secret, day), config.region), "s3"), "aws4_request")
  const signature = hmac(signingKey, `AWS4-HMAC-SHA256\n${date}\n${scope}\n${hash(canonical)}`).toString("hex")
  return { url: url.toString(), headers: { ...headers, Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, SignedHeaders=${signed}, Signature=${signature}` } }
}
export async function requestS3(config: S3Config, secret: string, method: "HEAD" | "PUT", key = "", body: Uint8Array = new Uint8Array(), options: S3RequestOptions = {}) {
  const request = signedS3Request(config, secret, method, key, body)
  const response = await (options.fetch ?? fetch)(request.url, { method, headers: request.headers, body: method === "PUT" ? new Uint8Array(body) : undefined, redirect: "error", signal: requestSignal(options, 60000) })
  if (!response.ok) {
    await response.body?.cancel()
    const reason = response.status === 404 ? "未找到存储桶，请确认 Bucket 名称包含 APPID 且区域与存储桶一致" : response.status === 403 ? "访问被拒绝，请检查密钥和存储桶访问权限" : "请检查服务端点、区域及存储桶权限"
    throw new SyncError("S3_REQUEST", `S3 请求失败（HTTP ${response.status}）：${reason}`, { status: response.status })
  }
  await response.body?.cancel()
}

/** Compare remote content metadata; a missing key can be recreated by the following PUT. */
export async function headS3File(config: S3Config, secret: string, key: string, options: S3RequestOptions = {}) {
  const request = signedS3Request(config, secret, "HEAD", key)
  const response = await (options.fetch ?? fetch)(request.url, { method: "HEAD", headers: request.headers, redirect: "error", signal: requestSignal(options, 60000) })
  await response.body?.cancel()
  if (response.status === 404) return undefined
  if (!response.ok) throw new SyncError("S3_REQUEST", `无法比较远端文件（HTTP ${response.status}）：${key}`, { status: response.status, path: key })
  return remoteHeaders(response)
}
/** Stream a whole object without buffering the entire file or creating visible chunk objects. */
export async function uploadS3File(config: S3Config, secret: string, key: string, source: string, digest: string, size: number, etag?: string, options: S3RequestOptions & { onProgress?: (bytes: number) => void; modifiedMs?: number } = {}) {
  const headers = { "content-length": String(size), "x-amz-meta-sha256": digest, ...(options.modifiedMs !== undefined ? { "x-amz-meta-mtime": String(options.modifiedMs) } : {}), ...(etag ? { "if-match": etag } : { "if-none-match": "*" }) }
  const request = signedS3Request(config, secret, "PUT", key, undefined, new Date(), { digest, headers })
  const stream = createReadStream(source)
  try {
    const response = await (options.fetch ?? fetch)(request.url, { method: "PUT", headers: request.headers, body: progressStream(stream, options.onProgress), duplex: "half", redirect: "error", signal: requestSignal(options, 30 * 60000) } as unknown as RequestInit)
    await response.body?.cancel()
    if (response.status === 412 || response.status === 409) throw new SyncError("REMOTE_CONFLICT", `远端文件在同步期间发生变化，未覆盖：${key}`, { status: response.status, path: key })
    if (!response.ok) throw new SyncError("S3_REQUEST", `上传文件失败（HTTP ${response.status}）：${key}`, { status: response.status, path: key })
    return { ...remoteHeaders(response), digest, size }
  } finally {
    stream.destroy()
  }
}

function requestSignal(options: S3RequestOptions, fallback: number) {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? fallback)
  return options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
}
async function retry<T>(operation: () => Promise<T>, options: S3RequestOptions): Promise<T> {
  const retries = options.retries ?? 2
  for (let attempt = 0; ; attempt++) {
    options.signal?.throwIfAborted()
    try {
      return await operation()
    } catch (error) {
      const transient = error instanceof SyncError ? [408, 429, 500, 502, 503, 504].includes(error.details.status ?? 0) : error instanceof TypeError || (error instanceof Error && error.name === "TimeoutError")
      if (!transient || attempt >= retries || options.signal?.aborted) throw error
      await delay(Math.min(500 * 2 ** attempt, 5000) + Math.random() * 200, undefined, { signal: options.signal })
    }
  }
}
/** Per-operation retries reopen file streams; conditional uploads remain safe after ambiguous failures. */
export function createS3Storage(config: S3Config, secret: string, options: S3RequestOptions = {}): StorageAdapter {
  config = { ...config }
  options = { ...options }
  if (options.retries !== undefined && (!Number.isInteger(options.retries) || options.retries < 0 || options.retries > 10)) throw new RangeError("retries must be between 0 and 10")
  if (options.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 2 ** 32 - 1)) throw new RangeError("timeoutMs must be between 1 and 4294967295")
  const partSize = options.partSize ?? 8 * 1024 ** 2,
    partConcurrency = options.partConcurrency ?? 4,
    multipartThreshold = options.multipartThreshold ?? 32 * 1024 ** 2
  if (!Number.isInteger(partSize) || partSize < 5 * 1024 ** 2 || partSize > 64 * 1024 ** 2 || !Number.isInteger(partConcurrency) || partConcurrency < 1 || partConcurrency > 8 || !Number.isFinite(multipartThreshold) || multipartThreshold < 5 * 1024 ** 2)
    throw new RangeError("Invalid multipart settings")
  const limitPart = partLimiter(partConcurrency)
  const prefix = (config.prefix ?? "").replace(/^\/+|\/+$/g, "")
  return {
    id: JSON.stringify([config.endpoint, config.bucket, config.region, config.accessKey, prefix]),
    maxObjectSize: 5 * 1024 ** 3,
    etagContentHash: options.compareSinglePartEtags === false ? undefined : "md5",
    list: (prefix, signal) => listS3Files(config, secret, prefix, { ...options, signal: combineSignals(signal, options.signal) }),
    download: (key, destination, input) => {
      const requestOptions = { ...options, signal: combineSignals(input.signal, options.signal) }
      return retry(() => downloadS3File(config, secret, key, destination, input.etag, { ...requestOptions, onProgress: input.onProgress }), requestOptions)
    },
    remove: (key, input) => {
      const requestOptions = { ...options, signal: combineSignals(input.signal, options.signal) }
      return retry(() => removeS3File(config, secret, key, input.etag, requestOptions), requestOptions)
    },
    head: (key, signal) => {
      const requestOptions = { ...options, signal: signal && options.signal ? AbortSignal.any([signal, options.signal]) : (signal ?? options.signal) }
      return retry(() => headS3File(config, secret, key, requestOptions), requestOptions)
    },
    upload: (key, source, input) => {
      const requestOptions = { ...options, signal: input.signal && options.signal ? AbortSignal.any([input.signal, options.signal]) : (input.signal ?? options.signal) }
      return retry(async () => {
        try {
          return input.size >= multipartThreshold
            ? await multipartS3File(config, secret, key, source, input, requestOptions, partSize, limitPart)
            : await uploadS3File(config, secret, key, source, input.digest, input.size, input.etag, { ...requestOptions, onProgress: input.onProgress, modifiedMs: input.modifiedMs })
        } catch (error) {
          // A prior attempt may have succeeded before the connection failed.
          if (error instanceof SyncError && error.code === "REMOTE_CONFLICT") {
            const current = await headS3File(config, secret, key, requestOptions)
            if (current?.digest === input.digest) return current
          }
          throw error
        }
      }, requestOptions)
    }
  }
}

function combineSignals(a?: AbortSignal, b?: AbortSignal) {
  return a && b ? AbortSignal.any([a, b]) : (a ?? b)
}
function remoteHeaders(response: Response): RemoteFile {
  const size = response.headers.get("content-length"),
    modified = response.headers.get("last-modified"),
    localModified = response.headers.get("x-amz-meta-mtime")
  return {
    digest: response.headers.get("x-amz-meta-sha256"),
    etag: response.headers.get("etag"),
    ...(size !== null ? { size: Number(size) } : {}),
    ...(localModified && Number.isFinite(Number(localModified)) ? { modifiedMs: Number(localModified) } : modified ? { modifiedMs: Date.parse(modified) } : {})
  }
}
export async function listS3Files(config: S3Config, secret: string, prefix: string, options: S3RequestOptions = {}) {
  const files = new Map<string, RemoteFile>(),
    tokens = new Set<string>()
  let continuation: string | undefined
  do {
    const page = await retry(async () => {
      const query = { "list-type": "2", "max-keys": "1000", "encoding-type": "url", prefix, ...(continuation ? { "continuation-token": continuation } : {}) }
      const request = signedS3Request(config, secret, "GET", "", undefined, new Date(), { query })
      const response = await (options.fetch ?? fetch)(request.url, { method: "GET", headers: request.headers, redirect: "error", signal: requestSignal(options, 60000) })
      if (!response.ok) {
        await response.body?.cancel()
        throw new SyncError("S3_REQUEST", `无法读取远端文件列表（HTTP ${response.status}）`, { status: response.status })
      }
      return parseS3List(await response.text())
    }, options)
    for (const [key, entry] of page.entries) {
      if (!key.startsWith(prefix) || files.has(key)) throw new SyncError("S3_REQUEST", "远端列表包含重复或越界文件")
      files.set(key, entry)
    }
    continuation = page.next
    if (continuation) {
      if (tokens.has(continuation)) throw new SyncError("S3_REQUEST", "远端列表分页未前进")
      tokens.add(continuation)
    }
  } while (continuation)
  return files
}
export async function downloadS3File(config: S3Config, secret: string, key: string, destination: string, etag?: string, options: S3RequestOptions & { onProgress?: (bytes: number) => void } = {}) {
  const request = signedS3Request(config, secret, "GET", key, undefined, new Date(), { headers: etag ? { "if-match": etag } : {} })
  const signal = requestSignal(options, 30 * 60000)
  const response = await (options.fetch ?? fetch)(request.url, { method: "GET", headers: request.headers, redirect: "error", signal })
  if (!response.ok || !response.body) {
    await response.body?.cancel()
    throw new SyncError(response.status === 412 || response.status === 404 ? "REMOTE_CONFLICT" : "S3_REQUEST", `下载文件失败（HTTP ${response.status}）：${key}`, { status: response.status, path: key })
  }
  await pipeline(progressStream(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>), options.onProgress), createWriteStream(destination, { mode: 0o600 }), { signal })
  return remoteHeaders(response)
}
export async function removeS3File(config: S3Config, secret: string, key: string, etag: string, options: S3RequestOptions = {}) {
  if (!etag) throw new SyncError("REMOTE_CONFLICT", `删除缺少远端版本标识：${key}`)
  const request = signedS3Request(config, secret, "DELETE", key, undefined, new Date(), { headers: { "if-match": etag } })
  const response = await (options.fetch ?? fetch)(request.url, { method: "DELETE", headers: request.headers, redirect: "error", signal: requestSignal(options, 60000) })
  await response.body?.cancel()
  if (!response.ok && response.status !== 404) throw new SyncError(response.status === 412 || response.status === 409 ? "REMOTE_CONFLICT" : "S3_REQUEST", `删除远端文件失败（HTTP ${response.status}）：${key}`, { status: response.status, path: key })
}
async function* progressStream(source: AsyncIterable<Uint8Array>, callback?: (bytes: number) => void) {
  let bytes = 0
  callback?.(0)
  for await (const chunk of source) {
    bytes += chunk.length
    callback?.(bytes)
    yield chunk
  }
}
function partLimiter(maximum: number) {
  let active = 0
  const waiting: Array<() => void> = []
  return async <T>(operation: () => Promise<T>): Promise<T> => {
    if (active < maximum) active++
    else await new Promise<void>((resolve) => waiting.push(resolve))
    try {
      return await operation()
    } finally {
      const next = waiting.shift()
      if (next) next()
      else active--
    }
  }
}
async function multipartS3File(config: S3Config, secret: string, key: string, source: string, input: import("./types.js").UploadOptions, options: S3RequestOptions, partSize: number, limit: <T>(operation: () => Promise<T>) => Promise<T>): Promise<RemoteFile> {
  const send = async (method: "POST" | "PUT" | "DELETE", query: Record<string, string>, body: Uint8Array = new Uint8Array(), headers: Record<string, string> = {}, requestOptions = options) => {
    requestOptions.signal?.throwIfAborted()
    const request = signedS3Request(config, secret, method, key, body, new Date(), { headers, query })
    const response = await (requestOptions.fetch ?? fetch)(request.url, { method, headers: request.headers, body: method === "DELETE" ? undefined : new Uint8Array(body), redirect: "error", signal: requestSignal(requestOptions, 30 * 60000) })
    if (!response.ok) {
      await response.body?.cancel()
      throw new SyncError(response.status === 412 || response.status === 409 ? "REMOTE_CONFLICT" : "S3_REQUEST", `S3 分片请求失败（HTTP ${response.status}）：${key}`, { status: response.status, path: key })
    }
    return response
  }
  const initial = await retry(() => send("POST", { uploads: "" }, undefined, { "x-amz-meta-sha256": input.digest, ...(input.modifiedMs !== undefined ? { "x-amz-meta-mtime": String(input.modifiedMs) } : {}) }), options)
  const uploadId = readS3XmlField(await initial.text(), "InitiateMultipartUploadResult", "UploadId")
  let file: Awaited<ReturnType<typeof open>> | undefined
  const parts: Array<{ number: number; etag: string }> = [],
    completed = new Map<number, number>()
  let cursor = 0,
    failure: unknown,
    failed = false,
    committed = false
  const count = Math.ceil(input.size / partSize)
  try {
    file = await open(source, "r")
    const before = await file.stat()
    const assertSource = async () => {
      const current = await file!.stat(),
        expected = input.sourceVersion ?? before
      if (current.size !== input.size || ["mtimeMs", "ctimeMs", "ino", "dev"].some((key) => current[key as "mtimeMs"] !== expected[key as "mtimeMs"])) throw new SyncError("FILE_CHANGED", `分片上传期间文件已变化：${key}`)
    }
    await assertSource()
    input.onProgress?.(0)
    await Promise.all(
      Array.from({ length: Math.min(options.partConcurrency ?? 4, count) }, async () => {
        while (!failed && cursor < count) {
          const number = ++cursor
          try {
            await limit(async () => {
              options.signal?.throwIfAborted()
              const start = (number - 1) * partSize,
                length = Math.min(partSize, input.size - start),
                buffer = Buffer.allocUnsafe(length)
              let offset = 0
              while (offset < length) {
                const read = await file!.read(buffer, offset, length - offset, start + offset)
                if (!read.bytesRead) throw new SyncError("FILE_CHANGED", `分片上传期间文件长度已变化：${key}`)
                offset += read.bytesRead
              }
              const response = await retry(() => send("PUT", { partNumber: String(number), uploadId }, buffer, { "content-length": String(length) }), options)
              const etag = response.headers.get("etag")
              await response.body?.cancel()
              if (!etag) throw new SyncError("S3_REQUEST", `分片响应缺少 ETag：${key}`)
              parts.push({ number, etag })
              completed.set(number, length)
              input.onProgress?.([...completed.values()].reduce((a, b) => a + b, 0))
            })
          } catch (error) {
            if (!failed) {
              failed = true
              failure = error
            }
          }
        }
      })
    )
    if (failed) throw failure
    await assertSource()
    const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    const body = Buffer.from(
      `<CompleteMultipartUpload>${parts
        .sort((a, b) => a.number - b.number)
        .map((part) => `<Part><PartNumber>${part.number}</PartNumber><ETag>${escape(part.etag)}</ETag></Part>`)
        .join("")}</CompleteMultipartUpload>`
    )
    const response = await retry(() => send("POST", { uploadId }, body, { "content-type": "application/xml", ...(input.etag ? { "if-match": input.etag } : { "if-none-match": "*" }) }), options)
    const etag = readS3XmlField(await response.text(), "CompleteMultipartUploadResult", "ETag")
    committed = true
    return { digest: input.digest, size: input.size, etag, ...(input.modifiedMs !== undefined ? { modifiedMs: input.modifiedMs } : {}) }
  } finally {
    await file?.close()
    if (!committed) {
      // Cleanup has its own bounded signal so caller cancellation does not leave uploaded parts.
      try {
        const response = await send("DELETE", { uploadId }, undefined, {}, { ...options, signal: undefined, timeoutMs: 10000 })
        await response.body?.cancel()
      } catch {
        /* Provider lifecycle policies can remove orphaned parts if cleanup is unavailable. */
      }
    }
  }
}
