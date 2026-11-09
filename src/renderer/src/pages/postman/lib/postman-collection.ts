import type { ApiCollectionRecord, ApiImportPayload, ApiRequestRecord } from "@vessel/type"
import { draftFromRecord, draftToRecord, emptyAuth, newDraft, type KV, type RequestDraft } from "@/pages/postman/lib/model"
import { paramsFromUrl } from "@/pages/postman/lib/url-params"

const SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"

type PostmanKV = { key?: string; value?: unknown; disabled?: boolean; type?: string; src?: unknown }
type PostmanItem = { name?: string; item?: PostmanItem[]; request?: PostmanRequest | string; event?: { listen?: string; script?: { exec?: string | string[] } }[] }
type PostmanRequest = {
  method?: string
  url?: string | { raw?: string; protocol?: string; host?: string | string[]; path?: string | string[]; query?: PostmanKV[] }
  header?: PostmanKV[] | string
  body?: { mode?: string; raw?: string; urlencoded?: PostmanKV[]; formdata?: PostmanKV[]; options?: { raw?: { language?: string } } }
  auth?: { type?: string; [key: string]: unknown }
}

export interface ImportedEnvironment {
  name: string
  variables: KV[]
}

export type ImportResult = { kind: "collection"; payload: ApiImportPayload; name: string; environment?: ImportedEnvironment; count: number } | { kind: "environment"; environment: ImportedEnvironment }

const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
const toRows = (list: PostmanKV[] | undefined): KV[] => (Array.isArray(list) ? list.filter((row) => row.type !== "file").map((row) => ({ key: String(row.key ?? ""), value: String(row.value ?? ""), enabled: !row.disabled })) : [])
const authValue = (list: unknown, key: string) => (Array.isArray(list) ? String((list as PostmanKV[]).find((row) => row.key === key)?.value ?? "") : "")
const script = (item: PostmanItem, listen: string) => {
  const exec = item.event?.find((event) => event.listen === listen)?.script?.exec
  return Array.isArray(exec) ? exec.join("\n") : (exec ?? "")
}

function urlOf(url: PostmanRequest["url"]): string {
  if (!url) return ""
  if (typeof url === "string") return url
  if (url.raw) return url.raw
  const host = Array.isArray(url.host) ? url.host.join(".") : (url.host ?? "")
  const path = Array.isArray(url.path) ? url.path.join("/") : (url.path ?? "")
  const query = toRows(url.query).filter((row) => row.enabled).map((row) => (row.value ? `${row.key}=${row.value}` : row.key)).join("&")
  return `${url.protocol ? `${url.protocol}://` : ""}${host}${path ? `/${path}` : ""}${query ? `?${query}` : ""}`
}

function draftOf(item: PostmanItem, collectionId: string): RequestDraft {
  const request: PostmanRequest = typeof item.request === "string" ? { url: item.request } : (item.request ?? {})
  const url = urlOf(request.url)
  const disabledQuery = typeof request.url === "object" ? toRows(request.url.query).filter((row) => !row.enabled) : []
  const draft = newDraft({ collectionId, name: item.name || url || "未命名请求", method: (request.method || "GET").toUpperCase(), url, params: paramsFromUrl(url, disabledQuery), headers: Array.isArray(request.header) ? toRows(request.header) : [], preRequest: script(item, "prerequest"), tests: script(item, "test") })
  const body = request.body
  if (body?.mode === "raw") {
    const language = body.options?.raw?.language
    Object.assign(draft, { bodyType: "raw", bodyRaw: body.raw ?? "", rawType: language === "json" || language === "html" || language === "xml" || language === "javascript" ? language : language === "text" ? "text" : "json" })
  } else if (body?.mode === "urlencoded") Object.assign(draft, { bodyType: "x-www-form-urlencoded", bodyForm: toRows(body.urlencoded) })
  else if (body?.mode === "formdata") Object.assign(draft, { bodyType: "form-data", bodyForm: toRows(body.formdata) })
  const auth = request.auth
  if (auth?.type === "bearer") Object.assign(draft, { authType: "bearer", auth: { ...emptyAuth(), token: authValue(auth.bearer, "token") } })
  else if (auth?.type === "basic") Object.assign(draft, { authType: "basic", auth: { ...emptyAuth(), username: authValue(auth.basic, "username"), password: authValue(auth.basic, "password") } })
  else if (auth?.type === "apikey") Object.assign(draft, { authType: "apiKey", auth: { ...emptyAuth(), apiKeyName: authValue(auth.apikey, "key"), apiKeyValue: authValue(auth.apikey, "value"), apiKeyLocation: authValue(auth.apikey, "in") === "query" ? "query" : "header" } })
  return draft
}

/** Parses a Postman v2/v2.1 collection or a Postman environment export. */
export function importPostman(json: unknown): ImportResult {
  const data = json as { info?: { name?: string; schema?: string }; item?: PostmanItem[]; variable?: PostmanKV[]; name?: string; values?: PostmanKV[] }
  if (data && Array.isArray(data.values) && !data.item) return { kind: "environment", environment: { name: data.name || "导入的环境", variables: toRows(data.values) } }
  if (!data || !Array.isArray(data.item)) throw new Error("不是有效的 Postman Collection（缺少 item）")
  const payload: ApiImportPayload = { collections: [], requests: [] }
  const name = data.info?.name || "导入的集合"
  const rootId = uid("col")
  payload.collections.push({ id: rootId, name, parentId: null })
  const walk = (items: PostmanItem[], parentId: string) => {
    items.forEach((item, index) => {
      if (Array.isArray(item.item)) {
        const id = uid("col")
        payload.collections.push({ id, name: item.name || "文件夹", parentId })
        walk(item.item, id)
      } else payload.requests.push({ ...draftToRecord(draftOf(item, parentId), uid("req")), sortOrder: index })
    })
  }
  walk(data.item, rootId)
  const variables = toRows(data.variable)
  return { kind: "collection", payload, name, count: payload.requests.length, environment: variables.length ? { name: `${name} 变量`, variables } : undefined }
}

const kvOut = (rows: KV[]) => rows.filter((row) => row.key).map((row) => ({ key: row.key, value: row.value, ...(row.enabled ? {} : { disabled: true }) }))
const exec = (text: string) => text.split("\n")

function requestOut(record: ApiRequestRecord) {
  const draft = draftFromRecord(record)
  const events = [
    ...(draft.preRequest.trim() ? [{ listen: "prerequest", script: { type: "text/javascript", exec: exec(draft.preRequest) } }] : []),
    ...(draft.tests.trim() ? [{ listen: "test", script: { type: "text/javascript", exec: exec(draft.tests) } }] : [])
  ]
  const body =
    draft.bodyType === "raw" ? { mode: "raw", raw: draft.bodyRaw, options: { raw: { language: draft.rawType } } } : draft.bodyType === "x-www-form-urlencoded" ? { mode: "urlencoded", urlencoded: kvOut(draft.bodyForm) } : draft.bodyType === "form-data" ? { mode: "formdata", formdata: kvOut(draft.bodyForm).map((row) => ({ ...row, type: "text" })) } : undefined
  const auth =
    draft.authType === "bearer" ? { type: "bearer", bearer: [{ key: "token", value: draft.auth.token, type: "string" }] } : draft.authType === "basic" ? { type: "basic", basic: [{ key: "username", value: draft.auth.username, type: "string" }, { key: "password", value: draft.auth.password, type: "string" }] } : draft.authType === "apiKey" ? { type: "apikey", apikey: [{ key: "key", value: draft.auth.apiKeyName, type: "string" }, { key: "value", value: draft.auth.apiKeyValue, type: "string" }, { key: "in", value: draft.auth.apiKeyLocation, type: "string" }] } : undefined
  return {
    name: draft.name,
    ...(events.length ? { event: events } : {}),
    request: { method: draft.method, header: kvOut(draft.headers), ...(body ? { body } : {}), ...(auth ? { auth } : {}), url: { raw: draft.url, query: kvOut(draft.params) } }
  }
}

/** Exports a collection (with sub-folders) as Postman Collection v2.1 JSON. */
export function exportPostman(collectionId: string, collections: ApiCollectionRecord[], requests: ApiRequestRecord[]) {
  const root = collections.find((item) => item.id === collectionId)
  if (!root) throw new Error("集合不存在")
  const items = (parentId: string): unknown[] => [
    ...collections.filter((item) => item.parentId === parentId).map((folder) => ({ name: folder.name, item: items(folder.id) })),
    ...requests.filter((item) => item.collectionId === parentId).map(requestOut)
  ]
  return { info: { _postman_id: crypto.randomUUID(), name: root.name, schema: SCHEMA }, item: items(collectionId) }
}
