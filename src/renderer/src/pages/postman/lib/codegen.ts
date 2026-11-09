import { interpolate, type KV, type RequestDraft } from "@/pages/postman/lib/model"

type Body = { type: "none" } | { type: "raw"; text: string } | { type: "urlencoded"; fields: [string, string][] } | { type: "form"; fields: [string, string][] }

export interface NormalizedRequest {
  method: string
  url: string
  headers: [string, string][]
  body: Body
}

export const SNIPPET_LANGUAGES = [
  { id: "curl", label: "cURL", editor: "shell" },
  { id: "fetch", label: "JavaScript - fetch", editor: "javascript" },
  { id: "axios", label: "JavaScript - axios", editor: "javascript" },
  { id: "python", label: "Python - requests", editor: "python" },
  { id: "http", label: "HTTP", editor: "plaintext" }
] as const

export type SnippetLanguage = (typeof SNIPPET_LANGUAGES)[number]["id"]

const base64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)))

const RAW_CONTENT_TYPE: Record<RequestDraft["rawType"], string> = { json: "application/json", text: "text/plain", html: "text/html", xml: "application/xml", javascript: "application/javascript" }

/** Resolves auth, body content-type and (optionally) environment variables into a plain request. */
export function normalizeRequest(draft: RequestDraft, vars: Record<string, string> = {}): NormalizedRequest {
  const v = (text: string) => interpolate(text, vars)
  const enabled = (list: KV[]) => list.filter((row) => row.enabled && row.key).map((row) => [v(row.key), v(row.value)] as [string, string])
  const headers = enabled(draft.headers)
  const has = (name: string) => headers.some(([key]) => key.toLowerCase() === name.toLowerCase())
  let url = v(draft.url.trim())
  if (draft.authType === "bearer" && draft.auth.token) headers.push(["Authorization", `Bearer ${v(draft.auth.token)}`])
  if (draft.authType === "basic" && draft.auth.username) headers.push(["Authorization", `Basic ${base64(`${v(draft.auth.username)}:${v(draft.auth.password)}`)}`])
  if (draft.authType === "apiKey" && draft.auth.apiKeyName && draft.auth.apiKeyValue) {
    if (draft.auth.apiKeyLocation === "query") url += `${url.includes("?") ? "&" : "?"}${encodeURIComponent(v(draft.auth.apiKeyName))}=${encodeURIComponent(v(draft.auth.apiKeyValue))}`
    else headers.push([v(draft.auth.apiKeyName), v(draft.auth.apiKeyValue)])
  }
  let body: Body = { type: "none" }
  if (draft.method !== "GET" && draft.method !== "HEAD") {
    if (draft.bodyType === "raw" && draft.bodyRaw) {
      body = { type: "raw", text: v(draft.bodyRaw) }
      if (!has("Content-Type")) headers.push(["Content-Type", RAW_CONTENT_TYPE[draft.rawType]])
    } else if (draft.bodyType === "x-www-form-urlencoded") {
      body = { type: "urlencoded", fields: enabled(draft.bodyForm) }
      if (!has("Content-Type")) headers.push(["Content-Type", "application/x-www-form-urlencoded"])
    } else if (draft.bodyType === "form-data") body = { type: "form", fields: enabled(draft.bodyForm) }
  }
  return { method: draft.method, url, headers, body }
}

const shellQuote = (text: string) => `'${text.replace(/'/g, `'\\''`)}'`
const js = (value: unknown) => JSON.stringify(value)
const py = (text: string) => JSON.stringify(text)
const encodeForm = (fields: [string, string][]) => fields.map(([k, val]) => `${encodeURIComponent(k)}=${encodeURIComponent(val)}`).join("&")

function curl(req: NormalizedRequest) {
  const lines = [`curl --location --request ${req.method} ${shellQuote(req.url)}`]
  for (const [key, value] of req.headers) lines.push(`--header ${shellQuote(`${key}: ${value}`)}`)
  if (req.body.type === "raw") lines.push(`--data-raw ${shellQuote(req.body.text)}`)
  if (req.body.type === "urlencoded") for (const [key, value] of req.body.fields) lines.push(`--data-urlencode ${shellQuote(`${key}=${value}`)}`)
  if (req.body.type === "form") for (const [key, value] of req.body.fields) lines.push(`--form ${shellQuote(`${key}=${value}`)}`)
  return lines.join(" \\\n  ")
}

function fetchSnippet(req: NormalizedRequest) {
  const out: string[] = []
  if (req.body.type === "form") {
    out.push("const formData = new FormData()")
    for (const [key, value] of req.body.fields) out.push(`formData.append(${js(key)}, ${js(value)})`)
    out.push("")
  }
  const body = req.body.type === "raw" ? js(req.body.text) : req.body.type === "urlencoded" ? js(encodeForm(req.body.fields)) : req.body.type === "form" ? "formData" : null
  out.push(`const response = await fetch(${js(req.url)}, {`, `  method: ${js(req.method)},`)
  if (req.headers.length) out.push(`  headers: ${JSON.stringify(Object.fromEntries(req.headers), null, 2).replace(/\n/g, "\n  ")},`)
  if (body) out.push(`  body: ${body},`)
  out.push("  redirect: \"follow\"", "})", "", "console.log(response.status, await response.text())")
  return out.join("\n")
}

function axiosSnippet(req: NormalizedRequest) {
  const out = ['import axios from "axios"', ""]
  if (req.body.type === "form") {
    out.push("const data = new FormData()")
    for (const [key, value] of req.body.fields) out.push(`data.append(${js(key)}, ${js(value)})`)
    out.push("")
  }
  out.push("const response = await axios.request({", `  method: ${js(req.method.toLowerCase())},`, `  url: ${js(req.url)},`)
  if (req.headers.length) out.push(`  headers: ${JSON.stringify(Object.fromEntries(req.headers), null, 2).replace(/\n/g, "\n  ")},`)
  if (req.body.type === "raw") {
    let data = js(req.body.text)
    try { data = JSON.stringify(JSON.parse(req.body.text), null, 2).replace(/\n/g, "\n  ") } catch { /* keep as string */ }
    out.push(`  data: ${data},`)
  }
  if (req.body.type === "urlencoded") out.push(`  data: new URLSearchParams(${JSON.stringify(Object.fromEntries(req.body.fields))}),`)
  if (req.body.type === "form") out.push("  data,")
  out.push("})", "", "console.log(response.status, response.data)")
  return out.join("\n")
}

function pythonSnippet(req: NormalizedRequest) {
  const out = ["import requests", "", `url = ${py(req.url)}`]
  const args = ["url"]
  if (req.headers.length) {
    out.push(`headers = {${req.headers.map(([k, val]) => `\n    ${py(k)}: ${py(val)}`).join(",")}\n}`)
    args.push("headers=headers")
  }
  if (req.body.type === "raw") {
    out.push(`payload = ${py(req.body.text)}`)
    args.push("data=payload.encode(\"utf-8\")")
  }
  if (req.body.type === "urlencoded" || req.body.type === "form") {
    out.push(`payload = {${req.body.fields.map(([k, val]) => `\n    ${py(k)}: ${py(val)}`).join(",")}\n}`)
    args.push(req.body.type === "form" ? "files={k: (None, v) for k, v in payload.items()}" : "data=payload")
  }
  out.push("", `response = requests.request(${py(req.method)}, ${args.join(", ")})`, "print(response.status_code, response.text)")
  return out.join("\n")
}

function httpSnippet(req: NormalizedRequest) {
  let target = req.url
  let host = ""
  try {
    const parsed = new URL(req.url)
    target = `${parsed.pathname}${parsed.search}`
    host = parsed.host
  } catch { /* keep the raw URL as request target */ }
  const lines = [`${req.method} ${target} HTTP/1.1`]
  if (host) lines.push(`Host: ${host}`)
  for (const [key, value] of req.headers) lines.push(`${key}: ${value}`)
  const body = req.body.type === "raw" ? req.body.text : req.body.type === "urlencoded" ? encodeForm(req.body.fields) : req.body.type === "form" ? req.body.fields.map(([k, val]) => `--boundary\nContent-Disposition: form-data; name="${k}"\n\n${val}`).join("\n") + "\n--boundary--" : ""
  return body ? `${lines.join("\n")}\n\n${body}` : lines.join("\n")
}

export function generateSnippet(language: SnippetLanguage, req: NormalizedRequest): string {
  return { curl, fetch: fetchSnippet, axios: axiosSnippet, python: pythonSnippet, http: httpSnippet }[language](req)
}
