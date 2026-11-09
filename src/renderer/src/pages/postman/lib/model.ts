import type { ApiEnvironmentRecord, ApiRequestRecord, ApiResponseData, ApiSendOptions } from "@vessel/type"
import { paramsFromUrl, splitUrl, urlWithParams } from "@/pages/postman/lib/url-params"

/** Key/value row; `type: "file"` (form-data only) means `value` is an absolute file path to upload. */
export type KV = { key: string; value: string; enabled: boolean; type?: "text" | "file" }
export type BodyType = "none" | "form-data" | "x-www-form-urlencoded" | "raw"
export type RawType = "json" | "text" | "html" | "xml" | "javascript"
export type AuthType = "none" | "bearer" | "basic" | "apiKey"

export interface AuthConfig {
  token: string
  username: string
  password: string
  apiKeyName: string
  apiKeyValue: string
  apiKeyLocation: "header" | "query"
}

export interface RequestDraft {
  savedId: string | null
  collectionId: string | null
  name: string
  method: string
  url: string
  params: KV[]
  headers: KV[]
  bodyType: BodyType
  rawType: RawType
  bodyRaw: string
  bodyForm: KV[]
  authType: AuthType
  auth: AuthConfig
  preRequest: string
  tests: string
}

export interface RequestTab {
  id: string
  draft: RequestDraft
  /** Snapshot of the last saved/loaded draft; differs from the live draft when dirty. */
  saved: string
  response: ApiResponseData | null
  loading: boolean
}

export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const

export const METHOD_COLOR: Record<string, string> = {
  GET: "text-green-600",
  POST: "text-amber-600",
  PUT: "text-blue-600",
  PATCH: "text-violet-600",
  DELETE: "text-red-600",
  HEAD: "text-teal-600",
  OPTIONS: "text-pink-600"
}

export const emptyAuth = (): AuthConfig => ({ token: "", username: "", password: "", apiKeyName: "", apiKeyValue: "", apiKeyLocation: "header" })

export const newTabId = () => `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

/** A blank request, optionally pre-filled. */
export function newDraft(partial: Partial<RequestDraft> = {}): RequestDraft {
  return {
    savedId: null,
    collectionId: null,
    name: "新请求",
    method: "GET",
    url: "",
    params: [],
    headers: [{ key: "Accept", value: "application/json", enabled: true }],
    bodyType: "none",
    rawType: "json",
    bodyRaw: "",
    bodyForm: [],
    authType: "none",
    auth: emptyAuth(),
    preRequest: "",
    tests: "",
    ...partial
  }
}

/** Stable comparison key used for the unsaved-changes marker. */
export const snapshotOf = (draft: RequestDraft) => JSON.stringify({ ...draft, savedId: undefined })

export function createTab(draft: RequestDraft = newDraft(), saved = draft.savedId ? snapshotOf(draft) : snapshotOf(newDraft())): RequestTab {
  return { id: newTabId(), draft, saved, response: null, loading: false }
}

export const isDirty = (tab: RequestTab) => snapshotOf(tab.draft) !== tab.saved

const parse = <T,>(text: string | undefined | null, fallback: T): T => {
  try { return text ? (JSON.parse(text) as T) : fallback } catch { return fallback }
}

const rows = (value: unknown): KV[] => (Array.isArray(value) ? value.filter((row) => row && typeof row === "object").map((row) => ({ key: String(row.key ?? ""), value: String(row.value ?? ""), enabled: row.enabled !== false, ...(row.type === "file" ? { type: "file" as const } : {}) })) : [])

/** Saved record → draft. Legacy records kept their query in `params`; fold it into the URL so the URL is authoritative. */
export function draftFromRecord(record: ApiRequestRecord): RequestDraft {
  const saved = rows(parse(record.params, []))
  const hasQuery = splitUrl(record.url).query !== null
  const url = hasQuery ? record.url : urlWithParams(record.url, saved)
  const isForm = record.bodyType === "form-data" || record.bodyType === "x-www-form-urlencoded"
  return newDraft({
    savedId: record.id,
    collectionId: record.collectionId,
    name: record.name,
    method: record.method.toUpperCase(),
    url,
    params: paramsFromUrl(url, saved),
    headers: rows(parse(record.headers, [])),
    bodyType: record.bodyType === "binary" ? "none" : record.bodyType,
    rawType: record.rawType ?? "json",
    bodyRaw: isForm ? "" : record.bodyContent,
    bodyForm: isForm ? rows(parse(record.bodyContent, [])) : [],
    authType: record.authType,
    auth: { ...emptyAuth(), ...parse<Partial<AuthConfig>>(record.authConfig, {}) },
    preRequest: record.preRequest ?? "",
    tests: record.tests ?? ""
  })
}

/** Draft → persisted record. */
export function draftToRecord(draft: RequestDraft, id: string): ApiRequestRecord {
  const isForm = draft.bodyType === "form-data" || draft.bodyType === "x-www-form-urlencoded"
  return {
    id,
    collectionId: draft.collectionId,
    name: draft.name.trim() || "未命名请求",
    method: draft.method,
    url: draft.url,
    headers: JSON.stringify(draft.headers),
    params: JSON.stringify(draft.params),
    bodyType: draft.bodyType,
    bodyContent: isForm ? JSON.stringify(draft.bodyForm) : draft.bodyRaw,
    rawType: draft.rawType,
    authType: draft.authType,
    authConfig: JSON.stringify(draft.auth),
    tests: draft.tests,
    preRequest: draft.preRequest,
    updatedAt: Date.now()
  }
}

/** Draft → IPC send options. The URL already carries the enabled params, so none are sent separately. */
export function draftToSendOptions(draft: RequestDraft, envVariables: Record<string, string>): ApiSendOptions {
  const isForm = draft.bodyType === "form-data" || draft.bodyType === "x-www-form-urlencoded"
  return {
    method: draft.method,
    url: draft.url.trim(),
    headers: draft.headers.filter((h) => h.key),
    params: [],
    bodyType: draft.bodyType,
    bodyContent: isForm ? JSON.stringify(draft.bodyForm) : draft.bodyRaw,
    rawType: draft.rawType,
    authType: draft.authType,
    authConfig: draft.auth,
    tests: draft.tests,
    preRequestScript: draft.preRequest,
    envVariables
  }
}

export const envRows = (env: ApiEnvironmentRecord | undefined): KV[] => rows(parse(env?.variables, []))

/** Enabled variables of an environment as a lookup map. */
export function envVarMap(env: ApiEnvironmentRecord | undefined): Record<string, string> {
  const map: Record<string, string> = {}
  for (const row of envRows(env)) if (row.enabled && row.key) map[row.key] = row.value
  return map
}

/** Applies script `envUpdates` (null = unset) to environment rows. */
export function applyEnvUpdates(current: KV[], updates: Record<string, string | null>): KV[] {
  const next = current.filter((row) => !(row.key in updates && updates[row.key] === null))
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) continue
    const row = next.find((item) => item.key === key)
    if (row) Object.assign(row, { value, enabled: true })
    else next.push({ key, value, enabled: true })
  }
  return next
}

export const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g

/** Replaces `{{var}}` placeholders, leaving unknown ones intact. */
export const interpolate = (text: string, vars: Record<string, string>) => text.replace(VARIABLE_PATTERN, (match, key: string) => vars[key] ?? match)
