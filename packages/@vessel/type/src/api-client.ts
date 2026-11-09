export interface ApiSendOptions {
  method: string
  url: string
  headers?: { key: string; value: string; enabled: boolean }[]
  params?: { key: string; value: string; enabled: boolean }[]
  bodyType?: "none" | "form-data" | "x-www-form-urlencoded" | "raw" | "binary"
  bodyContent?: string
  rawType?: "json" | "text" | "html" | "xml" | "javascript"
  authType?: "none" | "bearer" | "basic" | "apiKey"
  authConfig?: {
    token?: string
    username?: string
    password?: string
    apiKeyName?: string
    apiKeyValue?: string
    apiKeyLocation?: "header" | "query"
  }
  tests?: string
  /** Postman-style script executed before the request is built; may mutate env vars and the request. */
  preRequestScript?: string
  timeoutMs?: number
  envVariables?: Record<string, string>
  /** Attach/store cookies via the persistent cookie jar (default true). */
  useCookieJar?: boolean
}

export interface ApiTestResult {
  name: string
  passed: boolean
  error?: string
}

export interface ApiResponseData {
  status: number
  statusText: string
  headers: Record<string, string>
  cookies: string[]
  durationMs: number
  sizeBytes: number
  body: string
  contentType: string
  /** "base64" when the body is binary (e.g. images) and `body` holds base64 data. */
  bodyEncoding?: "text" | "base64"
  testResults: ApiTestResult[]
  /** Env vars changed by scripts: string = set, null = unset. */
  envUpdates?: Record<string, string | null>
  /** console.* output captured from scripts. */
  logs?: string[]
  /** Final request after scripts and interpolation. */
  request?: { method: string; url: string; headers: Record<string, string> }
}

export interface ApiCookieRecord {
  domain: string
  path: string
  name: string
  value: string
  expires: number | null
  secure: boolean
  httpOnly: boolean
}

export interface ApiRunResult {
  total: number
  passed: number
  failed: number
  results: { name: string; url: string; status: number; durationMs: number; passed: boolean; testResults: ApiTestResult[] }[]
  envUpdates: Record<string, string | null>
}

export interface ApiImportPayload {
  collections: { id: string; name: string; parentId: string | null }[]
  requests: ApiRequestRecord[]
}

export interface ApiOrderItem {
  kind: "collection" | "request"
  id: string
  parentId: string | null
  sortOrder: number
}

export interface ApiCollectionRecord {
  id: string
  name: string
  parentId: string | null
  createdAt: number
  sortOrder?: number
}

export interface ApiRequestRecord {
  id: string
  collectionId: string | null
  name: string
  method: string
  url: string
  headers: string // JSON: { key, value, enabled, description }[]
  params: string // JSON: { key, value, enabled, description }[]
  bodyType: "none" | "form-data" | "x-www-form-urlencoded" | "raw" | "binary"
  bodyContent: string // text, JSON, or form fields JSON
  rawType?: "json" | "text" | "html" | "xml" | "javascript"
  authType: "none" | "bearer" | "basic" | "apiKey"
  authConfig: string // JSON
  tests: string // test assertion code / script
  preRequest?: string
  sortOrder?: number
  updatedAt: number
}

export interface ApiHistoryRecord {
  id: number
  method: string
  url: string
  status: number
  statusText: string
  durationMs: number
  sizeBytes: number
  requestData: string // JSON snapshot of request
  responsePreview?: string
  createdAt: number
}

export interface ApiEnvironmentRecord {
  id: string
  name: string
  variables: string // JSON: { key, value, enabled }[]
  isActive: boolean
}
