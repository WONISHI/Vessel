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
  timeoutMs?: number
  envVariables?: Record<string, string>
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
  testResults: ApiTestResult[]
}

export interface ApiCollectionRecord {
  id: string
  name: string
  parentId: string | null
  createdAt: number
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
