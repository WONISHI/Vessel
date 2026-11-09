import { type ApiClientStore } from "@main/modules/api-client/store"
import { cookieHeaderFor, parseSetCookie } from "@main/modules/api-client/cookie-jar"
import { runApiScript, type ScriptRequest } from "@main/modules/api-client/script-runner"
import type { ApiRequestRecord, ApiResponseData, ApiRunResult, ApiSendOptions, ApiTestResult } from "@vessel/type/api-client"
export type { ApiResponseData, ApiSendOptions, ApiTestResult } from "@vessel/type/api-client"

/** 替换字符串中的 {{variable}} 为对应的值 */
export function interpolateVariables(template: string, vars: Record<string, string>): string {
  if (!template) return ""
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    return vars[key] !== undefined ? vars[key] : `{{${key}}}`
  })
}

const BINARY_TYPE = /^(image|audio|video)\/|application\/(pdf|zip|octet-stream|gzip)/i
const parseJson = <T,>(text: string | undefined, fallback: T): T => {
  try { return text ? (JSON.parse(text) as T) : fallback } catch { return fallback }
}

export class ApiClientService {
  /** Initializes the instance and its required dependencies. */
  constructor(private store: ApiClientStore) {}

  /** Sends request. */
  async sendRequest(options: ApiSendOptions): Promise<ApiResponseData> {
    const vars = { ...(options.envVariables || {}) }
    const envUpdates: Record<string, string | null> = {}
    const logs: string[] = []
    const testResults: ApiTestResult[] = []
    const draft: ScriptRequest = { method: (options.method || "GET").toUpperCase(), url: options.url.trim(), headers: {} }
    for (const h of options.headers || []) if (h.enabled && h.key) draft.headers[h.key] = h.value

    const pre = runApiScript(options.preRequestScript || "", { vars, envUpdates, request: draft })
    logs.push(...pre.logs)
    testResults.push(...pre.tests)
    if (pre.error) testResults.push({ name: "Pre-request Script", passed: false, error: pre.error })

    const method = draft.method
    let rawUrl = interpolateVariables(draft.url, vars)
    if (!/^https?:\/\//i.test(rawUrl)) rawUrl = `https://${rawUrl}`
    let urlObj: URL
    try {
      urlObj = new URL(rawUrl)
    } catch {
      return this.failure(options, method, rawUrl, `无效的 URL：${rawUrl}`, "Invalid URL", 0, { testResults, envUpdates, logs, headers: {} })
    }

    for (const p of options.params || []) {
      if (p.enabled && p.key) urlObj.searchParams.append(interpolateVariables(p.key, vars), interpolateVariables(p.value, vars))
    }

    const reqHeaders: Record<string, string> = {}
    for (const [key, value] of Object.entries(draft.headers)) reqHeaders[interpolateVariables(key, vars)] = interpolateVariables(value, vars)
    const hasHeader = (name: string) => Object.keys(reqHeaders).some((key) => key.toLowerCase() === name.toLowerCase())

    if (options.authType === "bearer" && options.authConfig?.token) {
      reqHeaders["Authorization"] = `Bearer ${interpolateVariables(options.authConfig.token, vars)}`
    } else if (options.authType === "basic" && options.authConfig?.username) {
      const u = interpolateVariables(options.authConfig.username, vars)
      const p = interpolateVariables(options.authConfig.password || "", vars)
      reqHeaders["Authorization"] = `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`
    } else if (options.authType === "apiKey" && options.authConfig?.apiKeyName && options.authConfig?.apiKeyValue) {
      const keyName = interpolateVariables(options.authConfig.apiKeyName, vars)
      const keyValue = interpolateVariables(options.authConfig.apiKeyValue, vars)
      if (options.authConfig.apiKeyLocation === "query") urlObj.searchParams.append(keyName, keyValue)
      else reqHeaders[keyName] = keyValue
    }

    let bodyData: BodyInit | undefined = undefined
    if (method !== "GET" && method !== "HEAD") {
      if (options.bodyType === "raw") {
        bodyData = interpolateVariables(options.bodyContent || "", vars)
        if (!hasHeader("Content-Type")) {
          reqHeaders["Content-Type"] = options.rawType === "json" ? "application/json; charset=utf-8" : options.rawType === "html" ? "text/html; charset=utf-8" : options.rawType === "xml" ? "application/xml; charset=utf-8" : options.rawType === "javascript" ? "application/javascript; charset=utf-8" : "text/plain; charset=utf-8"
        }
      } else if (options.bodyType === "x-www-form-urlencoded" || options.bodyType === "form-data") {
        const fields = parseJson<{ key: string; value: string; enabled: boolean }[]>(options.bodyContent, [])
        if (options.bodyType === "form-data") {
          const form = new FormData()
          for (const f of fields) if (f.enabled && f.key) form.append(interpolateVariables(f.key, vars), interpolateVariables(f.value, vars))
          bodyData = form
        } else {
          const usp = new URLSearchParams()
          for (const f of fields) if (f.enabled && f.key) usp.append(interpolateVariables(f.key, vars), interpolateVariables(f.value, vars))
          bodyData = usp.toString()
          if (!hasHeader("Content-Type")) reqHeaders["Content-Type"] = "application/x-www-form-urlencoded"
        }
      }
    }

    if (options.useCookieJar !== false && !hasHeader("Cookie")) {
      const cookie = cookieHeaderFor(this.store.listCookies(), urlObj)
      if (cookie) reqHeaders["Cookie"] = cookie
    }

    const startTime = Date.now()
    const controller = new AbortController()
    const timeoutMs = options.timeoutMs || 30000
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const finalRequest = { method, url: urlObj.toString(), headers: { ...reqHeaders } }

    try {
      const response = await fetch(finalRequest.url, { method, headers: reqHeaders, body: bodyData, signal: controller.signal })
      const resHeaders: Record<string, string> = {}
      response.headers.forEach((val, key) => {
        resHeaders[key] = val
      })
      const cookies = response.headers.getSetCookie?.() ?? []
      if (options.useCookieJar !== false && cookies.length) {
        this.store.saveCookies(cookies.map((header) => parseSetCookie(header, new URL(response.url || finalRequest.url))).filter((item) => item !== null))
      }
      const contentType = response.headers.get("content-type") || ""
      const binary = BINARY_TYPE.test(contentType)
      const buffer = Buffer.from(await response.arrayBuffer())
      clearTimeout(timeout)
      const durationMs = Date.now() - startTime
      const textBody = binary ? buffer.toString("base64") : buffer.toString("utf-8")

      const tests = runApiScript(options.tests || "", {
        vars,
        envUpdates,
        request: finalRequest,
        response: { code: response.status, status: response.statusText, responseTime: durationMs, headers: resHeaders, body: binary ? "" : textBody }
      })
      logs.push(...tests.logs)
      testResults.push(...tests.tests)
      if (tests.error) testResults.push({ name: "Script Execution", passed: false, error: tests.error })

      this.store.addHistory({
        method,
        url: finalRequest.url,
        status: response.status,
        statusText: response.statusText,
        durationMs,
        sizeBytes: buffer.byteLength,
        requestData: JSON.stringify(options),
        responsePreview: binary ? `[binary ${contentType}]` : textBody.slice(0, 500),
        createdAt: Date.now()
      })

      return {
        status: response.status,
        statusText: response.statusText,
        headers: resHeaders,
        cookies,
        durationMs,
        sizeBytes: buffer.byteLength,
        body: textBody,
        bodyEncoding: binary ? "base64" : "text",
        contentType,
        testResults,
        envUpdates,
        logs,
        request: finalRequest
      }
    } catch (err: any) {
      clearTimeout(timeout)
      const isAbort = err.name === "AbortError"
      const message = isAbort ? `请求超时 (${timeoutMs}ms)` : err.cause?.message ? `${err.message}: ${err.cause.message}` : err.message || String(err)
      return this.failure(options, method, finalRequest.url, message, isAbort ? "Timeout" : "Error", Date.now() - startTime, { testResults, envUpdates, logs, headers: reqHeaders, vars })
    }
  }

  /** Builds (and records) a failed response, still running the tests script against it. */
  private failure(options: ApiSendOptions, method: string, url: string, message: string, statusText: string, durationMs: number, context: { testResults: ApiTestResult[]; envUpdates: Record<string, string | null>; logs: string[]; headers: Record<string, string>; vars?: Record<string, string> }): ApiResponseData {
    const tests = runApiScript(options.tests || "", {
      vars: context.vars ?? { ...(options.envVariables || {}) },
      envUpdates: context.envUpdates,
      request: { method, url, headers: context.headers },
      response: { code: 0, status: statusText, responseTime: durationMs, headers: {}, body: message }
    })
    context.logs.push(...tests.logs)
    context.testResults.push(...tests.tests)
    if (tests.error) context.testResults.push({ name: "Script Execution", passed: false, error: tests.error })
    const sizeBytes = Buffer.byteLength(message, "utf-8")
    this.store.addHistory({ method, url, status: 0, statusText, durationMs, sizeBytes, requestData: JSON.stringify(options), responsePreview: message, createdAt: Date.now() })
    return { status: 0, statusText, headers: {}, cookies: [], durationMs, sizeBytes, body: message, bodyEncoding: "text", contentType: "text/plain", testResults: context.testResults, envUpdates: context.envUpdates, logs: context.logs, request: { method, url, headers: context.headers } }
  }

  /** Requests of a collection and all its sub-folders, in tree order. */
  private collectRequests(collectionId: string): ApiRequestRecord[] {
    const collections = this.store.listCollections()
    const requests = this.store.listRequests()
    const walk = (id: string): ApiRequestRecord[] => [
      ...requests.filter((item) => item.collectionId === id),
      ...collections.filter((item) => item.parentId === id).flatMap((item) => walk(item.id))
    ]
    return walk(collectionId)
  }

  /** 集合批量运行 (Collection Runner)：按树顺序执行，脚本设置的变量在后续请求中生效 */
  async runCollection(collectionId: string, envVariables: Record<string, string> = {}): Promise<ApiRunResult> {
    const requests = this.collectRequests(collectionId)
    const vars = { ...envVariables }
    const envUpdates: Record<string, string | null> = {}
    const results: ApiRunResult["results"] = []
    for (const req of requests) {
      const res = await this.sendRequest({
        method: req.method,
        url: req.url,
        headers: parseJson(req.headers, []),
        params: req.url.includes("?") ? [] : parseJson(req.params, []),
        bodyType: req.bodyType,
        bodyContent: req.bodyContent,
        rawType: req.rawType,
        authType: req.authType,
        authConfig: parseJson(req.authConfig, {}),
        tests: req.tests,
        preRequestScript: req.preRequest,
        envVariables: vars
      })
      for (const [key, value] of Object.entries(res.envUpdates || {})) {
        envUpdates[key] = value
        if (value === null) delete vars[key]
        else vars[key] = value
      }
      const passed = res.testResults.length === 0 ? res.status >= 200 && res.status < 400 : res.testResults.every((t) => t.passed)
      results.push({ name: req.name, url: req.url, status: res.status, durationMs: res.durationMs, passed, testResults: res.testResults })
    }
    const passed = results.filter((item) => item.passed).length
    return { total: requests.length, passed, failed: results.length - passed, results, envUpdates }
  }
}
