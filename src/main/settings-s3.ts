import { createHash, createHmac } from "node:crypto"
import type { AppSettings } from "../shared/settings"
const hash = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex")
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest()
const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
// AWS S3 Signature V4, single payload: docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
export function signedS3Request(config: AppSettings["backup"], secret: string, method: "HEAD" | "PUT", key = "", body: Uint8Array = new Uint8Array(), now = new Date()) {
  const endpoint = config.endpoint.trim()
  let url: URL
  try { url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`) } catch { throw new Error("请输入有效的 S3 Endpoint，例如 https://s3.amazonaws.com") }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("请输入不含凭据和查询参数的 HTTP(S) Endpoint")
  if (!config.bucket || !config.accessKey || !secret || !config.region) throw new Error("请填写完整的 S3 存储配置")
  const segments = [...url.pathname.split("/").filter(Boolean).map(decodeURIComponent), config.bucket, ...key.split("/").filter(Boolean)]
  if (segments.some(part => part === "." || part === "..")) throw new Error("路径不能包含 . 或 ..")
  url.pathname = "/" + segments.map(encode).join("/")
  const date = now.toISOString().replace(/[:-]|\.\d{3}/g, "")
  const day = date.slice(0, 8)
  const digest = hash(body)
  const headers = { "x-amz-content-sha256": digest, "x-amz-date": date }
  const signed = "host;x-amz-content-sha256;x-amz-date"
  const canonical = [method, url.pathname, "", `host:${url.host}\nx-amz-content-sha256:${digest}\nx-amz-date:${date}\n`, signed, digest].join("\n")
  const scope = `${day}/${config.region}/s3/aws4_request`
  const signingKey = hmac(hmac(hmac(hmac("AWS4" + secret, day), config.region), "s3"), "aws4_request")
  const signature = hmac(signingKey, `AWS4-HMAC-SHA256\n${date}\n${scope}\n${hash(canonical)}`).toString("hex")
  return { url: url.toString(), headers: { ...headers, Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, SignedHeaders=${signed}, Signature=${signature}` } }
}
export async function requestS3(config: AppSettings["backup"], secret: string, method: "HEAD" | "PUT", key = "", body: Uint8Array = new Uint8Array()) {
  const request = signedS3Request(config, secret, method, key, body)
  const response = await fetch(request.url, { method, headers: request.headers, body: method === "PUT" ? new Uint8Array(body) : undefined, redirect: "error", signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new Error(`S3 请求失败（HTTP ${response.status}），请检查服务端点、区域及存储桶权限`)
  await response.body?.cancel()
}
